/**
 * 百度 OCR 配置文件示例
 * 
 * 使用前请重命名为 config.js 并填入你的 API Key
 * 
 * 获取方式：
 * 1. 登录百度智能云：https://console.bce.baidu.com/
 * 2. 进入"文字识别 OCR"服务
 * 3. 创建应用，获取 API Key 和 Secret Key
 * 4. 免费额度：通用文字识别 500 次/天
 */

module.exports = {
  // 百度 OCR API 配置
  BAIDU_OCR: {
    APP_ID: '你的AppID',
    API_KEY: '你的ApiKey',
    SECRET_KEY: '你的SecretKey'
  },
  
  // 其他配置
  USE_HTTPS: true,  // 是否使用 HTTPS
  TIMEOUT: 30000    // 超时时间（毫秒）
}
