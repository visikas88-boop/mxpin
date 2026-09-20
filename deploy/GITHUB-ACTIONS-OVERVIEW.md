# 🚀 VideoFlow Pro - GitHub Actions 自动部署方案

## ✅ 准备完成

所有文件已准备好，现在可以开始配置自动化部署！

---

## 📦 已创建的文件

### 核心文件
- `.github/workflows/deploy.yml` - GitHub Actions工作流配置
- `deploy/first-deploy-github.sh` - 服务器首次部署脚本
- `.gitignore` - 已更新，保护敏感文件

### 文档
- `deploy/GITHUB-ACTIONS-SETUP.md` - 详细配置指南
- `deploy/QUICK-START-GITHUB.txt` - 快速开始指南
- `deploy/GITHUB-ACTIONS-OVERVIEW.md` - 本文件

---

## 🎯 工作原理

```
你本地修改代码
    ↓
git commit & push
    ↓
GitHub Actions 触发
    ↓
自动SSH到服务器
    ↓
拉取代码 → 安装依赖 → 构建前端 → 重启服务
    ↓
部署完成！✅
```

**时间**: 每次约2-3分钟自动完成

---

## 📋 立即开始（4步完成）

### 1️⃣ 配置GitHub Secrets（5分钟）

打开：https://github.com/basketikun/infinite-canvas/settings/secrets/actions

添加4个Secrets：
- `SERVER_HOST` = `45.32.65.132`
- `SERVER_USER` = `root`
- `SERVER_PASSWORD` = `[3EriKL4x*gFy]Ky`
- `GITHUB_REPO_URL` = `https://github.com/basketikun/infinite-canvas.git`

### 2️⃣ 推送配置文件到GitHub（2分钟）

```bash
cd F:\Aipost
git add .github/workflows/deploy.yml
git add .gitignore
git add deploy/
git commit -m "feat: add GitHub Actions auto-deploy"
git push origin main
```

### 3️⃣ 服务器首次部署（15分钟，只需一次）

打开 `deploy/QUICK-START-GITHUB.txt`，复制步骤3的命令到Vultr控制台执行。

### 4️⃣ 测试自动部署（3分钟）

```bash
echo "test" >> README.md
git add README.md
git commit -m "test: auto deploy"
git push
```

查看GitHub Actions：https://github.com/basketikun/infinite-canvas/actions

---

## 🎉 完成后的效果

以后开发流程：
```bash
# 1. 本地开发
# ... 修改代码 ...

# 2. 提交推送
git add .
git commit -m "feat: 新功能"
git push

# 3. ✅ 自动部署完成！（2-3分钟）
# 无需任何手动操作！
```

---

## 📊 监控和管理

### GitHub上查看
- 仓库 → Actions → 查看每次部署日志

### 服务器上查看
```bash
pm2 status          # 服务状态
pm2 logs            # 实时日志
systemctl status nginx  # Nginx状态
```

---

## 🔧 故障排查

### 部署失败？
1. 查看GitHub Actions日志找错误
2. 检查Secrets配置是否正确
3. 确认服务器SSH可访问

### 服务启动失败？
```bash
pm2 logs videoflow-backend --err
```

### Nginx错误？
```bash
tail -f /var/log/nginx/error.log
```

---

## 📚 详细文档

- **快速开始**: `deploy/QUICK-START-GITHUB.txt` ⭐
- **详细指南**: `deploy/GITHUB-ACTIONS-SETUP.md`
- **首次部署脚本**: `deploy/first-deploy-github.sh`

---

## ⚡ 下一步行动

**现在就开始**：
1. 打开 `deploy/QUICK-START-GITHUB.txt`
2. 按照步骤1-4执行
3. 享受自动化部署！

**预计总时间**: 25分钟（首次配置）

以后每次部署：**0分钟人工操作**（全自动）

---

🎯 **目标**: 让你专注于开发，部署交给自动化！

立即开始吧！🚀
