// pages/detail/detail.js
Page({
  data: {
    recordId: '',
    imageUrl: '',
    productName: '',
    price: '',
    quantity: 1,
    unitPrice: '',
    categoryName: '',
    platformName: '',
    orderTime: '',
    createTime: '',
    
    // 编辑相关
    isEditing: false,
    editData: {
      productName: '',
      price: '',
      quantity: 1,
      categoryIndex: 0,
      platformIndex: 0,
      orderTime: ''
    },
    
    // 分类选项
    categories: [
      { id: 1, name: '喂养' },
      { id: 2, name: '洗护' },
      { id: 3, name: '服装' },
      { id: 4, name: '玩具' },
      { id: 5, name: '医疗' },
      { id: 6, name: '教育' },
      { id: 7, name: '其他' }
    ],
    
    // 平台选项
    platforms: [
      { id: 'taobao', name: '淘宝' },
      { id: 'jd', name: '京东' },
      { id: 'pdd', name: '拼多多' },
      { id: 'douyin', name: '抖音' },
      { id: 'meituan', name: '美团' },
      { id: 'other', name: '其他' }
    ]
  },

  onLoad(options) {
    // 从参数获取记录 ID
    if (options.id) {
      this.setData({ recordId: options.id });
      this.loadRecordDetail(options.id);
    } else {
      wx.showToast({
        title: '记录 ID 缺失',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载记录详情
  async loadRecordDetail(recordId) {
    try {
      // TODO: 调用云函数获取记录详情
      // const res = await wx.cloud.callFunction({
      //   name: 'record',
      //   data: { action: 'get', id: recordId }
      // });
      
      // 模拟数据
      const mockData = {
        _id: recordId,
        productName: '示例商品',
        price: '99.00',
        quantity: 1,
        unitPrice: '99.00',
        categoryId: 1,
        platform: 'taobao',
        orderTime: '2026-04-01',
        imageUrl: '',
        createTime: '2026-04-01 12:00:00'
      };
      
      this.setRecordData(mockData);
    } catch (error) {
      console.error('加载记录详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 设置记录数据
  setRecordData(data) {
    const category = this.data.categories.find(c => c.id === data.categoryId) || this.data.categories[0];
    const platform = this.data.platforms.find(p => p.id === data.platform) || this.data.platforms[0];
    const categoryIndex = this.data.categories.findIndex(c => c.id === data.categoryId);
    const platformIndex = this.data.platforms.findIndex(p => p.id === data.platform);
    
    this.setData({
      imageUrl: data.imageUrl || '',
      productName: data.productName || '',
      price: data.price || '',
      quantity: data.quantity || 1,
      unitPrice: data.unitPrice || '',
      categoryName: category.name,
      platformName: platform.name,
      orderTime: data.orderTime || '',
      createTime: data.createTime || '',
      
      // 初始化编辑数据
      'editData.productName': data.productName || '',
      'editData.price': data.price || '',
      'editData.quantity': data.quantity || 1,
      'editData.categoryIndex': categoryIndex >= 0 ? categoryIndex : 0,
      'editData.platformIndex': platformIndex >= 0 ? platformIndex : 0,
      'editData.orderTime': data.orderTime || new Date().toISOString().split('T')[0]
    });
  },

  // 预览图片
  previewImage() {
    if (!this.data.imageUrl) return;
    
    wx.previewImage({
      urls: [this.data.imageUrl],
      current: this.data.imageUrl
    });
  },

  // 开始编辑
  startEdit() {
    this.setData({ isEditing: true });
  },

  // 取消编辑
  cancelEdit() {
    // 恢复原始数据
    this.setData({
      isEditing: false,
      'editData.productName': this.data.productName,
      'editData.price': this.data.price,
      'editData.quantity': this.data.quantity,
      'editData.orderTime': this.data.orderTime
    });
    
    // 重新查找分类和平台的索引
    const category = this.data.categories.find(c => c.name === this.data.categoryName);
    const platform = this.data.platforms.find(p => p.name === this.data.platformName);
    const categoryIndex = this.data.categories.findIndex(c => c.name === this.data.categoryName);
    const platformIndex = this.data.platforms.findIndex(p => p.name === this.data.platformName);
    
    this.setData({
      'editData.categoryIndex': categoryIndex >= 0 ? categoryIndex : 0,
      'editData.platformIndex': platformIndex >= 0 ? platformIndex : 0
    });
  },

  // 保存编辑
  async saveEdit() {
    const { editData } = this.data;
    
    // 表单验证
    if (!editData.productName || !editData.productName.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }
    
    if (!editData.price || parseFloat(editData.price) <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' });
      return;
    }
    
    if (!editData.quantity || parseInt(editData.quantity) <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      // 准备更新数据
      const updateData = {
        productName: editData.productName.trim(),
        price: editData.price,
        quantity: parseInt(editData.quantity),
        categoryId: this.data.categories[editData.categoryIndex].id,
        platform: this.data.platforms[editData.platformIndex].id,
        orderTime: editData.orderTime,
        updateTime: new Date().toISOString()
      };
      
      // 计算单价
      updateData.unitPrice = (parseFloat(editData.price) / parseInt(editData.quantity)).toFixed(2);
      
      // TODO: 调用云函数更新记录
      // const res = await wx.cloud.callFunction({
      //   name: 'record',
      //   data: { 
      //     action: 'update', 
      //     id: this.data.recordId,
      //     data: updateData 
      //   }
      // });
      
      // 模拟更新成功
      await new Promise(resolve => setTimeout(resolve, 500));
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      // 更新页面显示
      const category = this.data.categories[editData.categoryIndex];
      const platform = this.data.platforms[editData.platformIndex];
      
      this.setData({
        isEditing: false,
        productName: updateData.productName,
        price: updateData.price,
        quantity: updateData.quantity,
        unitPrice: updateData.unitPrice,
        categoryName: category.name,
        platformName: platform.name,
        orderTime: updateData.orderTime
      });
      
    } catch (error) {
      console.error('保存编辑失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 删除记录
  async deleteRecord() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？删除后无法恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            
            // TODO: 调用云函数删除记录
            // const res = await wx.cloud.callFunction({
            //   name: 'record',
            //   data: { action: 'delete', id: this.data.recordId }
            // });
            
            // 模拟删除
            await new Promise(resolve => setTimeout(resolve, 500));
            
            wx.hideLoading();
            wx.showToast({ title: '删除成功', icon: 'success' });
            
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
            
          } catch (error) {
            console.error('删除记录失败:', error);
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 表单输入处理
  onProductNameInput(e) {
    this.setData({
      'editData.productName': e.detail.value
    });
  },

  onPriceInput(e) {
    this.setData({
      'editData.price': e.detail.value
    });
  },

  onQuantityInput(e) {
    this.setData({
      'editData.quantity': e.detail.value
    });
  },

  onCategoryChange(e) {
    this.setData({
      'editData.categoryIndex': e.detail.value
    });
  },

  onPlatformChange(e) {
    this.setData({
      'editData.platformIndex': e.detail.value
    });
  },

  onDateChange(e) {
    this.setData({
      'editData.orderTime': e.detail.value
    });
  }
});
