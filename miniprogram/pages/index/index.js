// pages/index/index.js
const app = getApp();

Page({
  data: {
    recordList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    
    // 筛选条件
    filterCategoryIndex: 0,
    filterPlatformIndex: 0,
    categoryId: null,
    platform: null,
    
    // 分类和平台选项
    categories: [
      { id: 0, name: '全部分类' },
      { id: 1, name: '喂养' },
      { id: 2, name: '洗护' },
      { id: 3, name: '服装' },
      { id: 4, name: '玩具' },
      { id: 5, name: '医疗' },
      { id: 6, name: '教育' },
      { id: 7, name: '其他' }
    ],
    platforms: [
      { id: 0, name: '全部平台' },
      { id: 'taobao', name: '淘宝' },
      { id: 'jd', name: '京东' },
      { id: 'pdd', name: '拼多多' },
      { id: 'douyin', name: '抖音' },
      { id: 'meituan', name: '美团' },
      { id: 'other', name: '其他' }
    ],
    
    // 预算和统计数据
    monthlyBudget: 2000,
    spentThisMonth: 0,
    todaySpent: 0,
    yesterdaySpent: 0,
    todayOrderCount: 0
  },

  onLoad() {
    this.loadRecords();
    this.calculateStats();
  },

  onPullDownRefresh() {
    this.refreshRecords();
    this.calculateStats();
  },

  // 计算统计数据
  async calculateStats() {
    try {
      const now = new Date();
      const today = now.toDateString();
      const yesterday = new Date(now.setDate(now.getDate() - 1)).toDateString();
      const thisMonthStart = new Date().setDate(1);
      
      // TODO: 从云函数获取真实数据
      // const res = await wx.cloud.callFunction({
      //   name: 'stats',
      //   data: { action: 'getStats' }
      // });
      
      // 模拟数据
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 计算本月花费
      const mockRecords = this.data.recordList;
      const thisMonthRecords = mockRecords.filter(r => 
        new Date(r.orderTime).getTime() >= thisMonthStart
      );
      const spentThisMonth = thisMonthRecords.reduce((sum, r) => 
        sum + parseFloat(r.price) * r.quantity, 0
      );
      
      // 计算今日花费
      const todayRecords = mockRecords.filter(r => 
        new Date(r.orderTime).toDateString() === today
      );
      const todaySpent = todayRecords.reduce((sum, r) => 
        sum + parseFloat(r.price) * r.quantity, 0
      );
      
      // 计算昨日花费（模拟）
      const yesterdaySpent = todaySpent > 0 ? todaySpent * 0.8 : 0;
      
      this.setData({
        spentThisMonth: parseFloat(spentThisMonth.toFixed(2)),
        todaySpent: parseFloat(todaySpent.toFixed(2)),
        yesterdaySpent: parseFloat(yesterdaySpent.toFixed(2)),
        todayOrderCount: todayRecords.length
      });
      
    } catch (error) {
      console.error('计算统计失败:', error);
    }
  },

  // 加载记录列表
  async loadRecords(isRefresh = false) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      // TODO: 调用云函数获取记录列表
      // const res = await wx.cloud.callFunction({
      //   name: 'record',
      //   data: {
      //     action: 'list',
      //     data: {
      //       page: this.data.page,
      //       pageSize: this.data.pageSize,
      //       categoryId: this.data.categoryId,
      //       platform: this.data.platform
      //     }
      //   }
      // });
      
      // 模拟数据
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockData = {
        list: [
          {
            _id: '1',
            productName: '飞鹤星飞帆 3 段奶粉',
            price: '298.00',
            quantity: 2,
            categoryId: 1,
            platform: 'taobao',
            orderTime: '2026-04-05'
          },
          {
            _id: '2',
            productName: '帮宝适纸尿裤 L 码',
            price: '159.00',
            quantity: 1,
            categoryId: 2,
            platform: 'jd',
            orderTime: '2026-04-04'
          },
          {
            _id: '3',
            productName: '婴儿连体衣春秋款',
            price: '89.00',
            quantity: 3,
            categoryId: 3,
            platform: 'pdd',
            orderTime: '2026-04-03'
          }
        ],
        total: 3
      };
      
      if (isRefresh) {
        this.setData({
          recordList: mockData.list,
          page: 1,
          hasMore: mockData.list.length >= this.data.pageSize
        });
      } else {
        const newList = [...this.data.recordList, ...mockData.list];
        this.setData({
          recordList: newList,
          page: this.data.page + 1,
          hasMore: mockData.list.length >= this.data.pageSize
        });
      }
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载记录失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
    
    this.setData({ loading: false });
    wx.stopPullDownRefresh();
  },

  // 刷新记录
  refreshRecords() {
    this.loadRecords(true);
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRecords(false);
    }
  },

  // 跳转详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  // 编辑记录
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}&mode=edit`
    });
  },

  // 删除记录
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？删除后无法恢复。',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecord(id);
        }
      }
    });
  },

  // 执行删除
  async deleteRecord(id) {
    try {
      // TODO: 调用云函数删除
      // await wx.cloud.callFunction({
      //   name: 'record',
      //   data: { action: 'delete', data: { id } }
      // });
      
      // 模拟删除
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newList = this.data.recordList.filter(item => item._id !== id);
      this.setData({
        recordList: newList
      });
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
      // 重新计算统计
      this.calculateStats();
      
    } catch (error) {
      console.error('删除失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },

  // 分类筛选
  onCategoryFilterChange(e) {
    const index = e.detail.value;
    const category = this.data.categories[index];
    
    this.setData({
      filterCategoryIndex: index,
      categoryId: index > 0 ? category.id : null,
      page: 1,
      recordList: []
    });
    
    this.loadRecords(true);
  },

  // 平台筛选
  onPlatformFilterChange(e) {
    const index = e.detail.value;
    const platform = this.data.platforms[index];
    
    this.setData({
      filterPlatformIndex: index,
      platform: index > 0 ? platform.id : null,
      page: 1,
      recordList: []
    });
    
    this.loadRecords(true);
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
