#!/bin/bash
# VideoFlow Pro 服务器环境配置脚本
# 服务器: 45.32.65.132 (Vultr Ubuntu 22.04)

set -e  # 遇到错误立即退出

echo "=========================================="
echo "VideoFlow Pro 服务器部署脚本"
echo "=========================================="

# 1. 系统信息检查
echo ""
echo "[步骤 1/10] 检查系统信息..."
uname -a
cat /etc/os-release | head -n 3
df -h /
free -h

# 2. 更新系统
echo ""
echo "[步骤 2/10] 更新系统软件包..."
apt-get update
apt-get upgrade -y

# 3. 安装基础工具
echo ""
echo "[步骤 3/10] 安装基础工具..."
apt-get install -y curl wget git vim build-essential ufw fail2ban

# 4. 安装Node.js 18.x
echo ""
echo "[步骤 4/10] 安装Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node --version
npm --version

# 5. 安装PostgreSQL 14
echo ""
echo "[步骤 5/10] 安装PostgreSQL 14..."
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
sudo -u postgres psql --version

# 6. 安装Nginx
echo ""
echo "[步骤 6/10] 安装Nginx..."
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx
nginx -v

# 7. 安装PM2
echo ""
echo "[步骤 7/10] 安装PM2进程管理器..."
npm install -g pm2
pm2 --version

# 8. 配置PostgreSQL数据库
echo ""
echo "[步骤 8/10] 配置PostgreSQL数据库..."
sudo -u postgres psql << 'EOSQL'
-- 创建数据库
CREATE DATABASE videoflow_pro;

-- 创建用户并设置密码
CREATE USER videoflow WITH PASSWORD 'Mp112233@';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE videoflow_pro TO videoflow;

-- 连接到数据库并授予schema权限
\c videoflow_pro
GRANT ALL ON SCHEMA public TO videoflow;

EOSQL

echo "数据库配置完成！"

# 9. 创建应用目录
echo ""
echo "[步骤 9/10] 创建应用目录..."
mkdir -p /var/www/videoflow-pro
mkdir -p /var/www/videoflow-pro/logs
chown -R root:root /var/www/videoflow-pro

# 10. 配置防火墙
echo ""
echo "[步骤 10/10] 配置防火墙..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # 后端API (临时，后面用Nginx代理)
ufw status

echo ""
echo "=========================================="
echo "✅ 服务器环境配置完成！"
echo "=========================================="
echo ""
echo "已安装服务:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - PostgreSQL: $(sudo -u postgres psql --version | head -n 1)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo "  - PM2: $(pm2 --version)"
echo ""
echo "数据库信息:"
echo "  - 数据库名: videoflow_pro"
echo "  - 用户名: videoflow"
echo "  - 密码: Mp112233@"
echo ""
echo "应用目录: /var/www/videoflow-pro"
echo ""
echo "下一步: 上传项目代码并配置"
echo "=========================================="
