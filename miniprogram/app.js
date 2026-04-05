// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-8ggfnnl90cbdd81e', // 云环境 ID
        traceUser: true
      });
    }
    
    // 全局数据初始化
    this.globalData = {
      userInfo: null,
      cloudEnv: 'cloud1-8ggfnnl90cbdd81e'
    };
  },
  
  globalData: {
    userInfo: null,
    cloudEnv: 'cloud1-8ggfnnl90cbdd81e'
  }
});
