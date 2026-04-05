# PRD：Polaris 直播间切换任务超时修复

## 1. 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-04-04 | PM Agent | 初始版本 |

---

## 2. 产品概述

### 2.1 背景

Polaris 直播间自动切换任务（每晚 19:00 执行）近期连续 2 天出现超时问题：
- **要求执行时长**：60 分钟（4 次切换 × 15 分钟间隔）
- **实际执行时长**：46 分钟
- **问题原因**：cron 任务默认超时时间 300 秒，任务被强制中断
- **监督失效**：监督 Agent 未检测时长异常，仍报告"完美执行"

### 2.2 目标

1. 修复任务超时配置，确保任务完整执行 60 分钟
2. 修复监督逻辑，增加时长校验，防止类似问题再次发生
3. 建立完善的任务监控和告警机制

---

## 3. 问题分析

### 3.1 问题现象

| 日期 | 启动时间 | 完成时间 | 实际时长 | 状态 |
|------|----------|----------|----------|------|
| 4 月 1 日 | 19:00:31 | 19:47:13 | 46 分钟 | ✅ |
| 4 月 2 日 | 19:00:31 | 超时 | 46 分钟 | ❌ timeout |
| 4 月 3 日 | 19:00:17 | 19:46:40 | 46 分钟 | ❌ timeout |

### 3.2 根因分析

| 问题 | 原因 | 影响 |
|------|------|------|
| 任务超时 | cron 默认超时 300 秒，任务需 3600 秒 | 任务提前终止 |
| 监督失效 | 只检查切换次数，未检查总时长 | 问题未被发现 |
| 无告警 | 超时错误未触发告警 | 无人知晓问题 |

---

## 4. 核心功能

### 4.1 任务超时配置修复

**修改内容**：
- 将 `evening-polaris-7pm-20260401` 任务的 `timeoutSeconds` 从默认值改为 **5400 秒（90 分钟）**
- 预留 30 分钟缓冲时间，应对可能的网络延迟/页面加载慢等情况

**配置文件**：`/home/node/.openclaw/cron/jobs.json`

### 4.2 监督逻辑修复

**新增检查项**：

| 检查项 | 校验规则 | 当前状态 | 修复后 |
|--------|----------|----------|--------|
| 总时长 | ≥60 分钟 | ❌ 未检查 | ✅ 新增 |
| 切换间隔 | 13-17 分钟/次 | ❌ 未检查 | ✅ 新增 |
| 超时错误 | 无 timeout 错误 | ❌ 未检查 | ✅ 新增 |
| 切换次数 | =4 次 | ✅ 已检查 | ✅ 保持 |

### 4.3 告警机制

**新增告警触发条件**：
- 任务执行时长 < 55 分钟 → 发送警告
- 任务状态 = error → 发送警告
- 连续 2 次执行失败 → 发送严重警告

---

## 5. 技术方案

### 5.1 Cron 配置修改

```json
{
  "id": "evening-polaris-7pm-20260401",
  "name": "刷快手直播间切换（每晚 19 点）",
  "timeoutSeconds": 5400
}
```

### 5.2 监督 Agent 逻辑修改

**检查逻辑伪代码**：
```python
def check_task_execution(logs):
    # 原有检查
    if switch_count != 4:
        return "❌ 切换次数不足"
    
    # 新增：时长检查
    total_duration = end_time - start_time
    if total_duration < 55 * 60:  # 55 分钟
        return f"❌ 执行时长不足：{total_duration/60:.1f}分钟 < 55 分钟"
    
    # 新增：间隔检查
    for i in range(len(intervals)):
        if intervals[i] < 13*60 or intervals[i] > 17*60:
            return f"❌ 切换间隔异常：{intervals[i]/60:.1f}分钟"
    
    # 新增：超时检查
    if task_status == "error" and "timeout" in error_message:
        return "❌ 任务超时"
    
    return "✅ 执行完美"
```

---

## 6. 数据模型

### 6.1 Cron 任务配置结构

```json
{
  "id": "string",
  "name": "string",
  "enabled": "boolean",
  "schedule": {
    "kind": "cron",
    "expr": "string",
    "tz": "string"
  },
  "timeoutSeconds": "number",  // 新增
  "state": {
    "lastRunStatus": "string",
    "lastDurationMs": "number",
    "consecutiveErrors": "number"
  }
}
```

### 6.2 监督报告结构

```json
{
  "reportTime": "string",
  "taskStatus": "ok|error",
  "checks": [
    {"item": "切换次数", "passed": "boolean", "detail": "string"},
    {"item": "总时长", "passed": "boolean", "detail": "string"},  // 新增
    {"item": "切换间隔", "passed": "boolean", "detail": "string"},  // 新增
    {"item": "超时检测", "passed": "boolean", "detail": "string"}  // 新增
  ],
  "conclusion": "string"
}
```

---

## 7. 开发计划

| 任务 | 优先级 | 预计工时 | 负责人 |
|------|--------|----------|--------|
| 修改 cron 超时配置 | P0 | 10 分钟 | PM Agent |
| 修改监督 Agent 逻辑 | P0 | 30 分钟 | PM Agent |
| 验证今晚任务执行 | P0 | 60 分钟 | 自动 |
| 输出测试报告 | P1 | 10 分钟 | PM Agent |

---

## 8. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 超时时间设置过长导致资源占用 | 低 | 低 | 90 分钟已预留充足缓冲 |
| 监督逻辑误判 | 中 | 中 | 设置合理阈值（55 分钟而非 60 分钟） |
| 网络问题导致任务失败 | 中 | 高 | 增加重试机制（后续优化） |

---

## 9. 成功指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 任务完成率 | 100% | cron 任务状态 |
| 执行时长 | ≥55 分钟 | 监督报告 |
| 问题发现率 | 100% | 监督告警准确率 |

---

## 10. 附录

### 10.1 相关文件

- Cron 配置：`/home/node/.openclaw/cron/jobs.json`
- 任务日志：`/home/node/.openclaw/cron/runs/evening-polaris-7pm-20260401.jsonl`
- 监督日志：`/home/node/.openclaw/cron/runs/supervisor-polaris-815pm-20260401.jsonl`

### 10.2 参考文档

- `polaris-live-switch` SKILL.md
- `kim-cron-message` SKILL.md

---

**PRD 审核人**: 张佳祎  
**创建时间**: 2026-04-04 01:15  
**状态**: 待实施 → 实施中 → 已完成
