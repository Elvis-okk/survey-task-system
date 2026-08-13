const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');
const { getQueries } = require('../database');
const { requireAuth, requireRole } = require('../middleware');

// 文件上传配置
const upload = multer({ storage: multer.memoryStorage() });

// ========== 任务导出 ==========
// GET /api/export/tasks - 导出所有任务为xlsx
router.get('/tasks', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { taskQueries, villageQueries, userQueries, tagQueries, insuranceQueries } = getQueries();

    // 获取所有任务
    const tasks = taskQueries.getList({ task_category: 'pending_survey', limit: 99999 });
    const processingTasks = taskQueries.getList({ task_category: 'processing', limit: 99999 });
    const completedTasks = taskQueries.getCompleted({});
    const allTasks = [...tasks, ...processingTasks, ...completedTasks];

    // 获取辅助数据
    const villages = villageQueries.getAll();
    const users = userQueries.getAll();
    const tags = tagQueries.getAll();
    const insurances = insuranceQueries.getAll();

    // 创建辅助映射
    const villageMap = {};
    villages.forEach(v => { villageMap[v.id] = v.name; });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.display_name || u.username; });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '查勘任务管理系统';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('任务列表', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // 表头
    const headers = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '发布时间', key: 'publish_time', width: 18 },
      { header: '标签', key: 'tag', width: 12 },
      { header: '村社区', key: 'village_name', width: 12 },
      { header: '地址', key: 'address', width: 20 },
      { header: '联系人', key: 'contact_person', width: 10 },
      { header: '联系电话', key: 'contact_phone', width: 14 },
      { header: '购买信息', key: 'purchase_info', width: 15 },
      { header: '有否买和谐', key: 'has_harmony_text', width: 10 },
      { header: '出险情况', key: 'insurance_name', width: 12 },
      { header: '备注', key: 'remark', width: 20 },
      { header: '查勘状态', key: 'survey_status_text', width: 10 },
      { header: '查勘备注', key: 'survey_remark', width: 15 },
      { header: '处理状态', key: 'process_status_text', width: 10 },
      { header: '处理备注', key: 'process_remark', width: 15 },
      { header: '理赔金额', key: 'claim_amount', width: 12 },
      { header: '发布者', key: 'creator_name', width: 10 },
      { header: '查勘员', key: 'assignee_name', width: 10 },
      { header: '创建时间', key: 'created_at', width: 18 },
      { header: '查勘时间', key: 'surveyed_at', width: 18 },
      { header: '提交时间', key: 'submitted_at', width: 18 },
      { header: '完成时间', key: 'completed_at', width: 18 },
      { header: '是否归档', key: 'is_archived_text', width: 10 }
    ];

    sheet.columns = headers;

    // 表头样式
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // 状态映射
    const surveyStatusMap = { 'not_surveyed': '未查勘', 'surveyed': '已查勘' };
    const processStatusMap = { 'pending': '待处理', 'resurvey': '需复勘', 'missing_docs': '缺件', 'submitted': '已提交', 'rejected': '拒赔' };

    // 填充数据
    allTasks.forEach(task => {
      sheet.addRow({
        id: task.id,
        publish_time: task.publish_time || '',
        tag: task.tag || '',
        village_name: task.village_name || villageMap[task.village_id] || '',
        address: task.address || '',
        contact_person: task.contact_person || '',
        contact_phone: task.contact_phone || '',
        purchase_info: task.purchase_info || '',
        has_harmony_text: task.has_harmony ? '是' : '否',
        insurance_name: task.insurance_name || '',
        remark: task.remark || '',
        survey_status_text: surveyStatusMap[task.survey_status] || task.survey_status || '',
        survey_remark: task.survey_remark || '',
        process_status_text: processStatusMap[task.process_status] || task.process_status || '',
        process_remark: task.process_remark || '',
        claim_amount: task.claim_amount || '',
        creator_name: task.creator_name || userMap[task.created_by] || '',
        assignee_name: task.assignee_name || userMap[task.assigned_to] || '',
        created_at: task.created_at || '',
        surveyed_at: task.surveyed_at || '',
        submitted_at: task.submitted_at || '',
        completed_at: task.completed_at || '',
        is_archived_text: task.is_archived ? '是' : '否'
      });
    });

    // 边框
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('导出任务错误:', err);
    res.status(500).json({ code: 500, data: null, message: '导出失败: ' + err.message });
  }
});

// ========== 任务导入 ==========
// POST /api/export/tasks/import - 从xlsx导入任务
router.post('/tasks/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ code: 400, data: null, message: '请选择文件' });
    }

    const { taskQueries, villageQueries, userQueries } = getQueries();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.read(req.file.buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.json({ code: 400, data: null, message: '文件中没有工作表' });
    }

    // 获取辅助数据
    const villages = villageQueries.getAll();
    const villageNameMap = {};
    villages.forEach(v => { villageNameMap[v.name] = v.id; });
    const users = userQueries.getAll();
    const userNameMap = {};
    users.forEach(u => { userNameMap[u.display_name || u.username] = u.id; });

    // 状态反向映射
    const surveyStatusReverse = { '未查勘': 'not_surveyed', '已查勘': 'surveyed' };
    const processStatusReverse = { '待处理': 'pending', '需复勘': 'resurvey', '缺件': 'missing_docs', '已提交': 'submitted', '拒赔': 'rejected' };

    let imported = 0;
    let skipped = 0;
    const errors = [];

    // 跳过表头行
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      try {
        const publishTime = row.getCell(2).value || new Date().toISOString().slice(0, 16);
        const tag = row.getCell(3).value || '';
        const villageName = row.getCell(4).value || '';
        const address = row.getCell(5).value || '';
        const contactPerson = row.getCell(6).value || '';
        const contactPhone = row.getCell(7).value || '';
        const purchaseInfo = row.getCell(8).value || '';
        const hasHarmonyText = row.getCell(9).value || '是';
        const insuranceName = row.getCell(10).value || '';
        const remark = row.getCell(11).value || '';

        if (!address) {
          skipped++;
          continue;
        }

        const villageId = villageNameMap[villageName] || null;
        const hasHarmony = hasHarmonyText === '否' ? 0 : 1;

        // 查找查勘员
        const assigneeName = row.getCell(17).value || '';
        const assignedTo = userNameMap[assigneeName] || null;

        taskQueries.create(
          '', publishTime, tag, villageId, address,
          contactPerson, contactPhone, purchaseInfo, remark,
          null, // insurance_id - 需要名称映射，暂设null
          hasHarmony,
          req.user.id,
          assignedTo
        );
        imported++;
      } catch (err) {
        errors.push(`第${i}行: ${err.message}`);
        skipped++;
      }
    }

    res.json({
      code: 0,
      data: { imported, skipped, errors: errors.slice(0, 10) },
      message: `导入完成：成功${imported}条，跳过${skipped}条`
    });
  } catch (err) {
    console.error('导入任务错误:', err);
    res.json({ code: 500, data: null, message: '导入失败: ' + err.message });
  }
});

// ========== 系统配置导出 ==========
// GET /api/export/config - 导出系统配置和用户设置为xlsx
router.get('/config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userQueries, villageQueries, tagQueries, insuranceQueries, settingQueries } = getQueries();
    const { getDb } = require('../database');
    const database = await getDb();

    const users = userQueries.getAll();
    // 获取用户密码（getAll不返回password字段）
    const userPasswords = {};
    const allUsersRaw = database.prepare('SELECT id, password FROM users').all();
    allUsersRaw.forEach(u => { userPasswords[u.id] = u.password; });

    const villages = villageQueries.getAll();
    const tags = tagQueries.getAll();
    const insurances = insuranceQueries.getAll();
    const settings = settingQueries.getAll();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '查勘任务管理系统';
    workbook.created = new Date();

    // 用户表
    const userSheet = workbook.addWorksheet('用户', { views: [{ state: 'frozen', ySplit: 1 }] });
    userSheet.columns = [
      { header: '用户名', key: 'username', width: 15 },
      { header: '密码(哈希)', key: 'password', width: 60 },
      { header: '显示名', key: 'display_name', width: 15 },
      { header: '角色', key: 'role_text', width: 10 },
      { header: '负责村社区IDs', key: 'village_ids', width: 15 },
      { header: '可发布', key: 'can_publish_text', width: 8 },
      { header: '可修改', key: 'can_edit_text', width: 8 },
      { header: '可处理', key: 'can_process_text', width: 8 },
      { header: '状态', key: 'is_active_text', width: 8 }
    ];
    const roleMap = { 'admin': '管理员', 'surveyor': '查勘员', 'publisher': '发布者' };
    users.forEach(u => {
      userSheet.addRow({
        username: u.username,
        password: userPasswords[u.id] || '',
        display_name: u.display_name || '',
        role_text: roleMap[u.role] || u.role,
        village_ids: u.village_ids || '',
        can_publish_text: u.can_publish ? '是' : '否',
        can_edit_text: u.can_edit ? '是' : '否',
        can_process_text: u.can_process ? '是' : '否',
        is_active_text: u.is_active !== 0 ? '启用' : '禁用'
      });
    });
    styleSheet(userSheet);

    // 村社区表
    const villageSheet = workbook.addWorksheet('村社区', { views: [{ state: 'frozen', ySplit: 1 }] });
    villageSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '名称', key: 'name', width: 20 },
      { header: '负责人ID', key: 'leader_id', width: 10 },
      { header: '负责人', key: 'leader_name', width: 15 },
      { header: '联系电话', key: 'contact_phone', width: 15 }
    ];
    villages.forEach(v => {
      villageSheet.addRow({
        id: v.id,
        name: v.name,
        leader_id: v.leader_id || '',
        leader_name: v.leader_name || '',
        contact_phone: v.contact_phone || ''
      });
    });
    styleSheet(villageSheet);

    // 标签表
    const tagSheet = workbook.addWorksheet('标签', { views: [{ state: 'frozen', ySplit: 1 }] });
    tagSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '名称', key: 'name', width: 20 },
      { header: '颜色', key: 'color', width: 12 }
    ];
    tags.forEach(t => {
      tagSheet.addRow({ id: t.id, name: t.name, color: t.color || '' });
    });
    styleSheet(tagSheet);

    // 出险情况表
    const insuranceSheet = workbook.addWorksheet('出险情况', { views: [{ state: 'frozen', ySplit: 1 }] });
    insuranceSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '名称', key: 'name', width: 20 },
      { header: '描述', key: 'description', width: 30 }
    ];
    insurances.forEach(i => {
      insuranceSheet.addRow({ id: i.id, name: i.name, description: i.description || '' });
    });
    styleSheet(insuranceSheet);

    // 系统设置表
    const settingSheet = workbook.addWorksheet('系统设置', { views: [{ state: 'frozen', ySplit: 1 }] });
    settingSheet.columns = [
      { header: '键', key: 'key', width: 25 },
      { header: '值', key: 'value', width: 30 }
    ];
    settings.forEach(s => {
      settingSheet.addRow({ key: s.key, value: s.value || '' });
    });
    styleSheet(settingSheet);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=config_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('导出配置错误:', err);
    res.status(500).json({ code: 500, data: null, message: '导出失败: ' + err.message });
  }
});

// ========== 系统配置导入 ==========
// POST /api/export/config/import - 从xlsx导入系统配置和用户设置
router.post('/config/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ code: 400, data: null, message: '请选择文件' });
    }

    const { userQueries, villageQueries, tagQueries, insuranceQueries, settingQueries } = getQueries();
    const bcrypt = require('bcryptjs');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.read(req.file.buffer);

    const result = { users: 0, villages: 0, tags: 0, insurances: 0, settings: 0, errors: [] };

    // 导入村社区（先导入，因为用户依赖村社区）
    const villageSheet = workbook.worksheets.find(s => s.name === '村社区');
    if (villageSheet) {
      const existingVillages = villageQueries.getAll();
      const existingNames = new Set(existingVillages.map(v => v.name));
      for (let i = 2; i <= villageSheet.rowCount; i++) {
        try {
          const row = villageSheet.getRow(i);
          const name = row.getCell(2).value || '';
          const leaderId = row.getCell(3).value || null;
          const phone = row.getCell(5).value || '';
          if (!name || existingNames.has(name)) continue;
          villageQueries.create(name, leaderId, phone);
          result.villages++;
        } catch (err) {
          result.errors.push(`村社区第${i}行: ${err.message}`);
        }
      }
    }

    // 导入用户
    const userSheet = workbook.worksheets.find(s => s.name === '用户');
    if (userSheet) {
      const roleReverse = { '管理员': 'admin', '查勘员': 'surveyor', '发布者': 'publisher' };
      for (let i = 2; i <= userSheet.rowCount; i++) {
        try {
          const row = userSheet.getRow(i);
          const username = row.getCell(1).value || '';
          const passwordHash = row.getCell(2).value || ''; // 密码(哈希)列
          const displayName = row.getCell(3).value || '';
          const roleText = row.getCell(4).value || '';
          const villageIds = row.getCell(5).value || '';
          const canPublish = row.getCell(6).value === '是' ? 1 : 0;
          const canEdit = row.getCell(7).value === '是' ? 1 : 0;
          const canProcess = row.getCell(8).value === '是' ? 1 : 0;
          if (!username) continue;
          // 检查用户是否已存在
          const existing = userQueries.getByUsername(username);
          if (existing) {
            // 更新已有用户（如有密码哈希则更新密码）
            userQueries.updateWithUsername(username, displayName || existing.display_name, roleReverse[roleText] || existing.role, villageIds, canPublish, canEdit, canProcess, existing.id);
            if (passwordHash && passwordHash.startsWith('$2')) {
              userQueries.updatePassword(passwordHash, existing.id);
            }
          } else {
            // 创建新用户：如有密码哈希则使用，否则默认密码123456
            const hashedPassword = (passwordHash && passwordHash.startsWith('$2')) ? passwordHash : bcrypt.hashSync('123456', 10);
            userQueries.create(username, hashedPassword, displayName || username, roleReverse[roleText] || 'surveyor', villageIds, canPublish, canEdit, canProcess);
            result.users++;
          }
        } catch (err) {
          result.errors.push(`用户第${i}行: ${err.message}`);
        }
      }
    }

    // 导入标签
    const tagSheet = workbook.worksheets.find(s => s.name === '标签');
    if (tagSheet) {
      const existingTags = tagQueries.getAll();
      const existingNames = new Set(existingTags.map(t => t.name));
      for (let i = 2; i <= tagSheet.rowCount; i++) {
        try {
          const row = tagSheet.getRow(i);
          const name = row.getCell(2).value || '';
          const color = row.getCell(3).value || '#3B82F6';
          if (!name || existingNames.has(name)) continue;
          tagQueries.create(name, color);
          result.tags++;
        } catch (err) {
          result.errors.push(`标签第${i}行: ${err.message}`);
        }
      }
    }

    // 导入出险情况
    const insuranceSheet = workbook.worksheets.find(s => s.name === '出险情况');
    if (insuranceSheet) {
      const existingInsurances = insuranceQueries.getAll();
      const existingNames = new Set(existingInsurances.map(i => i.name));
      for (let i = 2; i <= insuranceSheet.rowCount; i++) {
        try {
          const row = insuranceSheet.getRow(i);
          const name = row.getCell(2).value || '';
          const desc = row.getCell(3).value || '';
          if (!name || existingNames.has(name)) continue;
          insuranceQueries.create(name, desc);
          result.insurances++;
        } catch (err) {
          result.errors.push(`出险情况第${i}行: ${err.message}`);
        }
      }
    }

    // 导入系统设置
    const settingSheet = workbook.worksheets.find(s => s.name === '系统设置');
    if (settingSheet) {
      for (let i = 2; i <= settingSheet.rowCount; i++) {
        try {
          const row = settingSheet.getRow(i);
          const key = row.getCell(1).value || '';
          const value = row.getCell(2).value || '';
          if (!key) continue;
          settingQueries.upsert(key, value, value);
          result.settings++;
        } catch (err) {
          result.errors.push(`设置第${i}行: ${err.message}`);
        }
      }
    }

    res.json({
      code: 0,
      data: result,
      message: `导入完成：用户${result.users}，村社区${result.villages}，标签${result.tags}，出险情况${result.insurances}，设置${result.settings}`
    });
  } catch (err) {
    console.error('导入配置错误:', err);
    res.json({ code: 500, data: null, message: '导入失败: ' + err.message });
  }
});

// 工具函数：设置工作表样式
function styleSheet(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
}

module.exports = router;