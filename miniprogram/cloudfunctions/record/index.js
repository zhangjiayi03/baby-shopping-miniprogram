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
  // 数据验证
  if (!data.productName || !data.productName.trim()) {
    return {
      success: false,
      message: '商品名称不能为空'
    };
  }
  
  const price = parseFloat(data.price);
  if (isNaN(price) || price < 0 || price > 100000) {
    return {
      success: false,
      message: '价格必须在 0-100000 之间'
    };
  }
  
  const quantity = parseInt(data.quantity);
  if (isNaN(quantity) || quantity <= 0 || quantity > 9999) {
    return {
      success: false,
      message: '数量必须在 1-9999 之间'
    };
  }
  
  const categoryId = parseInt(data.categoryId);
  if (isNaN(categoryId) || categoryId < 1 || categoryId > 7) {
    return {
      success: false,
      message: '分类 ID 无效'
    };
  }
  
  const validPlatforms = ['taobao', 'jd', 'pdd', 'douyin', 'meituan', 'other'];
  if (!validPlatforms.includes(data.platform)) {
    return {
      success: false,
      message: '平台类型无效'
    };
  }
  
  const now = new Date();
  const record = {
    productName: data.productName.trim(),
    price: price,
    quantity: quantity,
    unitPrice: data.unitPrice || (price / quantity).toFixed(2),
    categoryId: categoryId,
    platform: data.platform,
    orderTime: data.orderTime || now.toISOString().split('T')[0],
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
