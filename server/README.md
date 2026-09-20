# VideoFlow Pro Server

AI 视频生成与多平台发布系统 - 后端服务

## 🚀 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置数据库和密钥
nano .env
```

必须配置的环境变量：
- `DATABASE_PASSWORD`: PostgreSQL 密码
- `JWT_SECRET`: JWT 密钥（至少 32 字符）
- `ENCRYPTION_KEY`: API Key 加密密钥（必须 32 字符）

### 3. 初始化数据库

```bash
# 确保 PostgreSQL 已安装并运行
# macOS: brew services start postgresql@15
# Ubuntu: sudo systemctl start postgresql

# 执行数据库迁移
npm run db:migrate
```

成功后会看到：
```
✅ Migration completed successfully!
📊 Database created: videoflow_pro
📋 Total tables: 9
👤 Default admin user:
   Email: admin@videoflow.pro
   Username: admin
   Password: admin123
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务器启动在 `http://localhost:3001`

---

## 📁 项目结构

```
server/
├── src/
│   ├── config/           # 配置文件
│   │   └── database.js   # 数据库配置
│   ├── modules/          # 业务模块
│   │   ├── auth/         # 认证模块（待开发）
│   │   ├── model/        # 模型管理（待开发）
│   │   ├── generation/   # AI 生成（待开发）
│   │   ├── publish/      # 发布管理（待开发）
│   │   └── admin/        # 管理后台（待开发）
│   ├── common/           # 公共模块
│   │   └── middleware/   # 中间件（待开发）
│   ├── database/
│   │   ├── migrations/   # 数据库迁移脚本
│   │   └── migrate.js    # 迁移执行器
│   ├── utils/
│   │   └── crypto.js     # 加密工具
│   └── index.js          # 入口文件
├── .env.example          # 环境变量模板
├── package.json
└── README.md
```

---

## 🗄️ 数据库表

| 表名 | 说明 |
|-----|------|
| users | 用户表（含积分） |
| ai_models | AI 模型配置表 |
| generation_tasks | 生成任务表 |
| generated_contents | 内容库表 |
| upload_post_config | Upload-Post 配置 |
| publish_tasks | 发布任务表 |
| points_transactions | 积分流水表 |
| recharge_orders | 充值订单表 |
| admin_logs | 管理员操作日志 |

---

## 🔐 安全配置

### 生成密钥

```bash
# 生成 32 字符随机字符串（用于 JWT_SECRET 和 ENCRYPTION_KEY）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### API Key 加密

所有 AI 模型的 API Key 都会使用 AES-256-CBC 加密后存储在数据库中。

---

## 🧪 测试

### 测试数据库连接

```bash
psql -U postgres -d videoflow_pro -c "SELECT COUNT(*) FROM users;"
```

### 测试 API

```bash
# 健康检查
curl http://localhost:3001/health

# API 信息
curl http://localhost:3001/api
```

---

## 📚 API 接口（开发中）

### 认证模块
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/profile` - 获取用户信息

### 模型管理
- `GET /api/models/public` - 获取公开模型列表
- `POST /api/admin/models` - 创建模型（管理员）
- `PUT /api/admin/models/:id` - 更新模型
- `DELETE /api/admin/models/:id` - 删除模型

### AI 生成
- `POST /api/generate/image` - 图片生成
- `POST /api/generate/video` - 视频生成

### 发布管理
- `GET /api/contents` - 获取内容库
- `POST /api/publish/create` - 创建发布任务
- `GET /api/publish/tasks/:id` - 查询任务状态

---

## 🔧 开发计划

### Week 1（当前）
- [x] 项目初始化
- [x] 数据库设计与迁移
- [ ] 认证模块（JWT）
- [ ] 模型管理 CRUD
- [ ] AI 生成接口

### Week 2
- [ ] Upload-Post 集成
- [ ] 发布任务队列
- [ ] 实时状态推送

### Week 3-4
- [ ] 管理后台 API
- [ ] 测试与优化
- [ ] 部署到 DigitalOcean

---

## 🐛 故障排查

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql  # Linux
brew services list               # macOS

# 检查端口
netstat -an | grep 5432

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

### 迁移失败

```bash
# 手动执行迁移 SQL
psql -U postgres -f src/database/migrations/001-init.sql
```

---

## 📝 下一步

1. 开发认证模块（用户注册/登录）
2. 开发模型管理 API
3. 集成 AI 生成功能
4. 前端对接测试

---

## 📞 支持

遇到问题？查看：
- 完整文档：`/f/Aipost/DOC-002-数据库设计与迁移脚本.md`
- 商业计划：`/f/Aipost/商业计划-VideoFlow-Pro-完整方案.md`
