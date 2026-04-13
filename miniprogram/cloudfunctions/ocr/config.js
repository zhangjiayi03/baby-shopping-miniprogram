/**
 * 百度 OCR 配置文件
 * 
 * ⚠️ 安全提醒：请勿将此文件提交到 Git！
 * 
 * 推荐使用云函数环境变量配置：
 * - BAIDU_API_KEY: 百度 API Key
 * - BAIDU_SECRET_KEY: 百度 Secret Key
 * 
 * 在微信开发者工具中：
 * 云开发控制台 → 云函数 → ocr → 配置 → 环境变量
 */

module.exports = {
  BAIDU_OCR: {
    // 请填写您的百度 OCR API Key
    API_KEY: process.env.BAIDU_API_KEY || '',
    SECRET_KEY: process.env.BAIDU_SECRET_KEY || ''
  },
  
  USE_HTTPS: true,
  TIMEOUT: 30000
}
