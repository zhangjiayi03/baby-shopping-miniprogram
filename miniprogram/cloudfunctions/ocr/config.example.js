/**
 * 百度 OCR 配置示例文件
 * 
 * 使用方法：
 * 1. 复制此文件为 config.js（已添加到 .gitignore）
 * 2. 或者在云函数环境变量中设置：
 *    - BAIDU_API_KEY
 *    - BAIDU_SECRET_KEY
 * 
 * 推荐使用环境变量方式，更安全
 */

module.exports = {
  BAIDU_OCR: {
    API_KEY: 'your-api-key-here',
    SECRET_KEY: 'your-secret-key-here'
  },
  TIMEOUT: 30000
}
