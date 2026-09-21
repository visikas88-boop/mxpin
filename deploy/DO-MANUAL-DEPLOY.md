# DigitalOcean 手动部署 VideoFlow Pro

## 背景
Vultr和DO服务器都无法从本地SSH连接（kex_exchange_identification错误），这是本地网络/SSH客户端问题。
解决方案：通过DO Web控制台手动部署。

## 前提条件
1. 本地已构建前端：`F:\Aipost\web\dist` 目录存在
2. DO服务器：129.212.229.44
3. 通过DO控制台的Access → Console访问服务器

---

## 步骤1：在DO控制台创建项目目录

```bash
# 创建VideoFlow Pro目录
mkdir -p /opt/videoflow-pro/{server,web}
cd /opt/videoflow-pro

# 安装Node.js 20.x（如果还没有）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 安装PostgreSQL（如果还没有）
apt-get install -y postgresql postgresql-contrib

# 安装Nginx（如果还没有）
apt-get install -y nginx
```

---

## 步骤2：配置数据库

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE videoflow_pro;
CREATE USER videoflow_user WITH PASSWORD 'Mp112233@';
GRANT ALL PRIVILEGES ON DATABASE videoflow_pro TO videoflow_user;
\q
EOF

echo "✅ 数据库创建完成"
```

---

## 步骤3A：上传文件（使用Python HTTP服务器）

**在本地Windows PowerShell执行：**

```powershell
cd F:\Aipost

# 启动HTTP服务器
python -m http.server 8888
```

**然后在DO控制台执行：**

```bash
# 下载后端代码（需要替换YOUR_LOCAL_IP）
cd /opt/videoflow-pro/server
curl -O http://YOUR_LOCAL_IP:8888/server/package.json
curl -O http://YOUR_LOCAL_IP:8888/server/package-lock.json
# ... 需要下载所有server目录文件

# 下载前端构建（如果本地HTTP服务器可访问）
cd /opt/videoflow-pro/web
curl -O http://YOUR_LOCAL_IP:8888/web/dist.tar.gz
tar -xzf dist.tar.gz
```

---

## 步骤3B：上传文件（使用文件传输服务）

由于SSH不可用，建议：
1. 将 `F:\Aipost\server` 和 `F:\Aipost\web\dist` 打包上传到云存储（阿里云OSS、腾讯云COS等）
2. 在DO服务器上用wget下载

**本地打包：**
```powershell
# 打包后端
cd F:\Aipost
tar -czf server.tar.gz server/

# 打包前端（已有dist.tar.gz）
# F:\Aipost\web\dist.tar.gz
```

**上传到临时云存储后，在DO控制台下载：**
```bash
cd /opt/videoflow-pro
wget https://YOUR_CLOUD_STORAGE_URL/server.tar.gz
tar -xzf server.tar.gz

cd /opt/videoflow-pro/web
wget https://YOUR_CLOUD_STORAGE_URL/dist.tar.gz
tar -xzf dist.tar.gz
```

---

## 步骤4：配置后端环境变量

```bash
cat > /opt/videoflow-pro/server/.env << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://videoflow_user:Mp112233@@localhost:5432/videoflow_pro

JWT_SECRET=videoflow-pro-jwt-secret-change-in-production-2024
JWT_EXPIRES_IN=7d

# Upload-Post API配置
UPLOADPOST_API_URL=https://api.upload-post.com
UPLOADPOST_API_KEY=your_api_key_here

# 前端URL
FRONTEND_URL=http://129.212.229.44

# 管理员默认密码
ADMIN_DEFAULT_PASSWORD=Admin123456
EOF

chmod 600 /opt/videoflow-pro/server/.env
```

---

## 步骤5：安装依赖并启动后端

```bash
cd /opt/videoflow-pro/server
npm install --production

# 安装PM2
npm install -g pm2

# 启动后端
pm2 start src/index.js --name videoflow-backend
pm2 save
pm2 startup

echo "✅ 后端服务已启动"
pm2 status
```

---

## 步骤6：配置Nginx

```bash
cat > /etc/nginx/sites-available/videoflow-pro << 'EOF'
server {
    listen 80;
    server_name 129.212.229.44;

    # 前端静态文件
    location / {
        root /opt/videoflow-pro/web/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 文件上传大小限制
    client_max_body_size 100M;
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/videoflow-pro /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "✅ Nginx配置完成"
```

---

## 步骤7：验证部署

```bash
# 检查服务状态
pm2 status
systemctl status nginx
systemctl status postgresql

# 检查端口
netstat -tulpn | grep -E ':(80|3000|5432)'

# 测试API
curl http://localhost:3000/api/health

echo ""
echo "🎉 部署完成！访问: http://129.212.229.44"
```

---

## 故障排查

### 后端日志
```bash
pm2 logs videoflow-backend
```

### Nginx日志
```bash
tail -f /var/log/nginx/error.log
```

### 数据库连接测试
```bash
psql -U videoflow_user -d videoflow_pro -h localhost
```

---

## 下次更新部署

```bash
# 停止服务
pm2 stop videoflow-backend

# 替换文件（从云存储下载新版本）
cd /opt/videoflow-pro
wget https://YOUR_CLOUD_STORAGE_URL/server-new.tar.gz
tar -xzf server-new.tar.gz

# 重启服务
cd /opt/videoflow-pro/server
npm install --production
pm2 restart videoflow-backend
```
