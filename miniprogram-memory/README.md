# MemPalace 每日反思任务配置

## 🎯 功能概述

自动将过去 24 小时的开发对话历史分类存储到 MemPalace，支持语义搜索和知识沉淀。

**执行时间：** 每天 04:00 (凌晨，Asia/Shanghai)  
**存储位置：** `miniprogram-memory/daily-logs/`  
 **索引 Wing:** `miniprogram_memory`

---

## 📁 文件结构

```
miniprogram-memory/
├── scripts/
│   └── daily-reflection.sh      # 每日反思脚本
├── daily-logs/
│   ├── YYYY-MM-DD.log           # 原始对话日志
│   └── YYYY-MM-DD-summary.md    # 结构化摘要
├── mempalace.yaml               # MemPalace 配置
�└── README.md                    # 本文档
```

---

## ⚙️ 配置步骤

### 方案 1: OpenClaw Heartbeat (推荐)

OpenClaw 会自动读取 `HEARTBEAT.md` 文件并执行其中的任务。

**优点：**
- 与 OpenClaw 深度集成
- 无需额外配置
- 自动发送结果到 KIM

**配置：**
```markdown
# HEARTBEAT.md 已创建
# 每天 16:00 自动执行 daily-reflection.sh
```

### 方案 2: 系统 Cron

```bash
# 编辑 crontab
crontab -e

# 添加以下行
0 16 * * * bash /home/node/.openclaw/workspace-pm/miniprogram-memory/scripts/daily-reflection.sh >> /home/node/.openclaw/workspace-pm/miniprogram-memory/cron.log 2>&1
```

### 方案 3: 手动执行

```bash
cd /home/node/.openclaw/workspace-pm/miniprogram-memory
bash scripts/daily-reflection.sh
```

---

## 📊 分类存储结构

每日生成的日志按**5 个类别**分别存储到 MemPalace 的不同房间：

### 🏠 房间结构

| 房间名 | 内容 | 文件模式 |
|--------|------|----------|
| **technical** | 技术开发、Bug 修复、代码优化、架构决策 | `*-technical.md` |
| **product** | 产品需求、功能设计、PRD 讨论 | `*-product.md` |
| **user-feedback** | 用户反馈、对话重点、满意度 | `*-user-feedback.md` |
| **decisions** | 重要决策、技术选型、方案对比 | `*-decisions.md` |
| **todo** | 待办事项、进度追踪 | `*-todo.md` |

### 优势

✅ **精准搜索** - 可以指定房间搜索，缩小范围  
✅ **知识分类** - 不同类型知识分开存储  
✅ **快速定位** - 找 Bug 去 technical，找需求去 product  
✅ **避免干扰** - 不会混在一起

### 示例

```bash
# 搜索技术问题（只在 technical 房间）
python -m mempalace search "Page 定义缺失" --room technical

# 搜索产品需求（只在 product 房间）
python -m mempalace search "家庭共享功能" --room product

# 搜索用户反馈
python -m mempalace search "用户说太慢" --room user-feedback

# 搜索技术决策
python -m mempalace search "选择百度 OCR" --room decisions

# 搜索待办
python -m mempalace search "批量保存测试" --room todo
```

---

## 🔍 搜索使用

### 基本搜索

```bash
cd /home/node/.openclaw/workspace-pm/miniprogram-memory

# 搜索特定主题
python -m mempalace search "批量上传"

# 搜索问题
python -m mempalace search "代码审查 严重问题"

# 搜索决策
python -m mempalace search "家庭共享 数据库设计"
```

### 高级搜索

```bash
# 搜索特定日期
python -m mempalace search "2026-04-10 Page 定义"

# 搜索技术决策
python -m mempalace search "云函数 验证逻辑"

# 搜索经验教训
python -m mempalace search "慢就是快 设计"
```

---

## 📈 统计信息

### 首次运行结果

```
Files processed: 2
Files skipped: 1
Drawers filed: 33
By room: technical (2 files)
```

### 预期增长

- **每天：** ~30-50 个 drawers
- **每周：** ~200-350 个 drawers
- **每月：** ~900-1500 个 drawers

---

## 🧹 维护建议

### 日志轮转

建议保留 30 天的详细日志：

```bash
# 添加到 crontab，每周日清理
0 0 * * 0 find /home/node/.openclaw/workspace-pm/miniprogram-memory/daily-logs -name "*.log" -mtime +30 -delete
```

### 空间管理

定期检查 MemPalace 大小：

```bash
du -sh ~/.mempalace/palace
```

如果超过 1GB，考虑：
- 压缩旧数据
- 归档到冷存储
- 只保留最近 3 个月的详细记录

### 备份

```bash
# 每周备份 MemPalace
tar -czf mempalace-backup-$(date +%Y%m%d).tar.gz ~/.mempalace/palace
```

---

## 🚨 故障排查

### 脚本执行失败

**检查点：**
1. 脚本权限：`chmod +x scripts/daily-reflection.sh`
2. Python 环境：`python -m mempalace --version`
3. 目录存在：`ls -la daily-logs/`

### MemPalace 挖掘失败

**检查点：**
1. 配置文件：`cat mempalace.yaml`
2. Wing 存在：`python -m mempalace status`
3. 磁盘空间：`df -h`

### 搜索无结果

**可能原因：**
- 文件未成功挖掘
- 查询关键词不匹配
- 语义理解偏差

**解决：**
```bash
# 重新挖掘
python -m mempalace mine . --mode convos

# 尝试不同关键词
python -m mempalace search "相关问题"
```

---

## 📝 示例输出

### 日志文件片段

```markdown
# 2026-04-10 开发日志

## 主要任务
- 批量上传功能开发与修复
- 代码审查与优化
- MemPalace 集成

## 遇到的问题
- Page 定义缺失
- 变量名错误 (result vs resultListList)
- 云函数验证缺失

## 解决方案
- 补全 Page 结构
- 全局搜索替换
- 添加完整验证逻辑
```

### 搜索结果示例

```
============================================================
  Results for: "代码审查 严重问题"
============================================================

  [1] miniprogram_memory / technical
      Source: 2026-04-10-summary.md
      Match:  0.544

      ### 3. 代码审查
      **价值：** 发现 3 个严重问题  
      **建议：** 每次提交前审查
```

---

## 🎯 最佳实践

1. **每天查看** - 养成搜索习惯，回顾前一天工作
2. **定期复盘** - 每周/每月查看摘要，发现模式
3. **知识复用** - 遇到类似问题先搜索
4. **持续改进** - 根据实际需求调整摘要模板

---

## 🔗 相关资源

- [MemPalace 官方文档](https://github.com/milla-jovovich/mempalace)
- [宝宝购物记项目](../miniprogram/)
- [家庭共享 PRD](../miniprogram/docs/FAMILY_SHARED-PRD.md)
- [项目复盘](../miniprogram/docs/项目复盘 - 批量上传功能.md)

---

*最后更新：2026-04-10 11:15 GMT+8*
