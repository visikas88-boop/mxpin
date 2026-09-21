#!/bin/bash
# 最终配置Nginx和启动服务

# 1. 安装Nginx
apt-get install -y nginx

# 2. 配置Nginx
cat > /etc/nginx/sites-available/videoflow << 'EOF'
server {
    listen 80;
    server_name 45.32.65.132;
    client_max_body_size 100M;

    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# 3. 启用配置
ln -sf /etc/nginx/sites-available/videoflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 4. 测试并重启Nginx
nginx -t
systemctl restart nginx

# 5. 重启后端
pm2 restart videoflow-backend

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://45.32.65.132"
echo ""
