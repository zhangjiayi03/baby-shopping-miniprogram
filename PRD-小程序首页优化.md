# PRD - 小程序首页优化

## 版本记录

| 版本 | 日期 | 更新内容 | 更新人 |
|------|------|----------|--------|
| v1.0 | 2026-04-05 | 首页优化需求定义 | PM Agent |

---

## 背景 & 目标

### 背景
当前小程序首页功能完整但 UI 简单，缺少：
- 预算/花费统计展示
- 底部导航
- 快捷操作入口

### 目标
- ✅ 新增预算模块，支持月度预算管理
- ✅ 新增今日花费统计，支持环比对比
- ✅ 新增底部 Tab 导航（4 个 Tab）
- ✅ 优化列表项交互（编辑/删除按钮）

---

## 核心功能

### 1. 预算卡片

**展示内容**:
- 本月预算金额
- 已花费金额
- 剩余金额
- 预算进度条（百分比）

**交互**:
- 点击可跳转预算设置页

**样式**:
```
┌─────────────────────────────┐
│ 📊 本月预算                  │
│ ████████████░░░░░  65%      │
│ 已花 ¥1,280 / 预算 ¥2,000   │
│ 剩余 ¥720                   │
└─────────────────────────────┘
```

### 2. 今日花费卡片

**展示内容**:
- 今日花费金额
- 较昨日对比（↑↓百分比）
- 今日订单数

**交互**:
- 点击可跳转今日详情页

**样式**:
```
┌─────────────────────────────┐
│ 💰 今日花费                  │
│ ¥156.00                     │
│ 较昨日 ↑12%  (3 笔)          │
└─────────────────────────────┘
```

### 3. 底部 Tab 导航

| Tab | 图标 | 页面 |
|-----|------|------|
| 首页 | 🏠 | pages/index/index |
| 记账 | 📝 | pages/record/record |
| 统计 | 📈 | pages/stats/stats |
| 我的 | 👤 | pages/mine/mine |

### 4. 列表项优化

**新增操作按钮**:
- ✏️ 编辑按钮（右侧）
- 🗑️ 删除按钮（右侧）

---

## 页面结构

```
首页 (index)
├── 预算卡片组件 (budget-card)
├── 统计卡片组件 (stats-card)
├── 筛选区 (filter-section)
├── 订单列表 (record-list)
│   └── 订单卡片 (record-card)
│       ├── 商品信息
│       ├── 标签
│       └── 操作按钮组
└── 底部 Tab 导航 (tabBar)
```

---

## 技术方案

### 1. 数据结构

```javascript
// 预算数据
{
  monthlyBudget: 2000,
  spentThisMonth: 1280,
  remaining: 720,
  percentage: 65
}

// 今日统计
{
  todaySpent: 156,
  yesterdaySpent: 139,
  changePercent: 12,
  orderCount: 3
}
```

### 2. 计算逻辑

```javascript
// 本月花费计算
const thisMonthStart = new Date().setDate(1);
const thisMonthRecords = records.filter(r => 
  new Date(r.orderTime) >= thisMonthStart
);
const spentThisMonth = thisMonthRecords.reduce((sum, r) => 
  sum + parseFloat(r.price) * r.quantity, 0
);

// 今日花费计算
const today = new Date().toDateString();
const todayRecords = records.filter(r => 
  new Date(r.orderTime).toDateString() === today
);
```

### 3. 组件拆分

| 组件名 | 路径 | 功能 |
|--------|------|------|
| budget-card | components/budget-card | 预算卡片 |
| stats-card | components/stats-card | 统计卡片 |
| record-card | components/record-card | 订单卡片 |

---

## 开发计划

| 任务 | 预计工时 | 优先级 |
|------|----------|--------|
| 1. 底部 Tab 导航配置 | 0.5h | P0 |
| 2. 预算卡片组件 | 1h | P0 |
| 3. 统计卡片组件 | 1h | P0 |
| 4. 列表项操作按钮 | 1h | P1 |
| 5. 数据计算逻辑 | 1h | P0 |
| 6. 样式优化 | 1h | P1 |

**总计**: 5.5 小时

---

## 成功指标

- ✅ 预算卡片正常展示，数据准确
- ✅ 今日花费统计准确，环比计算正确
- ✅ 底部 Tab 可正常切换
- ✅ 列表项编辑/删除功能可用
- ✅ UI 样式美观，符合设计预期

---

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 云函数未部署 | 高 | 先使用模拟数据，后续切换 |
| 时间计算边界 | 中 | 添加边界测试用例 |
| 样式兼容性 | 低 | 在 iOS/Android 分别测试 |

---

## 附录

### 设计参考
- 预算进度条：蓝色渐变
- 对比标识：上涨红色↑，下降绿色↓
- 操作按钮：编辑蓝色，删除红色

### 相关文件
- `miniprogram/app.json` - Tab 配置
- `miniprogram/pages/index/` - 首页代码
- `miniprogram/components/` - 组件目录
