<<<<<<< HEAD
# 查勘任务发布处理系统

查勘任务发布处理系统，支持任务发布、查勘、处理、归档全流程管理。

## 功能特性

- 三种用户角色：管理员、查勘人员、发布人员
- 任务全生命周期管理：发布 → 查勘 → 处理 → 归档
- 实时通知（Socket.io）
- 响应式设计，支持手机和电脑
- 标签管理、村/社区管理
- 用户管理（管理员）

## 技术栈

- **后端**: Node.js + Express + better-sqlite3 + Socket.io
- **前端**: 原生 JavaScript + Tailwind CSS
- **认证**: JWT
- **部署**: Docker

## 快速开始

### 本地开发

```bash
cd server
npm install
npm start
```

访问 http://localhost:3000

### Docker 部署

```bash
docker-compose up -d
```

访问 http://localhost:3000

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| JWT_SECRET | - | JWT签名密钥 |
| DB_PATH | ./data/survey.db | 数据库路径 |

## 项目结构

```
survey-task-system/
├── server/              # 后端代码
│   ├── index.js         # 主入口
│   ├── database.js      # 数据库初始化
│   ├── middleware.js     # 认证中间件
│   ├── package.json     # 依赖配置
│   └── routes/          # API路由
│       ├── auth.js      # 认证
│       ├── users.js     # 用户管理
│       ├── tasks.js     # 任务管理
│       └── settings.js  # 系统设置
├── public/              # 前端静态文件
│   ├── login.html       # 登录页
│   ├── index.html       # 主页面
│   ├── css/app.css      # 样式
│   └── js/
│       ├── api.js       # API封装
│       ├── socket.js    # Socket.io
│       └── app.js       # 主应用逻辑
├── Dockerfile
├── docker-compose.yml
└── .dockerignore
=======
# survey-task-system
>>>>>>> deffee15041bd156c2827f14121ebd429eef2515
