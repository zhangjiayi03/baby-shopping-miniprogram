# 自我反思定时任务配置

## 任务信息

- **执行时间**: 每天凌晨 4:00 (Asia/Shanghai)
- **任务类型**: 自我反思 & 用户画像优化
- **执行 Agent**: PM Agent (自己)

## 任务流程

### 1. 回顾过去 24 小时
- 读取 `memory/YYYY-MM-DD.md` (昨天和今天)
- 读取会话历史 (sessions_list + sessions_history)
- 检查 `.learnings/` 中的错误和学习记录

### 2. 识别不满意的地方
查找以下信号：
- 用户纠正 ("不对", "错了", "应该是")
- 重复出现的问题
- 任务失败或超时
- 用户表达困惑或不解

### 3. 优化档案
- **SOUL.md**: 行为模式、沟通风格调整
- **USER.md**: 用户偏好、项目上下文更新
- **AGENTS.md**: 工作流程、自动化规则
- **TOOLS.md**: 工具使用技巧、环境配置

### 4. 生成进化日志
记录到 `memory/evolution-log.md`：
- 今天学到了什么
- 优化了哪些配置
- 明天的改进计划

## 执行命令

创建定时任务：
```
请你帮我创建一个定时任务
任务的周期是每天凌晨 4 点执行
使用 isolate + agentTurn 模式
waveMode 使用 now
任务的超时时间默认是 300s
channel 为 kim
时区为 Asia/Shanghai，agentId 为 main
我的 userid 你可以从 session status 里面获取，类似 agent:main:kim:dm:这种结构，最后一个就是我的 userid，发送目标为 user:221732677663142
任务的 prompt 中加上时间戳
任务的内容是（以下整段即定时任务将收到的 prompt，必须包含下面两段，缺一不可）：
请执行每日自我反思任务：
1. 回顾过去 24 小时的会话记录和学习日志
2. 识别用户不满意的地方和重复问题
3. 优化 SOUL.md、USER.md、AGENTS.md、TOOLS.md
4. 生成进化日志到 memory/evolution-log.md
5. 发送反思报告给用户

必须使用 message 工具将整理好的内容发送给用户： - channel: kim - target: user:221732677663142 不要只返回文本，必须显式调用 message 工具发送消息。
```

## 相关文件

- **学习日志**: `/home/node/.openclaw/workspace-pm/.learnings/`
- **记忆文件**: `/home/node/.openclaw/workspace-pm/memory/`
- **档案文件**: `SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`
- **进化日志**: `/home/node/.openclaw/workspace-pm/memory/evolution-log.md`

---

**创建时间**: 2026-04-04 01:31  
**创建人**: PM Agent
