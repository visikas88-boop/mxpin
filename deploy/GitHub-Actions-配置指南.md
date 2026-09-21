# GitHub Actions 自动部署配置指南

## 📋 概述

项目已配置GitHub Actions自动部署工作流，每次推送代码到main分支会自动部署到Vultr服务器。

## 🔐 第一步：配置GitHub Secrets

### 1. 打开GitHub仓库设置

访问：https://github.com/visikas88-boop/mxpin/settings/secrets/actions

或者手动导航：
1. 打开 https://github.com/visikas88-boop/mxpin
2. 点击 **Settings** 标签
3. 左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** 按钮

### 2. 添加以下4个Secrets

#### Secret 1: SERVER_HOST
```
名称: SERVER_HOST
值: 45.32.65.132
```

#### Secret 2: SERVER_USER
```
名称: SERVER_USER
值: root
```

#### Secret 3: SERVER_PASSWORD
```
名称: SERVER_PASSWORD
值: [你的Vultr服务器root密码]
```

#### Secret 4: REPO_URL
```
名称: REPO_URL
值: https://github.com/visikas88-boop/mxpin.git
```

### 3. 验证Secrets配置

配置完成后，你应该看到4个Secrets：
- ✅ SERVER_HOST
- ✅ SERVER_USER
- ✅ SERVER_PASSWORD
- ✅ REPO_URL

---

## 🚀 第二步：触发自动部署

### 方式1：推送代码触发（自动）

每次推送代码到main分支会自动触发部署：

```bash
git add .
git commit -m "feat: trigger deployment"
git push origin main
```

### 方式2：手动触发（推荐首次部署）

1. 访问 Actions 页面：https://github.com/visikas88-boop/mxpin/actions
2. 左侧点击 **Deploy to Vultr Server** 工作流
3. 右侧点击 **Run workflow** 按钮
4. 选择 **main** 分支
5. 点击绿色的 **Run workflow** 按钮

---

## 📊 第三步：监控部署进度

### 1. 查看部署日志

1. 访问：https://github.com/visikas88-boop/mxpin/actions
2. 点击最新的工作流运行
3. 点击 **deploy** 任务
4. 展开各个步骤查看详细日志

### 2. 部署过程说明

**首次部署**（约5-10分钟）：
- ✅ 克隆代码仓库
- ✅ 安装Node.js 18.x
- ✅ 安装PostgreSQL数据库
- ✅ 创建数据库和用户
- ✅ 安装后端依赖
- ✅ 配置PM2进程管理
- ✅ 构建前端
- ✅ 配置Nginx

**后续更新**（约2-3分钟）：
- ✅ 拉取最新代码
- ✅ 安装依赖
- ✅ 构建前端
- ✅ 重启后端服务
- ✅ 重载Nginx

### 3. 部署成功标志

当你看到以下输出时，表示部署成功：

```
==========================================
✅ 部署完成！
时间: [时间戳]
==========================================
```

---

## ✅ 第四步：验证部署

### 1. 访问应用

- 🌐 前端: http://45.32.65.132
- 🔌 API: http://45.32.65.132/api
- ❤️ 健康检查: http://45.32.65.132/api/health

### 2. 管理员登录

```
Email: admin@videoflow.pro
Password: admin123
```

⚠️ **重要**：首次登录后请立即修改密码！

### 3. SSH验证（可选）

```bash
ssh root@45.32.65.132

# 查看服务状态
pm2 status

# 查看后端日志
pm2 logs videoflow-backend --lines 20

# 检查Nginx
systemctl status nginx
```

---

## 🔧 故障排查

### 部署失败：Secrets未配置

**错误信息**：
```
Error: Input required and not supplied: host
```

**解决方法**：
检查并确保已配置所有4个Secrets

### 部署失败：SSH连接失败

**错误信息**：
```
ssh: connect to host 45.32.65.132 port 22: Connection refused
```

**可能原因**：
1. 服务器IP错误
2. SSH服务未启动
3. 防火墙阻止连接

**解决方法**：
1. 登录Vultr控制台确认服务器IP和状态
2. 更新 SERVER_HOST Secret
3. 确保服务器SSH服务运行：`systemctl status ssh`

### 部署失败：密码错误

**错误信息**：
```
Permission denied, please try again
```

**解决方法**：
更新 SERVER_PASSWORD Secret，确保密码正确

### 部署失败：权限不足

**错误信息**：
```
Permission denied
E: Could not open lock file
```

**解决方法**：
确保使用root用户（SERVER_USER = root）

### 前端无法访问

**检查清单**：
```bash
# SSH登录服务器
ssh root@45.32.65.132

# 检查前端构建
ls -la /var/www/videoflow-pro/web/dist

# 检查Nginx配置
nginx -t

# 查看Nginx日志
tail -f /var/log/nginx/error.log

# 重启Nginx
systemctl restart nginx
```

### 后端服务异常

**检查清单**：
```bash
# 查看PM2状态
pm2 status

# 查看后端日志
pm2 logs videoflow-backend --lines 50

# 重启后端
pm2 restart videoflow-backend

# 检查数据库连接
sudo -u postgres psql -l | grep videoflow_pro
```

---

## 🎯 快速开始（完整流程）

### 1分钟配置清单

```
☐ 1. 打开 GitHub Secrets 页面
☐ 2. 添加 SERVER_HOST = 45.32.65.132
☐ 3. 添加 SERVER_USER = root  
☐ 4. 添加 SERVER_PASSWORD = [你的密码]
☐ 5. 添加 REPO_URL = https://github.com/visikas88-boop/mxpin.git
☐ 6. 打开 Actions 页面
☐ 7. 点击 "Deploy to Vultr Server"
☐ 8. 点击 "Run workflow"
☐ 9. 等待5-10分钟
☐ 10. 访问 http://45.32.65.132
```

---

## 📝 注意事项

1. **首次部署需要5-10分钟**，请耐心等待
2. **后续更新只需2-3分钟**
3. **自动部署在每次推送到main分支时触发**
4. **可以随时手动触发部署**（Actions页面）
5. **部署日志可在GitHub Actions中查看**
6. **部署失败会收到邮件通知**（GitHub设置中配置）

---

## 🔄 日常使用

### 更新代码并自动部署

```bash
# 1. 修改代码
# 2. 提交并推送
git add .
git commit -m "feat: 添加新功能"
git push origin main

# 3. 自动触发部署（无需其他操作）
# 4. 访问 GitHub Actions 查看部署进度
# 5. 部署完成后访问 http://45.32.65.132 验证
```

### 回滚到上一个版本

如果新版本有问题，可以快速回滚：

```bash
# 方式1：推送回滚代码
git revert HEAD
git push origin main

# 方式2：手动在服务器回滚
ssh root@45.32.65.132
cd /var/www/videoflow-pro
git log --oneline  # 查看提交历史
git reset --hard [上一个版本的commit-id]
pm2 restart videoflow-backend
```

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. GitHub Actions 部署日志（完整）
2. 服务器SSH检查结果（pm2 status, nginx -t）
3. 错误截图或错误信息

祝部署顺利！🎉
