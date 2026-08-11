const express = require('express');
const router = express.Router();
const { getQueries } = require('../database');
const { requireAuth, requireRole } = require('../middleware');

// GET /api/settings - 获取所有设置（管理员）
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { settingQueries } = getQueries();
    const settings = settingQueries.getAll();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.json({ code: 0, data: settingsMap, message: '' });
  } catch (err) {
    console.error('获取设置错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/settings/:key - 更新设置（管理员）
router.put('/:key', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const { settingQueries } = getQueries();
    settingQueries.upsert(key, value, value);

    res.json({ code: 0, data: null, message: '设置更新成功' });
  } catch (err) {
    console.error('更新设置错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// GET /api/settings/tags - 获取标签列表
router.get('/tags', requireAuth, (req, res) => {
  try {
    const { tagQueries } = getQueries();
    const tags = tagQueries.getAll();
    res.json({ code: 0, data: tags, message: '' });
  } catch (err) {
    console.error('获取标签错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// POST /api/settings/tags - 创建标签（管理员）
router.post('/tags', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.json({ code: 400, data: null, message: '标签名称不能为空' });
    }

    const { tagQueries } = getQueries();
    const result = tagQueries.create(name, color || '#3B82F6');

    res.json({ code: 0, data: { id: result.lastInsertRowid }, message: '标签创建成功' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.json({ code: 400, data: null, message: '标签名称已存在' });
    }
    console.error('创建标签错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/settings/tags/:id - 更新标签（管理员）
router.put('/tags/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const { tagQueries } = getQueries();
    const tag = tagQueries.getById(id);
    if (!tag) {
      return res.json({ code: 404, data: null, message: '标签不存在' });
    }

    tagQueries.update(name || tag.name, color || tag.color, id);

    res.json({ code: 0, data: null, message: '标签更新成功' });
  } catch (err) {
    console.error('更新标签错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// DELETE /api/settings/tags/:id - 删除标签（管理员）
router.delete('/tags/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const { tagQueries } = getQueries();
    const tag = tagQueries.getById(id);
    if (!tag) {
      return res.json({ code: 404, data: null, message: '标签不存在' });
    }

    tagQueries.delete(id);

    res.json({ code: 0, data: null, message: '标签删除成功' });
  } catch (err) {
    console.error('删除标签错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// GET /api/settings/villages - 获取村/社区列表
router.get('/villages', requireAuth, (req, res) => {
  try {
    const { villageQueries } = getQueries();
    const villages = villageQueries.getAll();
    res.json({ code: 0, data: villages, message: '' });
  } catch (err) {
    console.error('获取村/社区错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// POST /api/settings/villages - 创建村/社区（管理员）
router.post('/villages', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { name, leader_id } = req.body;

    if (!name) {
      return res.json({ code: 400, data: null, message: '村/社区名称不能为空' });
    }

    const { villageQueries } = getQueries();
    const result = villageQueries.create(name, leader_id || null);

    res.json({ code: 0, data: { id: result.lastInsertRowid }, message: '村/社区创建成功' });
  } catch (err) {
    console.error('创建村/社区错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// PUT /api/settings/villages/:id - 更新村/社区（管理员）
router.put('/villages/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, leader_id } = req.body;

    const { villageQueries } = getQueries();
    const village = villageQueries.getById(id);
    if (!village) {
      return res.json({ code: 404, data: null, message: '村/社区不存在' });
    }

    villageQueries.update(name || village.name, leader_id !== undefined ? leader_id : village.leader_id, id);

    res.json({ code: 0, data: null, message: '村/社区更新成功' });
  } catch (err) {
    console.error('更新村/社区错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

// DELETE /api/settings/villages/:id - 删除村/社区（管理员）
router.delete('/villages/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const { villageQueries } = getQueries();
    const village = villageQueries.getById(id);
    if (!village) {
      return res.json({ code: 404, data: null, message: '村/社区不存在' });
    }

    villageQueries.delete(id);

    res.json({ code: 0, data: null, message: '村/社区删除成功' });
  } catch (err) {
    console.error('删除村/社区错误:', err);
    res.json({ code: 500, data: null, message: '服务器错误' });
  }
});

module.exports = router;