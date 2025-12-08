# Project Structure

## Directory Organization

```
RaceAdministration/
├── backend/                    # 后端代码
│   ├── src/
│   │   ├── models/            # Mongoose 数据模型
│   │   ├── controllers/       # 业务逻辑控制器
│   │   ├── routes/            # API 路由定义
│   │   ├── middlewares/       # 中间件（验证、错误处理等）
│   │   ├── config/            # 配置文件（数据库连接等）
│   │   └── utils/             # 工具函数
│   ├── server.js              # 服务器入口文件
│   ├── package.json
│   └── .env                   # 环境变量（不提交到 Git）
│
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── components/        # Vue 组件
│   │   ├── views/             # 页面视图
│   │   ├── router/            # 路由配置
│   │   ├── api/               # API 调用封装
│   │   ├── utils/             # 工具函数
│   │   └── assets/            # 静态资源（图片、样式等）
│   ├── public/                # 公共静态文件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── .spec-workflow/            # 项目文档和规范
│   ├── steering/              # 指导文档
│   └── templates/             # 模板文件
│
├── docs/                      # 项目文档
│   ├── API.md                # API 接口文档
│   └── LEARNING.md           # 学习笔记
│
└── README.md                  # 项目说明
```

## Naming Conventions

### Files
- **Models**: PascalCase，如 `Race.js`, `Participant.js`
- **Controllers**: camelCase + Controller 后缀，如 `raceController.js`
- **Routes**: camelCase + Routes 后缀，如 `raceRoutes.js`
- **Components**: PascalCase，如 `RaceList.vue`, `ParticipantForm.vue`
- **Views**: PascalCase，如 `RaceManagement.vue`
- **Utilities**: camelCase，如 `dateUtils.js`, `validator.js`

### Code
- **Classes/Models**: PascalCase，如 `Race`, `Participant`
- **Functions/Methods**: camelCase，如 `getRaces()`, `createParticipant()`
- **Constants**: UPPER_SNAKE_CASE，如 `API_BASE_URL`, `MAX_PARTICIPANTS`
- **Variables**: camelCase，如 `raceList`, `participantData`

## Import Patterns

### Import Order
1. 外部依赖（如 `express`, `mongoose`）
2. 内部模块（如 `models`, `controllers`）
3. 相对路径导入（如 `./utils`）
4. 样式导入（仅前端）

### 示例
```javascript
// 1. 外部依赖
const express = require('express');
const mongoose = require('mongoose');

// 2. 内部模块
const Race = require('./models/Race');
const raceController = require('./controllers/raceController');

// 3. 相对路径
const { validateRace } = require('./utils/validator');
```

## Code Structure Patterns

### 后端文件组织

**Model 文件结构：**
```javascript
// 1. 导入依赖
const mongoose = require('mongoose');

// 2. Schema 定义
const raceSchema = new mongoose.Schema({...});

// 3. 方法定义（如有）
raceSchema.methods.someMethod = function() {...};

// 4. 导出
module.exports = mongoose.model('Race', raceSchema);
```

**Controller 文件结构：**
```javascript
// 1. 导入依赖
const Race = require('../models/Race');

// 2. 控制器方法
exports.getRaces = async (req, res) => {
  // 输入验证
  // 业务逻辑
  // 错误处理
  // 返回响应
};

// 3. 其他方法...
```

**Route 文件结构：**
```javascript
// 1. 导入依赖
const express = require('express');
const router = express.Router();
const raceController = require('../controllers/raceController');

// 2. 路由定义
router.get('/', raceController.getRaces);
router.post('/', raceController.createRace);

// 3. 导出
module.exports = router;
```

### 前端文件组织

**Vue 组件结构：**
```vue
<template>
  <!-- 模板 -->
</template>

<script>
// 1. 导入依赖
import { ref, onMounted } from 'vue';
import { getRaces } from '@/api/race';

// 2. 组件逻辑
export default {
  name: 'ComponentName',
  // setup 函数
};
</script>

<style scoped>
/* 样式 */
</style>
```

## Code Organization Principles

1. **单一职责**: 每个文件只负责一个功能模块
2. **模块化**: 代码按功能拆分为独立模块，便于复用和维护
3. **可测试性**: 函数保持纯净，便于单元测试
4. **一致性**: 遵循统一的命名和组织规范

## Module Boundaries

### 后端模块边界
- **Models**: 仅定义数据结构，不包含业务逻辑
- **Controllers**: 处理业务逻辑，调用 Models 进行数据操作
- **Routes**: 仅定义路由映射，不包含业务逻辑
- **Middlewares**: 独立的中间件功能，可复用
- **Utils**: 纯函数工具，无副作用

### 前端模块边界
- **Components**: 可复用的 UI 组件，接收 props，触发 events
- **Views**: 页面级组件，组合多个 Components
- **API**: 封装所有后端 API 调用，统一管理
- **Router**: 仅负责路由配置
- **Utils**: 纯函数工具

### 依赖方向
- Routes → Controllers → Models
- Views → Components → API
- 禁止反向依赖（如 Models 不能依赖 Controllers）

## Code Size Guidelines

- **文件大小**: 单个文件不超过 300 行（复杂逻辑除外）
- **函数大小**: 单个函数不超过 50 行，尽量保持在 20 行以内
- **组件复杂度**: Vue 组件 template 不超过 100 行，复杂组件拆分为子组件
- **嵌套深度**: 最多 3 层嵌套，超过则重构

## RESTful API 设计规范

### 路由命名
- **资源名称**: 使用复数形式，如 `/api/races`, `/api/participants`
- **HTTP 方法**:
  - `GET` - 查询
  - `POST` - 创建
  - `PUT/PATCH` - 更新
  - `DELETE` - 删除

### 示例
```
GET    /api/races           # 获取所有赛事
GET    /api/races/:id       # 获取单个赛事
POST   /api/races           # 创建赛事
PUT    /api/races/:id       # 更新赛事
DELETE /api/races/:id       # 删除赛事
```

## Documentation Standards

- **公共 API**: 必须在 `docs/API.md` 中记录接口文档
- **复杂逻辑**: 添加行内注释说明
- **函数注释**: 使用 JSDoc 格式（可选）
- **README**: 每个主要模块包含 README 说明用途和使用方法
- **学习笔记**: 在 `docs/LEARNING.md` 中记录学习心得和遇到的问题

## 初期简化原则

由于是学习项目，初期可以简化：
- 不强制要求完整的目录结构，可以从简单的 `server.js` 开始
- 随着功能增加，逐步拆分为 models、controllers、routes
- 前端初期可以使用单文件组件，后期再拆分
- 文档可以边开发边补充，不必一开始就完整

**渐进式重构路径：**
1. 单文件 `server.js` → 拆分 routes
2. routes 中的逻辑 → 提取到 controllers
3. 数据结构 → 定义 models
4. 重复代码 → 提取到 utils
5. 前端单页面 → 拆分 components 和 views
