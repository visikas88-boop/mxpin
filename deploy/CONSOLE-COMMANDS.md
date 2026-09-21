## 在Vultr控制台执行以下命令

### 方式1：逐条执行（推荐，可以看到每步进度）

```bash
# 1. 更新系统并安装基础工具
apt-get update && apt-get install -y git curl wget

# 2. 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 3. 安装PostgreSQL
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# 4. 配置数据库
sudo -u postgres psql << 'EOF'
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
EOF

# 5. 克隆代码
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro
git clone https://github.com/visikas88-boop/mxpin.git .

# 6. 初始化数据库
if [ -f "deploy/init-database.sql" ]; then
    sudo -u postgres psql -d videoflow_pro -f deploy/init-database.sql
fi

# 7. 配置后端
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

# 8. 安装后端依赖并启动
npm install --production
npm install -g pm2
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup

# 9. 构建前端
cd /var/www/videoflow-pro/web
npm install
npm run build

# 10. 安装并配置Nginx
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

# 11. 检查服务状态
echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
pm2 status
systemctl status nginx
echo ""
echo "访问地址: http://45.32.65.122"
```

### 方式2：一键执行所有命令

复制粘贴整个脚本块到控制台，一次性执行。

---

## 📋 执行建议

**推荐逐条执行**，这样可以：
- ✅ 看到每一步的执行结果
- ✅ 遇到错误容易定位
- ✅ 了解部署过程

从第1步开始，逐条复制粘贴到Vultr控制台执行即可！
