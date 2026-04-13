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
    
    // 宝宝列表
    babies: [],
    
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
      id: '',
      nickname: '',
      birthDate: '',
      gender: 'male'
    },
    
    budgetForm: {
      amount: 2000
    },
    
    // 版本信息
    version: '1.2.0',
    hasUpdate: false
  },

  onLoad() {
    this.loadUserInfo();
    this.loadBabies();
    this.loadStats();
    this.loadSettings();
  },

  onShow() {
    this.loadBabies();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'getInfo' }
      });
      
      if (res.result?.success) {
        this.setData({ userInfo: res.result.data });
      }
    } catch (error) {
      console.log('用户信息加载失败');
    }
  },

  // 加载宝宝列表
  async loadBabies() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'babies',
        data: { action: 'list' }
      });
      
      if (res.result?.success) {
        // 计算月龄
        const babies = res.result.data.map(baby => {
          let ageMonths = null;
          if (baby.birthDate) {
            const birthDate = new Date(baby.birthDate);
            const now = new Date();
            ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                        (now.getMonth() - birthDate.getMonth());
            ageMonths = Math.max(0, ageMonths);
          }
          return { ...baby, ageMonths };
        });
        this.setData({ babies });
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const statsRes = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getStats' }
      });
      
      if (statsRes?.result?.success) {
        const stats = statsRes.result.data;
        
        const allRecordsRes = await wx.cloud.callFunction({
          name: 'record',
          data: { action: 'list', data: { page: 1, pageSize: 1000 } }
        });
        
        if (allRecordsRes?.result?.success) {
          const records = allRecordsRes.result.data.list || [];
          const totalRecords = records.length;
          const totalSpent = records.reduce((sum, r) => 
            sum + parseFloat(r.price || 0) * (parseInt(r.quantity) || 1), 0);
          
          const uniqueDays = [...new Set(records.map(r => r.orderTime?.split('T')[0]))];
          
          this.setData({
            totalDays: uniqueDays.length,
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
    this.setData({
      monthlyBudget: budget,
      budgetForm: { amount: budget }
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
      spentClass
    });
  },

  // 添加宝宝
  addBaby() {
    this.setData({
      babyForm: {
        id: '',
        nickname: '',
        birthDate: '',
        gender: 'male'
      },
      showBabyDialog: true
    });
  },

  // 编辑宝宝
  editBaby(e) {
    const index = e.currentTarget.dataset.index;
    const baby = this.data.babies[index];
    
    this.setData({
      babyForm: {
        id: baby._id,
        nickname: baby.nickname,
        birthDate: baby.birthDate,
        gender: baby.gender || 'male'
      },
      showBabyDialog: true
    });
  },

  // 删除宝宝
  deleteBaby(e) {
    const index = e.currentTarget.dataset.index;
    const baby = this.data.babies[index];
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${baby.nickname}"吗？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'babies',
              data: { action: 'delete', id: baby._id }
            });
            
            if (result.result?.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadBabies();
            } else {
              wx.showToast({ 
                title: result.result?.message || '删除失败', 
                icon: 'none' 
              });
            }
          } catch (error) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  hideBabyDialog() {
    this.setData({ showBabyDialog: false });
  },

  onNicknameInput(e) {
    this.setData({ 'babyForm.nickname': e.detail.value });
  },

  onBirthDateChange(e) {
    this.setData({ 'babyForm.birthDate': e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ 'babyForm.gender': e.detail.value });
  },

  async saveBabyInfo() {
    const { id, nickname, birthDate, gender } = this.data.babyForm;
    
    if (!nickname?.trim()) {
      return wx.showToast({ title: '请输入昵称', icon: 'none' });
    }
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      let result;
      if (id) {
        // 更新
        result = await wx.cloud.callFunction({
          name: 'babies',
          data: {
            action: 'update',
            id,
            data: { nickname: nickname.trim(), birthDate, gender }
          }
        });
      } else {
        // 新增
        result = await wx.cloud.callFunction({
          name: 'babies',
          data: {
            action: 'create',
            data: { nickname: nickname.trim(), birthDate, gender }
          }
        });
      }
      
      wx.hideLoading();
      
      if (result.result?.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ showBabyDialog: false });
        this.loadBabies();
      } else {
        wx.showToast({ 
          title: result.result?.message || '保存失败', 
          icon: 'none' 
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 编辑预算
  editBudget() {
    this.setData({ showBudgetDialog: true });
  },

  hideBudgetDialog() {
    this.setData({ showBudgetDialog: false });
  },

  saveBudget() {
    const amount = parseInt(this.data.budgetForm.amount);
    
    if (!amount || amount <= 0) {
      return wx.showToast({ title: '请输入有效金额', icon: 'none' });
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
      title: '关于萌宝账本',
      content: 'Version ' + this.data.version + '\n\n一款专为宝妈设计的购物记账工具，帮助记录宝宝成长过程中的每一笔开销。',
      showCancel: false
    });
  },

  checkUpdate() {
    wx.showToast({ title: '已是最新版本', icon: 'none' });
  }
});
