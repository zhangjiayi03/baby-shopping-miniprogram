#!/bin/bash
# 自动记忆搜索脚本 - 用于对话中实时搜索

QUERY="$1"
ROOM="$2"  # 可选，指定房间

MEMORY_DIR="/home/node/.openclaw/workspace-pm/all-memory"

if [ -z "$QUERY" ]; then
    echo "❌ 请提供搜索关键词"
    exit 1
fi

cd "$MEMORY_DIR"

echo "🔍 搜索记忆：\"$QUERY\""
if [ -n "$ROOM" ]; then
    echo "📂 房间：$ROOM"
    python -m mempalace search "$QUERY" --room "$ROOM" 2>&1
else
    # 自动搜索所有房间
    python -m mempalace search "$QUERY" 2>&1
fi

# 返回前 5 条结果
echo ""
echo "========================================="
echo "搜索完成"
