# VideoFlow Pro - 项目总览

## 🎯 项目简介

VideoFlow Pro 是一个基于 AI 的视频/图片生成与多平台自动发布管理系统。

**核心功能：**
- AI 视频/图片生成（支持多种模型）
- 多平台内容发布（Facebook、Instagram、TikTok、YouTube、Pinterest）
- 积分计费系统
- 用户权限管理
- 生成任务管理

---

## 📁 项目结构

```
F:/Aipost/
├── server/                    # 后端（Node.js + Express）
│   ├── src/
│   │   ├── config/           # 配置文件
│   │   ├── controllers/      # 控制器
│   │   ├── middleware/       # 中间件
│   │   ├── routes/           # 路由
│   │   ├── utils/            # 工具函数
│   │   ├── database/         # 数据库迁移
│   │   └── index.js          # 入口文件
│   ├── .env                  # 环境变量
│   └── package.json
│
├── web/                       # 前端（React + TypeScript）
│   ├── src/
│   │   ├── components/       # 组件
│   │   ├── pages/            # 页面
│   │   ├── stores/           # 状态管理
│   │   └── services/         # API服务
│   └── package.json
│
├── admin/                     # 管理后台
│
├── docs/                      # 用户文档站点（NextJS项目）
│
├── project-docs/              # 📚 项目管理文档
│   ├── design/               # 设计文档
│   ├── testing/              # 测试文档
│   ├── api/                  # API配置文档
│   ├── installation/         # 安装指南
│   ├── development/          # 开发文档
│   ├── deployment/           # 部署指南
│   ├── reports/              # 开发报告
│   ├── README.md             # 文档管理规范
│   └── INDEX.md              # 文档索引
│
├── README.md                  # 本文件
├── CHANGELOG.md              # 版本日志
├── SECURITY.md               # 安全策略
└── AGENTS.md                 # AI Agent配置
```

> 📖 **查看所有文档**: [project-docs/INDEX.md](project-docs/INDEX.md)  
> 📋 **文档管理规范**: [project-docs/README.md](project-docs/README.md)

---

## 🛠️ 技术栈

### 后端
- **框架**: Node.js + Express
- **数据库**: PostgreSQL 18.6
- **认证**: JWT + bcrypt
- **加密**: AES-256-CBC
- **HTTP 客户端**: Axios

### 前端
- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态**: Zustand
- **图标**: Lucide React
- **提示**: React Hot Toast

---

## 📊 数据库设计

### 核心表结构（9张表）

1. **users** - 用户表
   - 基础信息、角色、积分余额

2. **ai_models** - AI 模型配置
   - 灵活配置、加密 API Key

3. **generation_tasks** - 生成任务
   - 状态追踪、积分消费

4. **generated_contents** - 生成内容
   - 文件 URL、元数据

5. **upload_post_config** - 发布平台配置
   - 平台 Token 管理

6. **publish_tasks** - 发布任务
   - 多平台发布记录

7. **points_transactions** - 积分交易
   - 充值/消费/退款

8. **recharge_orders** - 充值订单
   - 支付记录

9. **admin_logs** - 管理员日志
   - 操作审计

---

## 🔌 API 接口

### 认证模块 (5个)
- POST `/api/auth/register` - 注册
- POST `/api/auth/login` - 登录
- GET `/api/auth/me` - 获取当前用户
- PUT `/api/auth/profile` - 更新资料
- PUT `/api/auth/password` - 修改密码

### 模型管理 (6个)
- GET `/api/models` - 获取模型列表
- GET `/api/models/:id` - 获取模型详情
- POST `/api/models` - 创建模型 (admin)
- PUT `/api/models/:id` - 更新模型 (admin)
- DELETE `/api/models/:id` - 删除模型 (admin)
- POST `/api/models/:id/test` - 测试模型 (admin)

### 生成任务 (4个)
- POST `/api/generation/create` - 创建任务
- GET `/api/generation/tasks/:id` - 查询任务状态
- GET `/api/generation/tasks` - 获取任务列表
- POST `/api/generation/tasks/:id/cancel` - 取消任务

### 积分系统 (5个)
- GET `/api/points/balance` - 获取余额
- GET `/api/points/transactions` - 交易记录
- GET `/api/points/orders` - 充值订单
- GET `/api/points/stats` - 积分统计
- POST `/api/points/recharge` - 手动充值 (admin)

**总计：20 个 API 接口**

---

## 🚀 快速开始

### 1. 环境准备

**必需软件：**
- Node.js >= 18
- PostgreSQL 18.6
- npm >= 9

### 2. 后端启动

```bash
# 进入后端目录
cd F:\Aipost\server

# 安装依赖
npm install

# 数据库迁移
npm run db:migrate

# 启动开发服务器
npm run dev
```

后端运行在: http://localhost:3001

### 3. 前端启动

```bash
# 进入前端目录
cd F:\Aipost\frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端运行在: http://localhost:3000

### 4. 一键启动

双击运行 `启动服务.bat`

---

## 🔑 测试账号

### 管理员
- 用户名: `admin`
- 密码: `admin123`
- 积分: 999999

### 测试用户
- 用户名: `testuser`
- 密码: `test123456`
- 积分: 3000

---

## 📋 开发进度

### Day 1 - 环境搭建 ✅
- PostgreSQL 安装配置
- 数据库设计
- 项目初始化

### Day 2 - 后端核心 ✅
- 用户认证系统
- 模型管理 CRUD
- JWT + bcrypt 安全

### Day 3 - 生成与积分 ✅
- AI 生成任务系统
- 积分计费系统
- 失败自动退款

### Day 3 下午 - 前端开发 ✅
- 登录页面
- 后台布局（左侧导航）
- 工作台
- AI 生成页面
- 积分中心

### Day 4 - 待完成 ⏳
- [ ] Upload-Post API 集成
- [ ] 多平台发布功能
- [ ] 内容管理页面
- [ ] 系统设置页面

---

## 🎨 功能特性

### 已完成 ✅

**用户系统**
- 注册/登录
- JWT 认证
- 角色权限（user/admin）
- 资料管理

**模型管理**
- 灵活配置（不硬编码）
- API Key 加密存储
- 支持视频/图片模型
- 6 个预置模型

**生成系统**
- 创建生成任务
- 异步 AI 调用
- 状态追踪
- 失败自动退款

**积分系统**
- 充值/消费/退款
- 完整交易记录
- 余额检查
- 统计分析

**前端界面**
- 响应式设计
- 左侧导航布局
- 工作台数据展示
- AI 生成创建
- 积分中心管理

### 待完成 ⏳

**内容管理**
- 内容列表
- 内容详情
- 编辑/删除

**发布管理**
- Upload-Post 集成
- 多平台发布
- 发布状态追踪

**系统设置**
- 个人设置
- 平台配置
- 模型管理（admin）

---

## 🔒 安全特性

1. **密码安全**
   - bcrypt 加密（10 rounds）
   - 强度验证

2. **API Key 保护**
   - AES-256-CBC 加密
   - 数据库加密存储

3. **JWT 认证**
   - 7 天有效期
   - 自动刷新机制

4. **权限控制**
   - 角色分离（user/admin）
   - 接口权限验证

5. **数据验证**
   - 输入验证
   - SQL 注入防护
   - XSS 防护

---

## 📈 性能优化

1. **数据库**
   - 索引优化
   - 连接池管理
   - 查询优化

2. **前端**
   - 代码分割
   - 懒加载
   - 图片优化

3. **API**
   - 响应缓存
   - 请求合并
   - 超时控制

---

## 🐛 已知问题

1. ⚠️ 预置模型 API Key 为占位符（需更新）
2. ⚠️ 暂不支持实际 AI 调用（等待真实 API Key）
3. ⚠️ 前端分页功能待完善
4. ⚠️ 移动端体验待优化

---

## 📝 部署指南

### 开发环境
- Windows 本地开发
- PostgreSQL 本地数据库
- Node.js 开发服务器

### 生产环境（计划）
- DigitalOcean 服务器（4G2C80G）
- Linux 系统
- PM2 进程管理
- Nginx 反向代理

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

---

## 📄 License

Private - All Rights Reserved

---

## 📞 联系方式

项目开发中，如有问题请查看文档：

**核心文档**
- 📚 [项目文档索引](project-docs/INDEX.md) - 快速查找所有文档
- 📋 [文档管理规范](project-docs/README.md) - 文档组织规则

**快速开始**
- 🚀 [快速启动指南](project-docs/deployment/快速启动指南.md)
- 📦 [开发环境搭建](project-docs/installation/开发环境搭建指南.md)
- 🔑 [后台访问指南](project-docs/deployment/后台管理系统访问指南.md)

**开发参考**
- 🗄️ [数据库设计](project-docs/design/DOC-002-数据库设计与迁移脚本.md)
- 🧪 [API测试文档](project-docs/testing/API-测试文档.md)
- 👥 [用户管理功能](project-docs/development/README-用户管理与积分管理.md)

**问题排查**
- 🔧 [快速修复指南](project-docs/testing/快速修复指南.md)
- ✅ [模型配置验证](project-docs/testing/模型配置修复-验证指南.md)

---

## 🎉 致谢

感谢以下技术和工具：
- Node.js / Express
- PostgreSQL
- Next.js / React
- Tailwind CSS
- Vercel
- DigitalOcean
