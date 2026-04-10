# 家庭共享账本 - 产品需求文档 (v1.1)

**文档版本：** v1.1 - 已审核修改  
**创建日期：** 2026-04-10  
**产品负责人：** 佳祎  
**状态：** ✅ 审核通过，待开发

---

## 📋 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-10 | PM Agent | 初始版本 |
| **v1.1** | **2026-04-10** | **PM Agent** | **补充向后兼容、邀请码冲突、退出机制、通知、错误文案** |

---

## 1. 背景与目标

### 1.1 背景
当前小程序为单用户模式，每个微信用户的账本数据完全隔离。但实际使用场景中，夫妻/家庭成员需要共享账本，共同记录家庭开支。

### 1.2 目标
- 支持创建家庭组，邀请家庭成员加入
- 家庭成员可共享查看、编辑家庭账本
- 保留个人私有账本能力
- 权限清晰，数据安全

### 1.3 用户场景

| 场景 | 描述 |
|------|------|
| 新婚夫妻 | 夫妻共同记录家庭开支，随时查看家庭总支出 |
| 多子女家庭 | 父母双方共同管理孩子相关开支 |
| 小家庭 | 夫妻 + 父母帮忙带孩子，多人共同记账 |

---

## 2. 核心功能

### 2.1 功能总览

```
家庭共享账本
├── 创建家庭
├── 邀请成员
├── 成员管理
├── 切换账本视图（个人/家庭）
└── 退出/解散家庭
```

### 2.2 功能详情

#### 2.2.1 创建家庭
- **入口：** "我的"页面 → "创建家庭账本"
- **规则：**
  - 每个用户只能创建 1 个家庭
  - 家庭名称支持重名（内部 ID 唯一）
  - 创建者自动成为管理员
  - **成员上限：15 人**（v1.1 修改）

#### 2.2.2 邀请成员
- **邀请方式：**
  - 邀请码（6 位数字，**带冲突检测**）
  - 二维码（小程序码）
  - 微信分享卡片
- **规则：**
  - 邀请码 24 小时有效
  - 每个家庭最多 **15 个成员**（v1.1 修改）
  - 需管理员审核（可选）

#### 2.2.3 成员管理
- **管理员权限：**
  - 审核加入申请
  - 移除成员
  - 转让管理员
  - 解散家庭
- **普通成员权限：**
  - 查看家庭账本
  - 记账
  - 退出家庭

#### 2.2.4 账本视图切换
- **个人账本：** 仅查看自己创建的记录
- **家庭账本：** 查看所有家庭成员的记录（`isShared: true`）
- **切换方式：** 首页/记账页顶部切换器

#### 2.2.5 退出/解散家庭
- **成员退出：**
  - 随时退出，不影响其他成员
  - **退出时提示：** "是否删除你创建的所有记录？"（保留/删除）
  - **默认保留**，标记为"已退出成员"
- **管理员退出：** 需转让管理员或解散家庭
- **解散家庭：** 仅管理员可操作，数据保留但不再共享

---

## 3. 数据库设计

### 3.1 新增集合

#### families - 家庭信息
```javascript
{
  _id: "family_001",
  name: "张家账本",
  creator_openid: "xxx",
  avatar: "家庭头像 URL",
  maxMembers: 15,  // v1.1: 10 → 15
  createTime: "2026-04-10T10:00:00Z",
  updateTime: "2026-04-10T10:00:00Z",
  status: "active" | "dismissed"
}
```

#### family_members - 家庭成员
```javascript
{
  _id: "member_001",
  family_id: "family_001",
  openid: "xxx",
  nickname: "成员昵称",
  avatar: "头像 URL",
  role: "admin" | "member",
  status: "active" | "removed",
  joinTime: "2026-04-10T10:00:00Z",
  joinMethod: "invite_code" | "qr_code" | "share",
  exitTime: Date,  // v1.1: 退出时间
  exitReason: "quit" | "removed"  // v1.1: 退出原因
}
```

#### family_invites - 邀请记录
```javascript
{
  _id: "invite_001",
  family_id: "family_001",
  invite_code: "123456",
  invite_openid: "邀请人 openid",
  expireTime: "2026-04-11T10:00:00Z",
  status: "pending" | "used" | "expired",
  usedBy: "被邀请人 openid",
  usedTime: "2026-04-10T15:00:00Z",
  maxUses: 1  // v1.1: 限制使用次数
}
```

### 3.2 修改集合

#### records - 购物记录（新增字段）
```javascript
{
  // 现有字段保持不变
  productName: "奶粉",
  price: 199,
  quantity: 1,
  _openid: "xxx",
  
  // 新增字段（向后兼容）
  family_id: String,  // 可选，为空表示个人记录
  isShared: { type: Boolean, default: false },  // v1.1: 默认不共享
  sharedTime: Date,  // 可选，共享时间
  createdBy: String  // v1.1: 创建者 openid（用于退出时数据归属）
}
```

**向后兼容方案（v1.1 新增）：**
1. **现有记录：** 保持个人状态，`isShared` 默认为 `false`
2. **手动共享：** 用户可以单条记录操作"共享到家庭"
3. **批量迁移：** 提供"一键共享所有历史记录"功能（用户确认后才执行）
4. **数据归属：** 新增 `createdBy` 字段，用于成员退出时判断记录归属

---

## 4. 技术方案

### 4.1 云函数设计

#### 4.1.1 family - 家庭管理
```javascript
exports.main = async (event, context) => {
  const { action } = event;
  
  switch (action) {
    case 'createFamily':     // 创建家庭
    case 'getFamilyInfo':    // 获取家庭信息
    case 'updateFamily':     // 更新家庭
    case 'dismissFamily':    // 解散家庭
    case 'getMembers':       // 获取成员列表
    case 'inviteMember':     // 邀请成员
    case 'joinFamily':       // 加入家庭
    case 'removeMember':     // 移除成员
    case 'quitFamily':       // 退出家庭
    case 'transferAdmin':    // 转让管理员
      return await handleFamilyAction(action, event);
    default:
      return { success: false, message: '未知操作' };
  }
};
```

#### 4.1.2 邀请码生成（v1.1 新增冲突检测）
```javascript
async function generateInviteCode(familyId) {
  let code;
  let attempts = 0;
  do {
    code = Math.random().toString(10).substring(2, 8);  // 6 位数字
    const exists = await db.collection('family_invites')
      .where({ 
        invite_code: code, 
        status: 'pending',
        expireTime: _.gt(new Date())
      })
      .get();
    if (exists.data.length === 0) break;
    attempts++;
  } while (attempts < 10);
  
  if (attempts >= 10) {
    throw new Error('邀请码生成失败，请重试');
  }
  return code;
}
```

#### 4.1.3 record - 记录查询扩展
```javascript
// 新增查询参数
{
  action: 'list',
  data: {
    viewMode: 'personal' | 'family',  // 视图模式
    familyId: 'family_001',  // 家庭 ID
    // ... 其他参数
  }
}
```

### 4.2 查询逻辑

#### 个人视图
```javascript
db.collection('records')
  .where({
    _openid: cloud.getWXContext().OPENID
  })
  .get();
```

#### 家庭视图
```javascript
// 1. 获取当前用户的所有 family_id
const memberShips = await db.collection('family_members')
  .where({ openid: currentOpenid, status: 'active' })
  .get();

const familyIds = memberShips.data.map(m => m.family_id);

// 2. 查询家庭共享记录
db.collection('records')
  .where({
    family_id: _.in(familyIds),
    isShared: true
  })
  .get();
```

### 4.3 权限校验
```javascript
async function checkPermission(familyId, openid, requiredRole) {
  const member = await db.collection('family_members')
    .where({
      family_id: familyId,
      openid: openid,
      status: 'active'
    })
    .get();
  
  if (member.data.length === 0) {
    throw new Error('不是家庭成员');
  }
  
  if (requiredRole === 'admin' && member.data[0].role !== 'admin') {
    throw new Error('需要管理员权限');
  }
  
  return member.data[0];
}
```

---

## 5. 通知机制（v1.1 新增）

### 5.1 通知类型

| 操作 | 通知对象 | 通知方式 |
|------|----------|----------|
| 邀请加入 | 被邀请人 | 小程序订阅消息 + KIM |
| 加入成功 | 管理员 | KIM |
| 被移除 | 被移除成员 | 小程序订阅消息 + KIM |
| 成员退出 | 管理员 | KIM |
| 家庭解散 | 所有成员 | 小程序订阅消息 + KIM |
| 管理员转让 | 所有成员 | KIM |

### 5.2 通知模板

**邀请加入：**
```
🏠 [邀请人昵称] 邀请你加入家庭账本"[家庭名称]"
点击接受邀请，一起记录家庭开支~
[接受] [拒绝]
```

**被移除：**
```
🏠 你已被移除出家庭账本"[家庭名称]"
如有异议，请联系管理员。
```

**家庭解散：**
```
🏠 家庭账本"[家庭名称]" 已被解散
所有共享记录将恢复为个人记录。
```

---

## 6. 错误处理（v1.1 新增文案）

### 6.1 错误码与提示

| 错误码 | 错误提示 |
|--------|----------|
| FAMILY_001 | 家庭不存在或已解散 |
| FAMILY_002 | 你已经是家庭成员，无需重复加入 |
| FAMILY_003 | 邀请码无效或已过期 |
| FAMILY_004 | 家庭已满员（15 人），无法加入 |
| FAMILY_005 | 权限不足，需要管理员操作 |
| FAMILY_006 | 无法移除自己，请使用退出功能 |
| FAMILY_007 | 你是唯一管理员，请先转让管理员身份 |
| FAMILY_008 | 邀请码生成失败，请重试 |
| FAMILY_009 | 操作失败，请稍后重试 |

### 6.2 错误处理原则

1. **友好提示** - 避免技术术语，用用户能理解的语言
2. **提供解决方案** - 告诉用户下一步该怎么做
3. **记录日志** - 便于排查问题

---

## 7. 页面设计

### 7.1 新增页面

#### pages/family/family - 家庭管理页
```
家庭管理
├── 家庭信息卡片
│   ├── 家庭名称
│   ├── 家庭头像
│   └── 成员数量 (X/15)
├── 成员列表
│   ├── 成员头像 + 昵称
│   ├── 角色标识（管理员）
│   └── 操作（移除/转让）
├── 邀请功能
│   ├── 邀请码显示（6 位数字）
│   ├── 复制邀请码
│   └── 分享二维码
└── 解散家庭（仅管理员）
```

### 7.2 修改页面

#### pages/mine/mine - 我的
- 新增"我的家庭"入口
- 显示家庭名称/成员数

#### pages/index/index - 首页
- 新增视图切换器（个人/家庭）
- 显示当前视图标识

#### pages/record/record - 记账
- 新增视图切换器
- 共享记录标识

---

## 8. UI/UX 细节（v1.1 补充）

### 8.1 视图切换器
- **位置：** 首页/记账页顶部
- **样式：** 分段控制器（Segmented Control）
- **标识：** 
  - 个人：📒 图标
  - 家庭：👨‍👩‍👧 图标
- **动画：** 平滑切换，带加载状态

### 8.2 家庭头像
- **上传：** 支持从相册选择
- **裁剪：** 圆形裁剪
- **默认：** 根据家庭名称生成首字母

### 8.3 邀请二维码
- **生成：** 小程序码，包含邀请码
- **分享：** 支持微信好友、朋友圈
- **扫描：** 扫码直接加入（需确认）

### 8.4 成员列表
- **排序：** 管理员置顶，按加入时间倒序
- **状态：** 活跃/已退出标识
- **操作：** 左滑删除（仅管理员）

---

## 9. 开发计划

### 9.1 阶段划分

| 阶段 | 内容 | 工时 | 优先级 |
|------|------|------|--------|
| P0 | 数据库设计 + 云函数 | 4h | 必须 |
| P1 | 家庭管理页面 | 3h | 必须 |
| P2 | 视图切换功能 | 2h | 必须 |
| P3 | 邀请功能 | 2h | 重要 |
| P4 | 成员管理 | 2h | 重要 |
| P5 | 通知机制 | 2h | 重要 |
| P6 | 优化与测试 | 3h | 建议 |

**总计：** 约 18 小时（v1.1 增加通知机制 2h）

### 9.2 里程碑

- **M1：** 创建家庭 + 加入家庭（可测试）
- **M2：** 视图切换 + 共享查询（可演示）
- **M3：** 完整功能（可发布）

---

## 10. 成功指标

| 指标 | 目标值 |
|------|--------|
| 家庭创建成功率 | > 95% |
| 邀请加入成功率 | > 90% |
| 视图切换响应时间 | < 500ms |
| 用户满意度 | > 4.5/5 |
| 通知到达率 | > 98% |

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 数据泄露 | 高 | 严格权限校验 + 云函数验证 |
| 邀请码滥用 | 中 | 有效期 + 使用次数限制 + 冲突检测 |
| 家庭纠纷 | 中 | 管理员权限 + 退出机制 |
| 性能问题 | 低 | 索引优化 + 分页查询 |
| 通知失败 | 中 | 多渠道通知 + 重试机制 |

---

## 12. 附录

### 12.1 邀请码生成算法
```javascript
async function generateInviteCode(familyId) {
  let code;
  let attempts = 0;
  do {
    code = Math.random().toString(10).substring(2, 8);
    const exists = await db.collection('family_invites')
      .where({ invite_code: code, status: 'pending' })
      .get();
    if (exists.data.length === 0) break;
    attempts++;
  } while (attempts < 10);
  
  if (attempts >= 10) {
    throw new Error('邀请码生成失败，请重试');
  }
  return code;
}
```

### 12.2 家庭 ID 生成
```javascript
function generateFamilyId() {
  return `family_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
```

### 12.3 退出机制伪代码
```javascript
async function quitFamily(familyId, openid, deleteRecords) {
  // 1. 更新成员状态
  await db.collection('family_members')
    .where({ family_id: familyId, openid })
    .update({ status: 'removed', exitTime: new Date(), exitReason: 'quit' });
  
  // 2. 处理记录（用户选择）
  if (deleteRecords) {
    await db.collection('records')
      .where({ family_id: familyId, createdBy: openid })
      .update({ isShared: false, family_id: null });
  }
  // else: 保留记录，标记为"已退出成员"
  
  // 3. 通知管理员
  await notifyAdmin(familyId, 'member_quit', { openid });
}
```

---

**文档版本：** v1.1  
**最后更新：** 2026-04-10 12:10  
**状态：** ✅ 审核通过，待开发
