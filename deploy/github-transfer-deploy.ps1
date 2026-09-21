# VideoFlow Pro - 通过GitHub中转部署到DO服务器
# 解决SSH无法连接的问题

$ErrorActionPreference = "Stop"

Write-Host "=== VideoFlow Pro GitHub中转部署 ===" -ForegroundColor Cyan
Write-Host ""

# 步骤1：确保前端已构建
Write-Host "[1/5] 检查前端构建..." -ForegroundColor Yellow
if (-not (Test-Path "F:\Aipost\web\dist\index.html")) {
    Write-Host "前端未构建，开始构建..." -ForegroundColor Yellow
    Push-Location "F:\Aipost\web"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "前端构建失败"
    }
    Pop-Location
}
Write-Host "✓ 前端构建文件存在" -ForegroundColor Green

# 步骤2：创建部署分支
Write-Host ""
Write-Host "[2/5] 创建部署分支..." -ForegroundColor Yellow
Push-Location "F:\Aipost"

# 检查是否有未提交的更改
$status = git status --porcelain
if ($status) {
    Write-Host "发现未提交的更改，添加到git..." -ForegroundColor Yellow
    git add .
    git commit -m "feat: prepare for DO deployment via GitHub transfer

- Add DO manual deployment guide
- Add GitHub transfer deployment script
- Frontend build ready for production

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
}

# 创建部署分支
$deployBranch = "deploy-do-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git checkout -b $deployBranch
Write-Host "✓ 创建部署分支: $deployBranch" -ForegroundColor Green

Pop-Location

# 步骤3：推送到GitHub
Write-Host ""
Write-Host "[3/5] 推送到GitHub..." -ForegroundColor Yellow
Write-Host "执行: git push origin $deployBranch" -ForegroundColor Cyan
Push-Location "F:\Aipost"
git push origin $deployBranch
if ($LASTEXITCODE -ne 0) {
    throw "推送到GitHub失败"
}
Pop-Location
Write-Host "✓ 代码已推送到GitHub" -ForegroundColor Green

# 步骤4：生成服务器端部署命令
Write-Host ""
Write-Host "[4/5] 生成服务器端部署命令..." -ForegroundColor Yellow

$serverCommands = @"
#!/bin/bash
set -e

echo "=== 从GitHub部署VideoFlow Pro到DO服务器 ==="
echo ""

# 安装必要软件
echo "[1/8] 安装必要软件..."
apt-get update
apt-get install -y git curl nginx postgresql postgresql-contrib

# 安装Node.js 20.x
echo "[2/8] 安装Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 克隆仓库
echo "[3/8] 从GitHub克隆代码..."
cd /opt
rm -rf videoflow-pro
git clone -b $deployBranch https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git videoflow-pro
cd videoflow-pro

# 配置数据库
echo "[4/8] 配置PostgreSQL数据库..."
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS videoflow_pro;
DROP USER IF EXISTS videoflow_user;
CREATE DATABASE videoflow_pro;
CREATE USER videoflow_user WITH PASSWORD 'Mp112233@';
GRANT ALL PRIVILEGES ON DATABASE videoflow_pro TO videoflow_user;
\q
EOF

# 配置后端环境变量
echo "[5/8] 配置后端环境变量..."
cat > /opt/videoflow-pro/server/.env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://videoflow_user:Mp112233@@localhost:5432/videoflow_pro

JWT_SECRET=videoflow-pro-jwt-secret-change-in-production-2024
JWT_EXPIRES_IN=7d

UPLOADPOST_API_URL=https://api.upload-post.com
UPLOADPOST_API_KEY=your_api_key_here

FRONTEND_URL=http://129.212.229.44
ADMIN_DEFAULT_PASSWORD=Admin123456
ENVEOF

chmod 600 /opt/videoflow-pro/server/.env

# 安装后端依赖
echo "[6/8] 安装后端依赖..."
cd /opt/videoflow-pro/server
npm install --production

# 启动后端服务
echo "[7/8] 启动后端服务..."
npm install -g pm2
pm2 delete videoflow-backend 2>/dev/null || true
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup

# 配置Nginx
echo "[8/8] 配置Nginx..."
cat > /etc/nginx/sites-available/videoflow-pro << 'NGINXEOF'
server {
    listen 80;
    server_name 129.212.229.44;

    location / {
        root /opt/videoflow-pro/web/dist;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    client_max_body_size 100M;
}
NGINXEOF

ln -sf /etc/nginx/sites-available/videoflow-pro /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "访问地址: http://129.212.229.44"
echo ""
echo "服务状态检查:"
pm2 status
echo ""
systemctl status nginx --no-pager -l
echo ""
echo "端口监听检查:"
netstat -tulpn | grep -E ':(80|3000|5432)'
"@

$serverCommands | Out-File -FilePath "F:\Aipost\deploy\do-server-deploy.sh" -Encoding UTF8 -NoNewline
Write-Host "✓ 服务器部署脚本已生成: F:\Aipost\deploy\do-server-deploy.sh" -ForegroundColor Green

# 步骤5：显示下一步操作
Write-Host ""
Write-Host "[5/5] 下一步操作指南" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  修改服务器脚本中的GitHub仓库信息:" -ForegroundColor White
Write-Host "   编辑 F:\Aipost\deploy\do-server-deploy.sh" -ForegroundColor Gray
Write-Host "   替换: YOUR_GITHUB_USERNAME/YOUR_REPO_NAME" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  登录DO控制台:" -ForegroundColor White
Write-Host "   https://cloud.digitalocean.com/" -ForegroundColor Gray
Write-Host "   选择服务器 129.212.229.44" -ForegroundColor Gray
Write-Host "   点击 Access -> Console" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  在DO控制台执行部署脚本:" -ForegroundColor White
Write-Host "   复制 F:\Aipost\deploy\do-server-deploy.sh 的内容" -ForegroundColor Gray
Write-Host "   粘贴到控制台执行" -ForegroundColor Gray
Write-Host ""
Write-Host "4️⃣  等待部署完成后访问:" -ForegroundColor White
Write-Host "   http://129.212.229.44" -ForegroundColor Cyan
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 提示: 如果GitHub仓库是私有的，需要在服务器上配置SSH密钥或使用Personal Access Token" -ForegroundColor Yellow
Write-Host ""
