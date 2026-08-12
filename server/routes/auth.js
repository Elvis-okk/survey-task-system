const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getQueries } = require('../database');
const { requireAuth, JWT_SECRET } = require('../middleware');

// POST /api/auth/login - 登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ code: 400, data: null, message: '用户名和密码不能为空' });
    }

    const { userQueries } = getQueries();
    const user = userQueries.getByUsername(username);
    if (!user) {
      return res.json({ code: 401, data: null, message: '用户名或密码错误' });
    }

    if (!user.is_active) {
      return res.json({ code: 403, data: null, message: '账号已被禁用' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.json({ code: 401, data: null, message: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, display_name: user.display_name, can_publish: user.can_publish, can_edit: user.can_edit, can_process: user.can_process },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      code: 0,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role,
          village_id: user.village_id,
          can_publish: user.can_publish,
          can_edit: user.can_edit,
          can_process: user.can_process
        }
      },
      message: '登录成功'
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// POST /api/auth/logout - 登出
router.post('/logout', requireAuth, (req, res) => {
  res.json({ code: 0, data: null, message: '已退出登录' });
});

// GET /api/auth/me - 获取当前用户信息
router.get('/me', requireAuth, (req, res) => {
  try {
    const { userQueries } = getQueries();
    const user = userQueries.getById(req.user.id);
    if (!user) {
      return res.json({ code: 404, data: null, message: '用户不存在' });
    }
    res.json({
      code: 0,
      data: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        village_id: user.village_id,
        village_name: user.village_name,
        is_active: user.is_active,
        can_publish: user.can_publish,
        can_edit: user.can_edit,
        can_process: user.can_process
      },
      message: ''
    });
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/auth/password - 修改密码
router.put('/password', requireAuth, (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.json({ code: 400, data: null, message: '旧密码和新密码不能为空' });
    }

    if (new_password.length < 6) {
      return res.json({ code: 400, data: null, message: '新密码长度不能少于6位' });
    }

    const { userQueries } = getQueries();
    const user = userQueries.getByUsername(req.user.username);
    const isValid = bcrypt.compareSync(old_password, user.password);
    if (!isValid) {
      return res.json({ code: 400, data: null, message: '旧密码错误' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    userQueries.updatePassword(hashedPassword, req.user.id);

    res.json({ code: 0, data: null, message: '密码修改成功' });
  } catch (err) {
    console.error('修改密码错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

module.exports = router;