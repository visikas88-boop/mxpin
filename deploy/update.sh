#!/bin/bash
# VideoFlow Pro 快速更新脚本
# 使用方法：在服务器上执行 bash update.sh

set -e

echo "=========================================="
echo "VideoFlow Pro 更新部署"
echo "=========================================="
echo ""

cd /var/www/videoflow-pro

# 1. 拉取最新代码
echo ">>> [1/5] 拉取最新代码..."
git pull origin main
echo "当前版本: $(git log -1 --oneline)"

# 2. 更新后端依赖
echo ">>> [2/5] 更新后端依赖..."
cd server
npm install --production

# 3. 更新前端依赖并构建
echo ">>> [3/5] 构建前端..."
cd ../web
npm install --legacy-peer-deps
npm run build

# 4. 重启后端服务
echo ">>> [4/5] 重启后端服务..."
pm2 restart videoflow-backend

# 5. 重载Nginx
echo ">>> [5/5] 重载Nginx..."
systemctl reload nginx

echo ""
echo "=========================================="
echo "✅ 更新完成！"
echo "=========================================="
echo ""
echo "访问地址: http://45.32.65.132"
echo ""
pm2 status
