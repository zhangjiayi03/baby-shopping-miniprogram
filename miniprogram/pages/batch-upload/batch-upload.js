// pages/batch-upload/batch-upload.js
Page({
  data: {
    imageList: [],
    statusList: [], // 每张图的识别状态
    resultList: [], // 识别结果
    processing: false,
    maxCount: 9
  },

  onLoad(options) {
    // 可选：从上一个页面传递的初始化数据
  },

  /**
   * 选择图片
   */
  async chooseImages() {
    const { imageList, maxCount } = this.data;
    const remaining = maxCount - imageList.length;

    if (remaining <= 0) {
      wx.showToast({
        title: `最多选择 ${maxCount} 张图片`,
        icon: 'none'
      });
      return;
    }

    try {
      const res = await wx.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const newImages = res.tempFilePaths;
      const newStatusList = newImages.map(() => ({
        icon: '⏳',
        text: '待识别'
      }));

      this.setData({
        imageList: [...imageList, ...newImages],
        statusList: [...this.data.statusList, ...newStatusList]
      });
    } catch (err) {
      console.error('选择图片失败:', err);
      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  },

  /**
   * 删除单张图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const { imageList, statusList } = this.data;

    imageList.splice(index, 1);
    statusList.splice(index, 1);

    this.setData({
      imageList,
      statusList
    });
  },

  /**
   * 清空所有图片
   */
  clearImages() {
    this.setData({
      imageList: [],
      statusList: [],
      resultList: []
    });
  },

  /**
   * 预览图片
   */
  previewImages() {
    wx.previewImage({
      urls: this.data.imageList
    });
  },

  /**
   * 开始批量识别
   */
  async startBatch() {
    const { imageList, processing } = this.data;

    if (imageList.length === 0 || processing) {
      return;
    }

    this.setData({ processing: true });

    // 初始化结果列表
    const resultList = imageList.map((_, index) => ({
      index,
      status: 'processing',
      icon: '⏳',
      statusText: '识别中...',
      data: null,
      error: null
    }));

    this.setData({ resultList });

    // 批量并行识别
    const promises = imageList.map((imagePath, index) =>
      this.recognizeSingleImage(imagePath, index)
    );

    await Promise.all(promises);

    this.setData({ processing: false });

    wx.showToast({
      title: '识别完成',
      icon: 'success'
    });
  },

  /**
   * 单张图片 OCR 识别
   */
  async recognizeSingleImage(imagePath, index) {
    try {
      // 上传临时文件到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ocr_temp/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`,
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
        // 更新状态为成功
        const statusList = [...this.data.statusList];
        statusList[index] = {
          icon: '✅',
          text: '识别成功'
        };

        const resultList = [...this.data.resultList];
        resultList[index] = {
          index,
          status: 'success',
          icon: '✅',
          statusText: '识别成功',
          data: {
            productName: ocrData.data.productName || '未识别商品',
            price: ocrData.data.price.toString() || '0.00',
            orderTime: ocrData.data.orderTime,
            quantity: ocrData.data.quantity || 1,
            platform: ocrData.data.platform || 'other',
            categoryId: ocrData.data.categoryId || 7,
            imagePath: fileID
          },
          error: null
        };

        this.setData({ statusList, resultList });
      } else {
        throw new Error(ocrData.message || '识别失败');
      }

      // 删除临时文件
      wx.cloud.deleteFile({
        fileList: [fileID]
      }).catch(console.error);
    } catch (err) {
      console.error('OCR 识别失败:', err);

      const statusList = [...this.data.statusList];
      statusList[index] = {
        icon: '❌',
        text: '识别失败'
      };

      const resultList = [...this.data.resultList];
      resultList[index] = {
        index,
        status: 'error',
        icon: '❌',
        statusText: '识别失败',
        data: null,
        error: err.message || '网络错误，请重试'
      };

      this.setData({ statusList, resultList });
    }
  },

  /**
   * 保存单条记录
   */
  async saveRecord(e) {
    const index = e.currentTarget.dataset.index;
    const { resultList } = this.data;
    const item = resultList[index];

    if (!item.data) {
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'create',
          record: item.data
        }
      });

      if (res.result.success) {
        // 更新状态为已保存
        resultList[index] = {
          ...item,
          status: 'saved',
          icon: '💾',
          statusText: '已保存'
        };

        this.setData({ resultList });

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        throw new Error(res.result.message || '保存失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
      wx.showToast({
        title: '保存失败',
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
    const successItems = resultList.filter(item => item.status === 'success');

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
    const savePromises = successItems.map(async (item) => {
      try {
        const res = await wx.cloud.callFunction({
          name: 'record',
          data: {
            action: 'create',
            record: item.data
          }
        });

        if (res.result.success) {
          savedCount++;
          // 更新状态
          const newList = [...this.data.resultList];
          newList[item.index] = {
            ...item,
            status: 'saved',
            icon: '💾',
            statusText: '已保存'
          };
          this.setData({ resultList: newList });
        }
      } catch (err) {
        console.error(`保存第 ${item.index + 1} 条记录失败:`, err);
      }

      // 更新进度
      wx.showLoading({
        title: `保存中 (${savedCount}/${successItems.length})...`,
        mask: true
      });
    });

    await Promise.all(savePromises);

    wx.hideLoading();

    wx.showToast({
      title: `已保存 ${savedCount}/${successItems.length} 条`,
      icon: 'success'
    });
  },

  /**
   * 获取成功数量
   */
  get successCount() {
    return this.data.resultList.filter(item => item.status === 'success').length;
  }
});
