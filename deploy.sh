#!/bin/bash

# 宝宝购物记账小程序 - 云函数自动部署脚本
# 使用方法：./deploy.sh

set -e

echo "🚀 开始部署云函数 ocr..."

# 检查是否在项目目录
if [ ! -d "cloudfunctions/ocr" ]; then
    echo "❌ 错误：请在项目根目录下运行此脚本"
    exit 1
fi

# 检查微信 CLI 是否安装
if ! command -v wx &> /dev/null; then
    echo "⚠️  微信开发者工具 CLI 未安装"
    echo "📦 请先安装："
    echo "   npm install -g @cloudbase/cli"
    echo ""
    echo "或者手动在微信开发者工具中部署："
    echo "1. 打开微信开发者工具"
    echo "2. 点击顶部「云开发」按钮"
    echo "3. 找到 ocr 云函数"
    echo "4. 点击「部署」"
    exit 1
fi

# 获取云环境 ID
ENV_ID=$(grep -o '"env": "[^"]*"' app.js | head -1 | cut -d'"' -f4)

if [ -z "$ENV_ID" ]; then
    echo "❌ 错误：无法从 app.js 中获取云环境 ID"
    exit 1
fi

echo "☁️  云环境 ID: $ENV_ID"

# 部署云函数
echo "📦 正在部署云函数 ocr..."
wx cloud functions:deploy ocr --envId "$ENV_ID"

echo ""
echo "✅ 部署完成！"
echo ""
echo "📝 下一步："
echo "1. 在微信开发者工具中点击「编译」"
echo "2. 测试截图识别功能"
