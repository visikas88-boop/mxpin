#!/bin/bash
# VideoFlow Pro 快速部署脚本
# 适用于 Vultr Ubuntu 22.04 服务器

set -e  # 遇到错误立即退出

echo "========================================="
echo "VideoFlow Pro 完整部署开始"
echo "========================================="

# 1. 更新系统并安装基础依赖
echo ">>> [1/11] 更新系统..."
apt-get update -qq

# 2. 安装 Node.js 18.x
echo ">>> [2/11] 安装 Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo "Node 版本: $(node -v)"

# 3. 安装 PostgreSQL
echo ">>> [3/11] 安装 PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# 4. 配置数据库
echo ">>> [4/11] 配置数据库..."
sudo -u postgres psql <<EOF
SELECT 'CREATE DATABASE videoflow_pro' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'videoflow_pro')\gexec
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'videoflow_user') THEN
    CREATE USER videoflow_user WITH PASSWORD 'VfP@2024Secure!';
  END IF;
END
\$\$;
GRANT ALL PRIVILEGES ON DATABASE videoflow_pro TO videoflow_user;
ALTER DATABASE videoflow_pro OWNER TO videoflow_user;
EOF

# 5. 导入数据库结构
echo ">>> [5/11] 导入数据库..."
if [ -f "/var/www/videoflow-pro/deploy/init-database.sql" ]; then
    sudo -u postgres psql -d videoflow_pro -f /var/www/videoflow-pro/deploy/init-database.sql || echo "数据库已初始化"
fi

# 6. 配置后端环境
echo ">>> [6/11] 配置后端环境..."
cd /var/www/videoflow-pro/server
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videoflow_pro
DB_USER=videoflow_user
DB_PASSWORD=VfP@2024Secure!
JWT_SECRET=vfp_jwt_secret_key_2024_change_in_prod
CORS_ORIGIN=http://45.32.65.132
ENVEOF

# 7. 安装后端依赖
echo ">>> [7/11] 安装后端依赖..."
npm install --production --no-progress

# 8. 安装并配置 PM2
echo ">>> [8/11] 配置 PM2..."
npm install -g pm2
pm2 delete videoflow-backend 2>/dev/null || true
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup systemd -u root --hp /root | grep -v PM2 | bash || true

# 9. 构建前端
echo ">>> [9/11] 构建前端..."
cd /var/www/videoflow-pro/web
npm install --no-progress
npm run build

# 10. 安装 Nginx
echo ">>> [10/11] 配置 Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
fi

# 11. 配置 Nginx 虚拟主机
cat > /etc/nginx/sites-available/videoflow << 'NGINXEOF'
server {
    listen 80;
    server_name 45.32.65.132;
    client_max_body_size 100M;

    # 前端
    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=31536000" always;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/videoflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试并重启 Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "🌐 访问地址: http://45.32.65.132"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "📝 查看日志:"
echo "  后端日志: pm2 logs videoflow-backend"
echo "  Nginx 日志: tail -f /var/log/nginx/error.log"
echo ""
