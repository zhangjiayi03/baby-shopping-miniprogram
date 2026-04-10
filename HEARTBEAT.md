# HEARTBEAT.md - 定时任务配置

## 🕐 每日自我反思任务 (04:00) - 已合并 MemPalace 全局存储

**时间：** 每天早上 4 点 (Asia/Shanghai)  
**配置：** `memory/self-reflection-config.md`  
**执行 Agent:** PM Agent

### 任务内容（已合并）

#### 1️⃣ 自我反思（原有）
- 回顾过去 24 小时会话记录
- 识别用户不满意的地方
- 优化 SOUL.md、USER.md、AGENTS.md、TOOLS.md
- 生成进化日志
- 发送反思报告到 KIM

#### 2️⃣ MemPalace 全局记忆存储（新增）
**脚本:** `memory/daily-reflection-all.sh`

**功能:**
- 收集过去 24 小时**所有对话**（不限项目）
- 生成**7 个分类**摘要
- 存储到 MemPalace (`all_memory` wing)
- 支持分类搜索

**分类结构:**
| 房间 | 内容 |
|------|------|
| work-dev | 工作开发、技术、Bug |
| work-product | 产品需求、功能设计 |
| life-feedback | 用户反馈、意见 |
| decisions | 重要决策 |
| todo | 待办事项 |
| life-personal | 个人生活、闲聊 |
| learning | 学习、知识 |

### 输出文件

**自我反思**:
- `memory/evolution-log.md` - 进化日志
- `memory/YYYY-MM-DD.md` - 每日记忆
- `.learnings/LEARNINGS.md` - 学习日志

**MemPalace 全局**:
- `all-memory/daily-logs/YYYY-MM-DD-*.md` - 7 个分类日志
- MemPalace Wing: `all_memory`
- 房间数：7 个

**MemPalace 项目** (可选):
- `miniprogram-memory/daily-logs/` - 小程序专项记忆
- Wing: `miniprogram_memory`

### 搜索示例

```bash
# 全局搜索
cd all-memory
python -m mempalace search "昨天讨论的技术" --room work-dev
python -m mempalace search "产品需求" --room work-product
python -m mempalace search "用户反馈" --room life-feedback
python -m mempalace search "重要决策" --room decisions
python -m mempalace search "待办" --room todo
python -m mempalace search "今天聊了什么" --room life-personal
python -m mempalace search "学到了什么" --room learning

# 项目搜索
cd miniprogram-memory
python -m mempalace search "批量上传" --room technical
```

---

## 📋 任务管理

**查看配置:**
```bash
cat memory/self-reflection-config.md
```

**查看进化日志:**
```bash
cat memory/evolution-log.md
```

**手动触发测试:**
```bash
bash memory/daily-reflection-all.sh
```

---

*最后更新：2026-04-10 11:32 - 已升级为全局对话存储*
