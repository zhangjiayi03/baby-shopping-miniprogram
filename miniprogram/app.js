// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        env: 'your-env-id', // 替换为你的云环境 ID
        traceUser: true
      });
    }
    
    // 全局数据初始化
    this.globalData = {
      userInfo: null,
      cloudEnv: 'your-env-id'
    };
  },
  
  globalData: {
    userInfo: null,
    cloudEnv: ''
  }
});
