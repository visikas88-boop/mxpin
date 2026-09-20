#!/bin/bash
# VideoFlow Pro 首次部署脚本（在服务器Web控制台执行一次）

set -e

echo "=========================================="
echo "VideoFlow Pro 首次部署"
echo "=========================================="

# 1. 更新系统并安装基础环境
echo ""
echo "[1/8] 安装基础环境..."
apt-get update -qq
apt-get install -y curl wget git vim build-essential

# 2. 安装Node.js 18.x
echo ""
echo "[2/8] 安装Node.js 18.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js: $(node --version)"

# 3. 安装PostgreSQL
echo ""
echo "[3/8] 安装PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# 4. 安装Nginx
echo ""
echo "[4/8] 安装Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi

# 5. 安装PM2
echo ""
echo "[5/8] 安装PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 6. 配置数据库
echo ""
echo "[6/8] 配置数据库..."
DB_NAME="videoflow_pro"
DB_USER="videoflow"
DB_PASSWORD="Mp112233@"

sudo -u postgres psql << EOSQL
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
SELECT 'CREATE USER $DB_USER WITH PASSWORD ''$DB_PASSWORD''' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER')\gexec
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOSQL

echo "✅ 数据库配置完成"

# 7. 克隆项目代码
echo ""
echo "[7/8] 克隆项目代码..."
mkdir -p /var/www
cd /var/www

if [ -d "videoflow-pro" ]; then
    echo "项目目录已存在，拉取最新代码..."
    cd videoflow-pro
    git pull
else
    echo "请输入GitHub仓库URL（例如：https://github.com/username/videoflow-pro.git）："
    read REPO_URL
    git clone $REPO_URL videoflow-pro
    cd videoflow-pro
fi

# 8. 配置环境变量
echo ""
echo "[8/8] 配置环境变量..."

# 后端环境变量
cat > server/.env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videoflow_pro
DB_USER=videoflow
DB_PASSWORD=Mp112233@
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3001
NODE_ENV=production
MAPAY_MERCHANT_ID=11560
MAPAY_MERCHANT_KEY=oGT738NTzBaAp4am2hmS
MAPAY_SUBMIT_URL=https://mzf.mapay.cc/xpay/epay/submit.php
MAPAY_MAPI_URL=https://mzf.mapay.cc/xpay/epay/mapi.php
UPLOAD_POST_API_URL=https://api.upload-post.com
UPLOAD_POST_API_KEY=your-api-key-here
CORS_ORIGIN=http://45.32.65.132
EOF

# 前端环境变量
cat > web/.env.production << 'EOF'
VITE_API_BASE_URL=http://45.32.65.132/api
VITE_APP_NAME=VideoFlow Pro
EOF

# 初始化数据库
echo ""
echo "初始化数据库表..."
cd server
npm install --production

# 构建前端
echo ""
echo "构建前端..."
cd ../web
npm install
npm run build

# 配置Nginx
echo ""
echo "配置Nginx..."
cat > /etc/nginx/sites-available/videoflow-pro << 'EOFNGINX'
server {
    listen 80;
    server_name 45.32.65.132;
    client_max_body_size 100M;

    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/videoflow-access.log;
    error_log /var/log/nginx/videoflow-error.log;
}
EOFNGINX

ln -sf /etc/nginx/sites-available/videoflow-pro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 启动后端服务
echo ""
echo "启动后端服务..."
cd /var/www/videoflow-pro/server
pm2 delete videoflow-backend 2>/dev/null || true
pm2 start npm --name "videoflow-backend" -- start
pm2 save
pm2 startup

# 配置防火墙
echo ""
echo "配置防火墙..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

echo ""
echo "=========================================="
echo "✅ 首次部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://45.32.65.132"
echo "管理后台: http://45.32.65.132/admin"
echo ""
echo "管理员账号:"
echo "  Email: admin@videoflow.pro"
echo "  Password: admin123"
echo ""
echo "后续更新只需 git push，GitHub Actions会自动部署！"
echo "=========================================="
