// cloudfunctions/stats/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 主函数
exports.main = async (event, context) => {
  const { action, type } = event;
  
  try {
    switch (action) {
      case 'getStats':
        return await getStats(event);
      case 'getMonthlyStats':
        return await getMonthlyStats(event);
      case 'getCategoryStats':
        return await getCategoryStats(event);
      default:
        return {
          success: false,
          message: '未知操作类型'
        };
    }
  } catch (error) {
    console.error('统计云函数执行错误:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

// 获取统计数据（今日/本月/昨日）
async function getStats(event) {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const openid = cloud.getWXContext().OPENID;
  
  // 获取所有记录
  const allRecords = await db.collection('records')
    .where({
      _openid: openid
    })
    .get();
  
  const records = allRecords.data;
  
  // 今日统计
  const todayRecords = records.filter(r => 
    new Date(r.orderTime).toDateString() === today
  );
  const todaySpent = todayRecords.reduce((sum, r) => 
    sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0
  );
  
  // 昨日统计
  const yesterdayRecords = records.filter(r => 
    new Date(r.orderTime).toDateString() === yesterday
  );
  const yesterdaySpent = yesterdayRecords.reduce((sum, r) => 
    sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0
  );
  
  // 本月统计
  const thisMonthRecords = records.filter(r => 
    new Date(r.orderTime).getTime() >= thisMonthStart.getTime()
  );
  const spentThisMonth = thisMonthRecords.reduce((sum, r) => 
    sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0
  );
  
  // 上月统计
  const lastMonthRecords = records.filter(r => {
    const orderTime = new Date(r.orderTime).getTime();
    return orderTime >= lastMonthStart.getTime() && orderTime <= lastMonthEnd.getTime();
  });
  const spentLastMonth = lastMonthRecords.reduce((sum, r) => 
    sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0
  );
  
  return {
    success: true,
    data: {
      today: {
        spent: parseFloat(todaySpent.toFixed(2)),
        count: todayRecords.length
      },
      yesterday: {
        spent: parseFloat(yesterdaySpent.toFixed(2)),
        count: yesterdayRecords.length
      },
      thisMonth: {
        spent: parseFloat(spentThisMonth.toFixed(2)),
        count: thisMonthRecords.length
      },
      lastMonth: {
        spent: parseFloat(spentLastMonth.toFixed(2)),
        count: lastMonthRecords.length
      },
      changePercent: yesterdaySpent > 0 
        ? Math.round(((todaySpent - yesterdaySpent) / yesterdaySpent) * 100) 
        : 0
    }
  };
}

// 获取月度统计（按分类）
async function getMonthlyStats(event) {
  const { year, month } = event;
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || (now.getMonth() + 1);
  
  const monthStart = new Date(targetYear, targetMonth - 1, 1);
  const monthEnd = new Date(targetYear, targetMonth, 0);
  
  const openid = cloud.getWXContext().OPENID;
  
  const records = await db.collection('records')
    .where({
      _openid: openid,
      orderTime: _.gte(monthStart.toISOString().split('T')[0])
        .and(_.lte(monthEnd.toISOString().split('T')[0]))
    })
    .get();
  
  // 按分类统计
  const categoryStats = {};
  let totalSpent = 0;
  
  records.data.forEach(r => {
    const categoryId = r.categoryId || 0;
    const amount = parseFloat(r.price || 0) * (parseInt(r.quantity) || 1);
    
    if (!categoryStats[categoryId]) {
      categoryStats[categoryId] = {
        categoryId: categoryId,
        amount: 0,
        count: 0
      };
    }
    
    categoryStats[categoryId].amount += amount;
    categoryStats[categoryId].count += 1;
    totalSpent += amount;
  });
  
  return {
    success: true,
    data: {
      total: parseFloat(totalSpent.toFixed(2)),
      categories: Object.values(categoryStats).map(c => ({
        ...c,
        amount: parseFloat(c.amount.toFixed(2)),
        percentage: totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0
      }))
    }
  };
}

// 获取分类统计
async function getCategoryStats(event) {
  const { startDate, endDate } = event;
  const openid = cloud.getWXContext().OPENID;
  
  let query = {
    _openid: openid
  };
  
  if (startDate || endDate) {
    query.orderTime = {};
    if (startDate) {
      query.orderTime._gte = startDate;
    }
    if (endDate) {
      query.orderTime._lte = endDate;
    }
  }
  
  const records = await db.collection('records')
    .where(query)
    .get();
  
  // 按平台统计
  const platformStats = {};
  let totalSpent = 0;
  
  records.data.forEach(r => {
    const platform = r.platform || 'other';
    const amount = parseFloat(r.price || 0) * (parseInt(r.quantity) || 1);
    
    if (!platformStats[platform]) {
      platformStats[platform] = {
        platform: platform,
        amount: 0,
        count: 0
      };
    }
    
    platformStats[platform].amount += amount;
    platformStats[platform].count += 1;
    totalSpent += amount;
  });
  
  return {
    success: true,
    data: {
      total: parseFloat(totalSpent.toFixed(2)),
      platforms: Object.values(platformStats).map(p => ({
        ...p,
        amount: parseFloat(p.amount.toFixed(2)),
        percentage: totalSpent > 0 ? Math.round((p.amount / totalSpent) * 100) : 0
      }))
    }
  };
}
