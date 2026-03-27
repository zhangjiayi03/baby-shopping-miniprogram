// pages/index/index.js
const app = getApp()

Page({
  data: {
    todayTotal: 0,
    todayCompare: 0,
    monthTotal: 0,
    monthProgress: 0,
    budget: 4000,
    recentRecords: []
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadData() {
    const { records, budget, categories } = app.globalData

    // 计算今日花费
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayRecords = records.filter(r => new Date(r.createTime) >= today)
    const todayTotal = todayRecords.reduce((sum, r) => sum + r.price, 0)

    // 计算昨日花费
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayRecords = records.filter(r => {
      const d = new Date(r.createTime)
      return d >= yesterday && d < today
    })
    const yesterdayTotal = yesterdayRecords.reduce((sum, r) => sum + r.price, 0)

    // 环比
    const todayCompare = yesterdayTotal > 0 
      ? Math.round((todayTotal - yesterdayTotal) / yesterdayTotal * 100)
      : (todayTotal > 0 ? 100 : 0)

    // 计算本月花费
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthRecords = records.filter(r => new Date(r.createTime) >= monthStart)
    const monthTotal = monthRecords.reduce((sum, r) => sum + r.price, 0)
    const monthProgress = Math.min(100, Math.round(monthTotal / budget * 100))

    // 最近5条记录
    const recentRecords = records
      .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
      .slice(0, 5)
      .map(r => {
        const category = categories.find(c => c.id === r.categoryId) || { icon: '📦', name: '其他' }
        const platform = this.getPlatformName(r.platform)
        const timeText = this.formatTime(r.createTime)
        return {
          ...r,
          categoryIcon: category.icon,
          categoryName: category.name,
          platform,
          timeText
        }
      })

    this.setData({
      todayTotal: todayTotal.toFixed(2),
      todayCompare,
      monthTotal: monthTotal.toFixed(2),
      monthProgress,
      budget,
      recentRecords
    })

    return Promise.resolve()
  },

  getPlatformName(platformId) {
    const platforms = {
      taobao: '淘宝',
      jd: '京东',
      pdd: '拼多多',
      douyin: '抖音',
      other: '其他'
    }
    return platforms[platformId] || '其他'
  },

  formatTime(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 172800000) return '昨天'
    
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  },

  goToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  goToStats() {
    wx.switchTab({
      url: '/pages/stats/stats'
    })
  },

  goToMine() {
    wx.navigateTo({
      url: '/pages/mine/mine'
    })
  },

  showNotifications() {
    wx.showToast({
      title: '暂无新消息',
      icon: 'none'
    })
  },

  viewRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/record/record?id=${id}`
    })
  }
})
