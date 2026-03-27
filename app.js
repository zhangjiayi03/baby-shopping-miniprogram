// app.js
App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-8ggfnnl90cbdd81e',
      traceUser: true,
    })

    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }

    // 获取本地存储的宝宝信息
    const babies = wx.getStorageSync('babies')
    if (babies) {
      this.globalData.babies = babies
    }

    // 获取记账记录
    const records = wx.getStorageSync('records')
    if (records) {
      this.globalData.records = records
    }
  },

  globalData: {
    userInfo: null,
    babies: [],
    currentBabyId: null,
    records: [],
    budget: 4000, // 默认月度预算
    categories: [
      { id: 1, name: '喂养用品', icon: '🍼', color: '#FF6B6B' },
      { id: 2, name: '护理用品', icon: '🧴', color: '#4ECDC4' },
      { id: 3, name: '服装鞋帽', icon: '👕', color: '#FFD93D' },
      { id: 4, name: '玩具娱乐', icon: '🧸', color: '#6BCB77' },
      { id: 5, name: '医疗保健', icon: '💊', color: '#9B59B6' },
      { id: 6, name: '教育早教', icon: '📚', color: '#3498DB' },
      { id: 7, name: '其他', icon: '📦', color: '#95A5A6' }
    ],
    platforms: [
      { id: 'taobao', name: '淘宝', color: '#FF6600' },
      { id: 'jd', name: '京东', color: '#E4393C' },
      { id: 'pdd', name: '拼多多', color: '#E02E24' },
      { id: 'douyin', name: '抖音', color: '#000000' },
      { id: 'other', name: '其他', color: '#999999' }
    ]
  },

  // 保存数据到本地
  saveData(key, data) {
    wx.setStorageSync(key, data)
    this.globalData[key] = data
  },

  // 获取当前宝宝
  getCurrentBaby() {
    const { babies, currentBabyId } = this.globalData
    if (!babies || babies.length === 0) return null
    if (currentBabyId) {
      return babies.find(b => b.id === currentBabyId) || babies[0]
    }
    return babies[0]
  },

  // 计算统计数据
  calculateStats(options = {}) {
    const { records, babies, budget } = this.globalData
    const { period = 'month', babyId } = options
    
    let filteredRecords = records
    
    // 按宝宝筛选
    if (babyId) {
      filteredRecords = filteredRecords.filter(r => r.babyId === babyId)
    }
    
    // 按时间筛选
    const now = new Date()
    const startDate = new Date()
    
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth(), 1)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'year') {
      startDate.setMonth(0, 1)
      startDate.setHours(0, 0, 0, 0)
    }
    
    filteredRecords = filteredRecords.filter(r => new Date(r.createTime) >= startDate)
    
    // 计算总额
    const total = filteredRecords.reduce((sum, r) => sum + r.price, 0)
    
    // 按类别统计
    const categoryStats = {}
    filteredRecords.forEach(r => {
      if (!categoryStats[r.categoryId]) {
        categoryStats[r.categoryId] = 0
      }
      categoryStats[r.categoryId] += r.price
    })
    
    return {
      total,
      count: filteredRecords.length,
      categoryStats,
      budget,
      remaining: budget - total
    }
  }
})
