const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getQueries } = require('../database');
const { requireAuth, requireRole, requirePermission } = require('../middleware');

// GET /api/users/surveyors - 获取查勘员列表（仅需登录，用于发布任务时选择查勘员）
router.get('/surveyors', requireAuth, (req, res) => {
  try {
    const { userQueries } = getQueries();
    const allUsers = userQueries.getAll();
    // 筛选有处理权限的活跃用户（查勘员或管理员）
    const surveyors = allUsers
      .filter(u => (u.can_process || u.role === 'surveyor') && u.is_active !== 0)
      .map(u => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        role: u.role,
        village_id: u.village_id,
        village_name: u.village_name
      }));
    res.json({ code: 0, data: surveyors, message: '' });
  } catch (err) {
    console.error('获取查勘员列表错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// GET /api/users - 获取用户列表（管理员）
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { userQueries } = getQueries();
    const users = userQueries.getAll();
    // 不返回密码
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      role: u.role,
      village_id: u.village_id,
      village_name: u.village_name,
      can_publish: u.can_publish,
      can_edit: u.can_edit,
      can_process: u.can_process,
      created_at: u.created_at,
      updated_at: u.updated_at,
      is_active: u.is_active
    }));
    res.json({ code: 0, data: safeUsers, message: '' });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// POST /api/users - 创建用户（管理员）
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { username, password, display_name, role, village_id, can_publish, can_edit, can_process } = req.body;

    if (!username || !password || !display_name) {
      return res.json({ code: 400, data: null, message: '用户名、密码和显示名称不能为空' });
    }

    if (password.length < 6) {
      return res.json({ code: 400, data: null, message: '密码长度不能少于6位' });
    }

    const { userQueries } = getQueries();
    const existing = userQueries.getByUsername(username);
    if (existing) {
      return res.json({ code: 400, data: null, message: '用户名已存在' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    // 根据角色设置默认权限
    const pub = can_publish !== undefined ? (can_publish ? 1 : 0) : (role === 'admin' || role === 'publisher' ? 1 : 0);
    const edit = can_edit !== undefined ? (can_edit ? 1 : 0) : (role === 'admin' || role === 'publisher' ? 1 : 0);
    const proc = can_process !== undefined ? (can_process ? 1 : 0) : (role === 'admin' || role === 'surveyor' ? 1 : 0);
    const userRole = role || 'publisher';

    const result = userQueries.create(username, hashedPassword, display_name, userRole, village_id || null, pub, edit, proc);

    res.json({ code: 0, data: { id: result.lastInsertRowid }, message: '用户创建成功' });
  } catch (err) {
    console.error('创建用户错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/users/:id - 更新用户（管理员）
router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { username, display_name, role, village_id, can_publish, can_edit, can_process } = req.body;

    const { userQueries } = getQueries();
    const user = userQueries.getById(id);
    if (!user) {
      return res.json({ code: 404, data: null, message: '用户不存在' });
    }

    // 如果修改了用户名，检查是否重复
    if (username && username !== user.username) {
      const existing = userQueries.checkUsernameExists(username, id);
      if (existing) {
        return res.json({ code: 400, data: null, message: '用户名已存在' });
      }
    }

    const newUsername = username || user.username;
    const newDisplayName = display_name || user.display_name;
    const newRole = role || user.role;
    const newVillageId = village_id !== undefined ? village_id : user.village_id;
    const newPub = can_publish !== undefined ? (can_publish ? 1 : 0) : user.can_publish;
    const newEdit = can_edit !== undefined ? (can_edit ? 1 : 0) : user.can_edit;
    const newProc = can_process !== undefined ? (can_process ? 1 : 0) : user.can_process;

    userQueries.updateWithUsername(newUsername, newDisplayName, newRole, newVillageId, newPub, newEdit, newProc, id);

    res.json({ code: 0, data: null, message: '用户更新成功' });
  } catch (err) {
    console.error('更新用户错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// DELETE /api/users/:id - 删除用户（管理员）- 真正删除
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.json({ code: 400, data: null, message: '不能删除自己的账号' });
    }

    const { userQueries } = getQueries();
    const user = userQueries.getById(id);
    if (!user) {
      return res.json({ code: 400, data: null, message: '用户不存在' });
    }

    // 检查是否为硬删除（query参数 hard=true）
    const hardDelete = req.query.hard === 'true';

    if (hardDelete) {
      userQueries.delete(id);
      res.json({ code: 0, data: null, message: '用户已永久删除' });
    } else {
      // 默认禁用
      userQueries.toggleActive(0, id);
      res.json({ code: 0, data: null, message: '用户已禁用' });
    }
  } catch (err) {
    console.error('删除用户错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/users/:id/role - 修改用户角色（管理员）
router.put('/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'surveyor', 'publisher'].includes(role)) {
      return res.json({ code: 400, data: null, message: '无效的角色' });
    }

    const { userQueries } = getQueries();
    const user = userQueries.getById(id);
    if (!user) {
      return res.json({ code: 404, data: null, message: '用户不存在' });
    }

    userQueries.updateRole(role, id);

    res.json({ code: 0, data: null, message: '角色修改成功' });
  } catch (err) {
    console.error('修改角色错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/users/:id/permissions - 修改用户权限（管理员）
router.put('/:id/permissions', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { can_publish, can_edit, can_process } = req.body;

    const { userQueries } = getQueries();
    const user = userQueries.getById(id);
    if (!user) {
      return res.json({ code: 404, data: null, message: '用户不存在' });
    }

    const pub = can_publish !== undefined ? (can_publish ? 1 : 0) : user.can_publish;
    const edit = can_edit !== undefined ? (can_edit ? 1 : 0) : user.can_edit;
    const proc = can_process !== undefined ? (can_process ? 1 : 0) : user.can_process;

    userQueries.updatePermissions(pub, edit, proc, id);

    res.json({ code: 0, data: null, message: '权限修改成功' });
  } catch (err) {
    console.error('修改权限错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

module.exports = router;