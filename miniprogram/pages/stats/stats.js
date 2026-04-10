// pages/stats/stats.js
const app = getApp();

Page({
  data: {
    loading: true,
    hasData: false,
    
    // 统计数据
    stats: {
      today: { spent: 0, count: 0 },
      yesterday: { spent: 0, count: 0 },
      thisMonth: { spent: 0, count: 0 },
      lastMonth: { spent: 0, count: 0 }
    },
    
    // 月度预算
    monthlyBudget: 2000,
    
    // 月度趋势（最近 6 个月）
    monthlyTrend: [],
    
    // 分类统计
    categoryStats: [],
    
    // 平台统计
    platformStats: [],
    
    // 分类颜色
    categoryColors: [
      '#FF6B6B', // 喂养 - 红色
      '#4ECDC4', // 洗护 - 青色
      '#45B7D1', // 服装 - 蓝色
      '#FFA07A', // 玩具 - 橙色
      '#98D8C8', // 医疗 - 绿色
      '#F7DC6F', // 教育 - 黄色
      '#BB8FCE'  // 其他 - 紫色
    ],
    
    // 分类名称映射
    categoryNames: [
      '其他',
      '喂养',
      '洗护',
      '服装',
      '玩具',
      '医疗',
      '教育'
    ],
    
    // 平台名称映射
    platformNames: {
      'taobao': '淘宝',
      'jd': '京东',
      'pdd': '拼多多',
      'douyin': '抖音',
      'meituan': '美团',
      'other': '其他'
    }
  },

  onLoad() {
    this.loadStats();
  },

  onPullDownRefresh() {
    this.loadStats();
  },

  // 加载统计数据
  async loadStats() {
    this.setData({ loading: true });
    
    try {
      // 获取综合统计
      const statsRes = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getStats' }
      });
      
      if (statsRes.result && statsRes.result.success) {
        const stats = statsRes.result.data;
        this.setData({
          stats: stats,
          hasData: stats.thisMonth.count > 0 || stats.today.count > 0
        });
        
        // 如果有数据，加载详细统计
        if (this.data.hasData) {
          await Promise.all([
            this.loadMonthlyTrend(),
            this.loadCategoryStats(),
            this.loadPlatformStats()
          ]);
        }
      }
      
    } catch (error) {
      console.error('加载统计失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
    
    this.setData({ loading: false });
    wx.stopPullDownRefresh();
  },

  // 加载月度趋势
  async loadMonthlyTrend() {
    const now = new Date();
    const trend = [];
    
    // 第一步：收集所有数据
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'stats',
          data: {
            action: 'getMonthlyStats',
            year: year,
            month: month
          }
        });
        
        if (res.result && res.result.success) {
          const amount = res.result.data.total;
          trend.push({
            month: `${month}月`,
            amount: amount.toFixed(0),
            rawAmount: amount,
            height: 0 // 先设为 0，后续统一计算
          });
        }
      } catch (error) {
        console.error('加载月度数据失败:', error);
        trend.push({
          month: `${month}月`,
          amount: '0',
          rawAmount: 0,
          height: 0
        });
      }
    }
    
    // 第二步：计算最大值并设置高度
    const maxAmount = Math.max(...trend.map(t => t.rawAmount), 1); // 避免除以 0
    trend.forEach(item => {
      const height = maxAmount > 0 ? (item.rawAmount / maxAmount) * 80 : 0;
      item.height = Math.max(height, 10); // 最小高度 10%
    });
    
    this.setData({ monthlyTrend: trend });
  },

  // 加载分类统计
  async loadCategoryStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getMonthlyStats' }
      });
      
      if (res.result && res.result.success) {
        const categories = res.result.data.categories;
        
        // 添加颜色和名称
        const categoryStats = categories.map(cat => ({
          ...cat,
          name: this.data.categoryNames[cat.categoryId] || '其他',
          color: this.data.categoryColors[cat.categoryId - 1] || '#999'
        })).sort((a, b) => b.amount - a.amount); // 按金额降序
        
        this.setData({ categoryStats });
      }
    } catch (error) {
      console.error('加载分类统计失败:', error);
    }
  },

  // 加载平台统计
  async loadPlatformStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getCategoryStats' }
      });
      
      if (res.result && res.result.success) {
        const platforms = res.result.data.platforms;
        
        // 添加名称
        const platformStats = platforms.map(p => ({
          ...p,
          name: this.data.platformNames[p.platform] || p.platform
        })).sort((a, b) => b.amount - a.amount); // 按金额降序
        
        this.setData({ platformStats });
      }
    } catch (error) {
      console.error('加载平台统计失败:', error);
    }
  },

  // 跳转到记账页面
  goToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    });
  }
});
