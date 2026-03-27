#!/bin/bash

# 宝宝购物记录小程序 - 一键更新脚本
# 双击运行即可自动更新到最新版本

cd "$(dirname "$0")"

echo "🔄 正在更新..."
git pull origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 更新完成！"
    echo ""
    echo "📱 下一步："
    echo "   1. 打开微信开发者工具"
    echo "   2. 导入此文件夹"
    echo ""
else
    echo "❌ 更新失败，请检查网络"
fi

read -p "按回车键退出..."
