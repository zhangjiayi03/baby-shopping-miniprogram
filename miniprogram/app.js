// app.js
App({
  globalData: {
    userInfo: null,
    cloudEnv: 'cloud1-8ggfnnl90cbdd81e',
    // 分类配置（全局共享）
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
    // 平台配置（全局共享）
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

  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.cloudEnv,
        traceUser: true
      });
    }
  }
});
