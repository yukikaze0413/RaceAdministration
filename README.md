# 赛事管理系统

一个基于 Node.js + Express + MongoDB + Vue.js 的全栈赛事管理系统，用于学习和实践全栈开发。

## 功能特性

- 赛事管理：创建、编辑、删除赛事
- 参赛者管理：报名信息录入和管理
- 成绩管理：成绩录入、修改、查询
- 排名展示：实时排名计算和展示
- 数据统计：参赛数据分析和报表

## 技术栈

**后端：**
- Node.js + Express
- MongoDB + Mongoose
- RESTful API

**前端（计划）：**
- Vue.js 3
- Vue Router
- Axios

## 项目结构

```
RaceAdministration/
├── backend/           # 后端代码
│   ├── src/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── ...
│   └── server.js
├── frontend/          # 前端代码（待创建）
└── docs/             # 项目文档
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- MongoDB >= 6.0

### 安装依赖

```bash
cd backend
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:5000 启动

## 学习路线

1. ✅ 项目初始化和基础结构
2. 🔄 Express 基础和路由
3. ⏳ MongoDB 连接和数据模型
4. ⏳ RESTful API 实现
5. ⏳ 前端开发
6. ⏳ 前后端联调

## 文档

- [API 文档](docs/API.md)
- [学习笔记](docs/LEARNING.md)

## 开发原则

- KISS：保持简单
- YAGNI：只实现需要的功能
- DRY：避免重复代码
- 渐进式开发：从简单到复杂

## License

MIT
