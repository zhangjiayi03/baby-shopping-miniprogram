  Page({
  /**
   * 页面的初始数据
   */
  data: {
    imageList: [],
    statusList: [],
    resultList: [],
    processing: false,
    editDialogVisible: false,
    editDialogData: null,
    successCount: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('📄 batch-upload 页面加载');
  },

  /**
   * 选择图片
   */
  async chooseImages() {
    const { imageList = [] } = this.data;
    const remaining = 9 - imageList.length;

    if (remaining <= 0) {
      wx.showToast({ title: '最多选择 9 张图片', icon: 'none' });
      return;
    }

    try {
      const res = await wx.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      const newImages = res.tempFilePaths;
      this.setData({
        imageList: [...imageList, ...newImages],
        statusList: new Array(imageList.length + newImages.length).fill(null)
      });

      console.log('📸 已选择图片:', newImages.length, '张');
    } catch (err) {
      console.error('选择图片失败:', err);
      wx.showToast({ title: '选择失败', icon: 'none' });
    }
  },

  /**
   * 删除单张图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const { imageList, statusList } = this.data;

    const newList = imageList.filter((_, i) => i !== index);
    const newStatusList = statusList.filter((_, i) => i !== index);

    this.setData({
      imageList: newList,
      statusList: newStatusList
    });

    console.log('🗑️ 删除图片，index:', index);
  },

  /**
   * 清空所有图片
   */
  clearImages() {
    this.setData({
      imageList: [],
      statusList: []
    });
    console.log('🧹 清空所有图片');
  },

  /**
   * 预览图片
   */
  previewImages() {
    const { imageList } = this.data;
    if (imageList.length === 0) return;

    wx.previewImage({
      urls: imageList,
      current: imageList[0]
    });
  },

  /**
   * 开始批量识别
   */
  async startBatch() {
    const { imageList, processing } = this.data;
    
    if (imageList.length === 0) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    if (processing) {
      wx.showToast({ title: '正在识别中...', icon: 'none' });
      return;
    }

    this.setData({ processing: true });
    wx.showLoading({ title: '正在识别...', mask: true });

    try {
      // 调用 OCR 识别
      const results = await this.ocrBatch(imageList);
      this.setData({
        resultList: results,
        processing: false,
        successCount: results.filter(r => r.status === 'success').length
      });
      wx.hideLoading();
      console.log('✅ 批量识别完成，成功:', results.filter(r => r.status === 'success').length);
    } catch (err) {
      console.error('识别失败:', err);
      this.setData({ processing: false });
      wx.hideLoading();
      wx.showToast({ title: '识别失败，请重试', icon: 'none' });
    }
  },

  /**
   * OCR 批量识别
   */
  async ocrBatch(imageList) {
    const results = [];
    const baseTime = Date.now();
    
    for (let i = 0; i < imageList.length; i++) {
      const imagePath = imageList[i];
      try {
        // 上传图片到云存储（添加随机数避免冲突）
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `order_images/${baseTime}_${i}_${Math.random().toString(36).substring(2, 8)}.jpg`,
          filePath: imagePath,
        });

        // 调用 OCR 云函数
        const ocrRes = await wx.cloud.callFunction({
          name: 'ocr',
          data: {
            action: 'recognize',
            imgUrl: uploadRes.fileID  // 改为 imgUrl，与云函数参数匹配
          }
        });

        console.log('🔍 OCR 云函数返回:', JSON.stringify(ocrRes.result, null, 2));
        
        if (ocrRes.result && ocrRes.result.success && ocrRes.result.data) {
          console.log('✅ 识别成功，data:', ocrRes.result.data);
          // 确保数据结构完整
          const ocrData = ocrRes.result.data;
          const normalizedData = {
            productName: String(ocrData.productName || '未识别商品'),
            price: parseFloat(ocrData.price) || 0,
            quantity: parseInt(ocrData.quantity) || 1,
            categoryId: parseInt(ocrData.categoryId) || 7,
            platform: String(ocrData.platform || 'other'),
            orderTime: String(ocrData.orderTime || new Date().toISOString().split('T')[0])
          };
          
          console.log('📦 标准化后的数据:', normalizedData);
          
          results.push({
            index: i,
            status: 'success',
            icon: '✅',
            statusText: '识别成功',
            data: normalizedData,
            error: null
          });
        } else {
          console.error('❌ 识别失败，result:', ocrRes.result);
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

  /**
   * 编辑记录
   */
  editRecord(e) {
    const index = e.currentTarget.dataset.index;
    const { resultList } = this.data;
    const item = resultList[index];

    if (!item || !item.data) return;

    this.setData({
      editDialogVisible: true,
      editDialogData: item.data
    });

    console.log('✏️ 编辑记录，index:', index);
  },

  /**
   * 隐藏编辑弹窗
   */
  hideEditDialog() {
    this.setData({
      editDialogVisible: false,
      editDialogData: null
    });
  },

  /**
   * 编辑确认
   */
  onEditConfirm(e) {
    const { index, data } = e.detail;
    const { resultList } = this.data;

    if (resultList[index]) {
      const newList = [...resultList];
      newList[index] = {
        ...newList[index],
        data: data
      };
      this.setData({ resultList: newList });
    }

    this.hideEditDialog();
    console.log('✅ 编辑完成，index:', index);
  },

  /**
   * 保存单条记录
   */
  async saveRecord(e) {
    const index = e.currentTarget.dataset.index;
    const { resultList } = this.data;
    
    console.log('💾 保存单条，index:', index);
    console.log('resultList 长度:', resultList.length);
    console.log('resultList:', JSON.stringify(resultList, null, 2));
    console.log('resultList[' + index + ']:', resultList[index]);
    console.log('typeof index:', typeof index, 'value:', index);
    
    // 确保 index 是数字
    const numericIndex = parseInt(index);
    if (isNaN(numericIndex)) {
      console.error('❌ index 不是数字:', index);
      wx.showToast({ title: '索引错误，请重试', icon: 'none' });
      return;
    }
    
    const item = resultList[numericIndex];

    // 安全检查
    if (!item) {
      console.error('❌ item 为空，index:', numericIndex, 'resultList 长度:', resultList.length);
      wx.showToast({ title: '数据为空，请重试', icon: 'none' });
      return;
    }

    if (!item.data) {
      console.error('❌ item.data 为空');
      console.error('完整 item:', JSON.stringify(item, null, 2));
      wx.showToast({ title: '数据格式错误，请重新识别', icon: 'none' });
      return;
    }

    // 数据已经在 ocrBatch 中标准化，直接使用
    const dataToSave = item.data;

    wx.showLoading({ title: '保存中...' });

    try {
      console.log('📤 发送到云函数的数据:', dataToSave);
      
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'create',
          data: dataToSave  // 字段名改为 data，与云函数保持一致
        }
      });

      console.log('📥 云函数返回:', res);
      console.log('res.result:', res.result);

      if (res.result && res.result.success) {
        // 更新状态为已保存
        const newList = [...this.data.resultList];
        newList[index] = {
          ...item,
          status: 'saved',
          icon: '💾',
          statusText: '已保存'
        };

        this.setData({ 
          resultList: newList,
          successCount: newList.filter(r => r.status === 'success').length
        });

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        throw new Error(res.result?.message || '保存失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
      wx.showToast({
        title: '保存失败：' + (err.message || '未知错误'),
        icon: 'none'
      });
    }

    wx.hideLoading();
  },

  /**
   * 批量保存所有成功识别的记录
   */
  async saveAll() {
    const { resultList } = this.data;
    
    // 过滤出成功且有数据的记录
    const successItems = resultList.filter(item => 
      item.status === 'success' && item.data && typeof item.data === 'object'
    );

    if (successItems.length === 0) {
      wx.showToast({
        title: '没有可保存的记录',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: `保存中 (0/${successItems.length})...`,
      mask: true
    });

    let savedCount = 0;
    
    // 串行保存，避免并发问题
    for (let i = 0; i < successItems.length; i++) {
      const item = successItems[i];
      try {
        // 数据已经在 ocrBatch 中标准化，直接使用
        const res = await wx.cloud.callFunction({
          name: 'record',
          data: {
            action: 'create',
            data: item.data  // 字段名改为 data，与云函数保持一致
          }
        });

        console.log(`📝 保存第 ${i + 1} 条，云函数返回:`, JSON.stringify(res.result, null, 2));
        
        if (res.result && res.result.success) {
          savedCount++;
          console.log(`✅ 保存成功，已保存 ${savedCount}/${successItems.length}`);
          // 更新状态
          const newList = [...this.data.resultList];
          const targetIndex = newList.findIndex(r => r.index === item.index);
          if (targetIndex >= 0) {
            newList[targetIndex] = {
              ...item,
              status: 'saved',
              icon: '💾',
              statusText: '已保存'
            };
            this.setData({ 
              resultList: newList,
              successCount: newList.filter(r => r.status === 'success').length
            });
          }
        } else {
          console.error(`❌ 保存失败，result:`, res.result);
          wx.showToast({
            title: `第 ${i + 1} 条保存失败：${res.result?.message || '未知错误'}`,
            icon: 'none',
            duration: 2000
          });
        }
      } catch (err) {
        console.error(`❌ 保存第 ${i + 1} 条异常:`, err);
        wx.showToast({
          title: `保存异常：${err.message}`,
          icon: 'none',
          duration: 2000
        });
      }

      // 更新进度
      wx.showLoading({
        title: `保存中 (${savedCount}/${successItems.length})...`,
        mask: true
      });
    }

    wx.hideLoading();

    if (savedCount > 0) {
      wx.showToast({
        title: `成功保存 ${savedCount} 条`,
        icon: 'success',
        duration: 2000
      });
      
      // 1.5 秒后询问是否跳转首页查看
      setTimeout(() => {
        wx.showModal({
          title: '保存完成',
          content: `成功保存 ${savedCount} 条记录，是否查看？`,
          success: (res) => {
            if (res.confirm) {
              console.log('🔄 跳转到首页查看记录');
              wx.switchTab({
                url: '/pages/index/index'
              });
            }
          }
        });
      }, 1500);
    } else {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 页面相关事件处理函数
   */
  handleTouchStart() {
    console.log('触摸开始');
  }
});
