const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, data: null, message: '未登录或token已过期' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 校验token_version：如果用户修改了密码，旧token的version会不匹配
    if (decoded.token_version !== undefined) {
      const { getQueries } = require('./database');
      try {
        const { userQueries } = getQueries();
        const user = userQueries.getById(decoded.id);
        if (user && (user.token_version || 0) !== decoded.token_version) {
          return res.status(401).json({ code: 401, data: null, message: '密码已变更，请重新登录' });
        }
      } catch (dbErr) {
        // 数据库查询失败时不阻止请求，仅记录日志
        console.error('token_version校验数据库查询失败:', dbErr.message);
      }
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, data: null, message: 'token已过期，请重新登录' });
    }
    return res.status(401).json({ code: 401, data: null, message: '无效的token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, data: null, message: '未登录' });
    }
    // admin角色始终有权限
    if (req.user.role === 'admin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, data: null, message: '权限不足' });
    }
    next();
  };
}

// 权限检查中间件 - 检查具体权限点
// permission: 'can_publish' | 'can_edit' | 'can_process'
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, data: null, message: '未登录' });
    }
    // admin角色始终有所有权限
    if (req.user.role === 'admin') return next();
    // 检查具体权限
    if (req.user[permission]) return next();
    return res.status(403).json({ code: 403, data: null, message: '权限不足' });
  };
}

module.exports = { requireAuth, requireRole, requirePermission, JWT_SECRET };