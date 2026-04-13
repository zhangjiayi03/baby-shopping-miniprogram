// pages/mine/mine.js
const app = getApp();

Page({
  data: {
    // 用户信息
    userInfo: {
      nickname: '',
      avatar: ''
    },
    
    // 统计数据
    totalDays: 0,
    totalRecords: 0,
    totalSpent: 0,
    
    // 宝宝信息
    babyInfo: {
      name: '',
      birthday: '',
      age: null
    },
    
    // 预算信息
    monthlyBudget: 2000,
    spentThisMonth: 0,
    budgetRemaining: 0,
    budgetPercent: 0,
    budgetTip: '',
    budgetTipClass: 'normal',
    spentClass: '',
    
    // 弹窗控制
    showBabyDialog: false,
    showBudgetDialog: false,
    
    // 表单数据
    babyForm: {
      name: '',
      birthday: ''
    },
    
    budgetForm: {
      amount: 2000
    },
    
    // 版本信息
    version: '1.1.0',
    hasUpdate: false
  },

  onLoad() {
    this.loadUserInfo();
    this.loadStats();
    this.loadSettings();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'getInfo' }
      });
      
      if (res.result && res.result.success) {
        this.setData({ userInfo: res.result.data });
      }
    } catch (error) {
      // 云函数可能未部署，使用默认值
      console.log('用户信息加载失败，使用默认值');
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const statsRes = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getStats' }
      });
      
      if (statsRes.result && statsRes.result.success) {
        const stats = statsRes.result.data;
        
        // 计算总消费
        const allRecordsRes = await wx.cloud.callFunction({
          name: 'record',
          data: { action: 'list', data: { page: 1, pageSize: 1000 } }
        });
        
        let totalSpent = 0;
        let totalRecords = 0;
        
        if (allRecordsRes.result && allRecordsRes.result.success) {
          const records = allRecordsRes.result.data.list || [];
          totalRecords = records.length;
          totalSpent = records.reduce((sum, r) => sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0);
          
          // 计算记录天数
          const uniqueDays = [...new Set(records.map(r => r.orderTime.split('T')[0]))];
          const totalDays = uniqueDays.length;
          
          this.setData({
            totalDays,
            totalRecords,
            totalSpent: parseFloat(totalSpent.toFixed(2)),
            spentThisMonth: stats.thisMonth.spent.toFixed(2)
          });
          
          this.calculateBudget();
        }
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  },

  // 加载设置
  loadSettings() {
    const budget = wx.getStorageSync('monthlyBudget') || 2000;
    const babyInfo = wx.getStorageSync('babyInfo') || { name: '', birthday: '' };
    
    this.setData({
      monthlyBudget: budget,
      babyInfo: babyInfo,
      budgetForm: { amount: budget },
      babyForm: { ...babyInfo }
    });
    
    this.calculateBudget();
  },

  // 计算预算
  calculateBudget() {
    const { monthlyBudget, spentThisMonth } = this.data;
    const remaining = monthlyBudget - spentThisMonth;
    const percent = monthlyBudget > 0 ? (spentThisMonth / monthlyBudget) * 100 : 0;
    
    let tip = '';
    let tipClass = 'normal';
    let spentClass = '';
    
    if (percent >= 90) {
      tip = '⚠️ 预算即将超支！';
      tipClass = 'danger';
      spentClass = 'danger';
    } else if (percent >= 70) {
      tip = '💡 预算使用较多，请合理消费';
      tipClass = 'warning';
      spentClass = 'warning';
    } else {
      tip = '✅ 预算充足，继续保持';
      tipClass = 'normal';
    }
    
    this.setData({
      budgetRemaining: parseFloat(remaining.toFixed(2)),
      budgetPercent: Math.min(percent, 100),
      budgetTip: tip,
      budgetTipClass: tipClass,
      spentClass: spentClass
    });
  },

  // 编辑宝宝信息
  editBaby() {
    this.setData({
      babyForm: { ...this.data.babyInfo },
      showBabyDialog: true
    });
  },

  hideBabyDialog() {
    this.setData({ showBabyDialog: false });
  },

  onBirthdayChange(e) {
    this.setData({
      'babyForm.birthday': e.detail.value
    });
  },

  onNameInput(e) {
    this.setData({
      'babyForm.name': e.detail.value
    });
  },

  saveBabyInfo() {
    const { name, birthday } = this.data.babyForm;
    
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    
    // 计算月龄
    let age = null;
    if (birthday) {
      const birthDate = new Date(birthday);
      const now = new Date();
      const months = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
      age = Math.max(0, months);
    }
    
    const babyInfo = { name: name.trim(), birthday, age };
    
    wx.setStorageSync('babyInfo', babyInfo);
    this.setData({
      babyInfo,
      showBabyDialog: false
    });
    
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  // 编辑预算
  editBudget() {
    this.setData({
      showBudgetDialog: true
    });
  },

  hideBudgetDialog() {
    this.setData({ showBudgetDialog: false });
  },

  saveBudget() {
    const amount = parseInt(this.data.budgetForm.amount);
    
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    
    wx.setStorageSync('monthlyBudget', amount);
    this.setData({
      monthlyBudget: amount,
      showBudgetDialog: false
    });
    
    this.calculateBudget();
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  // 功能菜单
  exportData() {
    wx.showToast({ title: '开发中', icon: 'none' });
  },

  clearCache() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '清除成功', icon: 'success' });
          this.loadSettings();
        }
      }
    });
  },

  feedback() {
    wx.showToast({ title: '开发中', icon: 'none' });
  },

  aboutUs() {
    wx.showModal({
      title: '关于宝宝购物记',
      content: 'Version ' + this.data.version + '\n\n一款专为宝妈设计的购物记账工具，帮助记录宝宝成长过程中的每一笔开销。',
      showCancel: false
    });
  },

  checkUpdate() {
    wx.showToast({ title: '已是最新版本', icon: 'none' });
  }
});
