# 第 5 课：错误处理和数据验证 - 理论知识

## 🎯 学习目标
- 理解 HTTP 状态码的含义和使用场景
- 掌握 try-catch 错误处理
- 学会输入数据验证
- 创建统一的错误处理中间件

---

## 📖 理论知识详解

### 1️⃣ HTTP 状态码

#### 什么是状态码？

HTTP 状态码是服务器返回给客户端的**三位数字**，表示请求的处理结果。

#### 状态码分类

| 范围 | 类别 | 说明 |
|-----|------|------|
| 1xx | 信息 | 请求已接收，继续处理 |
| 2xx | 成功 | 请求已成功处理 |
| 3xx | 重定向 | 需要进一步操作 |
| 4xx | 客户端错误 | 请求有问题 |
| 5xx | 服务器错误 | 服务器处理出错 |

#### 常用状态码详解

**成功类（2xx）：**
```javascript
// 200 OK - 请求成功（最常用）
res.status(200).json({ message: '获取成功', data: races });

// 201 Created - 创建成功（POST 请求）
res.status(201).json({ message: '创建成功', data: newRace });

// 204 No Content - 成功但无返回内容（DELETE 请求）
res.status(204).send();
```

**客户端错误类（4xx）：**
```javascript
// 400 Bad Request - 请求参数错误
res.status(400).json({ error: '缺少必填字段 name' });

// 401 Unauthorized - 未认证（需要登录）
res.status(401).json({ error: '请先登录' });

// 403 Forbidden - 无权限
res.status(403).json({ error: '没有权限执行此操作' });

// 404 Not Found - 资源不存在
res.status(404).json({ error: '赛事不存在' });

// 409 Conflict - 资源冲突（如重复创建）
res.status(409).json({ error: '该赛事名称已存在' });
```

**服务器错误类（5xx）：**
```javascript
// 500 Internal Server Error - 服务器内部错误
res.status(500).json({ error: '服务器错误，请稍后重试' });
```

#### 如何选择状态码？

```
请求成功了吗？
├── 是 → 返回什么？
│   ├── 有数据 → 200 OK
│   ├── 创建了新资源 → 201 Created
│   └── 无需返回内容 → 204 No Content
│
└── 否 → 谁的问题？
    ├── 客户端的问题
    │   ├── 参数错误 → 400 Bad Request
    │   ├── 未登录 → 401 Unauthorized
    │   ├── 无权限 → 403 Forbidden
    │   └── 资源不存在 → 404 Not Found
    │
    └── 服务器的问题 → 500 Internal Server Error
```

---

### 2️⃣ 数据验证

#### 为什么需要验证？

**永远不要相信用户输入！** 用户可能：
- 忘记填写必填字段
- 输入错误的数据格式
- 故意输入恶意数据

#### 验证的类型

**1. 存在性验证（必填字段）**
```javascript
if (!name) {
  return res.status(400).json({ error: '赛事名称不能为空' });
}
```

**2. 类型验证**
```javascript
const id = parseInt(req.params.id);
if (isNaN(id)) {
  return res.status(400).json({ error: 'ID 必须是数字' });
}
```

**3. 格式验证（正则表达式）**
```javascript
// 日期格式：YYYY-MM-DD
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date)) {
  return res.status(400).json({ error: '日期格式错误，应为 YYYY-MM-DD' });
}

// 邮箱格式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ error: '邮箱格式不正确' });
}
```

**4. 范围验证**
```javascript
// 字符串长度
if (name.length < 2 || name.length > 50) {
  return res.status(400).json({ error: '名称长度应在 2-50 个字符之间' });
}

// 数值范围
if (maxParticipants < 1 || maxParticipants > 10000) {
  return res.status(400).json({ error: '参赛人数应在 1-10000 之间' });
}
```

**5. 枚举验证**
```javascript
const validStatuses = ['upcoming', 'ongoing', 'completed'];
if (!validStatuses.includes(status)) {
  return res.status(400).json({
    error: '状态值无效',
    validValues: validStatuses
  });
}
```

#### 验证函数封装

```javascript
// utils/validators.js
const validateRace = (data) => {
  const errors = [];

  if (!data.name) {
    errors.push('赛事名称不能为空');
  } else if (data.name.length < 2 || data.name.length > 50) {
    errors.push('名称长度应在 2-50 个字符之间');
  }

  if (!data.date) {
    errors.push('日期不能为空');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('日期格式错误，应为 YYYY-MM-DD');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = { validateRace };
```

---

### 3️⃣ try-catch 错误处理

#### 为什么需要 try-catch？

代码执行过程中可能发生意外错误，如果不处理，服务器会崩溃！

**没有错误处理（危险）：**
```javascript
exports.getRaces = (req, res) => {
  // 如果这里出错，整个服务器可能崩溃
  const races = someRiskyOperation();
  res.json(races);
};
```

**有错误处理（安全）：**
```javascript
exports.getRaces = (req, res) => {
  try {
    const races = someRiskyOperation();
    res.json(races);
  } catch (error) {
    console.error('获取赛事失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};
```

#### try-catch 语法

```javascript
try {
  // 可能出错的代码
} catch (error) {
  // 错误处理代码
  // error 对象包含错误信息
  console.error(error.message);  // 错误消息
  console.error(error.stack);    // 错误堆栈
}
```

#### 完整示例

```javascript
exports.createRace = (req, res) => {
  try {
    const { name, date, location } = req.body;

    // 1. 数据验证
    if (!name || !date) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 2. 业务逻辑
    const newRace = {
      id: Date.now(),
      name,
      date,
      location: location || '未指定'
    };

    races.push(newRace);

    // 3. 成功响应
    res.status(201).json({
      message: '创建成功',
      data: newRace
    });

  } catch (error) {
    // 4. 错误处理
    console.error('创建赛事失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};
```

---

### 4️⃣ 统一错误处理中间件

#### 为什么需要统一处理？

每个控制器都写 try-catch 太重复了！可以用中间件统一处理。

#### 错误处理中间件

Express 的错误处理中间件有**4个参数**：`(err, req, res, next)`

```javascript
// middlewares/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('错误:', err);

  // 默认 500 错误
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    error: message,
    // 开发环境显示详细错误，生产环境隐藏
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
```

#### 在 server.js 中使用

```javascript
const express = require('express');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ... 其他中间件和路由

// 错误处理中间件放在最后！
app.use(errorHandler);

app.listen(5000);
```

#### 自定义错误类

```javascript
// utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
```

#### 在控制器中使用

```javascript
const AppError = require('../utils/AppError');

exports.getRaceById = (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const race = races.find(r => r.id === id);

    if (!race) {
      // 抛出自定义错误，由错误中间件统一处理
      throw new AppError('赛事不存在', 404);
    }

    res.json(race);
  } catch (error) {
    next(error);  // 传递给错误处理中间件
  }
};
```

---

### 5️⃣ 统一响应格式

#### 为什么要统一格式？

统一的响应格式让前端更容易处理数据。

#### 推荐格式

**成功响应：**
```javascript
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

**错误响应：**
```javascript
{
  "success": false,
  "error": "错误描述",
  "details": ["具体错误1", "具体错误2"]  // 可选
}
```

#### 响应工具函数

```javascript
// utils/response.js

// 成功响应
const success = (res, data, message = '操作成功', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

// 错误响应
const error = (res, message, statusCode = 400, details = null) => {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details })
  });
};

module.exports = { success, error };
```

---

## 💡 关键概念总结

| 概念 | 说明 |
|-----|------|
| **状态码** | 三位数字表示请求结果（2xx成功/4xx客户端错误/5xx服务器错误） |
| **数据验证** | 检查用户输入的存在性、类型、格式、范围 |
| **try-catch** | 捕获代码执行中的异常，防止服务器崩溃 |
| **错误中间件** | 统一处理所有错误，4个参数 (err, req, res, next) |
| **统一响应** | 保持响应格式一致，方便前端处理 |

---

## 🎯 学习检查

理解了这些概念后，你应该能回答：

1. **400 和 404 状态码有什么区别？**
   - 400：请求参数有问题
   - 404：请求的资源不存在

2. **为什么要用 try-catch？**
   - 捕获异常，防止服务器崩溃，返回友好的错误信息

3. **错误处理中间件和普通中间件有什么区别？**
   - 错误中间件有 4 个参数，第一个是 error

4. **数据验证应该在哪里做？**
   - 在控制器中，处理业务逻辑之前

---

## 📝 实践作业

### 作业 5.1：添加输入验证

**任务：** 在 `raceController.js` 的 `createRace` 函数中添加完整的输入验证

**要求：**
- 验证 `name` 必填，长度 2-50 个字符
- 验证 `date` 必填，格式为 YYYY-MM-DD
- 验证失败返回 400 状态码和具体错误信息

**💡 正则表达式提示：**

日期验证用到的正则：`/^\d{4}-\d{2}-\d{2}$/`

| 符号 | 含义 | 示例 |
|-----|------|------|
| `^` | 字符串开头 | 确保从头开始匹配 |
| `\d` | 任意数字（0-9） | 匹配 0、1、2...9 |
| `{n}` | 前面的字符重复 n 次 | `\d{4}` = 4位数字 |
| `-` | 普通字符，匹配横杠 | 匹配 `-` |
| `$` | 字符串结尾 | 确保到此结束 |

所以 `/^\d{4}-\d{2}-\d{2}$/` 的意思是：
- `^` 从开头
- `\d{4}` 4位数字（年）
- `-` 横杠
- `\d{2}` 2位数字（月）
- `-` 横杠
- `\d{2}` 2位数字（日）
- `$` 到结尾

✅ 匹配：`2025-01-15`、`2024-12-31`
❌ 不匹配：`2025/01/15`、`25-1-5`、`2025-01-15 extra`

**使用方法：**
```javascript
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date)) {
  return res.status(400).json({ error: '日期格式错误，应为 YYYY-MM-DD' });
}
```

**验收：**
- [ ] 缺少 name 时返回 400 错误
- [ ] name 长度不符合要求时返回 400 错误
- [ ] date 格式错误时返回 400 错误

---

### 作业 5.2：完善 404 错误处理

**任务：** 确保 `getRaceById`、`updateRace`、`deleteRace` 都正确处理资源不存在的情况

**要求：**
- 找不到资源时返回 404 状态码
- 返回清晰的错误信息

**验收：**
- [ ] 访问不存在的 ID 返回 404
- [ ] 错误信息清晰易懂

---

### 作业 5.3：创建错误处理中间件

**任务：** 创建 `backend/src/middlewares/errorHandler.js`

**代码模板：**
```javascript
// backend/src/middlewares/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('错误:', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    error: message
  });
};

module.exports = errorHandler;
```

**验收：**
- [ ] 创建了 middlewares 文件夹
- [ ] 创建了 errorHandler.js 文件

---

### 作业 5.4：在 server.js 中使用错误中间件

**任务：** 在 `server.js` 中引入并使用错误处理中间件

**提示：** 错误处理中间件要放在所有路由之后！

```javascript
// server.js
const errorHandler = require('./src/middlewares/errorHandler');

// ... 其他代码

// 路由
app.use('/api/races', raceroutes);

// 错误处理中间件（放在最后）
app.use(errorHandler);
```

**验收：**
- [ ] 错误中间件已引入
- [ ] 放在所有路由之后

---

### 作业 5.5：创建自定义错误类（进阶）

**任务：** 创建 `backend/src/utils/AppError.js`

**代码：**
```javascript
// backend/src/utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
```

**验收：**
- [ ] 创建了 utils 文件夹
- [ ] 创建了 AppError.js 文件

---

### 作业 5.6：在控制器中使用自定义错误（进阶）

**任务：** 修改控制器，使用 `AppError` 和 `next()` 传递错误

**示例：**
```javascript
const AppError = require('../utils/AppError');

exports.getRaceById = (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const race = races.find(r => r.id === id);

    if (!race) {
      throw new AppError('赛事不存在', 404);
    }

    res.json({ success: true, data: race });
  } catch (error) {
    next(error);
  }
};
```

**验收：**
- [ ] 控制器函数添加了 `next` 参数
- [ ] 使用 `throw new AppError()` 抛出错误
- [ ] 使用 `next(error)` 传递错误

---

## 🧪 测试作业

完成所有作业后，测试以下场景：

```bash
# 测试缺少必填字段
curl -X POST http://localhost:5000/api/races \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-12-01"}'
# 应返回 400 错误

# 测试日期格式错误
curl -X POST http://localhost:5000/api/races \
  -H "Content-Type: application/json" \
  -d '{"name": "测试", "date": "2025/12/01"}'
# 应返回 400 错误

# 测试资源不存在
curl http://localhost:5000/api/races/99999
# 应返回 404 错误

# 测试正常创建
curl -X POST http://localhost:5000/api/races \
  -H "Content-Type: application/json" \
  -d '{"name": "测试赛事", "date": "2025-12-01", "location": "线上"}'
# 应返回 201 成功
```

---

## ✅ 完整验收清单

- [ ] createRace 添加了完整的输入验证
- [ ] 所有需要的地方都处理了 404 错误
- [ ] 创建了 errorHandler.js 中间件
- [ ] server.js 中使用了错误中间件
- [ ] （进阶）创建了 AppError.js
- [ ] （进阶）控制器使用了自定义错误
- [ ] 所有测试场景通过

---

完成后记得在 `docs/LEARNING.md` 中记录你的学习心得！
