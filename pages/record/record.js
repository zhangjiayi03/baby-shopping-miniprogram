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
      { id: 'meituan', name: '美团' },
      { id: 'other', name: '其他' }
    ],
    categories: [],
    babies: [{ id: '', name: '不指定' }],
    tempImagePath: '',
    recognizeResult: null,
    isRecognizing: false,
    debugInfo: '', // 调试信息
    
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
    this.setData({ isRecognizing: true, debugInfo: '' })
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
      
      console.log('图片上传成功:', uploadResult.fileID)
      
      // 调用云函数进行 OCR
      const result = await wx.cloud.callFunction({
        name: 'ocr',
        data: {
          type: 'order',
          imgUrl: uploadResult.fileID
        }
      })
      
      wx.hideLoading()
      console.log('OCR 结果:', result.result)
      
      if (result.result && result.result.success) {
        const ocrData = result.result.data
        
        // 直接使用云函数返回的解析结果
        const recognized = {
          productName: ocrData.productName || '未识别商品',
          price: ocrData.price || '0.00',
          quantity: ocrData.quantity || 1,
          unitPrice: ocrData.unitPrice || ocrData.price || '0.00',
          platform: ocrData.platform || this.data.selectedPlatform || 'other',
          platformName: this.getPlatformName(ocrData.platform || this.data.selectedPlatform || 'other'),
          orderTime: ocrData.orderTime || new Date().toISOString().split('T')[0],
          categoryId: ocrData.categoryId || 7,
          categoryIcon: this.getCategoryIcon(ocrData.categoryId || 7),
          categoryName: this.getCategoryName(ocrData.categoryId || 7)
        }
        
        // 保存调试信息
        let debugInfo = ''
        if (ocrData.rawText) {
          debugInfo = '原始文字:\n' + ocrData.rawText.substring(0, 200)
        }
        
        this.setData({
          recognizeResult: recognized,
          isRecognizing: false,
          selectedCategory: recognized.categoryId,
          debugInfo: debugInfo
        })
        
        // 如果识别结果不完整，提示用户
        if (!ocrData.productName || ocrData.productName === '未识别商品') {
          wx.showToast({
            title: '商品名未识别，请手动修改',
            icon: 'none',
            duration: 2000
          })
        }
        
      } else {
        throw new Error(result.result?.error || '识别失败')
      }
    } catch (err) {
      console.error('OCR识别失败:', err)
      wx.hideLoading()
      this.setData({ isRecognizing: false })
      
      // 识别失败，提示用户
      wx.showModal({
        title: '识别失败',
        content: `${err.message || '无法识别图片内容'}\n\n请尝试手动输入`,
        showCancel: true,
        cancelText: '取消',
        confirmText: '手动输入',
        success: (res) => {
          if (res.confirm) {
            this.setData({ activeTab: 'manual' })
          }
        }
      })
    }
  },

  // 获取分类图标
  getCategoryIcon(categoryId) {
    const category = this.data.categories.find(c => c.id === categoryId)
    return category ? category.icon : '📦'
  },

  // 获取分类名称
  getCategoryName(categoryId) {
    const category = this.data.categories.find(c => c.id === categoryId)
    return category ? category.name : '其他'
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

  // 编辑识别结果中的商品名
  onEditProductName(e) {
    this.setData({
      'recognizeResult.productName': e.detail.value
    })
  },

  // 编辑识别结果中的价格
  onEditPrice(e) {
    this.setData({
      'recognizeResult.price': e.detail.value
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
    
    // 检查价格是否有效
    const price = parseFloat(recognizeResult.price)
    if (isNaN(price) || price <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    
    const record = {
      id: Date.now().toString(),
      productName: recognizeResult.productName,
      price: price,
      quantity: recognizeResult.quantity || 1,
      unitPrice: parseFloat(recognizeResult.unitPrice) || price,
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
      debugInfo: '',
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
