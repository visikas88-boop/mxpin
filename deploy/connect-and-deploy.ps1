# VideoFlow Pro 部署脚本 - 使用sshpass密码认证
# 服务器信息
$SERVER_IP = "45.32.65.122"
$SERVER_USER = "root"
$SERVER_PASS = "Vultr2026@"

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "VideoFlow Pro 服务器部署" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务器: $SERVER_IP" -ForegroundColor Yellow
Write-Host ""

# 创建部署脚本内容
$deployScript = @'
#!/bin/bash
set -e

echo "========================================"
echo "VideoFlow Pro 完整部署"
echo "========================================"
echo ""

# 1. 更新系统
echo ">>> [1/12] 更新系统包..."
apt-get update -qq

# 2. 安装基础工具
echo ">>> [2/12] 安装Git和基础工具..."
apt-get install -y git curl wget

# 3. 安装Node.js 18
echo ">>> [3/12] 安装Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo "Node版本: $(node -v)"

# 4. 安装PostgreSQL
echo ">>> [4/12] 安装PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# 5. 配置数据库
echo ">>> [5/12] 配置数据库..."
sudo -u postgres psql <<EOF
SELECT 'CREATE DATABASE videoflow_pro' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'videoflow_pro')\gexec
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'videoflow_user') THEN
    CREATE USER videoflow_user WITH PASSWORD 'Mp112233@';
  END IF;
END
\$\$;
GRANT ALL PRIVILEGES ON DATABASE videoflow_pro TO videoflow_user;
ALTER DATABASE videoflow_pro OWNER TO videoflow_user;
EOF

# 6. 克隆代码
echo ">>> [6/12] 获取代码..."
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro

if [ -d ".git" ]; then
    echo "更新现有代码..."
    git fetch origin
    git reset --hard origin/main
else
    echo "克隆代码仓库..."
    git clone https://github.com/visikas88-boop/mxpin.git .
fi

# 7. 导入数据库
echo ">>> [7/12] 初始化数据库..."
if [ -f "deploy/init-database.sql" ]; then
    sudo -u postgres psql -d videoflow_pro -f deploy/init-database.sql 2>/dev/null || echo "数据库已存在"
fi

# 8. 配置后端
echo ">>> [8/12] 配置后端环境..."
cd /var/www/videoflow-pro/server

cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videoflow_pro
DB_USER=videoflow_user
DB_PASSWORD=Mp112233@
JWT_SECRET=vfp_jwt_secret_key_2024_change_in_prod
CORS_ORIGIN=http://45.32.65.122
ENVEOF

# 9. 安装后端依赖
echo ">>> [9/12] 安装后端依赖..."
npm install --production

# 10. 启动后端
echo ">>> [10/12] 启动后端服务..."
npm install -g pm2
pm2 delete videoflow-backend 2>/dev/null || true
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup systemd -u root --hp /root | grep -v PM2 | bash || true

# 11. 构建前端
echo ">>> [11/12] 构建前端..."
cd /var/www/videoflow-pro/web
npm install
npm run build

# 12. 配置Nginx
echo ">>> [12/12] 配置Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
fi

cat > /etc/nginx/sites-available/videoflow << 'NGINXEOF'
server {
    listen 80;
    server_name 45.32.65.122;
    client_max_body_size 100M;

    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/videoflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "========================================"
echo "✅ 部署完成！"
echo "========================================"
echo ""
echo "🌐 访问地址: http://45.32.65.122"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
'@

# 保存脚本到临时文件
$tempScript = "$env:TEMP\deploy-videoflow.sh"
$deployScript | Out-File -FilePath $tempScript -Encoding UTF8

Write-Host "📝 部署脚本已生成" -ForegroundColor Green
Write-Host ""
Write-Host "现在有三种部署方式：" -ForegroundColor Yellow
Write-Host ""
Write-Host "方式1: 通过Vultr控制台部署（推荐）" -ForegroundColor Cyan
Write-Host "  1. 打开Vultr控制台: https://my.vultr.com/subs/" -ForegroundColor White
Write-Host "  2. 点击服务器进入详情页" -ForegroundColor White
Write-Host "  3. 点击 'View Console' 按钮" -ForegroundColor White
Write-Host "  4. 登录后复制粘贴以下命令：" -ForegroundColor White
Write-Host ""
Write-Host "wget -O deploy.sh https://raw.githubusercontent.com/visikas88-boop/mxpin/main/deploy/manual-deploy-simple.sh && chmod +x deploy.sh && ./deploy.sh" -ForegroundColor Green
Write-Host ""
Write-Host "方式2: 使用putty/SSH客户端" -ForegroundColor Cyan
Write-Host "  连接信息：" -ForegroundColor White
Write-Host "    主机: $SERVER_IP" -ForegroundColor White
Write-Host "    用户: $SERVER_USER" -ForegroundColor White
Write-Host "    密码: $SERVER_PASS" -ForegroundColor White
Write-Host ""
Write-Host "方式3: 手动执行脚本内容" -ForegroundColor Cyan
Write-Host "  脚本位置: $tempScript" -ForegroundColor White
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# 尝试测试连接
Write-Host "🔍 测试SSH连接..." -ForegroundColor Yellow
$testResult = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "echo 'OK'" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSH连接成功！可以直接部署" -ForegroundColor Green
    Write-Host ""
    $answer = Read-Host "是否现在开始自动部署？(y/n)"
    if ($answer -eq 'y' -or $answer -eq 'Y') {
        Write-Host ""
        Write-Host "🚀 开始自动部署..." -ForegroundColor Green
        Get-Content $tempScript | ssh "$SERVER_USER@$SERVER_IP" "bash -s"
    }
} else {
    Write-Host "⚠️  SSH连接失败" -ForegroundColor Red
    Write-Host "可能原因：" -ForegroundColor Yellow
    Write-Host "  1. 服务器正在启动中（新部署的服务器需要1-2分钟）" -ForegroundColor White
    Write-Host "  2. SSH密钥认证问题（需要配置密码认证）" -ForegroundColor White
    Write-Host "  3. 防火墙阻止连接" -ForegroundColor White
    Write-Host ""
    Write-Host "建议：使用方式1（Vultr控制台）最稳定可靠" -ForegroundColor Cyan
}
