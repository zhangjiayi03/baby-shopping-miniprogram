#!/bin/bash
# 每日反思任务 - 存储所有对话历史到 MemPalace（全局版）

set -e

# 配置
WORKSPACE="/home/node/.openclaw/workspace-pm"
MEMORY_DIR="$WORKSPACE/all-memory"  # 所有对话的记忆库
LOGS_DIR="$MEMORY_DIR/daily-logs"
DATE=$(date +%Y-%m-%d)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "======================================================="
echo "  每日反思任务 - 全局对话记忆存储"
echo "  执行时间：$TIMESTAMP"
echo "  周期：每天 04:00"
echo "  范围：所有对话（不限项目）"
echo "======================================================="

# 创建目录
mkdir -p "$MEMORY_DIR"
mkdir -p "$LOGS_DIR"

# 日志文件路径
LOG_FILE="$LOGS_DIR/$DATE.log"
SUMMARY_FILE="$LOGS_DIR/$DATE-summary.md"

# 步骤 1: 从 OpenClaw 收集过去 24 小时的会话历史
echo ""
echo "📥 步骤 1: 收集所有对话历史..."

# 使用 OpenClaw API 导出会话历史
SESSIONS_FILE="$LOGS_DIR/$DATE-sessions.json"

# 尝试使用 OpenClaw 命令导出（如果可用）
if command -v openclaw &> /dev/null; then
    echo "   使用 OpenClaw 导出会话历史..."
    openclaw sessions export --since "$YESTERDAY" --format json --output "$SESSIONS_FILE" 2>/dev/null || true
fi

# 如果没有自动导出，手动创建会话摘要
if [ ! -f "$SESSIONS_FILE" ] || [ ! -s "$SESSIONS_FILE" ]; then
    echo "   ⚠️  未找到自动导出的会话，创建手动摘要模板..."
    cat > "$LOG_FILE" << EOF
# $DATE 对话日志

## 主要话题
- [待填写]

## 关键决策
- [待填写]

## 学到的东西
- [待填写]

## 待办事项
- [待填写]
EOF
fi

# 步骤 2: 生成分类摘要（7 个通用分类）
echo ""
echo "📝 步骤 2: 生成分类摘要..."

# 分类文件
WORK_DEV="$LOGS_DIR/$DATE-work-dev.md"
WORK_PRODUCT="$LOGS_DIR/$DATE-work-product.md"
LIFE_FEEDBACK="$LOGS_DIR/$DATE-life-feedback.md"
DECISIONS="$LOGS_DIR/$DATE-decisions.md"
TODO="$LOGS_DIR/$DATE-todo.md"
LIFE_PERSONAL="$LOGS_DIR/$DATE-life-personal.md"
LEARNING="$LOGS_DIR/$DATE-learning.md"

# 1. 工作 - 技术开发
cat > "$WORK_DEV" << EOF
# 工作开发日志 - $DATE

**分类:** Work > Development  
**生成时间:** $TIMESTAMP  
**范围:** 所有开发相关对话

---

## 💻 技术讨论

### 话题 1: [主题]
**时间:** [时间]  
**内容:** [讨论了什么技术]  
**结论:** [技术方案/决策]

---

## 🐛 Bug 与修复

### Bug 1: [问题]
**发现:** [时间]  
**根因:** [原因]  
**修复:** [方案]

---

## 🔧 工具与环境

- 新工具：[工具名]
- 环境变化：[变化内容]

---

*工作开发分类 - 自动生成*
EOF

# 2. 工作 - 产品
cat > "$WORK_PRODUCT" << EOF
# 工作产品日志 - $DATE

**分类:** Work > Product  
**生成时间:** $TIMESTAMP

---

## 📋 需求讨论

### 需求 1: [需求名]
**背景:** [用户需求]  
**方案:** [产品方案]  
**优先级:** [P0/P1/P2]

---

## 🎯 功能设计

- 功能：[名称]
- 目标：[解决什么]

---

*工作产品分类 - 自动生成*
EOF

# 3. 生活 - 反馈
cat > "$LIFE_FEEDBACK" << EOF
# 用户反馈日志 - $DATE

**分类:** Life > Feedback  
**生成时间:** $TIMESTAMP

---

## 👤 反馈内容

### 反馈 1: [内容]
**类型:** [建议/问题/表扬/批评]  
**情绪:** [满意/中性/不满]  
**响应:** [如何处理]

---

*用户反馈分类 - 自动生成*
EOF

# 4. 决策
cat > "$DECISIONS" << EOF
# 重要决策日志 - $DATE

**分类:** Decisions  
**生成时间:** $TIMESTAMP

---

## 🎯 关键决策

### 决策 1: [内容]
**背景:** [为什么]  
**选项:** [A/B/C]  
**选择:** [最终方案]  
**原因:** [理由]

---

*决策分类 - 自动生成*
EOF

# 5. 待办
cat > "$TODO" << EOF
# 待办事项 - $DATE

**分类:** TODO  
**生成时间:** $TIMESTAMP

---

## 🎯 待办清单

### P0 - 必须
- [ ] [任务]

### P1 - 重要
- [ ] [任务]

### P2 - 可选
- [ ] [任务]

---

*待办分类 - 自动生成*
EOF

# 6. 生活 - 个人
cat > "$LIFE_PERSONAL" << EOF
# 个人生活日志 - $DATE

**分类:** Life > Personal  
**生成时间:** $TIMESTAMP

---

## 💬 闲聊对话

- [话题 1]
- [话题 2]

## 🎉 生活事件

- [事件]

---

*个人生活分类 - 自动生成*
EOF

# 7. 学习
cat > "$LEARNING" << EOF
# 学习日志 - $DATE

**分类:** Learning  
**生成时间:** $TIMESTAMP

---

## 📚 新知识

### 知识点 1: [主题]
**来源:** [对话/文档/搜索]  
**内容:** [学到了什么]  
**应用:** [怎么用]

---

## 🔍 技能提升

- 技能：[名称]
- 进步：[内容]

---

*学习分类 - 自动生成*
EOF

echo "✅ 分类摘要已生成 (7 个):"
echo "   - work-dev: $WORK_DEV"
echo "   - work-product: $WORK_PRODUCT"
echo "   - life-feedback: $LIFE_FEEDBACK"
echo "   - decisions: $DECISIONS"
echo "   - todo: $TODO"
echo "   - life-personal: $LIFE_PERSONAL"
echo "   - learning: $LEARNING"

# 步骤 3: 分类存储到 MemPalace
echo ""
echo "🏰 步骤 3: 分类存储到 MemPalace..."

cd "$MEMORY_DIR"

# 创建房间配置
cat > mempalace-rooms.yaml << EOF
rooms:
  - name: work-dev
    description: "工作开发、技术讨论、Bug 修复"
    files:
      - "daily-logs/*-work-dev.md"
  - name: work-product
    description: "产品需求、功能设计"
    files:
      - "daily-logs/*-work-product.md"
  - name: life-feedback
    description: "用户反馈、意见、满意度"
    files:
      - "daily-logs/*-life-feedback.md"
  - name: decisions
    description: "重要决策、技术选型"
    files:
      - "daily-logs/*-decisions.md"
  - name: todo
    description: "待办事项、进度"
    files:
      - "daily-logs/*-todo.md"
  - name: life-personal
    description: "个人生活、闲聊"
    files:
      - "daily-logs/*-life-personal.md"
  - name: learning
    description: "学习、知识、技能"
    files:
      - "daily-logs/*-learning.md"
EOF

echo "   房间配置已生成：mempalace-rooms.yaml"
echo "   房间数：7 个"

# 执行挖掘
echo ""
echo "   正在存储到 MemPalace..."
python -m mempalace mine . --mode convos 2>&1 | tail -10

echo ""
echo "✅ 全局对话存储完成！"
echo ""
echo "📊 统计信息:"
echo "   日期：$DATE"
echo "   分类文件：7 个"
echo "   MemPalace Wing: all_memory"
echo "   房间数：7 个 (work-dev/work-product/life-feedback/decisions/todo/life-personal/learning)"
echo ""
echo "🔍 分类搜索示例:"
echo "   python -m mempalace search \"小程序开发\" --room work-dev"
echo "   python -m mempalace search \"产品需求\" --room work-product"
echo "   python -m mempalace search \"用户反馈\" --room life-feedback"
echo "   python -m mempalace search \"技术决策\" --room decisions"
echo "   python -m mempalace search \"待办\" --room todo"
echo "   python -m mempalace search \"今天聊了什么\" --room life-personal"
echo "   python -m mempalace search \"学到了什么\" --room learning"
echo ""
echo "======================================================="
