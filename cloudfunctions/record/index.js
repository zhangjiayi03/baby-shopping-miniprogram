// cloudfunctions/record/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 主函数
exports.main = async (event, context) => {
  const { action, id, data } = event;
  
  try {
    switch (action) {
      case 'create':
        return await createRecord(data);
      case 'get':
        return await getRecord(id);
      case 'update':
        return await updateRecord(id, data);
      case 'delete':
        return await deleteRecord(id);
      case 'list':
        return await listRecords(data);
      default:
        return {
          success: false,
          message: '未知操作类型'
        };
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

// 创建记录
async function createRecord(data) {
  const now = new Date();
  const record = {
    productName: data.productName,
    price: data.price,
    quantity: data.quantity,
    unitPrice: data.unitPrice || (parseFloat(data.price) / data.quantity).toFixed(2),
    categoryId: data.categoryId,
    platform: data.platform,
    orderTime: data.orderTime,
    imageUrl: data.imageUrl || '',
    createTime: now.toISOString(),
    updateTime: now.toISOString(),
    _openid: cloud.getWXContext().OPENID
  };
  
  const res = await db.collection('records').add({
    data: record
  });
  
  return {
    success: true,
    message: '创建成功',
    data: {
      id: res._id,
      ...record
    }
  };
}

// 获取记录详情
async function getRecord(id) {
  const res = await db.collection('records')
    .doc(id)
    .get();
  
  if (!res.data) {
    return {
      success: false,
      message: '记录不存在'
    };
  }
  
  return {
    success: true,
    data: res.data
  };
}

// 更新记录
async function updateRecord(id, data) {
  const now = new Date();
  const updateData = {
    ...data,
    updateTime: now.toISOString()
  };
  
  // 如果更新了价格和数量，重新计算单价
  if (data.price && data.quantity) {
    updateData.unitPrice = (parseFloat(data.price) / parseInt(data.quantity)).toFixed(2);
  }
  
  await db.collection('records')
    .doc(id)
    .update({
      data: updateData
    });
  
  return {
    success: true,
    message: '更新成功'
  };
}

// 删除记录
async function deleteRecord(id) {
  await db.collection('records')
    .doc(id)
    .remove();
  
  return {
    success: true,
    message: '删除成功'
  };
}

// 查询记录列表
async function listRecords(params = {}) {
  const { page = 1, pageSize = 20, categoryId, platform, startDate, endDate } = params;
  const skip = (page - 1) * pageSize;
  
  let query = db.collection('records');
  
  // 构建查询条件
  const conditions = [];
  
  if (categoryId) {
    conditions.push({ categoryId: parseInt(categoryId) });
  }
  
  if (platform) {
    conditions.push({ platform: platform });
  }
  
  if (startDate || endDate) {
    const dateCondition = {};
    if (startDate) {
      dateCondition.orderTime = _.gte(startDate);
    }
    if (endDate) {
      dateCondition.orderTime = _.lte(endDate);
    }
    conditions.push(dateCondition);
  }
  
  // 只查询当前用户的记录
  conditions.push({
    _openid: cloud.getWXContext().OPENID
  });
  
  let result = query;
  if (conditions.length > 0) {
    result = query.where(_.and(conditions));
  }
  
  const total = await result.count();
  const records = await result
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
