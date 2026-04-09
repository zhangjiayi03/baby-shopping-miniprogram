  /**
   * 保存单条记录
   */
  async saveRecord(e) {
    const index = e.currentTarget.dataset.index;
    const { resultList } = this.data;
    
    console.log('💾 保存单条，index:', index);
    console.log('resultList 长度:', resultList.length);
    console.log('resultList[' + index + ']:', resultList[index]);
    
    const item = resultList[index];

    // 安全检查
    if (!item) {
      console.error('❌ item 为空');
      wx.showToast({ title: '数据为空，请重试', icon: 'none' });
      return;
    }

    if (!item.data) {
      console.error('❌ item.data 为空');
      console.error('完整 item:', JSON.stringify(item, null, 2));
      wx.showToast({ title: '数据格式错误，请重新识别', icon: 'none' });
      return;
    }

    // 确保数据存在且格式正确
    const dataToSave = {
      productName: String(item.data.productName || '未命名商品'),
      price: parseFloat(item.data.price) || 0,
      quantity: parseInt(item.data.quantity) || 1,
      categoryId: parseInt(item.data.categoryId) || 7,
      platform: String(item.data.platform || 'other'),
      orderTime: String(item.data.orderTime || new Date().toISOString().split('T')[0])
    };

    console.log('实际保存的数据:', dataToSave);

    wx.showLoading({ title: '保存中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'create',
          record: dataToSave
        }
      });

      console.log('云函数返回:', res.result);

      if (res.result && res.result.success) {
        // 更新状态为已保存
        const newList = [...this.data.resultList];
        newList[index] = {
          ...item,
          status: 'saved',
          icon: '💾',
          statusText: '已保存'
        };

        this.setData({ resultList: newList });

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
    
    console.log('📦 批量保存，resultList 长度:', resultList.length);
    
    // 过滤出成功且有数据的记录
    const successItems = resultList.filter(item => 
      item.status === 'success' && item.data && typeof item.data === 'object'
    );

    console.log('可保存的记录数:', successItems.length);

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
    for (const item of successItems) {
      try {
        // 再次检查数据
        if (!item.data) {
          console.error(`跳过第 ${item.index} 条：数据为空`);
          continue;
        }

        const dataToSave = {
          productName: String(item.data.productName || '未命名商品'),
          price: parseFloat(item.data.price) || 0,
          quantity: parseInt(item.data.quantity) || 1,
          categoryId: parseInt(item.data.categoryId) || 7,
          platform: String(item.data.platform || 'other'),
          orderTime: String(item.data.orderTime || new Date().toISOString().split('T')[0])
        };

        console.log(`保存第 ${item.index + 1} 条:`, dataToSave.productName);

        const res = await wx.cloud.callFunction({
          name: 'record',
          data: {
            action: 'create',
            record: dataToSave
          }
        });

        if (res.result && res.result.success) {
          savedCount++;
          // 更新状态
          const newList = [...this.data.resultList];
          const targetIndex = newList.findIndex(i => i.index === item.index);
          if (targetIndex >= 0) {
            newList[targetIndex] = {
              ...item,
              status: 'saved',
              icon: '💾',
              statusText: '已保存'
            };
            this.setData({ resultList: newList });
          }
        }
      } catch (err) {
        console.error(`保存第 ${item.index + 1} 条失败:`, err);
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
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },
