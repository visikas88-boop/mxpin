#!/bin/bash

# Vultr Web Console 手动更新命令
# 复制以下命令到 Vultr Web Console 执行

echo "==================================="
echo "VideoFlow Pro 服务器更新命令"
echo "==================================="
echo ""
echo "请在 Vultr Web Console 中依次执行以下命令："
echo ""
echo "1. 进入项目目录"
echo "   cd /var/www/videoflow-pro"
echo ""
echo "2. 拉取最新代码"
echo "   git pull origin main"
echo ""
echo "3. 安装后端依赖"
echo "   cd server && npm install --production"
echo ""
echo "4. 构建前端"
echo "   cd ../web && npm install --legacy-peer-deps && npm run build"
echo ""
echo "5. 重启后端服务"
echo "   pm2 restart videoflow-backend"
echo ""
echo "6. 重新加载 Nginx"
echo "   systemctl reload nginx"
echo ""
echo "7. 检查服务状态"
echo "   pm2 status"
echo ""
echo "==================================="
echo "或者复制下面的一键命令（推荐）："
echo "==================================="
echo ""
cat << 'EOF'
cd /var/www/videoflow-pro && \
git pull origin main && \
cd server && npm install --production && \
cd ../web && npm install --legacy-peer-deps && npm run build && \
pm2 restart videoflow-backend && \
systemctl reload nginx && \
echo "" && \
echo "✅ 更新完成！" && \
pm2 status
EOF
