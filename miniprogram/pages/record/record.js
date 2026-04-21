// pages/record/record.js
Page({
  data: {
    imageList: [],
    recognitionResult: null,
    editDialogVisible: false,
    editDialogData: {},
    
    categories: [],
    platforms: []
  },

  onLoad() {
    const app = getApp();
    this.setData({
      categories: app.globalData.categories.filter(c => c.id !== 0),
      platforms: app.globalData.platforms.filter(p => p.id !== 0)
    });
  },

  // 选择图片（单张）
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          imageList: [...this.data.imageList, tempFilePath]
        });
        
        this.uploadAndRecognize(tempFilePath);
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
        
        let priceValue = parseFloat(ocrData.data.price)
        console.log('原始价格:', ocrData.data.price, '解析后:', priceValue)
        if (isNaN(priceValue) || priceValue < 0 || priceValue > 10000) {
          console.log('⚠️ 价格无效，使用默认值 0')
          priceValue = 0
        }
        
        const categoryId = parseInt(ocrData.data.categoryId) || 7
        const platform = ocrData.data.platform || 'jd'
        
        console.log('分类 ID:', categoryId, '平台:', platform)
        
        const categoryObj = this.data.categories.find(c => c.id === categoryId)
        const categoryName = categoryObj ? categoryObj.name : '其他'
        
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
          orderTime: new Date().toISOString().split('T')[0],
          imageUrl: fileID
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
    
    if (!editedData.categoryName) {
      const cat = this.data.categories.find(c => c.id === editedData.categoryId);
      editedData.categoryName = cat ? cat.name : '其他';
    }
    if (!editedData.platformName) {
      const plat = this.data.platforms.find(p => p.id === editedData.platform);
      editedData.platformName = plat ? plat.name : '其他';
    }
    
    this.setData({
      recognitionResult: { ...this.data.recognitionResult, ...editedData },
      editDialogVisible: false
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
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'create',
          data: {
            ...this.data.recognitionResult
          }
        }
      });
      
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ imageList: [], recognitionResult: null });
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
  }
});
