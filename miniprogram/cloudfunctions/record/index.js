// cloudfunctions/record/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, id, data } = event;
  const openid = cloud.getWXContext().OPENID;

  try {
    switch (action) {
      case 'create':
        return await createRecord(openid, data);
      case 'batchCreate':
        return await batchCreateRecords(openid, data);
      case 'get':
        return await getRecord(openid, id);
      case 'update':
        return await updateRecord(openid, id, data);
      case 'batchUpdateBaby':
        return await batchUpdateBaby(openid, id, data);
      case 'delete':
        return await deleteRecord(openid, id);
      case 'batchCount':
        return await batchCount(openid, data);
      case 'list':
        return await listRecords(openid, data);
      default:
        return { success: false, message: '未知操作类型' };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return { success: false, message: error.message };
  }
};

// 创建单条记录
async function createRecord(openid, data) {
  if (!data || !data.productName || !data.productName.trim()) {
    return { success: false, message: '商品名称不能为空' };
  }

  const price = parseFloat(data.price);
  if (isNaN(price) || price < 0 || price > 100000) {
    return { success: false, message: '价格必须在 0-100000 之间' };
  }

  const quantity = parseInt(data.quantity) || 1;
  const categoryId = parseInt(data.categoryId) || 7;
  const platform = data.platform || 'other';

  const validPlatforms = ['taobao', 'jd', 'pdd', 'douyin', 'meituan', 'other'];
  if (!validPlatforms.includes(platform)) {
    return { success: false, message: '平台类型无效' };
  }

  const now = new Date().toISOString();
  const batchId = data.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const record = {
    productName: data.productName.trim(),
    price: price,
    quantity: quantity,
    unitPrice: parseFloat((price / quantity).toFixed(2)),
    categoryId: categoryId,
    platform: platform,
    babyId: data.babyId || '',
    batchId: batchId,
    orderTime: data.orderTime || now.split('T')[0],
    imageUrl: data.imageUrl || '',
    createTime: now,
    updateTime: now,
    _openid: openid
  };

  const res = await db.collection('records').add({ data: record });

  return {
    success: true,
    data: { _id: res._id, ...record }
  };
}

// 批量创建记录
async function batchCreateRecords(openid, records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, message: '记录不能为空' };
  }

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  const validRecords = [];

  for (const data of records) {
    if (!data.productName || !data.productName.trim()) continue;

    const price = parseFloat(data.price) || 0;
    const quantity = parseInt(data.quantity) || 1;

    validRecords.push({
      productName: data.productName.trim(),
      price: price,
      quantity: quantity,
      unitPrice: quantity > 0 ? parseFloat((price / quantity).toFixed(2)) : 0,
      categoryId: parseInt(data.categoryId) || 7,
      platform: data.platform || 'other',
      babyId: data.babyId || '',
      batchId: batchId,
      orderTime: data.orderTime || now.split('T')[0],
      imageUrl: data.imageUrl || '',
      createTime: now,
      updateTime: now,
      _openid: openid
    });
  }

  if (validRecords.length === 0) {
    return { success: false, message: '没有有效记录' };
  }

  // 批量插入
  const promises = validRecords.map(r => db.collection('records').add({ data: r }));
  const results = await Promise.all(promises);

  return {
    success: true,
    data: {
      count: results.length,
      batchId: batchId
    }
  };
}

// 获取记录详情（校验权限）
async function getRecord(openid, id) {
  const res = await db.collection('records').doc(id).get();
  if (!res.data) {
    return { success: false, message: '记录不存在' };
  }
  if (res.data._openid !== openid) {
    return { success: false, message: '无权访问该记录' };
  }
  return { success: true, data: res.data };
}

// 更新记录（校验权限）
async function updateRecord(openid, id, data) {
  const existing = await db.collection('records').doc(id).get();
  if (!existing.data) {
    return { success: false, message: '记录不存在' };
  }
  if (existing.data._openid !== openid) {
    return { success: false, message: '无权修改该记录' };
  }

  const allowedFields = ['productName', 'price', 'quantity', 'categoryId', 'platform', 'babyId', 'orderTime', 'imageUrl'];
  const updateData = { updateTime: new Date().toISOString() };
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (updateData.price !== undefined && updateData.quantity !== undefined) {
    const quantity = parseInt(updateData.quantity);
    const price = parseFloat(updateData.price);
    if (quantity > 0 && !isNaN(price)) {
      updateData.unitPrice = parseFloat((price / quantity).toFixed(2));
    }
  }

  await db.collection('records').doc(id).update({ data: updateData });
  return { success: true, message: '更新成功' };
}

// 批量更新同一批次的宝宝
async function batchUpdateBaby(openid, recordId, data) {
  const { babyId, updateAll } = data;

  const record = await db.collection('records').doc(recordId).get();
  if (!record.data) {
    return { success: false, message: '记录不存在' };
  }
  if (record.data._openid !== openid) {
    return { success: false, message: '无权修改该记录' };
  }

  let updatedCount = 0;

  if (updateAll && record.data.batchId) {
    const res = await db.collection('records')
      .where({
        _openid: openid,
        batchId: record.data.batchId,
        _id: _.neq(recordId)
      })
      .update({
        data: {
          babyId: babyId,
          updateTime: new Date().toISOString()
        }
      });
    updatedCount = res.stats.updated;
  }

  return {
    success: true,
    data: { updatedCount }
  };
}

// 删除记录（校验权限）
async function deleteRecord(openid, id) {
  const existing = await db.collection('records').doc(id).get();
  if (!existing.data) {
    return { success: false, message: '记录不存在' };
  }
  if (existing.data._openid !== openid) {
    return { success: false, message: '无权删除该记录' };
  }

  // 删除关联的云存储图片
  if (existing.data.imageUrl) {
    try {
      await cloud.deleteFile({ fileList: [existing.data.imageUrl] });
    } catch (e) {
      console.error('删除云存储图片失败:', e);
    }
  }

  await db.collection('records').doc(id).remove();
  return { success: true, message: '删除成功' };
}

async function batchCount(openid, data) {
  const { batchId, excludeId } = data;
  if (!batchId) {
    return { success: false, message: 'batchId 不能为空' };
  }

  const conditions = { _openid: openid, batchId: batchId };
  if (excludeId) {
    conditions._id = _.neq(excludeId);
  }

  const res = await db.collection('records').where(conditions).count();
  return { success: true, data: { count: res.total } };
}

// 查询记录列表
async function listRecords(openid, params = {}) {
  const { page = 1, pageSize = 20, categoryId, platform, babyId } = params;
  const skip = (page - 1) * pageSize;

  const conditions = [{ _openid: openid }];

  if (categoryId) {
    conditions.push({ categoryId: parseInt(categoryId) });
  }

  if (platform) {
    conditions.push({ platform: platform });
  }

  if (babyId) {
    conditions.push({ babyId: babyId });
  }

  const query = db.collection('records').where(_.and(conditions));
  const total = await query.count();
  const records = await query
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return {
    success: true,
    data: {
      list: records.data,
      total: total.total,
      page: page,
      pageSize: pageSize
    }
  };
}
