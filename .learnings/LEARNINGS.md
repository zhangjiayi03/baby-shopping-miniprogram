# Learnings Log

记录纠正、知识缺口、最佳实践等学习条目。

---


## [LRN-20260414-001] knowledge_gap

**Logged**: 2026-04-14T10:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: config

### Summary
Self-Improvement Hook 未启用导致学习日志连续 10 天空白

### Details
- Hook 文件存在于技能目录但未被复制到 `/home/node/.openclaw/hooks/`
- `openclaw hooks enable self-improvement` 报错 "Hook not found"
- 需要手动复制 hook 文件后才能启用

### Suggested Action
- ✅ 已修复：手动复制 hook 文件并启用
- 验证后续会话是否正常显示提醒

### Metadata
- Source: user_feedback
- Related Files: /home/node/.openclaw/skills/self-improvement/hooks/openclaw/
- Tags: hook, self-improvement, config
- Recurrence-Count: 1
- First-Seen: 2026-04-14

---

## [LRN-20260414-002] best_practic

**Logged**: 2026-04-14T10:30:00+08:00
**Priority**: medium
**Status**: promoted
**Area**: frontend

### Summary
小程序 WXML 不支持直接调用 JS 方法

### Details
- 错误写法：`{{getCategoryName(item.categoryId)}}`
- 正确方案：创建 WXS 模块，使用 `{{utils.getCategoryName()}}`
- `<text>` 组件不支持 `padding`，需改用 `<view>`

### Suggested Action
- ✅ 已提升到 AGENTS.md - 小程序开发规范

### Metadata
- Source: conversation
- Related Files: pages/index/index.wxml, pages/index/index.wxs
- Tags: miniprogram, wxml, wxs
- Recurrence-Count: 1
- First-Seen: 2026-04-13
- Promoted: AGENTS.md

---

## [LRN-20260414-003] bestpractic

**Logged**: 2026-04-14T10:30:00+08:00
**Priority**: medium
**Status**: promoted
**Area**: frontend

### Summary
小程序首页数据加载竞态条件

### Details
- 问题：`onLoad` 和 `onShow` 同时触发导致重复加载
- 解决：只在 `onLoad` 加载，`onShow` 仅当已有数据时刷新

### Suggested Action
- ✅ 已提升到 AGENTS.md - 小程序开发规范

### Metadata
- Source: conversation
- Related Files: pages/index/index.js
- Tags: miniprogram, lifecycle, race-condition
- Recurrence-Count: 1
- First-Seen: 2026-04-13
- Promoted: AGENTS.md

---

## [LRN-20260414-004] bestpractic

**Logged**: 2026-04-14T10:30:00+08:00
**Priority**: high
**Status**: promoted
**Area**: backend

### Summary
OCR 商品识别需排除支付/物流信息

### Details
- 问题：淘宝订单截图的"5 天 18 时后自动扣款 5.73 元"被误识别为商品名
- 方案：智能评分机制，排除关键词（扣款、自动扣款、先用后付等）
- 品牌/规格关键词加分优先

### Suggested Action
- ✅ 已提升到 AGENTS.md - 小程序开发规范

### Metadata
- Source: conversation
- Related Files: cloudfunctions/ocr/index.js
- Tags: ocr, ecommerce, scoring
- Recurrence-Count: 1
- First-Seen: 2026-04-13
- Promoted: AGENTS.md

---

## [LRN-20260414-005] insight

**Logged**: 2026-04-14T10:30:00+08:00
**Priority**: medium
**Status**: promoted
**Area**: infra

### Summary
Git 推送偶发 504 错误需重试机制

### Details
- 问题：推送大文件或网络波动时出现 504 Gateway Timeout
- 现象：多次重试后成功
- 建议：添加自动重试逻辑或分批次推送

### Suggested Action
- ✅ 已提升到 AGENTS.md - 小程序开发规范

### Metadata
- Source: conversation
- Tags: git, network, retry
- Recurrence-Count: 1
- First-Seen: 2026-04-13
- Promoted: AGENTS.md

---
