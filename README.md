# 查勘任务发布处理系统

查勘任务发布处理系统，支持任务发布、查勘、处理、归档全流程管理。

## 功能特性

- 三种用户角色：管理员、查勘人员、发布人员
- 任务全生命周期管理：发布 → 查勘 → 处理 → 归档
- 实时通知（Socket.io）
- 响应式设计，支持手机和电脑
- 标签管理、村/社区管理
- 用户管理（管理员）
- Android WebView 客户端

## 技术栈

- **后端**: Node.js + Express + better-sqlite3 + Socket.io
- **前端**: 原生 JavaScript + Tailwind CSS
- **认证**: JWT
- **部署**: Docker
- **Android**: WebView 空壳应用

## 快速开始

### 本地开发

```bash
cd server && npm install && npm start
```

### Docker 部署

使用 GitHub Container Registry 镜像一键部署：

```bash
docker-compose up -d
```

或直接使用 Docker 命令：

```bash
docker run -d --name survey-task-system -p 3000:3000 -v ./data:/app/data ghcr.io/elvis-okk/survey-task-system:2.0
```

### 从源码构建

```bash
git clone https://github.com/Elvis-okk/survey-task-system.git
cd survey-task-system
docker-compose up -d --build
```

## Android 客户端

项目包含 Android WebView 空壳应用，位于 android/ 目录。

### 功能

- JWT 登录认证
- WebView 全屏加载系统网页
- 支持文件上传/下载
- 下拉刷新
- 退出确认

### 构建

1. 使用 Android Studio 打开 android/ 目录
2. 修改 LoginActivity.java 中的服务器地址
3. 构建 APK

> APK 也可从 [GitHub Releases](https://github.com/Elvis-okk/survey-task-system/releases) 下载。

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

## 项目结构

```
survey-task-system/
  server/           # 后端服务
    routes/         # API 路由
  public/           # 前端静态文件
  android/          # Android WebView 空壳应用
  Dockerfile
  docker-compose.yml
  .github/workflows/  # CI/CD 工作流
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| JWT_SECRET | change-this-secret-in-production | JWT 密钥 |
| ADMIN_PASSWORD | admin123 | 管理员密码 |
| DB_PATH | /app/data/survey.db | 数据库路径 |
| AUTO_SAVE_INTERVAL | 5 | 自动保存间隔(分钟) |

## License

MIT
