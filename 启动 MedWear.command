#!/bin/bash
# 双击此文件即可启动 MedWear（macOS）
cd "$(dirname "$0")"
echo "MedWear 项目目录: $(pwd)"
if [ ! -f package.json ]; then
  echo "错误：找不到 package.json，请确认此文件在项目根目录。"
  read -p "按回车键关闭..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "首次运行，正在安装依赖..."
  npm install || { read -p "安装失败，按回车关闭..."; exit 1; }
fi
npm run app
read -p "已退出。按回车键关闭窗口..."
