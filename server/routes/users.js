const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getQueries } = require('../database');
const { requireAuth, requireRole } = require('../middleware');

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
    const { username, password, display_name, role, village_id } = req.body;

    if (!username || !password || !display_name || !role) {
      return res.json({ code: 400, data: null, message: '用户名、密码、显示名称和角色不能为空' });
    }

    if (!['admin', 'surveyor', 'publisher'].includes(role)) {
      return res.json({ code: 400, data: null, message: '无效的角色' });
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
    const result = userQueries.create(username, hashedPassword, display_name, role, village_id || null);

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
    const { display_name, role, village_id } = req.body;

    const { userQueries } = getQueries();
    const user = userQueries.getById(id);
    if (!user) {
      return res.json({ code: 404, data: null, message: '用户不存在' });
    }

    userQueries.update(display_name || user.display_name, role || user.role, village_id !== undefined ? village_id : user.village_id, id);

    res.json({ code: 0, data: null, message: '用户更新成功' });
  } catch (err) {
    console.error('更新用户错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// DELETE /api/users/:id - 禁用用户（管理员）
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.json({ code: 400, data: null, message: '不能禁用自己的账号' });
    }

    const { userQueries } = getQueries();
    const user = userQueries.getById(id);
    if (!user) {
      return res.json({ code: 400, data: null, message: '用户不存在' });
    }

    userQueries.toggleActive(0, id);

    res.json({ code: 0, data: null, message: '用户已禁用' });
  } catch (err) {
    console.error('禁用用户错误:', err);
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

module.exports = router;