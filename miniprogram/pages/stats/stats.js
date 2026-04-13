// pages/stats/stats.js
const app = getApp();

Page({
  data: {
    loading: true,
    hasData: false,
    
    // 宝宝筛选
    babies: [{ _id: '', nickname: '全部宝宝' }],
    selectedBabyIndex: 0,
    selectedBabyId: '',
    
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
    categoryColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'],
    categoryNames: ['其他', '喂养', '洗护', '服装', '玩具', '医疗', '教育'],
    platformNames: { 'taobao': '淘宝', 'jd': '京东', 'pdd': '拼多多', 'douyin': '抖音', 'meituan': '美团', 'other': '其他' }
  },

  onLoad() {
    this.loadBabies();
  },

  onPullDownRefresh() {
    this.loadAll();
  },

  // 加载宝宝列表
  async loadBabies() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'babies',
        data: { action: 'list' }
      });
      
      if (res.result?.success) {
        const babies = [
          { _id: '', nickname: '全部宝宝' },
          ...res.result.data
        ];
        this.setData({ babies });
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
    
    this.loadAll();
  },

  // 选择宝宝
  onBabyChange(e) {
    const index = e.detail.value;
    const baby = this.data.babies[index];
    this.setData({
      selectedBabyIndex: index,
      selectedBabyId: baby._id || ''
    });
    this.loadAll();
  },

  // 加载所有统计
  async loadAll() {
    this.setData({ loading: true });
    
    const { selectedBabyId } = this.data;
    
    try {
      const statsRes = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getStats', babyId: selectedBabyId }
      });
      
      if (statsRes.result?.success) {
        const stats = statsRes.result.data;
        this.setData({
          stats,
          hasData: stats.thisMonth.count > 0 || stats.today.count > 0
        });
        
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
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    
    this.setData({ loading: false });
    wx.stopPullDownRefresh();
  },

  // 加载月度趋势
  async loadMonthlyTrend() {
    const { selectedBabyId } = this.data;
    const now = new Date();
    const trend = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'stats',
          data: { action: 'getMonthlyStats', year, month, babyId: selectedBabyId }
        });
        
        if (res.result?.success) {
          trend.push({
            month: `${month}月`,
            amount: res.result.data.total.toFixed(0),
            rawAmount: res.result.data.total,
            height: 0
          });
        }
      } catch (error) {
        trend.push({ month: `${month}月`, amount: '0', rawAmount: 0, height: 0 });
      }
    }
    
    const maxAmount = Math.max(...trend.map(t => t.rawAmount), 1);
    trend.forEach(item => {
      item.height = Math.max((item.rawAmount / maxAmount) * 80, 10);
    });
    
    this.setData({ monthlyTrend: trend });
  },

  // 加载分类统计
  async loadCategoryStats() {
    const { selectedBabyId, categoryNames, categoryColors } = this.data;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getMonthlyStats', babyId: selectedBabyId }
      });
      
      if (res.result?.success) {
        const categoryStats = res.result.data.categories.map(cat => ({
          ...cat,
          name: categoryNames[cat.categoryId] || '其他',
          color: categoryColors[cat.categoryId - 1] || '#999'
        })).sort((a, b) => b.amount - a.amount);
        
        this.setData({ categoryStats });
      }
    } catch (error) {
      console.error('加载分类统计失败:', error);
    }
  },

  // 加载平台统计
  async loadPlatformStats() {
    const { selectedBabyId, platformNames } = this.data;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getCategoryStats', babyId: selectedBabyId }
      });
      
      if (res.result?.success) {
        const platformStats = res.result.data.platforms.map(p => ({
          ...p,
          name: platformNames[p.platform] || p.platform
        })).sort((a, b) => b.amount - a.amount);
        
        this.setData({ platformStats });
      }
    } catch (error) {
      console.error('加载平台统计失败:', error);
    }
  },

  goToRecord() {
    wx.switchTab({ url: '/pages/record/record' });
  }
});
