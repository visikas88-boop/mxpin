# VideoFlow Pro 立即部署指南

## 服务器信息
- **IP地址**: 45.32.65.122
- **用户名**: root
- **密码**: Vultr2026@
- **系统**: Ubuntu 22.04

---

## 🚀 推荐方式：Vultr Web控制台部署（最简单）

### 步骤1：打开Vultr控制台
1. 访问：https://my.vultr.com/subs/
2. 找到你的服务器（IP: 45.32.65.122）
3. 点击服务器进入详情页
4. 点击右上角 **"View Console"** 按钮（或页面中的Console标签）

### 步骤2：登录服务器
```
login: root
Password: Vultr2026@
```

### 步骤3：执行一键部署命令
复制粘贴以下命令（在控制台中右键粘贴）：

```bash
curl -o deploy.sh https://raw.githubusercontent.com/visikas88-boop/mxpin/main/deploy/manual-deploy-simple.sh && bash deploy.sh
```

如果GitHub访问慢，使用备用方案：

```bash
apt-get update && apt-get install -y git && \
git clone https://github.com/visikas88-boop/mxpin.git /tmp/mxpin && \
cd /tmp/mxpin && \
bash deploy/manual-deploy-simple.sh
```

### 步骤4：等待完成
- 整个过程约需 **5-10分钟**
- 看到 "✅ 部署完成！" 后即可访问

---

## 🌐 访问地址
部署完成后访问：**http://45.32.65.122**

### 默认管理员账号
- Email: admin@videoflow.pro
- Username: admin
- Password: admin123

---

## 📋 备用方案：手动复制粘贴命令

如果上面的一键脚本失败，可以逐条执行以下命令：

### 1. 更新系统和安装Git
```bash
apt-get update
apt-get install -y git curl wget
```

### 2. 安装Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v
```

### 3. 安装PostgreSQL
```bash
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### 4. 配置数据库
```bash
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
```

### 5. 克隆代码
```bash
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro
git clone https://github.com/visikas88-boop/mxpin.git .
```

### 6. 初始化数据库
```bash
sudo -u postgres psql -d videoflow_pro -f deploy/init-database.sql
```

### 7. 配置后端
```bash
cd /var/www/videoflow-pro/server
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videoflow_pro
DB_USER=videoflow_user
DB_PASSWORD=Mp112233@
JWT_SECRET=vfp_jwt_secret_key_2024_change_in_prod
CORS_ORIGIN=http://45.32.65.122
EOF
```

### 8. 安装后端依赖并启动
```bash
npm install --production
npm install -g pm2
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup
```

### 9. 构建前端
```bash
cd /var/www/videoflow-pro/web
npm install
npm run build
```

### 10. 配置Nginx
```bash
apt-get install -y nginx

cat > /etc/nginx/sites-available/videoflow << 'EOF'
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
EOF

ln -sf /etc/nginx/sites-available/videoflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx
```

### 11. 检查服务状态
```bash
pm2 status
systemctl status nginx
```

---

## ⚠️ 故障排查

### SSH无法连接
- **原因**: 服务器刚重新部署，SSH服务可能需要1-2分钟启动
- **解决**: 使用Vultr Web控制台（不依赖SSH）

### 部署过程中断
```bash
# 重新进入项目目录继续
cd /var/www/videoflow-pro
# 从中断的步骤继续执行
```

### 查看后端日志
```bash
pm2 logs videoflow-backend
```

### 查看Nginx日志
```bash
tail -f /var/log/nginx/error.log
```

### 重启所有服务
```bash
pm2 restart all
systemctl restart nginx
```

---

## 📞 快速命令备忘

```bash
# 查看服务状态
pm2 status

# 重启后端
pm2 restart videoflow-backend

# 重启Nginx
systemctl restart nginx

# 查看后端日志
pm2 logs videoflow-backend --lines 50

# 更新代码
cd /var/www/videoflow-pro
git pull origin main
cd server && npm install --production
cd ../web && npm install && npm run build
pm2 restart videoflow-backend
systemctl reload nginx
```

---

## ✅ 部署成功标志
- 访问 http://45.32.65.122 看到登录页面
- `pm2 status` 显示 videoflow-backend 状态为 **online**
- `systemctl status nginx` 显示 **active (running)**
