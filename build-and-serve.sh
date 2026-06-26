#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "==== MedWear 医用可穿戴设备数据分析平台 ===="

[ ! -d node_modules ] && npm install
npm run build

echo "启动 http://localhost:5000"
npx serve -s build -l 5000
