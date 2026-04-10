# 家庭共享账本 - 产品需求文档

**文档版本：** v1.0  
**创建日期：** 2026-04-10  
**产品负责人：** 佳祎  
**状态：** 待评审

---

## 📋 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-10 | PM Agent | 初始版本 |

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
  - 家庭名称不能重复（支持重名，内部 ID 唯一）
  - 创建者自动成为管理员

#### 2.2.2 邀请成员
- **邀请方式：**
  - 邀请码（6 位数字）
  - 二维码（小程序码）
  - 微信分享卡片
- **规则：**
  - 邀请码 24 小时有效
  - 每个家庭最多 10 个成员
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
- **家庭账本：** 查看所有家庭成员的记录
- **切换方式：** 首页/记账页顶部切换器

#### 2.2.5 退出/解散家庭
- **成员退出：** 随时退出，不影响其他成员
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
  maxMembers: 10,
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
  joinMethod: "invite_code" | "qr_code" | "share"
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
  usedTime: "2026-04-10T15:00:00Z"
}
```

### 3.2 修改集合

#### records - 购物记录（新增字段）
```javascript
{
  // 现有字段保持不变
  productName: "奶粉",
  price: 199,
  _openid: "xxx",
  
  // 新增字段
  family_id: "family_001",  // 所属家庭（可选，为空表示个人记录）
  isShared: true,  // 是否共享到家庭
  sharedTime: "2026-04-10T10:00:00Z"  // 共享时间
}
```

---

## 4. 技术方案

### 4.1 云函数设计

#### 4.1.1 family - 家庭管理
```javascript
// 云函数入口
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

#### 4.1.2 record - 记录查询扩展
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
// 云函数中校验操作权限
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

## 5. 页面设计

### 5.1 新增页面

#### pages/family/family - 家庭管理页
```
家庭管理
├── 家庭信息卡片
│   ├── 家庭名称
│   ├── 家庭头像
│   └── 成员数量
├── 成员列表
│   ├── 成员头像 + 昵称
│   ├── 角色标识（管理员）
│   └── 操作（移除/转让）
├── 邀请功能
│   ├── 邀请码显示
│   ├── 复制邀请码
│   └── 分享二维码
└── 解散家庭（仅管理员）
```

### 5.2 修改页面

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

## 6. 接口设计

### 6.1 云函数 API

| 接口 | 方法 | 参数 | 返回 |
|------|------|------|------|
| createFamily | POST | name, avatar | family_id |
| getFamilyInfo | GET | familyId | family info |
| getMembers | GET | familyId | member list |
| inviteMember | POST | familyId | inviteCode |
| joinFamily | POST | inviteCode | success |
| removeMember | POST | familyId, targetOpenid | success |
| quitFamily | POST | familyId | success |
| transferAdmin | POST | familyId, targetOpenid | success |
| dismissFamily | POST | familyId | success |

### 6.2 错误码

| 错误码 | 说明 |
|--------|------|
| FAMILY_001 | 家庭不存在 |
| FAMILY_002 | 已是家庭成员 |
| FAMILY_003 | 邀请码无效或过期 |
| FAMILY_004 | 家庭已满员 |
| FAMILY_005 | 权限不足 |
| FAMILY_006 | 不能移除自己 |
| FAMILY_007 | 唯一管理员不能退出 |

---

## 7. 安全设计

### 7.1 数据隔离
- 家庭数据通过 `family_id` 隔离
- 查询时强制校验用户权限
- 云函数中验证 `_openid`

### 7.2 邀请码安全
- 6 位随机数字
- 24 小时有效期
- 使用后立即失效
- 限制尝试次数

### 7.3 权限校验
- 所有写操作校验角色
- 管理员操作记录日志
- 敏感操作二次确认

---

## 8. 开发计划

### 8.1 阶段划分

| 阶段 | 内容 | 工时 | 优先级 |
|------|------|------|--------|
| P0 | 数据库设计 + 云函数 | 4h | 必须 |
| P1 | 家庭管理页面 | 3h | 必须 |
| P2 | 视图切换功能 | 2h | 必须 |
| P3 | 邀请功能 | 2h | 重要 |
| P4 | 成员管理 | 2h | 重要 |
| P5 | 优化与测试 | 3h | 建议 |

**总计：** 约 16 小时

### 8.2 里程碑

- **M1：** 创建家庭 + 加入家庭（可测试）
- **M2：** 视图切换 + 共享查询（可演示）
- **M3：** 完整功能（可发布）

---

## 9. 成功指标

| 指标 | 目标值 |
|------|--------|
| 家庭创建成功率 | > 95% |
| 邀请加入成功率 | > 90% |
| 视图切换响应时间 | < 500ms |
| 用户满意度 | > 4.5/5 |

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 数据泄露 | 高 | 严格权限校验 + 云函数验证 |
| 邀请码滥用 | 中 | 有效期 + 使用次数限制 |
| 家庭纠纷 | 中 | 管理员权限 + 退出机制 |
| 性能问题 | 低 | 索引优化 + 分页查询 |

---

## 11. 附录

### 11.1 邀请码生成算法
```javascript
function generateInviteCode() {
  return Math.random().toString(10).substring(2, 8);  // 6 位数字
}
```

### 11.2 家庭 ID 生成
```javascript
function generateFamilyId() {
  return `family_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
```

---

*文档结束*
