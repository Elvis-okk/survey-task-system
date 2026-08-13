const express = require('express');
const router = express.Router();
const { getQueries } = require('../database');
const { requireAuth, requireRole, requirePermission } = require('../middleware');

// 获取io实例的辅助函数
function getIo(req) {
  return req.app.get('io');
}

// 广播任务变更
function broadcastTaskChange(io, event, data) {
  if (io) {
    io.emit('task_updated', { event, data });
  }
}

// GET /api/tasks/stats - 获取任务统计数据
router.get('/stats', requireAuth, (req, res) => {
  try {
    const { taskQueries } = getQueries();
    const filters = {};
    
    // 支持按角色分开过滤
    if (req.query.assigned_to) filters.assigned_to = parseInt(req.query.assigned_to);
    if (req.query.created_by) filters.created_by = parseInt(req.query.created_by);
    if (req.query.user_id) filters.user_id = parseInt(req.query.user_id);
    
    const stats = taskQueries.getStats(filters);
    res.json({ code: 0, data: stats, message: '' });
  } catch (err) {
    console.error('获取统计数据错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// GET /api/tasks/completed - 获取已完成归档任务
router.get('/completed', requireAuth, (req, res) => {
  try {
    const { taskQueries } = getQueries();
    const filters = {
      village_id: req.query.village_id,
      tag: req.query.tag,
      keyword: req.query.keyword
    };
    const tasks = taskQueries.getCompleted(filters);
    const total = taskQueries.getCompletedCount(filters);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit || req.query.pageSize) || 20;
    const start = (page - 1) * limit;
    const pagedTasks = tasks.slice(start, start + limit);
    res.json({
      code: 0,
      data: {
        tasks: pagedTasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      message: ''
    });
  } catch (err) {
    console.error('获取已完成任务错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// GET /api/tasks - 获取任务列表
router.get('/', requireAuth, (req, res) => {
  try {
    const { taskQueries } = getQueries();
    const filters = {
      assigned_to: req.query.assigned_to,
      tag: req.query.tag,
      survey_status: req.query.survey_status,
      process_status: req.query.process_status,
      village_id: req.query.village_id,
      created_by: req.query.created_by,
      keyword: req.query.keyword,
      task_category: req.query.task_category,
      page: req.query.page || 1,
      limit: req.query.limit || req.query.pageSize || 20
    };

    const tasks = taskQueries.getList(filters);
    const total = taskQueries.getCount(filters);

    res.json({
      code: 0,
      data: {
        tasks,
        total,
        page: parseInt(filters.page),
        limit: parseInt(filters.limit),
        totalPages: Math.ceil(total / parseInt(filters.limit))
      },
      message: ''
    });
  } catch (err) {
    console.error('获取任务列表错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// POST /api/tasks - 发布新任务
router.post('/', requireAuth, requirePermission('can_publish'), (req, res) => {
  try {
    const { title, publish_time, tag, village_id, address, contact_person, contact_phone, purchase_info, remark, insurance_id, assigned_to, has_harmony } = req.body;

    if (!publish_time) {
      return res.json({ code: 400, data: null, message: '发布时间不能为空' });
    }
    if (!assigned_to) {
      return res.json({ code: 400, data: null, message: '请指派查勘员' });
    }
    if (!address || !address.trim()) {
      return res.json({ code: 400, data: null, message: '请填写详细地址' });
    }
    if (!contact_phone || !contact_phone.trim()) {
      return res.json({ code: 400, data: null, message: '请填写联系电话' });
    }

    const { taskQueries, logQueries, villageQueries } = getQueries();

    // 自动填充村/社区负责人
    let assigneeId = assigned_to || null;
    if (village_id && !assigneeId) {
      const village = villageQueries.getById(village_id);
      if (village && village.leader_id) {
        assigneeId = village.leader_id;
      }
    }

    const result = taskQueries.create(
      title || '',
      publish_time,
      tag || '',
      village_id || null,
      address || '',
      contact_person || '',
      contact_phone || '',
      purchase_info || '',
      remark || '',
      insurance_id || null,
      has_harmony ? 1 : 0,
      req.user.id,
      assigneeId
    );

    // 记录日志
    logQueries.create(result.lastInsertRowid, 'create', null, null, req.user.id);

    const io = getIo(req);
    broadcastTaskChange(io, 'task_created', { id: result.lastInsertRowid });

    res.json({ code: 0, data: { id: result.lastInsertRowid }, message: '任务发布成功' });
  } catch (err) {
    console.error('发布任务错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// GET /api/tasks/:id - 获取任务详情
router.get('/:id', requireAuth, (req, res) => {
  try {
    const { taskQueries, logQueries } = getQueries();
    const task = taskQueries.getById(req.params.id);
    if (!task) {
      return res.json({ code: 404, data: null, message: '任务不存在' });
    }

    const logs = logQueries.getByTaskId(req.params.id);

    res.json({ code: 0, data: { task, logs }, message: '' });
  } catch (err) {
    console.error('获取任务详情错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/tasks/:id - 修改任务信息
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { taskQueries, logQueries } = getQueries();
    const task = taskQueries.getById(req.params.id);
    if (!task) {
      return res.json({ code: 404, data: null, message: '任务不存在' });
    }

    // 没有修改权限的用户只能修改自己发布的任务
    if (req.user.role !== 'admin' && !req.user.can_edit && task.created_by !== req.user.id) {
      return res.json({ code: 403, data: null, message: '只能修改自己发布的任务' });
    }

    const { title, publish_time, tag, village_id, address, contact_person, contact_phone, purchase_info, remark, insurance_id, assigned_to, has_harmony } = req.body;

    taskQueries.update(
      title !== undefined ? title : task.title,
      publish_time !== undefined ? publish_time : task.publish_time,
      tag !== undefined ? tag : task.tag,
      village_id !== undefined ? village_id : task.village_id,
      address !== undefined ? address : task.address,
      contact_person !== undefined ? contact_person : task.contact_person,
      contact_phone !== undefined ? contact_phone : task.contact_phone,
      purchase_info !== undefined ? purchase_info : task.purchase_info,
      remark !== undefined ? remark : task.remark,
      insurance_id !== undefined ? insurance_id : task.insurance_id,
      has_harmony !== undefined ? (has_harmony ? 1 : 0) : task.has_harmony,
      req.params.id
    );

    // 如果修改了指派人
    if (assigned_to !== undefined && assigned_to !== task.assigned_to) {
      taskQueries.reassign(assigned_to, req.params.id);
    }

    // 记录日志
    logQueries.create(req.params.id, 'update', null, JSON.stringify(req.body), req.user.id);

    const io = getIo(req);
    broadcastTaskChange(io, 'task_updated', { id: parseInt(req.params.id) });

    res.json({ code: 0, data: null, message: '任务更新成功' });
  } catch (err) {
    console.error('修改任务错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/tasks/:id/survey - 更新查勘状态
router.put('/:id/survey', requireAuth, requirePermission('can_process'), (req, res) => {
  try {
    const { taskQueries, logQueries } = getQueries();
    const task = taskQueries.getById(req.params.id);
    if (!task) {
      return res.json({ code: 404, data: null, message: '任务不存在' });
    }

    const { survey_status, survey_remark } = req.body;
    if (!['not_surveyed', 'surveyed'].includes(survey_status)) {
      return res.json({ code: 400, data: null, message: '无效的查勘状态' });
    }

    const oldStatus = task.survey_status;
    // 标记已查勘后自动设置 process_status = 'pending'，未查勘时清空处理状态
    const processStatus = survey_status === 'surveyed' ? 'pending' : null;

    taskQueries.updateSurveyStatus(survey_status, processStatus, survey_remark || '', survey_status, req.params.id);

    logQueries.create(req.params.id, 'survey_status_change', oldStatus, survey_status, req.user.id);

    const io = getIo(req);
    broadcastTaskChange(io, 'task_survey_updated', { id: parseInt(req.params.id), survey_status });

    res.json({ code: 0, data: null, message: '查勘状态更新成功' });
  } catch (err) {
    console.error('更新查勘状态错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/tasks/:id/process - 更新处理进度
router.put('/:id/process', requireAuth, requirePermission('can_process'), (req, res) => {
  try {
    const { taskQueries, logQueries } = getQueries();
    const task = taskQueries.getById(req.params.id);
    if (!task) {
      return res.json({ code: 404, data: null, message: '任务不存在' });
    }

    // 只有已查勘的任务才能更新处理状态
    if (task.survey_status !== 'surveyed') {
      return res.json({ code: 400, data: null, message: '请先标记为已查勘再更新处理状态' });
    }

    const { process_status, process_remark } = req.body;
    if (!['pending', 'resurvey', 'missing_docs', 'submitted', 'rejected'].includes(process_status)) {
      return res.json({ code: 400, data: null, message: '无效的处理状态' });
    }

    const oldStatus = task.process_status;
    taskQueries.updateProcessStatus(process_status, process_remark || '', process_status, process_status, req.params.id);

    // 标记已提交或拒赔后自动归档
    if (process_status === 'submitted' || process_status === 'rejected') {
      taskQueries.archive(req.params.id);
    }

    logQueries.create(req.params.id, 'process_status_change', oldStatus, process_status, req.user.id);

    const io = getIo(req);
    broadcastTaskChange(io, 'task_process_updated', { id: parseInt(req.params.id), process_status });

    const statusMsg = process_status === 'submitted' ? '任务已提交并归档' : process_status === 'rejected' ? '任务已拒赔并归档' : '处理进度更新成功';
    res.json({ code: 0, data: null, message: statusMsg });
  } catch (err) {
    console.error('更新处理进度错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// DELETE /api/tasks/:id - 删除任务
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { taskQueries, logQueries } = getQueries();
    const task = taskQueries.getById(req.params.id);
    if (!task) {
      return res.json({ code: 404, data: null, message: '任务不存在' });
    }

    // 权限检查：任何登录用户都可以删除任务

    // 记录日志
    logQueries.create(req.params.id, 'delete', null, JSON.stringify({ title: task.title }), req.user.id);

    taskQueries.delete(req.params.id);

    const io = getIo(req);
    broadcastTaskChange(io, 'task_deleted', { id: parseInt(req.params.id) });

    res.json({ code: 0, data: null, message: '任务删除成功' });
  } catch (err) {
    console.error('删除任务错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/tasks/:id/reassign - 转移任务
router.put('/:id/reassign', requireAuth, (req, res) => {
  try {
    const { taskQueries, logQueries } = getQueries();
    const task = taskQueries.getById(req.params.id);
    if (!task) {
      return res.json({ code: 404, data: null, message: '任务不存在' });
    }

    const { assigned_to } = req.body;
    if (!assigned_to) {
      return res.json({ code: 400, data: null, message: '请指定负责人' });
    }

    const oldAssignee = task.assigned_to;
    taskQueries.reassign(assigned_to, req.params.id);

    logQueries.create(req.params.id, 'reassign', String(oldAssignee), String(assigned_to), req.user.id);

    const io = getIo(req);
    broadcastTaskChange(io, 'task_reassigned', { id: parseInt(req.params.id), assigned_to });

    res.json({ code: 0, data: null, message: '任务转移成功' });
  } catch (err) {
    console.error('转移任务错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

module.exports = router;