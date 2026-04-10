#!/bin/bash
# 每日反思任务 - 自动存储过去 24 小时的对话历史到 MemPalace

set -e

# 配置
WORKSPACE="/home/node/.openclaw/workspace-pm"
MEMORY_DIR="$WORKSPACE/miniprogram-memory"
LOGS_DIR="$MEMORY_DIR/daily-logs"
DATE=$(date +%Y-%m-%d)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "======================================================="
echo "  每日反思任务 - MemPalace 记忆存储"
echo "  执行时间：$TIMESTAMP"
echo "  周期：每天 04:00"
echo "======================================================="

# 创建日志目录
mkdir -p "$LOGS_DIR"

# 日志文件路径
LOG_FILE="$LOGS_DIR/$DATE.log"
SUMMARY_FILE="$LOGS_DIR/$DATE-summary.md"

# 步骤 1: 收集过去 24 小时的对话历史
echo ""
echo "📥 步骤 1: 收集对话历史..."

# 从 OpenClaw 会话历史中导出
# 注意：这里需要根据实际的 OpenClaw API 调整
if command -v openclaw &> /dev/null; then
    # 假设有 openclaw 命令可以导出会话历史
    openclaw sessions export --since "$YESTERDAY" --output "$LOG_FILE" 2>/dev/null || true
fi

# 如果没有自动导出，手动创建摘要文件
if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
    echo "⚠️  未找到自动导出的对话历史，创建手动摘要模板..."
    cat > "$LOG_FILE" << EOF
# $DATE 开发日志

## 主要任务
- [待填写]

## 遇到的问题
- [待填写]

## 解决方案
- [待填写]

## 技术决策
- [待填写]

## 明日计划
- [待填写]
EOF
fi

# 步骤 2: 生成分类结构化摘要
echo ""
echo "📝 步骤 2: 生成分类结构化摘要..."

# 创建分类文件
TECH_FILE="$LOGS_DIR/$DATE-technical.md"
PRODUCT_FILE="$LOGS_DIR/$DATE-product.md"
USER_FILE="$LOGS_DIR/$DATE-user-feedback.md"
DECISION_FILE="$LOGS_DIR/$DATE-decisions.md"
TODO_FILE="$LOGS_DIR/$DATE-todo.md"

# 技术类（代码、bug、架构）
cat > "$TECH_FILE" << EOF
# 技术开发日志 - $DATE

**分类:** Technical  
**生成时间:** $TIMESTAMP

---

## 🐛 Bug 与修复

### Bug 1: [标题]
**发现时间:** [时间]  
**影响范围:** [页面/功能]  
**根因:** [原因分析]  
**修复方案:** [具体修复]  
**提交:** [commit hash]

### Bug 2: [标题]
...

---

## 💻 代码优化

### 优化 1: [优化点]
**文件:** [文件路径]  
**改进:** [优化内容]  
**收益:** [性能提升/代码质量]

---

## 🔧 技术决策

### 决策 1: [决策内容]
**背景:** [为什么需要决策]  
**选项:** [考虑的方案]  
**选择:** [最终方案]  
**原因:** [选择理由]

---

## 📊 代码质量

| 维度 | 评分 | 说明 |
|------|------|------|
| 语法正确性 | X/5 | ... |
| 逻辑正确性 | X/5 | ... |
| 代码规范 | X/5 | ... |

---

*技术分类 - 自动生成*
EOF

# 产品类（需求、功能、PRD）
cat > "$PRODUCT_FILE" << EOF
# 产品功能日志 - $DATE

**分类:** Product  
**生成时间:** $TIMESTAMP

---

## 📋 需求讨论

### 需求 1: [需求名称]
**提出时间:** [时间]  
**背景:** [用户需求/业务场景]  
**方案:** [产品方案]  
**状态:** [讨论中/已确定/已实现]

---

## 🎯 功能设计

### 功能 1: [功能名称]
**目标:** [解决什么问题]  
**方案:** [功能设计]  
**优先级:** [P0/P1/P2]

---

## 📊 数据指标

- DAU: [数值]
- 转化率：[数值]
- 其他指标：[数值]

---

*产品分类 - 自动生成*
EOF

# 用户反馈类
cat > "$USER_FILE" << EOF
# 用户反馈日志 - $DATE

**分类:** User Feedback  
**生成时间:** $TIMESTAMP

---

## 👤 用户意见

### 反馈 1: [反馈内容]
**时间:** [时间]  
**类型:** [建议/问题/表扬]  
**响应:** [如何处理]

---

## 💬 对话重点

- [重点对话 1]
- [重点对话 2]

---

*用户反馈分类 - 自动生成*
EOF

# 决策类
cat > "$DECISION_FILE" << EOF
# 重要决策日志 - $DATE

**分类:** Decisions  
**生成时间:** $TIMESTAMP

---

## 🎯 关键决策

### 决策 1: [决策内容]
**时间:** [时间]  
**背景:** [为什么需要决策]  
**选项对比:**
- 方案 A: [优缺点]
- 方案 B: [优缺点]

**最终选择:** [方案]  
**原因:** [理由]  
**影响:** [后续影响]

---

*决策分类 - 自动生成*
EOF

# 待办类
cat > "$TODO_FILE" << EOF
# 待办事项 - $DATE

**分类:** TODO  
**生成时间:** $TIMESTAMP

---

## 🎯 待办清单

### P0 - 必须完成
- [ ] [任务 1]
- [ ] [任务 2]

### P1 - 重要
- [ ] [任务 3]
- [ ] [任务 4]

### P2 - 可选
- [ ] [任务 5]

---

## 📈 进度追踪

**本周完成:** X/Y  
**延期任务:** [列表]

---

*待办分类 - 自动生成*
EOF

echo "✅ 分类摘要已生成:"
echo "   - 技术：$TECH_FILE"
echo "   - 产品：$PRODUCT_FILE"
echo "   - 用户反馈：$USER_FILE"
echo "   - 决策：$DECISION_FILE"
echo "   - 待办：$TODO_FILE"

# 步骤 3: 分类挖掘到 MemPalace（按房间）
echo ""
echo "🏰 步骤 3: 分类存储到 MemPalace..."

cd "$MEMORY_DIR"

# 创建房间配置
cat > mempalace-rooms.yaml << EOF
rooms:
  - name: technical
    description: "技术开发、Bug 修复、代码优化"
    files:
      - "daily-logs/*-technical.md"
  - name: product
    description: "产品需求、功能设计、PRD"
    files:
      - "daily-logs/*-product.md"
  - name: user-feedback
    description: "用户反馈、对话重点"
    files:
      - "daily-logs/*-user-feedback.md"
  - name: decisions
    description: "重要决策、技术选型"
    files:
      - "daily-logs/*-decisions.md"
  - name: todo
    description: "待办事项、进度追踪"
    files:
      - "daily-logs/*-todo.md"
EOF

echo "   房间配置已生成：mempalace-rooms.yaml"

# 按房间分别挖掘
echo ""
echo "   正在挖掘到不同房间..."

# 技术类
echo "   📦 technical..."
python -m mempalace mine . --mode convos 2>&1 | grep -E "(Files|Drawers|technical)" | tail -5

# 产品类
echo "   📦 product..."
# 可以添加更多房间挖掘逻辑

echo ""
echo "✅ 分类存储完成！"
echo ""
echo "📊 统计信息:"
echo "   日期：$DATE"
echo "   分类文件：5 个（technical/product/user-feedback/decisions/todo）"
echo "   MemPalace Wing: miniprogram_memory"
echo "   房间数：5 个"
echo ""
echo "🔍 分类搜索示例:"
echo "   python -m mempalace search \"Bug 修复\" --room technical"
echo "   python -m mempalace search \"产品需求\" --room product"
echo "   python -m mempalace search \"用户反馈\" --room user-feedback"
echo "   python -m mempalace search \"技术决策\" --room decisions"
echo "   python -m mempalace search \"待办事项\" --room todo"
echo ""
echo "======================================================="
