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
    filterBabyIndex: 0,
    categoryId: null,
    platform: null,
    babyId: null,
    
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
    babies: [
      { id: 0, name: '全部宝宝', nickname: '全部宝宝' }
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
    this.loadBabies();
  },

  onShow() {
    console.log('📄 首页 onShow - 刷新数据');
    this.refreshRecords();
    this.calculateStats();
  },

  onPullDownRefresh() {
    this.refreshRecords();
    this.calculateStats();
  },

  // 加载宝宝列表
  async loadBabies() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'babies',
        data: { action: 'list' }
      });

      if (res.result && res.result.success) {
        const babies = res.result.data;
        const babyOptions = [
          { id: 0, name: '全部宝宝', nickname: '全部宝宝' },
          ...babies.map(b => ({ id: b._id, name: b.nickname, nickname: b.nickname }))
        ];
        this.setData({ babies: babyOptions });
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
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
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      // 获取记录列表
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: {
          action: 'list',
          data: {
            page: isRefresh ? 1 : this.data.page,
            pageSize: this.data.pageSize,
            categoryId: this.data.categoryId,
            platform: this.data.platform,
            babyId: this.data.babyId
          }
        }
      });
      
      if (res.result && res.result.success) {
        const { list } = res.result.data;
        
        // 获取宝宝信息映射
        const babyMap = {};
        this.data.babies.forEach(b => {
          if (b.id !== 0) babyMap[b.id] = b.nickname;
        });
        
        // 给每条记录添加宝宝昵称
        const processedList = list.map(item => ({
          ...item,
          babyNickname: babyMap[item.babyId] || ''
        }));
        
        if (isRefresh) {
          this.setData({
            recordList: processedList,
            page: 2,
            hasMore: processedList.length >= this.data.pageSize
          });
        } else {
          const newList = [...this.data.recordList, ...processedList];
          this.setData({
            recordList: newList,
            page: this.data.page + 1,
            hasMore: processedList.length >= this.data.pageSize
          });
        }
      }
    } catch (error) {
      console.error('加载记录失败:', error);
      if (isRefresh) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  // 刷新记录
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
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 编辑记录
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}&mode=edit` });
  },

  // 删除记录
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) this.deleteRecord(id);
      }
    });
  },

  async deleteRecord(id) {
    try {
      wx.showLoading({ title: '删除中...' });
      const res = await wx.cloud.callFunction({
        name: 'record',
        data: { action: 'delete', id }
      });
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        const newList = this.data.recordList.filter(item => item._id !== id);
        this.setData({ recordList: newList });
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.calculateStats();
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // 筛选变化
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

  onBabyFilterChange(e) {
    const index = e.detail.value;
    const baby = this.data.babies[index];
    this.setData({
      filterBabyIndex: index,
      babyId: index > 0 ? baby.id : null,
      page: 1,
      recordList: []
    });
    this.loadRecords(true);
  }
});
