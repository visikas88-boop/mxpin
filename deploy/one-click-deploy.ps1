# VideoFlow Pro 一键自动部署脚本
# 本地构建 + 自动上传 + 服务器部署

param(
    [string]$ServerIP = "45.32.65.122",
    [string]$ServerUser = "root",
    [string]$ServerPassword = "Vultr2026@"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "VideoFlow Pro 一键自动部署" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# 1. 本地构建前端
Write-Host "[1/5] 本地构建前端..." -ForegroundColor Yellow
cd F:\Aipost\web
npm run build
Write-Host "  ✅ 前端构建完成" -ForegroundColor Green
Write-Host ""

# 2. 打包dist目录
Write-Host "[2/5] 打包前端文件..." -ForegroundColor Yellow
if (Test-Path dist.tar.gz) { Remove-Item dist.tar.gz }
tar -czf dist.tar.gz dist
Write-Host "  ✅ 打包完成: dist.tar.gz" -ForegroundColor Green
Write-Host ""

# 3. 通过Vultr控制台API上传（如果SSH不通）
Write-Host "[3/5] 准备上传到服务器..." -ForegroundColor Yellow
Write-Host "  由于SSH密钥问题，需要手动操作：" -ForegroundColor Yellow
Write-Host ""
Write-Host "  请按以下步骤操作：" -ForegroundColor Cyan
Write-Host "  1. 打开 https://my.vultr.com/subs/" -ForegroundColor White
Write-Host "  2. 点击服务器 -> View Console" -ForegroundColor White
Write-Host "  3. 在控制台执行：" -ForegroundColor White
Write-Host ""
Write-Host "     cd /tmp && python3 -m http.server 9000" -ForegroundColor Green
Write-Host ""
Write-Host "  4. 然后在浏览器访问：http://$ServerIP`:9000" -ForegroundColor White
Write-Host "  5. 手动上传文件：F:\Aipost\web\dist.tar.gz" -ForegroundColor White
Write-Host ""
Write-Host "  上传完成后，按任意键继续..." -ForegroundColor Yellow
pause

# 4. 生成服务器端解压脚本
Write-Host ""
Write-Host "[4/5] 生成服务器部署脚本..." -ForegroundColor Yellow
$serverScript = @'
#!/bin/bash
set -e

echo "开始部署..."

# 解压前端文件
cd /var/www/videoflow-pro/web
rm -rf dist
tar -xzf /tmp/dist.tar.gz
echo "✅ 前端文件已更新"

# 重启服务
systemctl restart nginx
pm2 restart videoflow-backend

echo ""
echo "======================================="
echo "✅ 部署完成！"
echo "======================================="
echo ""
echo "访问地址: http://45.32.65.122"
echo ""
pm2 status
'@

$serverScript | Out-File -FilePath "F:\Aipost\deploy\server-deploy.sh" -Encoding UTF8
Write-Host "  ✅ 服务器脚本已生成: deploy/server-deploy.sh" -ForegroundColor Green
Write-Host ""

# 5. 提示用户执行
Write-Host "[5/5] 最后一步..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  在Vultr控制台执行以下命令：" -ForegroundColor Cyan
Write-Host ""
Write-Host "  cd /var/www/videoflow-pro/web && rm -rf dist && tar -xzf /tmp/dist.tar.gz && systemctl restart nginx && pm2 restart videoflow-backend && echo '部署完成！访问 http://$ServerIP'" -ForegroundColor Green
Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host "准备工作已完成！" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 本地构建文件: F:\Aipost\web\dist.tar.gz" -ForegroundColor Cyan
Write-Host "🌐 访问地址: http://$ServerIP" -ForegroundColor Cyan
Write-Host ""
