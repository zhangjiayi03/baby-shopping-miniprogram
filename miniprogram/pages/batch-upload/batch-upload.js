Page({
  data: {
    imageList: [],
    statusList: [],
    resultList: [],
    processing: false,
    editDialogVisible: false,
    editDialogData: null,
    editIndex: -1,
    successCount: 0,
    
    // 宝宝选择
    babies: [{ id: '', nickname: '请先添加宝宝信息' }],
    selectedBabyIndex: 0,
    selectedBabyId: ''
  },

  onLoad(options) {
    console.log('📄 batch-upload 页面加载');
    this.loadBabies();
  },

  // 加载宝宝列表
  async loadBabies() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'babies',
        data: { action: 'list' }
      });

      if (res.result && res.result.success && res.result.data.length > 0) {
        const babies = res.result.data.map(b => ({
          id: b._id,
          nickname: b.nickname
        }));
        this.setData({
          babies: babies,
          selectedBabyIndex: 0,
          selectedBabyId: babies[0].id
        });
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
  },

  // 选择宝宝
  onBabyChange(e) {
    const index = e.detail.value;
    const baby = this.data.babies[index];
    this.setData({
      selectedBabyIndex: index,
      selectedBabyId: baby.id
    });
  },

  async chooseImages() {
    const { imageList = [] } = this.data;
    const remaining = 9 - imageList.length;

    if (remaining <= 0) {
      wx.showToast({ title: '最多选择 9 张图片', icon: 'none' });
      return;
    }

    try {
      const res = await wx.chooseMedia({
        count: remaining,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      const newImages = res.tempFiles.map(f => f.tempFilePath);
      this.setData({
        imageList: [...imageList, ...newImages],
        statusList: new Array(imageList.length + newImages.length).fill(null)
      });
    } catch (err) {
      console.error('选择图片失败:', err);
    }
  },

  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const { imageList, statusList } = this.data;
    this.setData({
      imageList: imageList.filter((_, i) => i !== index),
      statusList: statusList.filter((_, i) => i !== index)
    });
  },

  clearImages() {
    this.setData({ imageList: [], statusList: [], resultList: [] });
  },

  previewImages() {
    const { imageList } = this.data;
    if (imageList.length === 0) return;
    wx.previewImage({ urls: imageList, current: imageList[0] });
  },

  async startBatch() {
    const { imageList, processing, selectedBabyId, babies } = this.data;
    
    if (imageList.length === 0) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    if (processing) return;

    // 检查是否选择了宝宝
    if (!selectedBabyId && babies.length > 0 && babies[0].id) {
      const res = await new Promise(resolve => {
        wx.showModal({
          title: '提示',
          content: '您还没有选择宝宝，是否继续？',
          success: resolve
        });
      });
      if (!res.confirm) return;
    }

    this.setData({ processing: true });
    wx.showLoading({ title: '识别中...', mask: true });

    try {
      const results = await this.ocrBatch(imageList);
      
      // 给每个结果添加 babyId
      const processedResults = results.map(r => ({
        ...r,
        data: r.data ? { ...r.data, babyId: selectedBabyId } : null
      }));
      
      this.setData({
        resultList: processedResults,
        processing: false,
        successCount: processedResults.filter(r => r.status === 'success').length
      });
      wx.hideLoading();
    } catch (err) {
      console.error('识别失败:', err);
      this.setData({ processing: false });
      wx.hideLoading();
      wx.showToast({ title: '识别失败', icon: 'none' });
    }
  },

  async ocrBatch(imageList) {
    const results = [];
    const baseTime = Date.now();
    
    for (let i = 0; i < imageList.length; i++) {
      const imagePath = imageList[i];
      try {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `order_images/${baseTime}_${i}_${Math.random().toString(36).substring(2, 8)}.jpg`,
          filePath: imagePath,
        });

        const ocrRes = await wx.cloud.callFunction({
          name: 'ocr',
          data: { imgUrl: uploadRes.fileID }
        });

        if (ocrRes.result && ocrRes.result.success && ocrRes.result.data) {
          const ocrData = ocrRes.result.data;
          results.push({
            index: i,
            status: 'success',
            icon: '✅',
            statusText: '识别成功',
            data: {
              productName: String(ocrData.productName || '未识别商品'),
              price: parseFloat(ocrData.price) || 0,
              priceDisplay: (parseFloat(ocrData.price) || 0).toFixed(2),
              quantity: parseInt(ocrData.quantity) || 1,
              categoryId: parseInt(ocrData.categoryId) || 7,
              platform: String(ocrData.platform || 'other'),
              orderTime: String(ocrData.orderTime || new Date().toISOString().split('T')[0]),
              imageUrl: uploadRes.fileID
            }
          });
        } else {
          results.push({
            index: i,
            status: 'error',
            icon: '❌',
            statusText: '识别失败',
            data: null,
            error: ocrRes.result?.message || '识别失败'
          });
        }
      } catch (err) {
        results.push({
          index: i,
          status: 'error',
          icon: '❌',
          statusText: '识别失败',
          data: null,
          error: err.message || '网络错误'
        });
      }
    }

    return results;
  },

  editRecord(e) {
    const index = e.currentTarget.dataset.index;
    const { resultList } = this.data;
    const item = resultList[index];
    if (!item?.data) return;

    this.setData({
      editDialogVisible: true,
      editDialogData: item.data,
      editIndex: index
    });
  },

  hideEditDialog() {
    this.setData({ editDialogVisible: false, editDialogData: null });
  },

  onEditConfirm(e) {
    const data = e.detail;
    const { resultList, editIndex } = this.data;
    if (editIndex >= 0 && resultList[editIndex]) {
      const newList = [...resultList];
      const originalData = newList[editIndex].data || {};
      const mergedData = { ...originalData, ...data };
      if (data.price !== undefined) {
        mergedData.priceDisplay = parseFloat(data.price).toFixed(2);
      }
      newList[editIndex] = { ...newList[editIndex], data: mergedData };
      this.setData({ resultList: newList, editIndex: -1 });
    }
    this.hideEditDialog();
  },

  async saveRecord(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const { resultList, selectedBabyId } = this.data;
    const item = resultList[index];

    if (!item?.data) {
      return wx.showToast({ title: '数据为空', icon: 'none' });
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const dataToSave = { ...item.data, babyId: selectedBabyId };
      
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: { action: 'create', data: dataToSave }
      });

      if (res.result?.success) {
        const newList = [...resultList];
        newList[index] = { ...item, status: 'saved', icon: '💾', statusText: '已保存' };
        this.setData({ resultList: newList });
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        throw new Error(res.result?.message || '保存失败');
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }

    wx.hideLoading();
  },

  async saveAll() {
    const { resultList, selectedBabyId } = this.data;
    const successItems = resultList.filter(item => item.status === 'success' && item.data);

    if (successItems.length === 0) {
      return wx.showToast({ title: '没有可保存的记录', icon: 'none' });
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const records = successItems.map(item => ({
        ...item.data,
        babyId: selectedBabyId
      }));

      const res = await wx.cloud.callFunction({
        name: 'record',
        data: { action: 'batchCreate', data: records }
      });

      if (res.result?.success) {
        const savedCount = res.result.data.count;
        const newList = resultList.map(item => {
          if (item.status === 'success' && item.data) {
            return { ...item, status: 'saved', icon: '💾', statusText: '已保存' };
          }
          return item;
        });
        this.setData({ resultList: newList });

        wx.hideLoading();
        wx.showModal({
          title: '保存完成',
          content: `成功保存 ${savedCount} 条记录，是否查看？`,
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({ url: '/pages/index/index' });
            }
          }
        });
      } else {
        throw new Error(res.result?.message || '批量保存失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('批量保存失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  handleTouchStart() {}
});
