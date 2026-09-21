#!/bin/bash
# VideoFlow Pro 精简部署脚本 - 用于Vultr Startup Script
set -e
exec > /var/log/videoflow-deploy.log 2>&1

echo "=== VideoFlow Pro 部署开始 ==="
date

# 允许SSH密码登录
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd

# 更新系统
apt-get update -qq
apt-get install -y git curl wget

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 安装PostgreSQL
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# 配置数据库
sudo -u postgres psql << 'DBEOF'
SELECT 'CREATE DATABASE videoflow_pro' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'videoflow_pro')\gexec
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'videoflow_user') THEN
    CREATE USER videoflow_user WITH PASSWORD 'Mp112233@';
  END IF;
END
$$;
GRANT ALL PRIVILEGES ON DATABASE videoflow_pro TO videoflow_user;
ALTER DATABASE videoflow_pro OWNER TO videoflow_user;
DBEOF

# 克隆代码
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro
git clone https://github.com/visikas88-boop/mxpin.git .

# 初始化数据库
[ -f "deploy/init-database.sql" ] && sudo -u postgres psql -d videoflow_pro -f deploy/init-database.sql || true

# 配置后端
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

npm install --production
npm install -g pm2
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup systemd -u root --hp /root | grep -v PM2 | bash || true

# 构建前端
cd /var/www/videoflow-pro/web
npm install
npm run build

# 配置Nginx
apt-get install -y nginx
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

echo "=== 部署完成 ==="
date
echo "deployed" > /var/www/videoflow-pro/.deployed
