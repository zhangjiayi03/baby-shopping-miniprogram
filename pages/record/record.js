// pages/record/record.js
const app = getApp()

Page({
  data: {
    activeTab: 'scan',
    selectedPlatform: '',
    platforms: [
      { id: 'taobao', name: '淘宝' },
      { id: 'jd', name: '京东' },
      { id: 'pdd', name: '拼多多' },
      { id: 'douyin', name: '抖音' },
      { id: 'other', name: '其他' }
    ],
    categories: [],
    babies: [{ id: '', name: '不指定' }],
    tempImagePath: '',
    recognizeResult: null,
    isRecognizing: false,
    
    // 表单数据
    form: {
      productName: '',
      price: '',
      categoryId: 1,
      platform: 'taobao',
      date: '',
      babyId: '',
      remark: ''
    },
    categoryIndex: 0,
    platformIndex: 0,
    babyIndex: 0,
    
    // 弹窗
    showCategoryPopup: false,
    selectedCategory: null
  },

  onLoad(options) {
    const { categories, babies } = app.globalData
    const today = new Date().toISOString().split('T')[0]
    
    this.setData({
      categories,
      babies: [{ id: '', name: '不指定' }, ...babies],
      'form.date': today
    })
    
    // 如果有传入 babyId，自动选中
    if (options.babyId) {
      const index = this.data.babies.findIndex(b => b.id === options.babyId)
      if (index !== -1) {
        this.setData({ babyIndex: index })
      }
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  selectPlatform(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ 
      selectedPlatform: id,
      'form.platform': id 
    })
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ tempImagePath: tempFilePath })
        this.recognizeImage(tempFilePath)
      }
    })
  },

  // 调用云函数 OCR 识别
  async recognizeImage(imagePath) {
    this.setData({ isRecognizing: true })
    wx.showLoading({ title: '识别中...' })
    
    try {
      // 先上传图片到云存储
      const cloudPath = `ocr-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: imagePath
      })
      
      if (!uploadResult.fileID) {
        throw new Error('图片上传失败')
      }
      
      // 调用云函数进行 OCR
      const result = await wx.cloud.callFunction({
        name: 'ocr',
        data: {
          type: 'order',
          imgUrl: uploadResult.fileID
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const ocrData = result.result.data
        const recognized = this.parseOcrResult(ocrData)
        
        this.setData({
          recognizeResult: recognized,
          isRecognizing: false,
          selectedCategory: recognized.categoryId
        })
      } else {
        throw new Error(result.result?.error || '识别失败')
      }
    } catch (err) {
      console.error('OCR识别失败:', err)
      wx.hideLoading()
      this.setData({ isRecognizing: false })
      
      // 识别失败，手动输入
      wx.showModal({
        title: '识别失败',
        content: '无法识别图片内容，请手动输入',
        showCancel: false,
        success: () => {
          this.setData({ activeTab: 'manual' })
        }
      })
    }
  },

  // 解析 OCR 结果
  parseOcrResult(ocrData) {
    // 根据 OCR 返回的数据结构解析
    let productName = ''
    let price = ''
    let orderTime = ''
    
    if (ocrData.words_result) {
      const words = ocrData.words_result.map(item => item.words).join(' ')
      productName = this.extractProduct(words)
      price = this.extractPrice(words)
      orderTime = this.extractDate(words)
    }
    
    // 智能分类
    const category = this.guessCategory(productName)
    
    return {
      productName: productName || '未识别商品',
      quantity: 1,
      unitPrice: price || '0.00',
      price: price || '0.00',
      platform: this.data.selectedPlatform || 'other',
      platformName: this.getPlatformName(this.data.selectedPlatform || 'other'),
      orderTime: orderTime || new Date().toISOString().split('T')[0],
      categoryId: category.id,
      categoryIcon: category.icon,
      categoryName: category.name
    }
  },

  // 从文字中提取商品名
  extractProduct(text) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length > 0) {
      return lines[0].substring(0, 50)
    }
    return ''
  },

  // 从文字中提取价格
  extractPrice(text) {
    const priceMatch = text.match(/(?:¥|￥|价格|金额|合计|总计|实付)[:\s]*(\d+\.?\d*)/)
    if (priceMatch) {
      return parseFloat(priceMatch[1]).toFixed(2)
    }
    const numMatch = text.match(/(\d+\.\d{2})/)
    return numMatch ? numMatch[1] : '0.00'
  },

  // 从文字中提取日期
  extractDate(text) {
    const dateMatch = text.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/)
    if (dateMatch) {
      return dateMatch[1].replace(/[年月日]/g, '-').replace(/\/-/g, '-')
    }
    return new Date().toISOString().split('T')[0]
  },

  // 智能猜测分类
  guessCategory(productName) {
    const name = productName.toLowerCase()
    const categories = this.data.categories
    
    const keywords = {
      1: ['奶粉', '奶瓶', '辅食', '米粉', '营养', '水杯', '宝宝水'],
      2: ['纸尿裤', '尿布', '湿巾', '洗澡', '洗护', '护肤', '防晒', '洗衣液'],
      3: ['衣服', '裤子', '鞋子', '袜子', '帽子', '外套', '连衣裙'],
      4: ['玩具', '积木', '绘本', '图书', '滑梯', '摇马'],
      5: ['药品', '药', '体温计', '退热贴', '医疗'],
      6: ['早教', '课程', '启蒙', '学习', '教育']
    }
    
    for (const [catId, words] of Object.entries(keywords)) {
      if (words.some(word => name.includes(word))) {
        return categories.find(c => c.id == catId) || categories[6]
      }
    }
    
    return categories[6]
  },

  getPlatformName(id) {
    const platform = this.data.platforms.find(p => p.id === id)
    return platform ? platform.name : '其他'
  },

  showCategoryPicker() {
    this.setData({ showCategoryPopup: true })
  },

  closeCategoryPicker() {
    this.setData({ showCategoryPopup: false })
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(c => c.id === id)
    
    this.setData({
      selectedCategory: id,
      'recognizeResult.categoryId': id,
      'recognizeResult.categoryIcon': category.icon,
      'recognizeResult.categoryName': category.name,
      showCategoryPopup: false
    })
  },

  onBabyChange(e) {
    const index = e.detail.value
    this.setData({ 
      babyIndex: index,
      'form.babyId': this.data.babies[index].id
    })
  },

  // 确认保存识别结果
  confirmRecord() {
    const { recognizeResult, babies, babyIndex } = this.data
    
    if (!recognizeResult || !recognizeResult.productName) {
      wx.showToast({ title: '请先识别图片', icon: 'none' })
      return
    }
    
    const record = {
      id: Date.now().toString(),
      productName: recognizeResult.productName,
      price: parseFloat(recognizeResult.price) || 0,
      quantity: recognizeResult.quantity || 1,
      unitPrice: parseFloat(recognizeResult.unitPrice) || 0,
      categoryId: recognizeResult.categoryId,
      platform: recognizeResult.platform,
      orderTime: recognizeResult.orderTime,
      babyId: babies[babyIndex]?.id || '',
      createTime: new Date().toISOString(),
      image: this.data.tempImagePath
    }
    
    this.saveRecord(record)
  },

  // 表单输入
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  onCategoryChange(e) {
    const index = e.detail.value
    this.setData({ 
      categoryIndex: index,
      'form.categoryId': this.data.categories[index].id
    })
  },

  onPlatformChange(e) {
    const index = e.detail.value
    this.setData({ 
      platformIndex: index,
      'form.platform': this.data.platforms[index].id
    })
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  // 提交手动表单
  submitForm() {
    const { form, categories, platforms, babies, categoryIndex, platformIndex, babyIndex } = this.data
    
    if (!form.productName) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    
    if (!form.price || parseFloat(form.price) <= 0) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    
    const record = {
      id: Date.now().toString(),
      productName: form.productName,
      price: parseFloat(form.price),
      categoryId: categories[categoryIndex]?.id || 7,
      platform: platforms[platformIndex]?.id || 'other',
      orderTime: form.date,
      babyId: babies[babyIndex]?.id || '',
      remark: form.remark,
      createTime: new Date().toISOString()
    }
    
    this.saveRecord(record)
  },

  // 保存记录
  saveRecord(record) {
    const records = app.globalData.records || []
    records.unshift(record)
    app.saveData('records', records)
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    })
    
    // 重置表单
    this.setData({
      tempImagePath: '',
      recognizeResult: null,
      form: {
        productName: '',
        price: '',
        categoryId: 1,
        platform: 'taobao',
        date: new Date().toISOString().split('T')[0],
        babyId: '',
        remark: ''
      }
    })
    
    // 跳转到首页
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' })
    }, 1500)
  }
})
