const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'survey.db');
let db = null;
let saveTimer = null;

// sql.js wrapper to mimic better-sqlite3 API
class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  run(...params) {
    if (params.length === 1 && Array.isArray(params[0])) params = params[0];
    this.db.run(this.sql, params);
    const changes = this.db.getRowsModified();
    // 获取 lastInsertRowid
    let lastInsertRowid = 0;
    if (this.sql.trim().toUpperCase().startsWith('INSERT')) {
      try {
        const res = this.db.exec('SELECT last_insert_rowid()');
        if (res.length > 0 && res[0].values.length > 0) {
          lastInsertRowid = res[0].values[0][0];
        }
      } catch (e) { /* ignore */ }
    }
    return { changes, lastInsertRowid };
  }

  get(...params) {
    if (params.length === 1 && Array.isArray(params[0])) params = params[0];
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    let result = undefined;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  all(...params) {
    if (params.length === 1 && Array.isArray(params[0])) params = params[0];
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

class DatabaseWrapper {
  constructor(rawDb) {
    this.rawDb = rawDb;
  }

  prepare(sql) {
    return new Statement(this.rawDb, sql);
  }

  exec(sql) {
    this.rawDb.exec(sql);
  }

  pragma(pragma) {
    this.rawDb.exec('PRAGMA ' + pragma);
  }

  save() {
    const data = this.rawDb.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, buffer);
  }

  close() {
    this.save();
    this.rawDb.close();
  }
}

async function getDb() {
  if (!db) {
    const SQL = await initSqlJs();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let buffer = null;
    if (fs.existsSync(DB_PATH)) {
      buffer = fs.readFileSync(DB_PATH);
    }
    const rawDb = buffer ? new SQL.Database(buffer) : new SQL.Database();
    db = new DatabaseWrapper(rawDb);
    // Auto-save interval from environment variable (seconds, default 5)
    const autoSaveInterval = (parseInt(process.env.AUTO_SAVE_INTERVAL) || 5) * 1000;
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(() => {
      if (db) db.save();
    }, autoSaveInterval);
  }
  return db;
}

async function initDatabase() {
  const database = await getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'publisher' CHECK(role IN ('admin', 'surveyor', 'publisher')),
      village_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (village_id) REFERENCES villages(id)
    );

    CREATE TABLE IF NOT EXISTS villages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      leader_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (leader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      publish_time TEXT NOT NULL,
      tag TEXT DEFAULT '',
      village_id INTEGER,
      address TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      purchase_info TEXT DEFAULT '',
      contact_person TEXT DEFAULT '',
      survey_status TEXT DEFAULT 'not_surveyed' CHECK(survey_status IN ('not_surveyed', 'surveyed')),
      process_status TEXT CHECK(process_status IN ('pending', 'resurvey', 'missing_docs', 'submitted')),
      has_harmony INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      is_archived INTEGER DEFAULT 0,
      remark TEXT DEFAULT '',
      survey_remark TEXT DEFAULT '',
      process_remark TEXT DEFAULT '',
      FOREIGN KEY (village_id) REFERENCES villages(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 为已有数据库添加新列（如果不存在）
  const columnsToAdd = [
    { table: 'tasks', column: 'remark', type: 'TEXT DEFAULT \'\'' },
    { table: 'tasks', column: 'survey_remark', type: 'TEXT DEFAULT \'\'' },
    { table: 'tasks', column: 'process_remark', type: 'TEXT DEFAULT \'\'' },
    { table: 'tasks', column: 'insurance_id', type: 'INTEGER' },
    { table: 'villages', column: 'leader', type: 'TEXT DEFAULT \'\'' },
    { table: 'villages', column: 'contact_phone', type: 'TEXT DEFAULT \'\'' },
    { table: 'users', column: 'can_publish', type: 'INTEGER DEFAULT 0' },
    { table: 'users', column: 'can_edit', type: 'INTEGER DEFAULT 0' },
    { table: 'users', column: 'can_process', type: 'INTEGER DEFAULT 0' },
    { table: 'tasks', column: 'contact_person', type: "TEXT DEFAULT ''" },
    { table: 'tasks', column: 'has_harmony', type: 'INTEGER DEFAULT 0' }
  ];
  for (const col of columnsToAdd) {
    try {
      database.exec(`ALTER TABLE ${col.table} ADD COLUMN ${col.column} ${col.type}`);
    } catch (e) {
      // 列已存在，忽略错误
    }
  }

  // 创建默认管理员账号
  const adminExists = database.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    database.prepare(`
      INSERT INTO users (username, password, display_name, role, is_active, can_publish, can_edit, can_process)
      VALUES (?, ?, ?, ?, 1, 1, 1, 1)
    `).run('admin', hashedPassword, '系统管理员', 'admin');
  }

  // 创建默认标签
  const tagCount = database.prepare('SELECT COUNT(*) as count FROM tags').get();
  if (tagCount.count === 0) {
    const defaultTags = [
      ['农房保险', '#3B82F6'],
      ['农业保险', '#10B981'],
      ['财产保险', '#F59E0B'],
      ['人身保险', '#EF4444'],
      ['其他', '#6B7280']
    ];
    for (const [name, color] of defaultTags) {
      database.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color);
    }
  }

  // 创建默认出险情况
  const insuranceCount = database.prepare('SELECT COUNT(*) as count FROM insurance_cases').get();
  if (insuranceCount.count === 0) {
    const defaultInsurances = [
      ['火灾', '因火灾导致的保险理赔'],
      ['水灾', '因水灾导致的保险理赔'],
      ['风灾', '因风灾导致的保险理赔'],
      ['倒塌', '因房屋倒塌导致的保险理赔'],
      ['其他', '其他出险情况']
    ];
    for (const [name, desc] of defaultInsurances) {
      database.prepare('INSERT INTO insurance_cases (name, description) VALUES (?, ?)').run(name, desc);
    }
  }

  // 创建默认设置
  const settingCount = database.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (settingCount.count === 0) {
    const defaultSettings = [
      ['system_name', '查勘任务发布处理系统'],
      ['task_timeout_hours', '72'],
      ['notification_enabled', 'true']
    ];
    for (const [key, value] of defaultSettings) {
      database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
  }

  database.save();
  console.log('数据库初始化完成');
  return database;
}

// 延迟初始化的查询对象 - 调用时获取db实例
function createQueries() {
  return {
    user: {
      getAll: () => db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.village_id, u.created_at, u.updated_at, u.is_active,
               u.can_publish, u.can_edit, u.can_process,
               v.name as village_name
        FROM users u
        LEFT JOIN villages v ON u.village_id = v.id
        ORDER BY u.created_at DESC
      `).all(),

      getById: (id) => db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.village_id, u.created_at, u.updated_at, u.is_active,
               u.can_publish, u.can_edit, u.can_process,
               v.name as village_name
        FROM users u
        LEFT JOIN villages v ON u.village_id = v.id
        WHERE u.id = ?
      `).get(id),

      getByUsername: (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username),

      create: (...params) => db.prepare(`
        INSERT INTO users (username, password, display_name, role, village_id, can_publish, can_edit, can_process)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...params),

      update: (...params) => db.prepare(`
        UPDATE users SET display_name = ?, role = ?, village_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(...params),

      updateWithUsername: (...params) => db.prepare(`
        UPDATE users SET username = ?, display_name = ?, role = ?, village_id = ?, can_publish = ?, can_edit = ?, can_process = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(...params),

      updatePermissions: (...params) => db.prepare(`
        UPDATE users SET can_publish = ?, can_edit = ?, can_process = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(...params),

      updatePassword: (...params) => db.prepare(`
        UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?
      `).run(...params),

      toggleActive: (...params) => db.prepare(`
        UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?
      `).run(...params),

      updateRole: (...params) => db.prepare(`
        UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?
      `).run(...params),

      delete: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id),

      checkUsernameExists: (username, excludeId) => db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, excludeId)
    },

    village: {
      getAll: () => db.prepare('SELECT v.*, u.display_name as leader_name FROM villages v LEFT JOIN users u ON v.leader_id = u.id ORDER BY v.created_at DESC').all(),
      getById: (id) => db.prepare('SELECT * FROM villages WHERE id = ?').get(id),
      create: (...params) => db.prepare('INSERT INTO villages (name, leader_id, contact_phone) VALUES (?, ?, ?)').run(...params),
      update: (...params) => db.prepare('UPDATE villages SET name = ?, leader_id = ?, contact_phone = ? WHERE id = ?').run(...params),
      delete: (id) => db.prepare('DELETE FROM villages WHERE id = ?').run(id)
    },

    task: {
      getList: (filters) => {
        // completed分类查归档任务，其他查未归档
        const isCompletedCategory = filters.task_category === 'completed';
        let sql = `
          SELECT t.*, v.name as village_name,
                 u1.display_name as creator_name,
                 u2.display_name as assignee_name,
                 tg.name as tag_name, tg.color as tag_color,
                 ic.name as insurance_name
          FROM tasks t
          LEFT JOIN villages v ON t.village_id = v.id
          LEFT JOIN users u1 ON t.created_by = u1.id
          LEFT JOIN users u2 ON t.assigned_to = u2.id
          LEFT JOIN tags tg ON t.tag = tg.name
          LEFT JOIN insurance_cases ic ON t.insurance_id = ic.id
          WHERE t.is_archived = ${isCompletedCategory ? 1 : 0}
        `;
        const params = [];
        const conditions = [];

        if (filters.assigned_to) { conditions.push('t.assigned_to = ?'); params.push(filters.assigned_to); }
        if (filters.tag) { conditions.push('t.tag = ?'); params.push(filters.tag); }
        if (filters.survey_status) { conditions.push('t.survey_status = ?'); params.push(filters.survey_status); }
        if (filters.process_status) { conditions.push('t.process_status = ?'); params.push(filters.process_status); }
        if (filters.village_id) { conditions.push('t.village_id = ?'); params.push(filters.village_id); }
        if (filters.created_by) { conditions.push('t.created_by = ?'); params.push(filters.created_by); }
        if (filters.keyword) { conditions.push('(t.title LIKE ? OR t.address LIKE ?)'); params.push(`%${filters.keyword}%`, `%${filters.keyword}%`); }
        if (filters.task_category === 'pending_survey') {
          conditions.push("t.survey_status = 'not_surveyed'");
        } else if (filters.task_category === 'processing') {
          conditions.push("t.survey_status = 'surveyed' AND (t.process_status IS NULL OR t.process_status != 'submitted')");
        }
        // completed分类已通过is_archived主条件处理

        if (conditions.length > 0) sql += ' AND ' + conditions.join(' AND ');
        sql += ' ORDER BY t.publish_time ASC';

        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 20;
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return db.prepare(sql).all(...params);
      },

      getCount: (filters) => {
        const isCompletedCategory = filters.task_category === 'completed';
        let sql = `SELECT COUNT(*) as total FROM tasks WHERE is_archived = ${isCompletedCategory ? 1 : 0}`;
        const params = [];
        const conditions = [];

        if (filters.assigned_to) { conditions.push('assigned_to = ?'); params.push(filters.assigned_to); }
        if (filters.tag) { conditions.push('tag = ?'); params.push(filters.tag); }
        if (filters.survey_status) { conditions.push('survey_status = ?'); params.push(filters.survey_status); }
        if (filters.process_status) { conditions.push('process_status = ?'); params.push(filters.process_status); }
        if (filters.village_id) { conditions.push('village_id = ?'); params.push(filters.village_id); }
        if (filters.created_by) { conditions.push('created_by = ?'); params.push(filters.created_by); }
        if (filters.keyword) { conditions.push('(title LIKE ? OR address LIKE ?)'); params.push(`%${filters.keyword}%`, `%${filters.keyword}%`); }
        if (filters.task_category === 'pending_survey') {
          conditions.push("survey_status = 'not_surveyed'");
        } else if (filters.task_category === 'processing') {
          conditions.push("survey_status = 'surveyed' AND (process_status IS NULL OR process_status != 'submitted')");
        }
        // completed分类已通过is_archived主条件处理

        if (conditions.length > 0) sql += ' AND ' + conditions.join(' AND ');
        return db.prepare(sql).get(...params).total;
      },

      getById: (id) => db.prepare(`
        SELECT t.*, v.name as village_name,
               u1.display_name as creator_name,
               u2.display_name as assignee_name,
               tg.name as tag_name, tg.color as tag_color,
               ic.name as insurance_name
        FROM tasks t
        LEFT JOIN villages v ON t.village_id = v.id
        LEFT JOIN users u1 ON t.created_by = u1.id
        LEFT JOIN users u2 ON t.assigned_to = u2.id
        LEFT JOIN tags tg ON t.tag = tg.name
        LEFT JOIN insurance_cases ic ON t.insurance_id = ic.id
        WHERE t.id = ?
      `).get(id),

      create: (...params) => db.prepare(`
        INSERT INTO tasks (title, publish_time, tag, village_id, address, contact_person, contact_phone, purchase_info, remark, insurance_id, has_harmony, survey_status, process_status, created_by, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_surveyed', NULL, ?, ?)
      `).run(...params),

      update: (...params) => db.prepare(`
        UPDATE tasks SET title = ?, publish_time = ?, tag = ?, village_id = ?, address = ?, contact_person = ?, contact_phone = ?, purchase_info = ?, remark = ?, insurance_id = ?, has_harmony = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(...params),

      updateSurveyStatus: (...params) => db.prepare(`
        UPDATE tasks SET survey_status = ?, process_status = ?, survey_remark = ?, updated_at = datetime('now') WHERE id = ?
      `).run(...params),

      updateProcessStatus: (...params) => db.prepare(`
        UPDATE tasks SET process_status = ?, process_remark = ?, updated_at = datetime('now'), completed_at = CASE WHEN ? = 'submitted' THEN datetime('now') ELSE completed_at END
        WHERE id = ?
      `).run(...params),

      reassign: (...params) => db.prepare(`
        UPDATE tasks SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?
      `).run(...params),

      archive: (id) => db.prepare(`
        UPDATE tasks SET is_archived = 1, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).run(id),

      getCompleted: (filters) => {
        let sql = `
          SELECT t.*, v.name as village_name,
                 u1.display_name as creator_name,
                 u2.display_name as assignee_name,
                 tg.name as tag_name, tg.color as tag_color,
                 ic.name as insurance_name
          FROM tasks t
          LEFT JOIN villages v ON t.village_id = v.id
          LEFT JOIN users u1 ON t.created_by = u1.id
          LEFT JOIN users u2 ON t.assigned_to = u2.id
          LEFT JOIN tags tg ON t.tag = tg.name
          LEFT JOIN insurance_cases ic ON t.insurance_id = ic.id
          WHERE t.is_archived = 1
        `;
        const params = [];
        if (filters.village_id) { sql += ' AND t.village_id = ?'; params.push(filters.village_id); }
        if (filters.tag) { sql += ' AND t.tag = ?'; params.push(filters.tag); }
        if (filters.keyword) { sql += ' AND (t.title LIKE ? OR t.address LIKE ?)'; params.push(`%${filters.keyword}%`, `%${filters.keyword}%`); }
        sql += ' ORDER BY t.completed_at DESC';
        return db.prepare(sql).all(...params);
      },

      getCompletedCount: (filters) => {
        let sql = 'SELECT COUNT(*) as total FROM tasks WHERE is_archived = 1';
        const params = [];
        if (filters.village_id) { sql += ' AND village_id = ?'; params.push(filters.village_id); }
        if (filters.tag) { sql += ' AND tag = ?'; params.push(filters.tag); }
        if (filters.keyword) { sql += ' AND (title LIKE ? OR address LIKE ?)'; params.push(`%${filters.keyword}%`, `%${filters.keyword}%`); }
        return db.prepare(sql).get(...params).total;
      },

      getStats: (filters) => {
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (filters && filters.assigned_to) {
          whereClause += ' AND assigned_to = ?';
          params.push(filters.assigned_to);
        }
        if (filters && filters.created_by) {
          whereClause += ' AND created_by = ?';
          params.push(filters.created_by);
        }
        if (filters && filters.user_id) {
          // 兼容旧逻辑：显示与用户相关的所有任务
          whereClause += ' AND (assigned_to = ? OR created_by = ?)';
          params.push(filters.user_id, filters.user_id);
        }
        
        const stmt = db.prepare(`
          SELECT
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN survey_status = 'not_surveyed' THEN 1 ELSE 0 END), 0) as not_surveyed,
            COALESCE(SUM(CASE WHEN survey_status = 'surveyed' THEN 1 ELSE 0 END), 0) as surveyed,
            COALESCE(SUM(CASE WHEN process_status = 'pending' AND survey_status = 'surveyed' THEN 1 ELSE 0 END), 0) as pending,
            COALESCE(SUM(CASE WHEN process_status = 'resurvey' THEN 1 ELSE 0 END), 0) as resurvey,
            COALESCE(SUM(CASE WHEN process_status = 'missing_docs' THEN 1 ELSE 0 END), 0) as missing_docs,
            COALESCE(SUM(CASE WHEN process_status = 'submitted' THEN 1 ELSE 0 END), 0) as submitted,
            COALESCE(SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END), 0) as archived
          FROM tasks
          ${whereClause}
        `);
        return stmt.get(...params);
      }
    },

    log: {
      create: (...params) => db.prepare(`
        INSERT INTO task_logs (task_id, action, old_value, new_value, operator_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(...params),

      getByTaskId: (taskId) => db.prepare(`
        SELECT tl.*, u.display_name as operator_name
        FROM task_logs tl
        LEFT JOIN users u ON tl.operator_id = u.id
        WHERE tl.task_id = ?
        ORDER BY tl.created_at DESC
      `).all(taskId)
    },

    setting: {
      getAll: () => db.prepare('SELECT * FROM settings').all(),
      getByKey: (key) => db.prepare('SELECT * FROM settings WHERE key = ?').get(key),
      upsert: (...params) => db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
      `).run(...params)
    },

    tag: {
      getAll: () => db.prepare('SELECT * FROM tags ORDER BY created_at DESC').all(),
      getById: (id) => db.prepare('SELECT * FROM tags WHERE id = ?').get(id),
      create: (...params) => db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(...params),
      update: (...params) => db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(...params),
      delete: (id) => db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    },

    insurance: {
      getAll: () => db.prepare('SELECT * FROM insurance_cases ORDER BY created_at DESC').all(),
      getById: (id) => db.prepare('SELECT * FROM insurance_cases WHERE id = ?').get(id),
      create: (...params) => db.prepare('INSERT INTO insurance_cases (name, description) VALUES (?, ?)').run(...params),
      update: (...params) => db.prepare('UPDATE insurance_cases SET name = ?, description = ? WHERE id = ?').run(...params),
      delete: (id) => db.prepare('DELETE FROM insurance_cases WHERE id = ?').run(id)
    }
  };
}

// 便捷访问属性
function getQueries() {
  const q = createQueries();
  return {
    userQueries: q.user,
    villageQueries: q.village,
    taskQueries: q.task,
    logQueries: q.log,
    settingQueries: q.setting,
    tagQueries: q.tag,
    insuranceQueries: q.insurance
  };
}

// 如果直接运行此文件，初始化数据库
if (require.main === module) {
  initDatabase().then(() => {
    console.log('数据库初始化成功，路径:', DB_PATH);
    if (db) db.close();
    process.exit(0);
  }).catch(err => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
}

module.exports = {
  getDb,
  initDatabase,
  getQueries,
  createQueries,
  // 向后兼容：惰性获取查询对象（在initDatabase之后才可使用）
  get userQueries() { return createQueries().user; },
  get villageQueries() { return createQueries().village; },
  get taskQueries() { return createQueries().task; },
  get logQueries() { return createQueries().log; },
  get settingQueries() { return createQueries().setting; },
  get tagQueries() { return createQueries().tag; },
  get insuranceQueries() { return createQueries().insurance; }
};