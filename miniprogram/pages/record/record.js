// pages/record/record.js
Page({
  data: {
    imageList: [],
    recognitionResult: null,
    editDialogVisible: false,
    editDialogData: {},
    
    // 分类和平台映射
    categories: [
      { id: 1, name: '喂养' },
      { id: 2, name: '洗护' },
      { id: 3, name: '服装' },
      { id: 4, name: '玩具' },
      { id: 5, name: '医疗' },
      { id: 6, name: '教育' },
      { id: 7, name: '其他' }
    ],
    platforms: [
      { id: 'taobao', name: '淘宝' },
      { id: 'jd', name: '京东' },
      { id: 'pdd', name: '拼多多' },
      { id: 'douyin', name: '抖音' },
      { id: 'meituan', name: '美团' },
      { id: 'other', name: '其他' }
    ]
  },

  onLoad() {
    // 页面加载时的初始化
  },

  // 选择图片（单张）
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        this.setData({
          imageList: [...this.data.imageList, ...tempFilePaths]
        });
        
        // 上传图片并识别
        this.uploadAndRecognize(tempFilePaths[0]);
      }
    });
  },

  // 跳转批量上传页面
  goBatchUpload() {
    wx.navigateTo({
      url: '/pages/batch-upload/batch-upload'
    });
  },

  // 移除图片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = this.data.imageList;
    imageList.splice(index, 1);
    this.setData({ imageList });
  },

  // 上传图片并识别
  async uploadAndRecognize(imagePath) {
    wx.showLoading({ title: '识别中...' });
    
    try {
      // 上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `records/${Date.now()}_${Math.random()}.jpg`,
        filePath: imagePath
      });
      
      const fileID = uploadRes.fileID;
      
      // 调用 OCR 云函数
      const ocrRes = await wx.cloud.callFunction({
        name: 'ocr',
        data: {
          imgUrl: fileID
        }
      });
      
      const ocrData = ocrRes.result;
      
      if (ocrData.success) {
        console.log('OCR 识别成功:', ocrData.data)
        
        // 严格验证价格 - 必须是有效数字
        let priceValue = parseFloat(ocrData.data.price)
        console.log('原始价格:', ocrData.data.price, '解析后:', priceValue)
        if (isNaN(priceValue) || priceValue < 0 || priceValue > 10000) {
          console.log('⚠️ 价格无效，使用默认值 0')
          priceValue = 0
        }
        
        // 确保分类 ID 是数字
        const categoryId = parseInt(ocrData.data.categoryId) || 7
        const platform = ocrData.data.platform || 'jd'
        
        console.log('分类 ID:', categoryId, '平台:', platform)
        
        // 计算分类名称
        const categoryObj = this.data.categories.find(c => c.id === categoryId)
        const categoryName = categoryObj ? categoryObj.name : '其他'
        
        // 计算平台名称
        const platformObj = this.data.platforms.find(p => p.id === platform)
        const platformName = platformObj ? platformObj.name : '京东'
        
        console.log('分类名称:', categoryName, '平台名称:', platformName)
        
        const result = {
          productName: ocrData.data.productName || '未识别商品',
          price: priceValue.toFixed(2),
          quantity: parseInt(ocrData.data.quantity) || 1,
          categoryId: categoryId,
          categoryName: categoryName,
          platform: platform,
          platformName: platformName,
          orderTime: new Date().toISOString().split('T')[0]
        }
        console.log('📦 最终识别结果:', result)
        this.setData({
          recognitionResult: result
        }, () => {
          console.log('✅ setData 完成')
          console.log('当前 recognitionResult:', {
            price: this.data.recognitionResult.price,
            categoryName: this.data.recognitionResult.categoryName,
            platformName: this.data.recognitionResult.platformName
          })
        })
      } else {
        throw new Error(ocrData.error || '识别失败');
      }
      
      wx.hideLoading();
    } catch (error) {
      console.error('识别失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '识别失败，请重试',
        icon: 'none'
      });
    }
  },

  // 显示编辑弹窗
  showEditDialog() {
    console.log('🔧 点击编辑按钮，当前 recognitionResult:', this.data.recognitionResult)
    if (!this.data.recognitionResult) {
      wx.showToast({ title: '没有可编辑的数据', icon: 'none' })
      return
    }
    this.setData({
      editDialogData: this.data.recognitionResult,
      editDialogVisible: true
    }, () => {
      console.log('✅ 编辑弹窗已打开，editDialogVisible:', this.data.editDialogVisible)
    })
  },

  // 隐藏编辑弹窗
  hideEditDialog() {
    this.setData({
      editDialogVisible: false
    });
  },

  // 编辑确认
  onEditConfirm(e) {
    const editedData = e.detail;
    console.log('✏️ 编辑确认收到数据:', editedData);
    
    // 确保分类名和平台名存在
    if (!editedData.categoryName) {
      const cat = this.data.categories.find(c => c.id === editedData.categoryId);
      editedData.categoryName = cat ? cat.name : '其他';
    }
    if (!editedData.platformName) {
      const plat = this.data.platforms.find(p => p.id === editedData.platform);
      editedData.platformName = plat ? plat.name : '京东';
    }
    
    this.setData({
      recognitionResult: editedData,
      editDialogVisible: false
    }, () => {
      console.log('✅ 编辑后更新 recognitionResult:', {
        categoryId: this.data.recognitionResult.categoryId,
        categoryName: this.data.recognitionResult.categoryName,
        platform: this.data.recognitionResult.platform,
        platformName: this.data.recognitionResult.platformName
      });
    });
    
    wx.showToast({
      title: '修改成功',
      icon: 'success'
    });
  },

  // 保存记录
  async saveRecord() {
    if (!this.data.recognitionResult) {
      wx.showToast({ title: '没有可保存的数据', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      let imageUrl = '';
      if (this.data.imageList.length > 0) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `records/${Date.now()}_${Math.random()}.jpg`,
          filePath: this.data.imageList[0]
        });
        imageUrl = uploadRes.fileID;
      }
      
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'create',
          data: {
            ...this.data.recognitionResult,
            imageUrl: imageUrl
          }
        }
      });
      
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ imageList: [], recognitionResult: null });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        throw new Error(res.result?.message || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  // 重新识别
  retryRecognition() {
    if (this.data.imageList.length === 0) {
      wx.showToast({
        title: '请先上传图片',
        icon: 'none'
      });
      return;
    }
    
    this.uploadAndRecognize(this.data.imageList[0]);
  },

  // 获取分类名称
  getCategoryName(categoryId) {
    console.log('getCategoryName 被调用，categoryId:', categoryId, '类型:', typeof categoryId)
    if (!categoryId) return '其他'
    // 确保类型匹配（categoryId 可能是字符串）
    const categoryIdNum = parseInt(categoryId)
    const category = this.data.categories.find(c => c.id === categoryIdNum)
    console.log('查找分类结果:', category)
    return category ? category.name : '其他'
  },

  // 获取平台名称
  getPlatformName(platform) {
    console.log('getPlatformName 被调用，platform:', platform)
    if (!platform) return '京东'
    const platformItem = this.data.platforms.find(p => p.id === platform)
    console.log('查找平台结果:', platformItem)
    return platformItem ? platformItem.name : '京东'
  }
});
