# 🚀 GitHub Actions 自动部署配置指南

## 📋 概述

配置完成后，你只需要：
```bash
git push
```
GitHub Actions会自动部署到服务器！完全自动化！

---

## ⚙️ 配置步骤

### 第一步：在GitHub仓库设置Secrets

1. 打开你的GitHub仓库页面
2. 点击 **Settings**（设置）
3. 左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** 按钮

添加以下4个Secrets：

#### Secret 1: SERVER_HOST
- **Name**: `SERVER_HOST`
- **Value**: `45.32.65.132`

#### Secret 2: SERVER_USER
- **Name**: `SERVER_USER`
- **Value**: `root`

#### Secret 3: SERVER_PASSWORD
- **Name**: `SERVER_PASSWORD`
- **Value**: `[3EriKL4x*gFy]Ky`

#### Secret 4: GITHUB_REPO_URL
- **Name**: `GITHUB_REPO_URL`
- **Value**: `https://github.com/basketikun/infinite-canvas.git`
（你的仓库地址）

---

### 第二步：推送代码到GitHub

在本地执行：

```bash
cd F:\Aipost

# 添加GitHub Actions配置文件
git add .github/workflows/deploy.yml

# 提交
git commit -m "feat: add GitHub Actions auto-deploy"

# 推送到GitHub
git push origin main
```

⚠️ **注意**：不要推送敏感文件！

确保 `.gitignore` 包含：
```
AiAPIKey
node_modules/
*.log
.env
*.pid
```

---

### 第三步：在服务器执行首次部署

**只需执行一次**，在Vultr Web控制台执行：

```bash
# 方法1：直接执行在线脚本（推荐）
curl -sSL https://raw.githubusercontent.com/basketikun/infinite-canvas/main/deploy/first-deploy-github.sh | bash

# 方法2：手动复制脚本内容执行
# 打开 F:\Aipost\deploy\first-deploy-github.sh
# 复制所有内容到Vultr控制台执行
```

这个脚本会：
- ✅ 安装所有必要环境（Node.js, PostgreSQL, Nginx, PM2）
- ✅ 克隆GitHub代码
- ✅ 配置数据库
- ✅ 构建并启动项目
- ✅ 配置Nginx

**预计时间**：15-20分钟

---

### 第四步：测试自动部署

首次部署完成后，测试自动化：

1. 在本地修改代码：
```bash
cd F:\Aipost
echo "# Test auto deploy" >> README.md
git add .
git commit -m "test: auto deploy"
git push
```

2. 查看GitHub Actions执行：
   - 打开GitHub仓库页面
   - 点击 **Actions** 标签
   - 查看正在运行的workflow
   - 等待显示绿色✅（约2-3分钟）

3. 访问网站验证：
   - http://45.32.65.132

---

## 🎯 工作流程

以后的开发流程：

```bash
# 1. 本地开发和测试
npm run dev

# 2. 提交代码
git add .
git commit -m "feat: 新功能"

# 3. 推送到GitHub
git push

# 4. 🎉 自动部署完成！（无需任何手动操作）
```

GitHub Actions会自动：
- 拉取最新代码
- 安装依赖
- 构建前端
- 重启后端
- 重载Nginx

**约2-3分钟后访问网站即可看到更新！**

---

## 📊 监控部署状态

### 在GitHub查看
- 仓库页面 → **Actions** 标签
- 查看每次部署的日志
- 失败会收到邮件通知

### 在服务器查看
```bash
# 查看后端日志
pm2 logs videoflow-backend

# 查看Nginx日志
tail -f /var/log/nginx/videoflow-error.log

# 查看服务状态
pm2 status
systemctl status nginx
```

---

## 🔧 常见问题

### Q1: 部署失败怎么办？
查看GitHub Actions日志，找到错误行，通常是：
- Secrets配置错误
- 服务器SSH连接问题
- 依赖安装失败

### Q2: 如何回滚到之前的版本？
```bash
# 在GitHub页面找到之前的commit
# 点击该commit的Actions重新运行
# 或者本地执行：
git revert HEAD
git push
```

### Q3: 如何暂停自动部署？
- GitHub仓库 → Settings → Actions
- 禁用workflow

### Q4: 如何手动触发部署？
- GitHub仓库 → Actions
- 选择 "Deploy to Vultr Server"
- 点击 "Run workflow"

---

## 🔐 安全建议

1. **使用私有仓库**（推荐）
   - GitHub设置仓库为Private
   - 避免敏感信息泄露

2. **不要提交敏感文件**
   - `.env` 文件
   - `AiAPIKey`
   - 数据库密码

3. **定期更换密码**
   - 服务器root密码
   - GitHub Secrets

4. **使用SSH密钥代替密码**（可选）
   - 生成SSH密钥对
   - 配置到GitHub Actions

---

## 📝 配置文件说明

### `.github/workflows/deploy.yml`
GitHub Actions配置文件，定义自动部署流程

### `deploy/first-deploy-github.sh`
服务器首次部署脚本（只执行一次）

---

## ✅ 配置检查清单

部署前确认：

- [ ] GitHub Secrets已配置（4个）
- [ ] `.gitignore` 已配置
- [ ] 推送了 `.github/workflows/deploy.yml`
- [ ] 服务器已执行首次部署脚本
- [ ] 访问 http://45.32.65.132 能看到网站

全部完成后，你就拥有了：
🎉 **完全自动化的CI/CD部署系统！**

---

## 🚀 下一步

1. **现在**：按照本指南配置GitHub Secrets
2. **然后**：推送代码到GitHub
3. **接着**：在服务器执行首次部署
4. **最后**：享受自动化部署！

以后只需 `git push`，其他的交给GitHub Actions！

---

**需要帮助？查看GitHub Actions日志或服务器日志排查问题。**
