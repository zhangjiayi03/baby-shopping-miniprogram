// pages/stats/stats.js
const app = getApp()

Page({
  data: {
    period: 'month',
    periods: [
      { id: 'day', name: '今日' },
      { id: 'week', name: '本周' },
      { id: 'month', name: '本月' },
      { id: 'year', name: '今年' }
    ],
    totalAmount: 0,
    totalCount: 0,
    avgDaily: 0,
    compareLastPeriod: 0,
    categoryStats: [],
    trendData: []
  },

  onLoad() {
    this.loadStats()
  },

  onShow() {
    this.loadStats()
  },

  changePeriod(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ period })
    this.loadStats()
  },

  loadStats() {
    const { records, categories, budget } = app.globalData
    const { period } = this.data

    // 时间范围
    const now = new Date()
    let startDate = new Date()
    
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'year') {
      startDate.setMonth(0, 1)
      startDate.setHours(0, 0, 0, 0)
    }

    // 筛选记录
    const filteredRecords = records.filter(r => new Date(r.createTime) >= startDate)
    
    // 计算总额
    const totalAmount = filteredRecords.reduce((sum, r) => sum + r.price, 0)
    const totalCount = filteredRecords.length

    // 计算日均
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? now.getDate() : now.getDate()
    const avgDaily = totalAmount / days

    // 按类别统计
    const categoryMap = {}
    filteredRecords.forEach(r => {
      if (!categoryMap[r.categoryId]) {
        categoryMap[r.categoryId] = { amount: 0, count: 0 }
      }
      categoryMap[r.categoryId].amount += r.price
      categoryMap[r.categoryId].count++
    })

    const categoryStats = Object.entries(categoryMap)
      .map(([catId, data]) => {
        const category = categories.find(c => c.id == catId) || { icon: '📦', name: '其他', color: '#999' }
        return {
          id: catId,
          name: category.name,
          icon: category.icon,
          color: category.color,
          amount: data.amount.toFixed(2),
          count: data.count,
          percent: totalAmount > 0 ? Math.round(data.amount / totalAmount * 100) : 0
        }
      })
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))

    // 趋势数据（最近7天）
    const trendData = this.calculateTrend(records, 7)

    this.setData({
      totalAmount: totalAmount.toFixed(2),
      totalCount,
      avgDaily: avgDaily.toFixed(2),
      categoryStats,
      trendData
    })
  },

  calculateTrend(records, days) {
    const trend = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayRecords = records.filter(r => {
        const d = new Date(r.createTime)
        return d >= date && d < nextDate
      })

      const amount = dayRecords.reduce((sum, r) => sum + r.price, 0)

      trend.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        amount: amount.toFixed(0)
      })
    }

    return trend
  },

  goToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  exportData() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
