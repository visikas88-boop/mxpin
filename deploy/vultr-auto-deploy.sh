#!/bin/bash
# VideoFlow Pro - Vultr全自动化部署脚本
# 使用Vultr API + Startup Script实现零人工干预部署

set -e

# 配置区域
VULTR_API_KEY="${VULTR_API_KEY}"
SERVER_ID="${VULTR_SERVER_ID:-9c765e11-5249-4336-84d9-492e9ac84b00}"
GITHUB_REPO="https://github.com/visikas88-boop/mxpin.git"
SERVER_IP="45.32.65.122"

echo "========================================"
echo "VideoFlow Pro 全自动化部署系统"
echo "========================================"
echo ""

# 检查API密钥
if [ -z "$VULTR_API_KEY" ]; then
    echo "❌ 错误：未设置 VULTR_API_KEY 环境变量"
    echo ""
    echo "获取API密钥："
    echo "1. 访问 https://my.vultr.com/settings/#settingsapi"
    echo "2. 创建新的API密钥"
    echo "3. 设置环境变量："
    echo "   export VULTR_API_KEY='your-api-key-here'"
    echo ""
    exit 1
fi

echo "✅ Vultr API密钥已配置"
echo ""

# 创建部署Startup Script
echo ">>> [1/3] 创建Startup Script..."

STARTUP_SCRIPT=$(cat <<'SCRIPT_EOF'
#!/bin/bash
# VideoFlow Pro 自动部署脚本 - 由Startup Script执行

exec > >(tee /var/log/videoflow-deploy.log)
exec 2>&1

echo "========================================="
echo "VideoFlow Pro 自动部署开始"
echo "时间: $(date)"
echo "========================================="

# 1. 配置SSH允许密码登录（用于后续远程管理）
echo ">>> 配置SSH..."
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd

# 2. 更新系统
echo ">>> 更新系统..."
apt-get update -qq

# 3. 安装基础工具
echo ">>> 安装Git..."
apt-get install -y git curl wget

# 4. 安装Node.js 18
echo ">>> 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 5. 安装PostgreSQL
echo ">>> 安装PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# 6. 配置数据库
echo ">>> 配置数据库..."
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

# 7. 克隆代码
echo ">>> 克隆代码..."
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro
git clone https://github.com/visikas88-boop/mxpin.git .

# 8. 初始化数据库
echo ">>> 初始化数据库..."
if [ -f "deploy/init-database.sql" ]; then
    sudo -u postgres psql -d videoflow_pro -f deploy/init-database.sql || true
fi

# 9. 配置后端
echo ">>> 配置后端..."
cd /var/www/videoflow-pro/server
cat > .env <<ENVEOF
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

# 10. 安装后端依赖
echo ">>> 安装后端依赖..."
npm install --production

# 11. 启动后端
echo ">>> 启动后端..."
npm install -g pm2
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup systemd -u root --hp /root | grep -v PM2 | bash || true

# 12. 构建前端
echo ">>> 构建前端..."
cd /var/www/videoflow-pro/web
npm install
npm run build

# 13. 配置Nginx
echo ">>> 配置Nginx..."
apt-get install -y nginx

cat > /etc/nginx/sites-available/videoflow <<NGINXEOF
server {
    listen 80;
    server_name 45.32.65.122;
    client_max_body_size 100M;

    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/videoflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

# 14. 完成标记
echo "========================================="
echo "✅ 部署完成！"
echo "时间: $(date)"
echo "访问: http://45.32.65.122"
echo "========================================="

# 创建完成标记文件
echo "deployed" > /var/www/videoflow-pro/.deployed
date >> /var/www/videoflow-pro/.deployed
SCRIPT_EOF
)

# 通过API创建Startup Script
SCRIPT_ID=$(curl -s "https://api.vultr.com/v2/startup-scripts" \
    -X POST \
    -H "Authorization: Bearer $VULTR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"videoflow-deploy-$(date +%s)\",
        \"type\": \"boot\",
        \"script\": $(echo "$STARTUP_SCRIPT" | jq -Rs .)
    }" | jq -r '.startup_script.id')

if [ -z "$SCRIPT_ID" ] || [ "$SCRIPT_ID" = "null" ]; then
    echo "❌ Startup Script创建失败"
    exit 1
fi

echo "✅ Startup Script已创建 (ID: $SCRIPT_ID)"
echo ""

# 应用Startup Script到服务器
echo ">>> [2/3] 应用Startup Script到服务器..."

curl -s "https://api.vultr.com/v2/instances/$SERVER_ID" \
    -X PATCH \
    -H "Authorization: Bearer $VULTR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"script_id\": \"$SCRIPT_ID\"
    }" > /dev/null

echo "✅ Startup Script已应用"
echo ""

# 重启服务器以执行脚本
echo ">>> [3/3] 重启服务器执行部署..."

curl -s "https://api.vultr.com/v2/instances/$SERVER_ID/reboot" \
    -X POST \
    -H "Authorization: Bearer $VULTR_API_KEY" > /dev/null

echo "✅ 服务器正在重启..."
echo ""

echo "========================================"
echo "🎉 自动化部署已启动！"
echo "========================================"
echo ""
echo "📊 部署进度："
echo "  1. 服务器重启中... (约1分钟)"
echo "  2. Startup Script执行... (约5-8分钟)"
echo "  3. 服务启动... (约1分钟)"
echo ""
echo "⏱️  预计总耗时: 7-10分钟"
echo ""
echo "🔍 监控命令："
echo "  # 等待2分钟后SSH连接查看日志"
echo "  ssh root@$SERVER_IP 'tail -f /var/log/videoflow-deploy.log'"
echo ""
echo "🌐 完成后访问: http://$SERVER_IP"
echo ""
echo "💡 提示：部署完成后会自动启用SSH密码登录"
echo "   用户: root"
echo "   密码: Vultr2026@"
echo ""
