# VideoFlow Pro 自动部署脚本 (PowerShell版本)
# 用途：从Windows本机SSH到服务器并执行更新

$password = "Vultr2026@"
$server = "45.32.65.122"
$user = "root"

Write-Host "🚀 开始部署到服务器..." -ForegroundColor Green
Write-Host ""

# 创建SSH命令脚本
$commands = @"
cd /var/www/videoflow-pro
git pull origin main
cd server && npm install --production
cd ../web && npm install --legacy-peer-deps && npm run build
pm2 restart videoflow-backend
systemctl reload nginx
echo ""
echo "✅ 部署完成！"
pm2 status
"@

# 使用plink或ssh执行（如果有Putty）
try {
    Write-Host "📡 连接服务器: $user@$server" -ForegroundColor Cyan

    # 保存命令到临时文件
    $tempScript = "$env:TEMP\deploy-commands.sh"
    $commands | Out-File -FilePath $tempScript -Encoding ASCII

    # 使用SSH执行（需要手动输入密码）
    Write-Host ""
    Write-Host "⚠️  请在提示时输入密码: $password" -ForegroundColor Yellow
    Write-Host ""

    # 方法1: 使用 cat | ssh
    Get-Content $tempScript | ssh -o StrictHostKeyChecking=no "$user@$server" "bash -s"

    Remove-Item $tempScript -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "🎉 部署完成！" -ForegroundColor Green
    Write-Host "🌐 访问地址: http://$server" -ForegroundColor Cyan

} catch {
    Write-Host "❌ 部署失败: $_" -ForegroundColor Red
    exit 1
}
