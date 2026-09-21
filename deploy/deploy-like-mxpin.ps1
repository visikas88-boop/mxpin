param(
    [string]$Server = "45.32.65.122",
    [string]$Password = "Vultr2026@",
    [string]$Local = "F:\Aipost",
    [string]$Remote = "/var/www/videoflow-pro"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "VideoFlow Pro 自动部署（mxpin方式）" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$Stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$Bundle = Join-Path $env:TEMP "videoflow_$Stamp.tgz"

function Run-Step($Name, [scriptblock]$Block) {
    Write-Host "=== $Name ===" -ForegroundColor Yellow
    & $Block
    Write-Host ""
}

Run-Step "1/4 本地构建前端" {
    Push-Location "$Local\web"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "前端构建失败"
    }
    Pop-Location
    Write-Host "  ✅ 前端构建完成" -ForegroundColor Green
}

Run-Step "2/4 创建部署包" {
    Push-Location $Local
    if (Test-Path $Bundle) { Remove-Item $Bundle -Force }

    tar -czf $Bundle web/dist server/src server/package.json server/.env.example

    if ($LASTEXITCODE -ne 0 -or !(Test-Path $Bundle)) {
        throw "打包失败"
    }
    Pop-Location
    Write-Host "  ✅ 部署包已创建: $Bundle" -ForegroundColor Green
    Write-Host "  大小: $((Get-Item $Bundle).Length / 1MB | Out-String -Stream | Select-Object -First 1) MB"
}

Run-Step "3/4 上传到服务器" {
    Write-Host "  使用pscp上传..." -ForegroundColor Cyan

    # 使用pscp（PuTTY）上传
    if (Get-Command pscp -ErrorAction SilentlyContinue) {
        pscp -pw $Password $Bundle "root@${Server}:/tmp/"
        if ($LASTEXITCODE -ne 0) {
            throw "上传失败"
        }
    } else {
        Write-Host "  ⚠️  未找到pscp，请手动上传：" -ForegroundColor Yellow
        Write-Host "  文件: $Bundle" -ForegroundColor White
        Write-Host "  目标: root@${Server}:/tmp/" -ForegroundColor White
        Write-Host ""
        Write-Host "  按任意键继续（上传完成后）..." -ForegroundColor Yellow
        pause
    }
    Write-Host "  ✅ 文件已上传" -ForegroundColor Green
}

Run-Step "4/4 服务器端部署" {
    Write-Host "  请在Vultr控制台执行以下命令：" -ForegroundColor Cyan
    Write-Host ""

$serverCommands = @"
cd $Remote
tar -xzf /tmp/$(Split-Path $Bundle -Leaf)
rm -rf web/dist
mv web/dist web/dist
systemctl restart nginx
pm2 restart videoflow-backend
pm2 status
echo "✅ 部署完成！访问 http://$Server"
"@

    Write-Host $serverCommands -ForegroundColor Green
    Write-Host ""
}

Write-Host "=======================================" -ForegroundColor Green
Write-Host "准备工作完成！" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 部署包: $Bundle" -ForegroundColor Cyan
Write-Host "🌐 访问地址: http://$Server" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 提示：Vultr服务器SSH有问题，需要通过Web控制台执行部署命令" -ForegroundColor Yellow
Write-Host ""
