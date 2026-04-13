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
    console.log('📄 首页 onLoad');
  },

  onShow() {
    // 每次显示页面时刷新数据
    console.log('📄 首页 onShow - 刷新数据');
    this.refreshRecords();
    this.calculateStats();
  },

  onPullDownRefresh() {
    this.refreshRecords();
    this.calculateStats();
  },

  // 计算统计数据
  async calculateStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'stats',
        data: { action: 'getStats' }
      });
      
      if (res.result && res.result.success) {
        const stats = res.result.data;
        this.setData({
          spentThisMonth: stats.thisMonth.spent,
          todaySpent: stats.today.spent,
          yesterdaySpent: stats.yesterday.spent,
          todayOrderCount: stats.today.count
        });
      }
    } catch (error) {
      console.error('计算统计失败:', error);
    }
  },

  // 加载记录列表
  async loadRecords(isRefresh = false) {
    // 防止重复加载
    if (this.data.loading) {
      console.log('⏳ 正在加载中，跳过');
      return;
    }
    
    this.setData({ loading: true });
    
    try {
      console.log('📡 加载记录, isRefresh:', isRefresh, 'page:', this.data.page);
      
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'list',
          data: {
            page: isRefresh ? 1 : this.data.page,
            pageSize: this.data.pageSize,
            categoryId: this.data.categoryId,
            platform: this.data.platform
          }
        }
      });
      
      console.log('📡 云函数返回:', res.result ? 'success' : 'failed');
      
      if (res.result && res.result.success) {
        const { list, total } = res.result.data;
        console.log('📊 获取到记录数:', list.length, '总数:', total);
        
        if (isRefresh) {
          // 刷新时替换列表
          this.setData({
            recordList: list,
            page: 2,  // 下次加载第2页
            hasMore: list.length >= this.data.pageSize
          });
        } else {
          // 加载更多时追加
          const newList = [...this.data.recordList, ...list];
          this.setData({
            recordList: newList,
            page: this.data.page + 1,
            hasMore: list.length >= this.data.pageSize
          });
        }
      } else {
        console.error('云函数返回失败:', res.result);
        // 不清空列表，保持现有数据
        if (isRefresh) {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      }
    } catch (error) {
      console.error('加载记录失败:', error);
      // 不清空列表，保持现有数据
      if (isRefresh) {
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  // 刷新记录（重置分页）
  refreshRecords() {
    this.setData({ page: 1 });
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
      wx.showLoading({ title: '删除中...' });
      
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: { 
          action: 'delete', 
          id: id 
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        const newList = this.data.recordList.filter(item => item._id !== id);
        this.setData({ recordList: newList });
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.calculateStats();
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('删除失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
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
