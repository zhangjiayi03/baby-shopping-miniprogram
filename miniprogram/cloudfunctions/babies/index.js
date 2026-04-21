// cloudfunctions/babies/index.js - 宝宝信息管理
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, id, data } = event;
  const openid = cloud.getWXContext().OPENID;

  try {
    switch (action) {
      case 'list':
        return await listBabies(openid);
      case 'get':
        return await getBaby(openid, id);
      case 'create':
        return await createBaby(openid, data);
      case 'update':
        return await updateBaby(openid, id, data);
      case 'delete':
        return await deleteBaby(openid, id);
      case 'getDefault':
        return await getDefaultBaby(openid);
      default:
        return { success: false, message: '未知操作类型' };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return { success: false, message: error.message };
  }
};

// 获取宝宝列表
async function listBabies(openid) {
  const res = await db.collection('babies')
    .where({ _openid: openid })
    .orderBy('createTime', 'asc')
    .get();

  return {
    success: true,
    data: res.data
  };
}

// 获取单个宝宝（校验权限）
async function getBaby(openid, id) {
  const res = await db.collection('babies').doc(id).get();
  if (!res.data) {
    return { success: false, message: '宝宝信息不存在' };
  }
  if (res.data._openid !== openid) {
    return { success: false, message: '无权访问该宝宝信息' };
  }
  return {
    success: true,
    data: res.data
  };
}

// 创建宝宝
async function createBaby(openid, data) {
  if (!data.nickname || !data.nickname.trim()) {
    return { success: false, message: '昵称不能为空' };
  }

  const now = new Date().toISOString();
  const baby = {
    nickname: data.nickname.trim(),
    birthDate: data.birthDate || '',
    gender: data.gender || 'male',
    avatar: data.avatar || '',
    _openid: openid,
    createTime: now,
    updateTime: now
  };

  const res = await db.collection('babies').add({ data: baby });

  return {
    success: true,
    data: { _id: res._id, ...baby }
  };
}

// 更新宝宝（校验权限）
async function updateBaby(openid, id, data) {
  const existing = await db.collection('babies').doc(id).get();
  if (!existing.data) {
    return { success: false, message: '宝宝信息不存在' };
  }
  if (existing.data._openid !== openid) {
    return { success: false, message: '无权修改该宝宝信息' };
  }

  const allowedFields = ['nickname', 'birthDate', 'gender', 'avatar'];
  const updateData = { updateTime: new Date().toISOString() };

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  await db.collection('babies').doc(id).update({ data: updateData });
  return { success: true, message: '更新成功' };
}

// 删除宝宝
async function deleteBaby(openid, id) {
  const existing = await db.collection('babies').doc(id).get();
  if (!existing.data) {
    return { success: false, message: '宝宝信息不存在' };
  }
  if (existing.data._openid !== openid) {
    return { success: false, message: '无权删除该宝宝信息' };
  }

  const recordsRes = await db.collection('records')
    .where({
      _openid: openid,
      babyId: id
    })
    .count();

  if (recordsRes.total > 0) {
    return {
      success: false,
      message: `该宝宝有 ${recordsRes.total} 条订单记录，请先处理后再删除`
    };
  }

  await db.collection('babies').doc(id).remove();
  return { success: true, message: '删除成功' };
}

// 获取默认宝宝（第一个）
async function getDefaultBaby(openid) {
  const res = await db.collection('babies')
    .where({ _openid: openid })
    .orderBy('createTime', 'asc')
    .limit(1)
    .get();

  if (res.data.length === 0) {
    return { success: true, data: null };
  }

  return { success: true, data: res.data[0] };
}
