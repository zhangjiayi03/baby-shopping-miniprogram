// pages/detail/detail.js
Page({
  data: {
    recordId: '',
    batchId: '',
    imageUrl: '',
    productName: '',
    price: '',
    priceDisplay: '',
    quantity: 1,
    unitPrice: '',
    unitPriceDisplay: '',
    categoryName: '',
    platformName: '',
    babyId: '',
    babyNickname: '',
    orderTime: '',
    createTime: '',
    
    isEditing: false,
    editData: {
      productName: '',
      price: '',
      quantity: 1,
      babyIndex: 0,
      categoryIndex: 0,
      platformIndex: 0,
      orderTime: ''
    },
    
    showBatchModal: false,
    batchCount: 0,
    pendingBabyId: '',
    
    babies: [
      { id: '', nickname: '不关联' }
    ],
    
    categories: [],
    platforms: []
  },

  onLoad(options) {
    const app = getApp();
    this.setData({
      categories: app.globalData.categories.filter(c => c.id !== 0),
      platforms: app.globalData.platforms.filter(p => p.id !== 0)
    });

    if (options.id) {
      this.setData({ recordId: options.id });
      this.loadBabies().then(() => {
        this.loadRecordDetail(options.id);
      });
    } else {
      wx.showToast({ title: '记录 ID 缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 加载宝宝列表
  async loadBabies() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'babies',
        data: { action: 'list' }
      });
      
      if (res.result && res.result.success) {
        const babies = [
          { id: '', nickname: '不关联' },
          ...res.result.data.map(b => ({ id: b._id, nickname: b.nickname }))
        ];
        this.setData({ babies });
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
  },

  // 加载记录详情
  async loadRecordDetail(recordId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: { action: 'get', id: recordId }
      });
      
      if (res.result && res.result.success) {
        this.setRecordData(res.result.data);
      } else {
        throw new Error('记录不存在');
      }
    } catch (error) {
      console.error('加载记录详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 设置记录数据
  setRecordData(data) {
    const categoryIndex = this.data.categories.findIndex(c => c.id === data.categoryId);
    const platformIndex = this.data.platforms.findIndex(p => p.id === data.platform);
    const babyIndex = this.data.babies.findIndex(b => b.id === (data.babyId || ''));
    
    const baby = this.data.babies.find(b => b.id === data.babyId);
    
    this.setData({
      batchId: data.batchId || '',
      imageUrl: data.imageUrl || '',
      productName: data.productName || '',
      price: data.price || '',
      priceDisplay: parseFloat(data.price || 0).toFixed(2),
      quantity: data.quantity || 1,
      unitPrice: data.unitPrice || '',
      unitPriceDisplay: data.unitPrice ? parseFloat(data.unitPrice).toFixed(2) : '',
      categoryName: this.data.categories[categoryIndex >= 0 ? categoryIndex : 6]?.name || '其他',
      platformName: this.data.platforms[platformIndex >= 0 ? platformIndex : 5]?.name || '其他',
      babyId: data.babyId || '',
      babyNickname: baby?.nickname || '',
      orderTime: data.orderTime || '',
      createTime: data.createTime || '',
      
      'editData.productName': data.productName || '',
      'editData.price': String(data.price || ''),
      'editData.quantity': String(data.quantity || 1),
      'editData.babyIndex': babyIndex >= 0 ? babyIndex : 0,
      'editData.categoryIndex': categoryIndex >= 0 ? categoryIndex : 6,
      'editData.platformIndex': platformIndex >= 0 ? platformIndex : 5,
      'editData.orderTime': data.orderTime || new Date().toISOString().split('T')[0]
    });
  },

  previewImage() {
    if (!this.data.imageUrl) return;
    wx.previewImage({ urls: [this.data.imageUrl], current: this.data.imageUrl });
  },

  startEdit() {
    this.setData({ isEditing: true });
  },

  cancelEdit() {
    const categoryIndex = this.data.categories.findIndex(c => c.name === this.data.categoryName);
    const platformIndex = this.data.platforms.findIndex(p => p.name === this.data.platformName);
    const babyIndex = this.data.babies.findIndex(b => b.id === this.data.babyId);
    
    this.setData({
      isEditing: false,
      'editData.productName': this.data.productName,
      'editData.price': String(this.data.price),
      'editData.quantity': String(this.data.quantity),
      'editData.babyIndex': babyIndex >= 0 ? babyIndex : 0,
      'editData.categoryIndex': categoryIndex >= 0 ? categoryIndex : 6,
      'editData.platformIndex': platformIndex >= 0 ? platformIndex : 5,
      'editData.orderTime': this.data.orderTime
    });
  },

  async saveEdit() {
    const { editData, batchId, recordId, babies } = this.data;
    
    if (!editData.productName?.trim()) {
      return wx.showToast({ title: '请输入商品名称', icon: 'none' });
    }
    
    const price = parseFloat(editData.price);
    if (isNaN(price) || price <= 0) {
      return wx.showToast({ title: '请输入有效价格', icon: 'none' });
    }
    
    const quantity = parseInt(editData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      return wx.showToast({ title: '请输入有效数量', icon: 'none' });
    }
    
    const newBabyId = babies[editData.babyIndex]?.id || '';
    const babyChanged = newBabyId !== this.data.babyId;
    
    // 如果宝宝变了且有批次ID，弹出询问
    if (babyChanged && batchId) {
      this.setData({
        showBatchModal: true,
        pendingBabyId: newBabyId,
        batchCount: 0
      });
      await this.getBatchCount(batchId);
      return;
    }
    
    // 直接保存
    await this.doSaveEdit(newBabyId, false);
  },

  // 获取同批次记录数
  async getBatchCount(batchId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'batchCount',
          data: { batchId, excludeId: this.data.recordId }
        }
      });
      
      if (res.result?.success) {
        this.setData({ batchCount: res.result.data.count });
      }
    } catch (error) {
      console.error('获取批次数量失败:', error);
    }
  },

  // 关闭批量弹窗，仅修改当前
  async closeBatchModal() {
    const newBabyId = this.data.pendingBabyId;
    this.setData({ showBatchModal: false });
    await this.doSaveEdit(newBabyId, false);
  },

  // 确认批量修改
  async confirmBatchUpdate() {
    const newBabyId = this.data.pendingBabyId;
    this.setData({ showBatchModal: false });
    await this.doSaveEdit(newBabyId, true);
  },

  // 执行保存
  async doSaveEdit(newBabyId, updateAll) {
    const { editData, recordId, babies, categories, platforms } = this.data;
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      if (updateAll) {
        const res = await wx.cloud.callFunction({
          name: 'record',
          data: {
            action: 'batchUpdateBaby',
            id: recordId,
            data: { babyId: newBabyId, updateAll: true }
          }
        });
        
        if (res.result?.success && res.result.data.updatedCount > 0) {
          wx.showToast({ title: `同步更新 ${res.result.data.updatedCount} 条`, icon: 'success' });
        }
      }
      
      // 更新当前记录其他字段
      const updateData = {
        productName: editData.productName.trim(),
        price: parseFloat(editData.price),
        quantity: parseInt(editData.quantity),
        categoryId: categories[editData.categoryIndex].id,
        platform: platforms[editData.platformIndex].id,
        babyId: newBabyId,
        orderTime: editData.orderTime
      };
      
      await wx.cloud.callFunction({
        name: 'record',
        data: { action: 'update', id: recordId, data: updateData }
      });
      
      wx.hideLoading();
      
      const baby = babies.find(b => b.id === newBabyId);
      const newUnitPrice = updateData.quantity > 0 ? parseFloat((updateData.price / updateData.quantity).toFixed(2)) : 0;
      this.setData({
        isEditing: false,
        productName: updateData.productName,
        price: updateData.price,
        priceDisplay: updateData.price.toFixed(2),
        quantity: updateData.quantity,
        unitPrice: newUnitPrice,
        unitPriceDisplay: newUnitPrice.toFixed(2),
        categoryName: categories[editData.categoryIndex].name,
        platformName: platforms[editData.platformIndex].name,
        babyId: newBabyId,
        babyNickname: baby?.nickname || '',
        orderTime: updateData.orderTime
      });
      
      wx.showToast({ title: '保存成功', icon: 'success' });
      
    } catch (error) {
      wx.hideLoading();
      console.error('保存失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async deleteRecord() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            const result = await wx.cloud.callFunction({
              name: 'record',
              data: { action: 'delete', id: this.data.recordId }
            });
            
            wx.hideLoading();
            if (result.result?.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              setTimeout(() => wx.navigateBack(), 1500);
            } else {
              wx.showToast({ title: result.result?.message || '删除失败', icon: 'none' });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 表单输入
  onProductNameInput(e) { this.setData({ 'editData.productName': e.detail.value }); },
  onPriceInput(e) { this.setData({ 'editData.price': e.detail.value }); },
  onQuantityInput(e) { this.setData({ 'editData.quantity': e.detail.value }); },
  onBabyChange(e) { this.setData({ 'editData.babyIndex': e.detail.value }); },
  onCategoryChange(e) { this.setData({ 'editData.categoryIndex': e.detail.value }); },
  onPlatformChange(e) { this.setData({ 'editData.platformIndex': e.detail.value }); },
  onDateChange(e) { this.setData({ 'editData.orderTime': e.detail.value }); }
});
