#!/bin/bash

# VideoFlow Pro 服务器更新脚本
# 用途：代码修改后快速部署到生产服务器

set -e

echo "🚀 开始更新服务器..."
echo ""

# 服务器信息
SERVER_IP="45.32.65.132"
SERVER_USER="root"
PROJECT_DIR="/var/www/videoflow-pro"

echo "📡 连接服务器: $SERVER_USER@$SERVER_IP"
echo ""

# 通过SSH执行更新命令
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'ENDSSH'

echo "📂 进入项目目录..."
cd /var/www/videoflow-pro

echo "🔄 拉取最新代码..."
git pull origin main

echo "📦 安装后端依赖..."
cd server
npm install --production

echo "🏗️ 构建前端..."
cd ../web
npm install --legacy-peer-deps
npm run build

echo "🔄 重启后端服务..."
pm2 restart videoflow-backend

echo "🔄 重新加载 Nginx..."
systemctl reload nginx

echo ""
echo "✅ 服务器更新完成！"
echo ""
echo "📊 服务状态:"
pm2 status videoflow-backend

ENDSSH

echo ""
echo "🎉 部署完成！"
echo "🌐 访问地址: http://$SERVER_IP"
