// cloudfunctions/stats/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, babyId } = event;
  
  try {
    switch (action) {
      case 'getStats':
        return await getStats(event);
      case 'getMonthlyStats':
        return await getMonthlyStats(event);
      case 'getCategoryStats':
        return await getCategoryStats(event);
      default:
        return { success: false, message: '未知操作类型' };
    }
  } catch (error) {
    console.error('统计云函数执行错误:', error);
    return { success: false, message: error.message };
  }
};

// 获取统计数据（今日/本月/昨日）
async function getStats(event) {
  const { babyId } = event;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  
  const openid = cloud.getWXContext().OPENID;
  
  // 构建查询条件
  const buildQuery = (startDate, endDate) => {
    const conditions = [{ _openid: openid }];
    if (babyId) {
      conditions.push({ babyId: babyId });
    }
    conditions.push({
      orderTime: _.gte(startDate).and(_.lte(endDate))
    });
    return _.and(conditions);
  };
  
  // 今日统计
  const todayRecords = await db.collection('records')
    .where(buildQuery(today, today + 'T23:59:59'))
    .get();
  const todaySpent = sumSpent(todayRecords.data);
  
  // 昨日统计
  const yesterdayRecords = await db.collection('records')
    .where(buildQuery(yesterday, yesterday + 'T23:59:59'))
    .get();
  const yesterdaySpent = sumSpent(yesterdayRecords.data);
  
  // 本月统计
  const thisMonthRecords = await db.collection('records')
    .where(buildQuery(thisMonthStart, today + 'T23:59:59'))
    .get();
  const spentThisMonth = sumSpent(thisMonthRecords.data);
  
  // 上月统计
  const lastMonthRecords = await db.collection('records')
    .where(buildQuery(lastMonthStart, lastMonthEnd + 'T23:59:59'))
    .get();
  const spentLastMonth = sumSpent(lastMonthRecords.data);
  
  return {
    success: true,
    data: {
      today: { spent: todaySpent, count: todayRecords.data.length },
      yesterday: { spent: yesterdaySpent, count: yesterdayRecords.data.length },
      thisMonth: { spent: spentThisMonth, count: thisMonthRecords.data.length },
      lastMonth: { spent: spentLastMonth, count: lastMonthRecords.data.length },
      changePercent: yesterdaySpent > 0 
        ? Math.round(((todaySpent - yesterdaySpent) / yesterdaySpent) * 100) 
        : 0
    }
  };
}

// 获取月度统计（按分类）
async function getMonthlyStats(event) {
  const { year, month, babyId } = event;
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || (now.getMonth() + 1);
  
  const monthStart = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
  const monthEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
  
  const openid = cloud.getWXContext().OPENID;
  
  const conditions = [
    { _openid: openid },
    { orderTime: _.gte(monthStart).and(_.lte(monthEnd)) }
  ];
  if (babyId) {
    conditions.push({ babyId: babyId });
  }
  
  const records = await db.collection('records')
    .where(_.and(conditions))
    .get();
  
  // 按分类统计
  const categoryStats = {};
  let totalSpent = 0;
  
  records.data.forEach(r => {
    const categoryId = r.categoryId || 0;
    const amount = parseFloat(r.price || 0) * (parseInt(r.quantity) || 1);
    
    if (!categoryStats[categoryId]) {
      categoryStats[categoryId] = { categoryId, amount: 0, count: 0 };
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

// 获取平台统计
async function getCategoryStats(event) {
  const { babyId } = event;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  
  const openid = cloud.getWXContext().OPENID;
  
  const conditions = [
    { _openid: openid },
    { orderTime: _.gte(monthStart) }
  ];
  if (babyId) {
    conditions.push({ babyId: babyId });
  }
  
  const records = await db.collection('records')
    .where(_.and(conditions))
    .get();
  
  // 按平台统计
  const platformStats = {};
  let totalSpent = 0;
  
  records.data.forEach(r => {
    const platform = r.platform || 'other';
    const amount = parseFloat(r.price || 0) * (parseInt(r.quantity) || 1);
    
    if (!platformStats[platform]) {
      platformStats[platform] = { platform, amount: 0, count: 0 };
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

// 辅助函数：计算总消费
function sumSpent(records) {
  return parseFloat(records.reduce((sum, r) => 
    sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0
  ).toFixed(2));
}
