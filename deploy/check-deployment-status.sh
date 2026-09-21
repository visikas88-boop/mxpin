# 检查服务器当前部署状态的命令
# 在Vultr控制台执行

# 1. 检查Node.js是否安装
node --version

# 2. 检查PostgreSQL是否运行
systemctl status postgresql --no-pager | head -5

# 3. 检查Nginx是否运行
systemctl status nginx --no-pager | head -5

# 4. 检查项目是否已克隆
ls -la /var/www/videoflow-pro 2>/dev/null || echo "项目未克隆"

# 5. 检查PM2服务
pm2 list

# 如果以上都正常，访问：http://45.32.65.132
