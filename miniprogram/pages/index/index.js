// pages/index/index.js
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
    ]
  },

  onLoad() {
    this.loadRecords();
  },

  onPullDownRefresh() {
    this.refreshRecords();
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
            productName: '示例商品 1',
            price: '99.00',
            quantity: 1,
            categoryId: 1,
            platform: 'taobao',
            orderTime: '2026-04-01'
          },
          {
            _id: '2',
            productName: '示例商品 2',
            price: '199.00',
            quantity: 2,
            categoryId: 2,
            platform: 'jd',
            orderTime: '2026-04-02'
          }
        ],
        total: 2
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

  // 跳转录入页
  goToRecord() {
    wx.navigateTo({
      url: '/pages/record/record'
    });
  },

  // 跳转详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
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
