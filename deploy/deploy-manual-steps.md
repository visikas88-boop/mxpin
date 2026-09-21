# VideoFlow Pro 手动部署步骤

由于SSH密码认证需要交互式输入，请按以下步骤手动部署：

## 方式一：使用SSH密钥（推荐）

### 1. 生成SSH密钥（如果还没有）
```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
# 一路回车，使用默认路径
```

### 2. 复制公钥到服务器
```bash
ssh-copy-id root@45.32.65.132
# 输入服务器密码
```

### 3. 测试SSH连接（无需密码）
```bash
ssh root@45.32.65.132
```

### 4. 执行一键部署
```bash
cd F:/Aipost
bash deploy/one-click-deploy.sh
```

---

## 方式二：手动SSH登录部署

### 1. SSH登录到服务器
```bash
ssh root@45.32.65.132
# 输入密码
```

### 2. 在服务器上执行以下命令

```bash
# 创建部署目录
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro

# 安装Git（如果还没有）
apt-get update
apt-get install -y git

# 克隆代码（首次部署）
git clone https://github.com/visikas88-boop/mxpin.git .

# 或者更新代码（已有代码）
git fetch origin
git reset --hard origin/main

# 查看最新提交
git log -1 --oneline

# 执行部署脚本
chmod +x deploy/quick-deploy.sh
bash deploy/quick-deploy.sh
```

### 3. 等待部署完成

部署过程大约需要5-10分钟，脚本会自动：
- ✅ 安装 Node.js 18.x
- ✅ 安装 PostgreSQL 数据库
- ✅ 创建数据库和用户
- ✅ 导入数据库结构
- ✅ 安装后端依赖
- ✅ 配置 PM2 进程管理
- ✅ 构建前端
- ✅ 配置 Nginx

### 4. 验证部署

```bash
# 检查服务状态
pm2 status

# 检查后端健康
curl http://localhost:3000/api/health

# 检查Nginx
systemctl status nginx
```

### 5. 访问应用

- 🌐 前端: http://45.32.65.132
- 🔌 API: http://45.32.65.132/api
- ❤️ 健康检查: http://45.32.65.132/api/health

### 6. 管理员登录

- 📧 Email: admin@videoflow.pro
- 🔑 Password: admin123

**⚠️ 重要：首次登录后立即修改密码！**

---

## 方式三：使用GitHub Actions自动部署（推荐用于后续更新）

项目已配置GitHub Actions自动部署，每次推送到main分支会自动部署到服务器。

### 配置步骤：

1. 在GitHub仓库设置中添加Secrets：
   - `SERVER_HOST`: 45.32.65.132
   - `SERVER_USER`: root
   - `SERVER_PASSWORD`: 你的服务器密码
   - `SERVER_PORT`: 22

2. 推送代码到main分支后会自动触发部署

---

## 常用管理命令

```bash
# SSH登录服务器
ssh root@45.32.65.132

# 查看服务状态
pm2 status

# 查看后端日志
pm2 logs videoflow-backend

# 重启后端服务
pm2 restart videoflow-backend

# 查看Nginx日志
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# 重启Nginx
systemctl restart nginx

# 更新代码（服务器上）
cd /var/www/videoflow-pro
git pull origin main
pm2 restart videoflow-backend
```

---

## 故障排查

### 后端服务无法启动
```bash
# 查看详细日志
pm2 logs videoflow-backend --lines 50

# 检查数据库连接
psql -h localhost -U videoflow_user -d videoflow_pro
```

### 前端无法访问
```bash
# 检查Nginx配置
nginx -t

# 检查前端构建
ls -la /var/www/videoflow-pro/web/dist

# 重启Nginx
systemctl restart nginx
```

### 数据库连接失败
```bash
# 检查PostgreSQL状态
systemctl status postgresql

# 检查数据库是否存在
sudo -u postgres psql -l | grep videoflow_pro
```

---

## 下一步

1. ✅ 完成部署
2. ✅ 访问前端测试
3. ✅ 登录管理后台
4. ✅ 修改管理员密码
5. ⚙️ 配置Upload-Post API密钥
6. 🎬 测试视频生成功能
7. 🚀 测试多平台发布功能
