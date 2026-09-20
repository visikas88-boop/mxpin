@echo off
echo ========================================
echo 执行数据库迁移：创建 user_points 表
echo ========================================
echo.

REM 查找 PostgreSQL 安装路径
set PSQL_PATH=

if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    set PSQL_PATH=C:\Program Files\PostgreSQL\16\bin\psql.exe
) else if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
    set PSQL_PATH=C:\Program Files\PostgreSQL\15\bin\psql.exe
) else if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    set PSQL_PATH=C:\Program Files\PostgreSQL\14\bin\psql.exe
) else if exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" (
    set PSQL_PATH=C:\Program Files\PostgreSQL\13\bin\psql.exe
) else (
    echo 错误：未找到 PostgreSQL 安装路径
    echo 请手动执行以下命令：
    echo psql -h localhost -U postgres -d videoflow_pro -f create-user-points-table.sql
    pause
    exit /b 1
)

echo 找到 PostgreSQL: %PSQL_PATH%
echo.
echo 正在执行迁移脚本...
echo.

"%PSQL_PATH%" -h localhost -U postgres -d videoflow_pro -f create-user-points-table.sql

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ 迁移成功完成！
    echo ========================================
) else (
    echo.
    echo ========================================
    echo ❌ 迁移失败，请检查错误信息
    echo ========================================
)

echo.
pause
