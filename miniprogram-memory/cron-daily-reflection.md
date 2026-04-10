# 每日反思任务配置

## 📅 定时任务配置

### 方案 1: OpenClaw Cron (推荐)

在 OpenClaw 中创建定时任务，每天 04:00 (凌晨 4 点) 执行：

```bash
# 添加到 OpenClaw 配置
openclaw cron add --schedule "0 4 * * *" \
  --label "每日反思 - MemPalace" \
  --command "bash /home/node/.openclaw/workspace-pm/miniprogram-memory/scripts/daily-reflection.sh"
```

### 方案 2: 系统 Cron

```bash
# 编辑 crontab
crontab -e

# 添加以下行
0 4 * * * bash /home/node/.openclaw/workspace-pm/miniprogram-memory/scripts/daily-reflection.sh >> /home/node/.openclaw/workspace-pm/miniprogram-memory/cron.log 2>&1
```

### 方案 3: Kim 定时消息 (如果 OpenClaw 支持)

使用 `kim-cron-message` skill 创建定时任务：

```
每天 16:00 执行以下任务：
1. 运行 daily-reflection.sh 脚本
2. 将结果发送到 KIM
3. 提醒用户查看 MemPalace 更新
```

---

## 🔧 脚本说明

**脚本路径:** `/home/node/.openclaw/workspace-pm/miniprogram-memory/scripts/daily-reflection.sh`

**功能:**
1. 收集过去 24 小时的对话历史
2. 生成结构化摘要 (Markdown 格式)
3. 自动挖掘到 MemPalace
4. 输出统计信息和搜索示例

**输出文件:**
- `daily-logs/YYYY-MM-DD.log` - 原始对话日志
- `daily-logs/YYYY-MM-DD-summary.md` - 结构化摘要
- MemPalace Wing: `miniprogram_memory`

---

## 📊 摘要模板结构

每日生成的摘要包含：

1. **今日概览** - 主要任务、关键决策
2. **问题与解决** - 按时间线记录 bug 和修复
3. **代码质量** - 各项评分指标
4. **待办事项** - P0/P1/P2 优先级分类
5. **经验教训** - 学到的东西和改进建议
6. **相关文档** - 链接到 PRD、复盘、审查报告

---

## 🔍 搜索示例

任务执行后，可以搜索：

```bash
# 搜索今天的问题
python -m mempalace search "今天的问题"

# 搜索特定日期的决策
python -m mempalace search "2026-04-10 决策"

# 搜索批量上传相关
python -m mempalace search "批量上传 修复"

# 搜索代码审查
python -m mempalace search "代码审查"
```

---

## ⚙️ 自定义配置

### 修改执行时间

编辑脚本中的时间配置：

```bash
# 改为每天晚上 8 点
0 20 * * *

# 改为每天早上 9 点
0 9 * * *
```

### 修改存储位置

```bash
MEMORY_DIR="/your/custom/path"
```

### 添加更多分类

在摘要模板中添加新的分类部分：

```markdown
## 🎨 设计决策
- UI 改进
- 用户体验优化

## 📈 性能指标
- 编译时间
- 包大小
```

---

## 🚀 首次运行

手动执行一次测试：

```bash
cd /home/node/.openclaw/workspace-pm/miniprogram-memory
bash scripts/daily-reflection.sh
```

检查输出：
- ✅ 日志文件生成
- ✅ 摘要文件生成
- ✅ MemPalace 挖掘成功

---

## 📝 注意事项

1. **权限** - 确保脚本有执行权限 (`chmod +x`)
2. **路径** - 使用绝对路径避免问题
3. **日志轮转** - 定期清理旧的日志文件（建议保留 30 天）
4. **错误处理** - 脚本失败时发送通知

---

*配置日期：2026-04-10*
