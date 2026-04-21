const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'getStats':
        return await getStats(event);
      case 'getMonthlyStats':
        return await getMonthlyStats(event);
      case 'getCategoryStats':
        return await getCategoryStats(event);
      case 'getTotalStats':
        return await getTotalStats(event);
      default:
        return { success: false, message: '未知操作类型' };
    }
  } catch (error) {
    console.error('统计云函数执行错误:', error);
    return { success: false, message: error.message };
  }
};

function buildMatch(openid, startDate, endDate, babyId) {
  const match = {
    _openid: openid,
    orderTime: _.gte(startDate).and(_.lte(endDate))
  };
  if (babyId) {
    match.babyId = babyId;
  }
  return match;
}

async function aggregateSum(openid, startDate, endDate, babyId) {
  const res = await db.collection('records')
    .aggregate()
    .match(buildMatch(openid, startDate, endDate, babyId))
    .group({
      _id: null,
      totalSpent: $.sum($.multiply(['$price', '$quantity'])),
      count: $.sum(1)
    })
    .end();

  if (res.list && res.list.length > 0) {
    return {
      spent: parseFloat(res.list[0].totalSpent.toFixed(2)),
      count: res.list[0].count
    };
  }
  return { spent: 0, count: 0 };
}

async function getStats(event) {
  const { babyId } = event;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  const openid = cloud.getWXContext().OPENID;

  const [todayResult, yesterdayResult, thisMonthResult, lastMonthResult] = await Promise.all([
    aggregateSum(openid, today, today + 'T23:59:59', babyId),
    aggregateSum(openid, yesterday, yesterday + 'T23:59:59', babyId),
    aggregateSum(openid, thisMonthStart, today + 'T23:59:59', babyId),
    aggregateSum(openid, lastMonthStart, lastMonthEnd + 'T23:59:59', babyId)
  ]);

  return {
    success: true,
    data: {
      today: todayResult,
      yesterday: yesterdayResult,
      thisMonth: thisMonthResult,
      lastMonth: lastMonthResult,
      changePercent: yesterdayResult.spent > 0
        ? Math.round(((todayResult.spent - yesterdayResult.spent) / yesterdayResult.spent) * 100)
        : 0
    }
  };
}

async function getMonthlyStats(event) {
  const { year, month, babyId } = event;
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || (now.getMonth() + 1);

  const monthStart = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
  const monthEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

  const openid = cloud.getWXContext().OPENID;

  const match = buildMatch(openid, monthStart, monthEnd, babyId);

  const res = await db.collection('records')
    .aggregate()
    .match(match)
    .group({
      _id: '$categoryId',
      amount: $.sum($.multiply(['$price', '$quantity'])),
      count: $.sum(1)
    })
    .end();

  let totalSpent = 0;
  const categories = res.list.map(item => {
    const amount = parseFloat(item.amount.toFixed(2));
    totalSpent += amount;
    return {
      categoryId: item._id,
      amount,
      count: item.count
    };
  });

  totalSpent = parseFloat(totalSpent.toFixed(2));

  return {
    success: true,
    data: {
      total: totalSpent,
      categories: categories.map(c => ({
        ...c,
        percentage: totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0
      }))
    }
  };
}

async function getCategoryStats(event) {
  const { babyId } = event;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const openid = cloud.getWXContext().OPENID;

  const match = buildMatch(openid, monthStart, today + 'T23:59:59', babyId);

  const res = await db.collection('records')
    .aggregate()
    .match(match)
    .group({
      _id: '$platform',
      amount: $.sum($.multiply(['$price', '$quantity'])),
      count: $.sum(1)
    })
    .end();

  let totalSpent = 0;
  const platforms = res.list.map(item => {
    const amount = parseFloat(item.amount.toFixed(2));
    totalSpent += amount;
    return {
      platform: item._id,
      amount,
      count: item.count
    };
  });

  totalSpent = parseFloat(totalSpent.toFixed(2));

  return {
    success: true,
    data: {
      total: totalSpent,
      platforms: platforms.map(p => ({
        ...p,
        percentage: totalSpent > 0 ? Math.round((p.amount / totalSpent) * 100) : 0
      }))
    }
  };
}

async function getTotalStats(event) {
  const openid = cloud.getWXContext().OPENID;

  const [sumRes, daysRes] = await Promise.all([
    db.collection('records')
      .aggregate()
      .match({ _openid: openid })
      .group({
        _id: null,
        totalSpent: $.sum($.multiply(['$price', '$quantity'])),
        totalCount: $.sum(1)
      })
      .end(),
    db.collection('records')
      .aggregate()
      .match({ _openid: openid })
      .group({
        _id: '$orderTime'
      })
      .end()
  ]);

  const totalSpent = sumRes.list?.[0]?.totalSpent || 0;
  const totalRecords = sumRes.list?.[0]?.totalCount || 0;
  const totalDays = daysRes.list ? daysRes.list.length : 0;

  return {
    success: true,
    data: {
      totalRecords: totalRecords,
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalDays: totalDays
    }
  };
}
