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
      // TODO: 调用 OCR 识别接口
      // 这里先模拟识别结果
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResult = {
        productName: '示例商品名称',
        price: '99.00',
        quantity: 1,
        categoryId: 1,
        platform: 'taobao',
        orderTime: new Date().toISOString().split('T')[0]
      };
      
      this.setData({
        recognitionResult: mockResult
      });
      
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
    this.setData({
      editDialogData: this.data.recognitionResult,
      editDialogVisible: true
    });
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
    this.setData({
      recognitionResult: editedData,
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
    const category = this.data.categories.find(c => c.id === categoryId);
    return category ? category.name : '未知';
  },

  // 获取平台名称
  getPlatformName(platform) {
    const platformItem = this.data.platforms.find(p => p.id === platform);
    return platformItem ? platformItem.name : '未知';
  }
});
