@echo off
echo ==== MedWear 医用可穿戴设备数据分析平台 ====
echo.

cd /d "%~dp0"

if not exist "node_modules" (
  echo 安装依赖...
  call npm install
  if %ERRORLEVEL% NEQ 0 exit /b 1
)

echo 构建中...
call npm run build
if %ERRORLEVEL% NEQ 0 exit /b 1

echo 启动 http://localhost:5000
cd build
call npx serve -s . -l 5000
