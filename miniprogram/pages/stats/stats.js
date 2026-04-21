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
    categoryColors: { 1: '#FF6B6B', 2: '#4ECDC4', 3: '#45B7D1', 4: '#FFA07A', 5: '#98D8C8', 6: '#F7DC6F', 7: '#BB8FCE' },
    categoryMap: {},
    platformMap: {}
  },

  onLoad() {
    const categoryMap = {};
    app.globalData.categories.forEach(c => { categoryMap[c.id] = c.name; });
    const platformMap = {};
    app.globalData.platforms.forEach(p => { platformMap[p.id] = p.name; });
    const budget = wx.getStorageSync('monthlyBudget') || 2000;
    this.setData({ categoryMap, platformMap, monthlyBudget: budget });

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
        const rawStats = statsRes.result.data;
        // 格式化数字，小程序模板不支持 .toFixed()
        const stats = {
          today: {
            spent: rawStats.today.spent,
            spentDisplay: rawStats.today.spent.toFixed(2),
            count: rawStats.today.count
          },
          yesterday: {
            spent: rawStats.yesterday.spent,
            spentDisplay: rawStats.yesterday.spent.toFixed(2),
            count: rawStats.yesterday.count
          },
          thisMonth: {
            spent: rawStats.thisMonth.spent,
            spentDisplay: rawStats.thisMonth.spent.toFixed(2),
            count: rawStats.thisMonth.count
          },
          lastMonth: {
            spent: rawStats.lastMonth.spent,
            spentDisplay: rawStats.lastMonth.spent.toFixed(2),
            count: rawStats.lastMonth.count
          },
          changePercent: rawStats.changePercent
        };
        this.setData({
          stats,
          hasData: rawStats.thisMonth.count > 0 || rawStats.today.count > 0
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
    const months = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: `${date.getMonth() + 1}月`
      });
    }

    try {
      const promises = months.map(m =>
        wx.cloud.callFunction({
          name: 'stats',
          data: { action: 'getMonthlyStats', year: m.year, month: m.month, babyId: selectedBabyId }
        }).then(res => {
          if (res.result?.success) {
            return {
              month: m.label,
              amount: res.result.data.total.toFixed(0),
              rawAmount: res.result.data.total,
              height: 0
            };
          }
          return { month: m.label, amount: '0', rawAmount: 0, height: 0 };
        }).catch(() => ({
          month: m.label, amount: '0', rawAmount: 0, height: 0
        }))
      );

      const trend = await Promise.all(promises);
      const maxAmount = Math.max(...trend.map(t => t.rawAmount), 1);
      trend.forEach(item => {
        item.height = Math.max((item.rawAmount / maxAmount) * 80, 10);
      });

      this.setData({ monthlyTrend: trend });
    } catch (error) {
      console.error('加载月度趋势失败:', error);
    }
  },

  // 加载分类统计
  async loadCategoryStats() {
    const { selectedBabyId, categoryMap, categoryColors } = this.data;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getMonthlyStats', babyId: selectedBabyId }
      });
      
      if (res.result?.success) {
        const categoryStats = res.result.data.categories.map(cat => ({
          ...cat,
          name: categoryMap[cat.categoryId] || '其他',
          color: categoryColors[cat.categoryId] || '#999'
        })).sort((a, b) => b.amount - a.amount);
        
        this.setData({ categoryStats });
      }
    } catch (error) {
      console.error('加载分类统计失败:', error);
    }
  },

  async loadPlatformStats() {
    const { selectedBabyId, platformMap } = this.data;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getCategoryStats', babyId: selectedBabyId }
      });
      
      if (res.result?.success) {
        const platformStats = res.result.data.platforms.map(p => ({
          ...p,
          name: platformMap[p.platform] || p.platform
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
