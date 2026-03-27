// pages/mine/mine.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    budget: 4000,
    stats: {
      totalRecords: 0,
      totalAmount: 0,
      avgDaily: 0,
      maxAmount: 0,
      maxProduct: ''
    },
    menus: [
      { id: 'budget', icon: '💰', title: '预算管理', desc: '设置月度预算' },
      { id: 'export', icon: '📤', title: '导出数据', desc: '导出为 Excel' },
      { id: 'backup', icon: '☁️', title: '云备份', desc: '同步到云端' },
      { id: 'feedback', icon: '💬', title: '意见反馈', desc: '帮助我们改进' },
      { id: 'about', icon: 'ℹ️', title: '关于', desc: '版本信息' }
    ]
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const { records, budget } = app.globalData
    
    // 计算统计数据
    const totalRecords = records.length
    const totalAmount = records.reduce((sum, r) => sum + r.price, 0)
    
    // 日均（按有记录的天数）
    const dates = [...new Set(records.map(r => r.createTime.split('T')[0]))]
    const avgDaily = dates.length > 0 ? totalAmount / dates.length : 0
    
    // 最大单笔
    let maxAmount = 0
    let maxProduct = ''
    records.forEach(r => {
      if (r.price > maxAmount) {
        maxAmount = r.price
        maxProduct = r.productName
      }
    })

    this.setData({
      budget,
      stats: {
        totalRecords,
        totalAmount: totalAmount.toFixed(2),
        avgDaily: avgDaily.toFixed(2),
        maxAmount: maxAmount.toFixed(2),
        maxProduct
      }
    })
  },

  onMenuClick(e) {
    const id = e.currentTarget.dataset.id
    
    switch (id) {
      case 'budget':
        this.showBudgetModal()
        break
      case 'export':
        this.exportData()
        break
      case 'backup':
        this.backupData()
        break
      case 'feedback':
        this.openFeedback()
        break
      case 'about':
        this.showAbout()
        break
    }
  },

  showBudgetModal() {
    wx.showModal({
      title: '设置月度预算',
      editable: true,
      placeholderText: '请输入预算金额',
      content: this.data.budget.toString(),
      success: (res) => {
        if (res.confirm && res.content) {
          const budget = parseFloat(res.content)
          if (!isNaN(budget) && budget > 0) {
            app.saveData('budget', budget)
            this.setData({ budget })
            wx.showToast({ title: '设置成功', icon: 'success' })
          } else {
            wx.showToast({ title: '请输入有效金额', icon: 'none' })
          }
        }
      }
    })
  },

  exportData() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  backupData() {
    const { records, babies } = app.globalData
    
    wx.showLoading({ title: '备份中...' })
    
    wx.cloud.callFunction({
      name: 'backup',
      data: {
        records,
        babies
      },
      success: () => {
        wx.hideLoading()
        wx.showToast({ title: '备份成功', icon: 'success' })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '备份失败', icon: 'none' })
      }
    })
  },

  openFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '如有问题或建议，请联系：baby-shopping@example.com',
      showCancel: false
    })
  },

  showAbout() {
    wx.showModal({
      title: '宝宝购物记录',
      content: '版本：1.0.0\n\n一款专为新手爸妈设计的购物记账工具，帮助您轻松记录和管理宝宝用品的开支。',
      showCancel: false
    })
  },

  clearData() {
    wx.showModal({
      title: '清空数据',
      content: '确定要清空所有记账记录吗？此操作不可恢复！',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          app.saveData('records', [])
          this.loadData()
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  }
})
