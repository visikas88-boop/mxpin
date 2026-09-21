#!/bin/bash
# VideoFlow Pro 一键部署到Vultr服务器
# 从GitHub拉取最新代码并自动部署

set -e

# 配置信息
SERVER_IP="45.32.65.132"
SERVER_USER="root"
GITHUB_REPO="https://github.com/visikas88-boop/mxpin.git"
GITHUB_BRANCH="main"
DEPLOY_PATH="/var/www/videoflow-pro"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_step() { echo -e "${YELLOW}>>> $1${NC}"; }

echo "=========================================="
echo "  VideoFlow Pro 一键部署到 Vultr"
echo "=========================================="
echo ""
print_info "目标服务器: $SERVER_IP"
print_info "GitHub仓库: $GITHUB_REPO"
print_info "分支: $GITHUB_BRANCH"
echo ""

# 检查SSH连接
print_step "[1/8] 测试SSH连接..."
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "echo 'SSH连接成功'" > /dev/null 2>&1; then
    print_error "无法连接到服务器 $SERVER_IP"
    echo ""
    echo "请确保："
    echo "  1. 服务器IP地址正确"
    echo "  2. SSH服务正在运行"
    echo "  3. 防火墙允许SSH连接（端口22）"
    echo "  4. 可以使用以下命令手动测试："
    echo "     ssh $SERVER_USER@$SERVER_IP"
    exit 1
fi
print_success "SSH连接测试成功"

# 部署脚本
print_step "[2/8] 准备部署脚本..."

# 创建服务器端部署脚本
REMOTE_DEPLOY_SCRIPT=$(cat << 'REMOTE_SCRIPT_EOF'
#!/bin/bash
set -e

echo "========================================="
echo "开始服务器端部署"
echo "========================================="

# 检查并安装Git
if ! command -v git &> /dev/null; then
    echo ">>> 安装 Git..."
    apt-get update -qq
    apt-get install -y git
fi

# 创建部署目录
echo ">>> 创建部署目录..."
mkdir -p /var/www/videoflow-pro
cd /var/www/videoflow-pro

# 克隆或更新代码
if [ -d ".git" ]; then
    echo ">>> 拉取最新代码..."
    git fetch origin
    git reset --hard origin/main
else
    echo ">>> 克隆代码仓库..."
    git clone https://github.com/visikas88-boop/mxpin.git .
fi

echo ">>> 当前提交: $(git log -1 --oneline)"

# 检查部署脚本是否存在
if [ ! -f "deploy/quick-deploy.sh" ]; then
    echo "❌ 错误: 未找到 deploy/quick-deploy.sh"
    exit 1
fi

# 执行部署脚本
echo ">>> 执行部署脚本..."
chmod +x deploy/quick-deploy.sh
bash deploy/quick-deploy.sh

echo ""
echo "========================================="
echo "✅ 服务器端部署完成"
echo "========================================="
REMOTE_SCRIPT_EOF
)

# 上传并执行部署脚本
print_step "[3/8] 连接到服务器并开始部署..."
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "bash -s" << EOF
$REMOTE_DEPLOY_SCRIPT
EOF

if [ $? -eq 0 ]; then
    print_success "部署脚本执行成功"
else
    print_error "部署脚本执行失败"
    exit 1
fi

# 等待服务启动
print_step "[4/8] 等待服务启动..."
sleep 5

# 健康检查
print_step "[5/8] 健康检查..."

echo -n "  检查后端服务... "
if ssh $SERVER_USER@$SERVER_IP "curl -s http://localhost:3000/api/health > /dev/null 2>&1"; then
    print_success "后端运行正常"
else
    print_error "后端健康检查失败"
    echo "    请手动检查: ssh $SERVER_USER@$SERVER_IP 'pm2 logs videoflow-backend'"
fi

echo -n "  检查前端服务... "
if ssh $SERVER_USER@$SERVER_IP "curl -s http://localhost/ | grep -q 'html' 2>&1"; then
    print_success "前端运行正常"
else
    print_error "前端访问失败"
fi

echo -n "  检查Nginx服务... "
if ssh $SERVER_USER@$SERVER_IP "systemctl is-active nginx > /dev/null 2>&1"; then
    print_success "Nginx运行正常"
else
    print_error "Nginx未运行"
fi

# 获取服务状态
print_step "[6/8] 获取服务状态..."
ssh $SERVER_USER@$SERVER_IP "pm2 status"

# 显示日志
print_step "[7/8] 最近的日志（最后10行）..."
echo ""
echo "--- 后端日志 ---"
ssh $SERVER_USER@$SERVER_IP "pm2 logs videoflow-backend --lines 10 --nostream" || echo "无法获取日志"

# 完成
print_step "[8/8] 部署完成！"
echo ""
echo "=========================================="
echo "✅ 部署成功完成！"
echo "=========================================="
echo ""
echo "📌 访问信息:"
echo "  🌐 前端地址: http://$SERVER_IP"
echo "  🔌 API地址: http://$SERVER_IP/api"
echo "  ❤️  健康检查: http://$SERVER_IP/api/health"
echo ""
echo "👤 管理员账号:"
echo "  📧 Email: admin@videoflow.pro"
echo "  🔑 Password: admin123"
echo ""
echo "📊 管理命令:"
echo "  查看状态: ssh $SERVER_USER@$SERVER_IP 'pm2 status'"
echo "  查看日志: ssh $SERVER_USER@$SERVER_IP 'pm2 logs videoflow-backend'"
echo "  重启服务: ssh $SERVER_USER@$SERVER_IP 'pm2 restart videoflow-backend'"
echo ""
echo "🔧 下一步:"
echo "  1. 访问 http://$SERVER_IP 测试前端"
echo "  2. 登录管理后台修改密码"
echo "  3. 配置Upload-Post API密钥"
echo "  4. 测试视频生成功能"
echo ""
echo "=========================================="
