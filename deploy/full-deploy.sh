#!/bin/bash
# VideoFlow Pro 完整部署脚本（在服务器上执行）
# 此脚本包含环境安装、数据库配置、项目部署的完整流程

set -e  # 遇到错误立即退出

echo "=========================================="
echo "VideoFlow Pro 完整部署脚本"
echo "开始时间: $(date)"
echo "=========================================="

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    print_error "请使用root用户运行此脚本"
    exit 1
fi

# ==========================================
# 步骤1: 系统信息检查
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 1/12] 检查系统信息"
echo "=========================================="
print_info "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
print_info "内核版本: $(uname -r)"
print_info "CPU核心: $(nproc)"
print_info "内存: $(free -h | grep Mem | awk '{print $2}')"
print_info "磁盘: $(df -h / | tail -1 | awk '{print $2}')"

# ==========================================
# 步骤2: 更新系统
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 2/12] 更新系统软件包"
echo "=========================================="
apt-get update -qq
apt-get upgrade -y -qq
print_success "系统更新完成"

# ==========================================
# 步骤3: 安装基础工具
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 3/12] 安装基础工具"
echo "=========================================="
apt-get install -y -qq curl wget git vim build-essential ufw fail2ban unzip
print_success "基础工具安装完成"

# ==========================================
# 步骤4: 安装Node.js 18.x
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 4/12] 安装Node.js 18.x"
echo "=========================================="
if command -v node &> /dev/null; then
    print_info "Node.js 已安装: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null
    apt-get install -y -qq nodejs
    print_success "Node.js 安装完成: $(node --version)"
fi

# ==========================================
# 步骤5: 安装PostgreSQL 14
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 5/12] 安装PostgreSQL 14"
echo "=========================================="
if command -v psql &> /dev/null; then
    print_info "PostgreSQL 已安装: $(sudo -u postgres psql --version | head -n 1)"
else
    apt-get install -y -qq postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    print_success "PostgreSQL 安装完成"
fi

# ==========================================
# 步骤6: 安装Nginx
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 6/12] 安装Nginx"
echo "=========================================="
if command -v nginx &> /dev/null; then
    print_info "Nginx 已安装: $(nginx -v 2>&1 | cut -d'/' -f2)"
else
    apt-get install -y -qq nginx
    systemctl start nginx
    systemctl enable nginx
    print_success "Nginx 安装完成"
fi

# ==========================================
# 步骤7: 安装PM2
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 7/12] 安装PM2进程管理器"
echo "=========================================="
if command -v pm2 &> /dev/null; then
    print_info "PM2 已安装: $(pm2 --version)"
else
    npm install -g pm2 --silent
    print_success "PM2 安装完成: $(pm2 --version)"
fi

# ==========================================
# 步骤8: 配置PostgreSQL数据库
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 8/12] 配置PostgreSQL数据库"
echo "=========================================="

DB_NAME="videoflow_pro"
DB_USER="videoflow"
DB_PASSWORD="Mp112233@"

# 检查数据库是否存在
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    print_info "数据库 $DB_NAME 已存在"
else
    sudo -u postgres psql << EOSQL
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOSQL
    print_success "数据库配置完成"
fi

# ==========================================
# 步骤9: 创建应用目录
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 9/12] 创建应用目录"
echo "=========================================="
mkdir -p /var/www/videoflow-pro
mkdir -p /var/www/videoflow-pro/logs
print_success "应用目录创建完成"

# ==========================================
# 步骤10: 解压项目文件
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 10/12] 解压项目文件"
echo "=========================================="
if [ -f /var/www/videoflow-pro/videoflow-pro-deploy.tar.gz ]; then
    cd /var/www/videoflow-pro
    tar -xzf videoflow-pro-deploy.tar.gz
    rm -f videoflow-pro-deploy.tar.gz
    print_success "项目文件解压完成"
else
    print_error "未找到项目压缩包，请先上传 videoflow-pro-deploy.tar.gz"
    exit 1
fi

# ==========================================
# 步骤11: 配置后端
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 11/12] 配置后端环境"
echo "=========================================="

# 创建后端环境变量文件
cat > /var/www/videoflow-pro/server/.env << EOF
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# JWT密钥
JWT_SECRET=$(openssl rand -hex 32)

# 服务器配置
PORT=3001
NODE_ENV=production

# 码支付配置
MAPAY_MERCHANT_ID=11560
MAPAY_MERCHANT_KEY=oGT738NTzBaAp4am2hmS
MAPAY_SUBMIT_URL=https://mzf.mapay.cc/xpay/epay/submit.php
MAPAY_MAPI_URL=https://mzf.mapay.cc/xpay/epay/mapi.php

# Upload-Post API 配置（待配置）
UPLOAD_POST_API_URL=https://api.upload-post.com
UPLOAD_POST_API_KEY=your-api-key-here

# CORS配置
CORS_ORIGIN=http://45.32.65.132
EOF

print_success "后端环境配置完成"

# 安装后端依赖
cd /var/www/videoflow-pro/server
print_info "安装后端依赖..."
npm install --production --silent

# 初始化数据库
if [ -f /root/init-database.sql ]; then
    print_info "初始化数据库..."
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f /root/init-database.sql > /dev/null
    print_success "数据库初始化完成"
fi

print_success "后端配置完成"

# ==========================================
# 步骤12: 构建和配置前端
# ==========================================
echo ""
echo "=========================================="
echo "[步骤 12/12] 构建前端"
echo "=========================================="

cd /var/www/videoflow-pro/web
print_info "安装前端依赖..."
npm install --silent

# 创建前端环境变量
cat > .env.production << EOF
VITE_API_BASE_URL=http://45.32.65.132/api
VITE_APP_NAME=VideoFlow Pro
EOF

print_info "构建前端..."
npm run build

if [ -d dist ]; then
    print_success "前端构建完成"
else
    print_error "前端构建失败"
    exit 1
fi

# ==========================================
# 配置Nginx
# ==========================================
echo ""
echo "=========================================="
echo "配置Nginx"
echo "=========================================="

cat > /etc/nginx/sites-available/videoflow-pro << 'EOF'
server {
    listen 80;
    server_name 45.32.65.132;

    client_max_body_size 100M;

    # 前端静态文件
    location / {
        root /var/www/videoflow-pro/web/dist;
        try_files $uri $uri/ /index.html;

        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理
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

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 日志
    access_log /var/www/videoflow-pro/logs/nginx-access.log;
    error_log /var/www/videoflow-pro/logs/nginx-error.log;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/videoflow-pro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
if nginx -t > /dev/null 2>&1; then
    systemctl reload nginx
    print_success "Nginx配置完成"
else
    print_error "Nginx配置测试失败"
    nginx -t
    exit 1
fi

# ==========================================
# 启动后端服务
# ==========================================
echo ""
echo "=========================================="
echo "启动后端服务"
echo "=========================================="

cd /var/www/videoflow-pro/server

# 停止旧进程
pm2 delete videoflow-backend 2>/dev/null || true

# 启动服务
pm2 start npm --name "videoflow-backend" -- start
pm2 save
pm2 startup > /dev/null 2>&1 || true

sleep 3

# 检查服务状态
if pm2 list | grep -q "videoflow-backend.*online"; then
    print_success "后端服务启动成功"
else
    print_error "后端服务启动失败"
    pm2 logs videoflow-backend --lines 20
    exit 1
fi

# ==========================================
# 配置防火墙
# ==========================================
echo ""
echo "=========================================="
echo "配置防火墙"
echo "=========================================="

ufw --force enable
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
print_success "防火墙配置完成"

# ==========================================
# 验证部署
# ==========================================
echo ""
echo "=========================================="
echo "验证部署"
echo "=========================================="

sleep 2

# 检查后端健康
if curl -s http://localhost:3001/health > /dev/null; then
    print_success "后端服务运行正常"
else
    print_error "后端健康检查失败"
fi

# 检查前端
if curl -s http://localhost/ | grep -q "<!doctype html>"; then
    print_success "前端服务运行正常"
else
    print_error "前端访问失败"
fi

# ==========================================
# 完成
# ==========================================
echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "服务信息:"
echo "  - 前端地址: http://45.32.65.132"
echo "  - API地址: http://45.32.65.132/api"
echo "  - 健康检查: http://45.32.65.132/api/health"
echo ""
echo "管理员账号:"
echo "  - Email: admin@videoflow.pro"
echo "  - Password: admin123"
echo ""
echo "常用命令:"
echo "  - 查看后端状态: pm2 status"
echo "  - 查看后端日志: pm2 logs videoflow-backend"
echo "  - 重启后端: pm2 restart videoflow-backend"
echo "  - 查看Nginx日志: tail -f /var/www/videoflow-pro/logs/nginx-access.log"
echo ""
echo "下一步:"
echo "  1. 修改管理员密码"
echo "  2. 配置域名和SSL证书"
echo "  3. 配置Upload-Post API密钥"
echo "  4. 测试视频生成和发布功能"
echo ""
echo "完成时间: $(date)"
echo "=========================================="
