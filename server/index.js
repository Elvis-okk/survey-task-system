const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');
const { requireAuth } = require('./middleware');

// 路由
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const tasksRoutes = require('./routes/tasks');
const settingsRoutes = require('./routes/settings');
const exportRoutes = require('./routes/export');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 22233;

// 中间件
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/export', exportRoutes);

// Socket.io 认证
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change_me_in_production');
      socket.user = decoded;
      next();
    } catch (err) {
      next();
    }
  } else {
    next();
  }
});

// Socket.io 连接
io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);

  if (socket.user) {
    // 按角色加入房间
    socket.join(`role:${socket.user.role}`);
    socket.join(`user:${socket.user.id}`);
  }

  socket.on('disconnect', () => {
    console.log('客户端断开:', socket.id);
  });
});

// 将io实例挂载到app上供路由使用
app.set('io', io);

// SPA回退 - 所有非API请求返回index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, data: null, message: '服务器内部错误' });
});

// 异步启动
async function start() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('数据库初始化完成');

    server.listen(PORT, () => {
      console.log(`查勘任务发布处理系统已启动，端口: ${PORT}`);
      console.log(`访问 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };