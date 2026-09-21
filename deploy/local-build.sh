#!/bin/bash

# 本地构建 + 手动部署方案
# 由于SSH被禁用，我们先在本地构建，然后通过Vultr Web Console部署

echo "🏗️  开始本地构建..."
echo ""

# 1. 构建前端
echo "📦 构建前端..."
cd F:/Aipost/web
npm install --legacy-peer-deps
npm run build

# 2. 打包构建产物
echo ""
echo "📦 打包构建产物..."
cd F:/Aipost
tar -czf deploy-package.tar.gz \
  -C web/dist . \
  --transform 's,^,web/dist/,'

echo ""
echo "✅ 构建完成！"
echo ""
echo "📦 构建包位置: F:/Aipost/deploy-package.tar.gz"
echo ""
echo "=================================="
echo "接下来在 Vultr Web Console 执行："
echo "=================================="
echo ""
echo "# 1. 进入项目目录"
echo "cd /var/www/videoflow-pro"
echo ""
echo "# 2. 拉取最新代码"
echo "git pull origin main"
echo ""
echo "# 3. 安装后端依赖（如有变化）"
echo "cd server && npm install --production"
echo ""
echo "# 4. 构建前端（使用服务器构建）"
echo "cd ../web && npm install --legacy-peer-deps && npm run build"
echo ""
echo "# 5. 重启后端"
echo "pm2 restart videoflow-backend"
echo ""
echo "# 6. 重新加载Nginx"
echo "systemctl reload nginx"
echo ""
echo "# 7. 检查状态"
echo "pm2 status && curl -I http://localhost"
