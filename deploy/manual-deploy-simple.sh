#!/bin/bash
# VideoFlow Pro 手动部署脚本 - 一键执行版本
# 在Vultr服务器上执行此脚本

set -e

echo "========================================"
echo "VideoFlow Pro 手动部署"
echo "========================================"
echo ""

# 1. 更新系统
echo ">>> [1/11] 更新系统..."
apt-get update -qq

# 2. 安装Git
echo ">>> [2/11] 安装Git..."
if ! command -v git &> /dev/null; then
    apt-get install -y git curl wget
fi

# 3. 安装Node.js 18
echo ">>> [3/11] 安装Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo "Node版本: $(node -v)"
echo "NPM版本: $(npm -v)"

# 4. 安装PostgreSQL
echo ">>> [4/11] 安装PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# 5. 配置数据库
echo ">>> [5/11] 配置数据库..."
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

# 6. 克隆或更新代码
echo ">>> [6/11] 获取代码..."
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

echo "当前版本: $(git log -1 --oneline)"

# 7. 导入数据库
echo ">>> [7/11] 初始化数据库..."
if [ -f "deploy/init-database.sql" ]; then
    sudo -u postgres psql -d videoflow_pro -f deploy/init-database.sql 2>/dev/null || echo "数据库已初始化"
fi

# 8. 配置后端
echo ">>> [8/11] 配置后端..."
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
CORS_ORIGIN=http://45.32.65.122
ENVEOF

echo ">>> [9/11] 安装后端依赖..."
npm install --production --no-progress --loglevel=error

# 10. 安装PM2并启动后端
echo ">>> [10/11] 启动后端服务..."
npm install -g pm2 --loglevel=error
pm2 delete videoflow-backend 2>/dev/null || true
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup systemd -u root --hp /root | grep -v PM2 | bash || true

# 11. 构建前端
echo ">>> [11/11] 构建前端..."
cd /var/www/videoflow-pro/web
npm install --no-progress --loglevel=error
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

    # 前端
    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API
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
echo "📝 常用命令:"
echo "  查看后端日志: pm2 logs videoflow-backend"
echo "  重启后端: pm2 restart videoflow-backend"
echo "  查看Nginx日志: tail -f /var/log/nginx/error.log"
echo ""
