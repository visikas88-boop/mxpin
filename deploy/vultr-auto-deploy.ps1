# VideoFlow Pro 自动化部署脚本 (PowerShell版)
# 完全自动化，无需手动操作服务器

param(
    [string]$ApiKey = $env:VULTR_API_KEY,
    [string]$ServerId = "9c765e11-5249-4336-84d9-492e9ac84b00",
    [string]$ServerIP = "45.32.65.122"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VideoFlow Pro 全自动化部署系统" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查API密钥
if ([string]::IsNullOrEmpty($ApiKey)) {
    Write-Host "错误：未设置 VULTR_API_KEY" -ForegroundColor Red
    Write-Host ""
    Write-Host "获取API密钥步骤：" -ForegroundColor Yellow
    Write-Host "1. 访问 https://my.vultr.com/settings/#settingsapi"
    Write-Host "2. 点击 'Add API Key'"
    Write-Host "3. 复制生成的密钥"
    Write-Host ""
    Write-Host "使用方法：" -ForegroundColor Yellow
    Write-Host '  $env:VULTR_API_KEY = "your-api-key"'
    Write-Host "  .\vultr-auto-deploy.ps1"
    Write-Host ""
    exit 1
}

Write-Host "配置信息：" -ForegroundColor Green
Write-Host "  API Key: $($ApiKey.Substring(0, 10))..."
Write-Host "  Server ID: $ServerId"
Write-Host "  Server IP: $ServerIP"
Write-Host ""

# 读取部署脚本
Write-Host "[1/4] 准备部署脚本..." -ForegroundColor Cyan
$deployScriptPath = Join-Path $PSScriptRoot "manual-deploy-simple.sh"

if (-not (Test-Path $deployScriptPath)) {
    Write-Host "错误：找不到部署脚本 $deployScriptPath" -ForegroundColor Red
    exit 1
}

$deployScript = Get-Content $deployScriptPath -Raw -Encoding UTF8

Write-Host "  部署脚本大小: $($deployScript.Length) 字节" -ForegroundColor Gray
Write-Host ""

# 创建Startup Script
Write-Host "[2/4] 创建 Vultr Startup Script..." -ForegroundColor Cyan

$scriptName = "videoflow-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
$createScriptBody = @{
    name = $scriptName
    type = "boot"
    script = $deployScript
} | ConvertTo-Json -Depth 10

try {
    $scriptResponse = Invoke-RestMethod `
        -Uri "https://api.vultr.com/v2/startup-scripts" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ApiKey"
            "Content-Type" = "application/json"
        } `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($createScriptBody))

    $scriptId = $scriptResponse.startup_script.id
    Write-Host "  Startup Script ID: $scriptId" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "错误：创建 Startup Script 失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 应用Startup Script到服务器
Write-Host "[3/4] 应用 Startup Script 到服务器..." -ForegroundColor Cyan

$updateServerBody = @{
    script_id = $scriptId
} | ConvertTo-Json

try {
    Invoke-RestMethod `
        -Uri "https://api.vultr.com/v2/instances/$ServerId" `
        -Method PATCH `
        -Headers @{
            "Authorization" = "Bearer $ApiKey"
            "Content-Type" = "application/json"
        } `
        -Body $updateServerBody | Out-Null

    Write-Host "  已应用到服务器" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "错误：应用 Startup Script 失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 重启服务器
Write-Host "[4/4] 重启服务器执行部署..." -ForegroundColor Cyan

try {
    Invoke-RestMethod `
        -Uri "https://api.vultr.com/v2/instances/$ServerId/reboot" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ApiKey"
        } | Out-Null

    Write-Host "  服务器正在重启" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "错误：重启服务器失败" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "自动化部署已启动！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "部署进度：" -ForegroundColor Yellow
Write-Host "  1. 服务器重启中... (约1-2分钟)"
Write-Host "  2. Startup Script执行... (约5-8分钟)"
Write-Host "  3. 服务启动完成... (约1分钟)"
Write-Host ""
Write-Host "预计总耗时: 7-10分钟" -ForegroundColor Cyan
Write-Host ""
Write-Host "监控部署进度：" -ForegroundColor Yellow
Write-Host "  # 等待3分钟后执行"
Write-Host "  ssh root@$ServerIP 'tail -f /var/log/videoflow-deploy.log'" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 或查看部署状态"
Write-Host "  ssh root@$ServerIP 'test -f /var/www/videoflow-pro/.deployed && echo 已完成 || echo 进行中'" -ForegroundColor Gray
Write-Host ""
Write-Host "完成后访问: http://$ServerIP" -ForegroundColor Green
Write-Host ""
Write-Host "默认管理员账号：" -ForegroundColor Yellow
Write-Host "  Email: admin@videoflow.pro"
Write-Host "  Username: admin"
Write-Host "  Password: admin123"
Write-Host ""
