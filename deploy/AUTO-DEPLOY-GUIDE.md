# VideoFlow Pro 全自动化部署系统

## 🎯 方案概述

通过Vultr API + Startup Script实现完全自动化部署，无需手动操作服务器。

---

## 📋 准备工作

### 1. 获取Vultr API密钥

1. 访问：https://my.vultr.com/settings/#settingsapi
2. 点击 **"Enable API"**（如果还未启用）
3. 点击 **"Add API Key"**
4. 输入描述：`VideoFlow Deploy`
5. 复制生成的API密钥（只显示一次！）

### 2. 获取服务器ID

访问服务器页面，URL中的ID：
```
https://my.vultr.com/subs/?id=YOUR-SERVER-ID
```

或者在服务器详情页面的"Server Information"中查看"Instance ID"

---

## 🚀 方案A：通过API自动部署（推荐）

### 步骤1：配置环境变量

在Windows PowerShell中：
```powershell
$env:VULTR_API_KEY = "your-api-key-here"
$env:VULTR_SERVER_ID = "9c765e11-5249-4336-84d9-492e9ac84b00"
```

### 步骤2：执行自动部署脚本

```bash
cd F:\Aipost\deploy
bash vultr-auto-deploy.sh
```

### 步骤3：等待完成

- 服务器自动重启
- Startup Script自动执行所有部署步骤
- 约7-10分钟后完成

---

## 🛠️ 方案B：使用PowerShell直接部署

更简单的方式，不需要bash：

```powershell
# 1. 设置配置
$VULTR_API_KEY = "your-api-key-here"
$SERVER_ID = "9c765e11-5249-4336-84d9-492e9ac84b00"
$SERVER_IP = "45.32.65.122"

# 2. 读取部署脚本
$deployScript = Get-Content "F:\Aipost\deploy\manual-deploy-simple.sh" -Raw

# 3. 创建Startup Script
$body = @{
    name = "videoflow-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
    type = "boot"
    script = $deployScript
} | ConvertTo-Json

$scriptResponse = Invoke-RestMethod `
    -Uri "https://api.vultr.com/v2/startup-scripts" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $VULTR_API_KEY"
        "Content-Type" = "application/json"
    } `
    -Body $body

$scriptId = $scriptResponse.startup_script.id
Write-Host "✅ Startup Script创建成功: $scriptId"

# 4. 应用到服务器并重启
Invoke-RestMethod `
    -Uri "https://api.vultr.com/v2/instances/$SERVER_ID" `
    -Method PATCH `
    -Headers @{
        "Authorization" = "Bearer $VULTR_API_KEY"
        "Content-Type" = "application/json"
    } `
    -Body (@{script_id = $scriptId} | ConvertTo-Json)

Invoke-RestMethod `
    -Uri "https://api.vultr.com/v2/instances/$SERVER_ID/reboot" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $VULTR_API_KEY"
    }

Write-Host "🎉 部署已启动！"
Write-Host "⏱️  预计10分钟后完成"
Write-Host "🌐 访问地址: http://$SERVER_IP"
```

---

## 🔧 方案C：重新部署服务器（从头开始）

如果当前服务器有问题，可以销毁重建并自动部署：

### 1. 先上传SSH公钥到Vultr账户

访问：https://my.vultr.com/settings/#settingskeys

添加以下公钥：
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCm2ClnsI/VVZNel5Z6cX+Jv2cu2kBEHEY+2kuz3ao7/pNsqIBn3hz3Uo9OGO50gV6mb6GcvGb7orUFyLNI/xAUg6rEk0BP2qYC9VBeuGxtgEzx0ciQpyMvfdKRLTbhTN1gZlTgzSmoTHnmLIYp8allIRyuoYRIYFRmBrtadFLx5nUoMb0gQeQtooD6T84Xx7E6qAlcZq2z3n5Z1yDLFQ7NlfSujEqgVgaw96JslF8Xm35bDLTwRQFWh80MHpyIk4gj7l8EjlT7LQ1qVDQ/alC1C0RoGe44naXRvBk/sRMJJ3DDU/UntAdKVaZmo/7Dump92WmAC57467jN3IO//tPeBmlHZFn85yyZ6WnV3B3ImhKANBTEOIeayVYdLFwUhRyZjy+mHPBhJxZ/Gf38AtHiLTHOlsgh2YlAwkR2Rp9k3hT3uNI2TwfQolWuIHJcRSYzXAV8zGgSWTD6Lp6SH5mt4caVkatWpk5YizVkQQZ+g2xK/Zqvk68/ha1qdMQETsWlxjvkVxxcYbMCCkPL7IGZlP+Lu0kOfl1rQcLzQ+iU+WWgP4a6nzwTipV9xtKhNluihBtKGCnFeEkWgGo3hZmg17rft/rmZ5Pwsm9vfpLyNW/8j26en0dAUSD1UwRAuK7DHTk4G3hO8zR1JfbCwx4pf/deK7JKqDFhRhwoeI6z5w== claude-code@oneap
```

### 2. 创建Startup Script

通过API或Vultr控制台创建：
- 名称：`videoflow-auto-deploy`
- 类型：`boot`
- 脚本内容：使用 `deploy/manual-deploy-simple.sh` 的内容

### 3. 部署新服务器

创建时选择：
- OS: Ubuntu 22.04
- Location: Los Angeles
- Plan: 2 CPU, 4GB RAM
- **Enable IPv6**: ✓
- **SSH Keys**: 选择刚添加的密钥
- **Startup Script**: 选择 `videoflow-auto-deploy`

服务器启动后自动执行部署脚本。

---

## 🔍 监控部署进度

### 方法1：通过Vultr控制台

1. 访问：https://my.vultr.com/subs/
2. 点击服务器进入详情
3. 点击 **"View Console"**
4. 查看部署日志：
```bash
tail -f /var/log/videoflow-deploy.log
```

### 方法2：SSH连接（部署完成后）

```bash
ssh root@45.32.65.122
tail -f /var/log/videoflow-deploy.log
```

### 方法3：检查部署状态

```bash
ssh root@45.32.65.122 "test -f /var/www/videoflow-pro/.deployed && echo '✅ 部署完成' || echo '⏳ 部署中...'"
```

---

## 📊 部署时间线

1. **服务器重启**: 1-2分钟
2. **系统更新**: 1分钟
3. **安装Node.js + PostgreSQL**: 2-3分钟
4. **代码克隆 + 数据库初始化**: 1分钟
5. **后端依赖安装**: 2-3分钟
6. **前端构建**: 2-3分钟
7. **服务启动**: 1分钟

**总计**: 约7-10分钟

---

## 🎯 后续更新部署

部署完成后，SSH连接已启用密码登录，可以使用更新脚本：

```bash
# 方式1：从本地推送更新
cd F:\Aipost\deploy
bash update-server.sh

# 方式2：SSH连接后更新
ssh root@45.32.65.122 'cd /var/www/videoflow-pro && git pull && cd server && npm install --production && cd ../web && npm install && npm run build && pm2 restart videoflow-backend && systemctl reload nginx'
```

---

## ❓ 常见问题

### Q: Startup Script没有执行？
**A**: 检查服务器日志 `/var/log/cloud-init-output.log`

### Q: API密钥权限不足？
**A**: 确保API密钥有完整的管理权限

### Q: 部署失败怎么办？
**A**: 
1. SSH连接查看日志：`tail -100 /var/log/videoflow-deploy.log`
2. 手动执行失败的步骤
3. 或者销毁服务器重新部署

### Q: 如何验证部署成功？
**A**:
```bash
# 检查后端
curl http://45.32.65.122/api/health

# 检查前端
curl -I http://45.32.65.122

# 检查服务
ssh root@45.32.65.122 "pm2 status && systemctl status nginx"
```

---

## 📝 API参考

### Vultr API v2文档
- 官方文档：https://www.vultr.com/api/
- Startup Scripts：https://www.vultr.com/api/#tag/startup/operation/list-startup-scripts
- 实例管理：https://www.vultr.com/api/#tag/instances

### 常用API端点

```bash
# 列出所有服务器
curl "https://api.vultr.com/v2/instances" \
  -H "Authorization: Bearer $VULTR_API_KEY"

# 获取服务器信息
curl "https://api.vultr.com/v2/instances/$SERVER_ID" \
  -H "Authorization: Bearer $VULTR_API_KEY"

# 重启服务器
curl -X POST "https://api.vultr.com/v2/instances/$SERVER_ID/reboot" \
  -H "Authorization: Bearer $VULTR_API_KEY"

# 列出Startup Scripts
curl "https://api.vultr.com/v2/startup-scripts" \
  -H "Authorization: Bearer $VULTR_API_KEY"
```

---

## 🎉 总结

三种自动化方案，选择最适合的：

1. **方案A（Bash脚本）**: 完整自动化，适合熟悉命令行
2. **方案B（PowerShell）**: Windows原生，不依赖Git Bash
3. **方案C（重新部署）**: 从头开始，最干净

所有方案都实现了**零人工干预**的自动化部署！
