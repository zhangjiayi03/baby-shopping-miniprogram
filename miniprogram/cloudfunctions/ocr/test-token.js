// 简化的 OCR 测试云函数
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置
const BAIDU_API_KEY = 'aWb1o2tbEqXuH2TN41iUuhIt'
const BAIDU_SECRET_KEY = 'TLwVw2OCU5JoQtjS56HI5OcGVgihlfqH'

/**
 * 获取百度 Access Token
 */
async function getBaiduAccessToken() {
  console.log('=== 开始获取百度 Access Token ===')
  
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', BAIDU_API_KEY)
  params.append('client_secret', BAIDU_SECRET_KEY)

  try {
    const res = await axios.post(
      'https://aip.baidubce.com/oauth/2.0/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    )

    console.log('百度返回:', JSON.stringify(res.data))
    
    if (res.data.access_token) {
      console.log('✅ 获取 Access Token 成功')
      return res.data.access_token
    }

    console.error('❌ 没有 access_token:', res.data)
    throw new Error(res.data.error_description || '获取 Access Token 失败')
  } catch (error) {
    console.error('❌ 获取 Token 异常:', error.message)
    throw error
  }
}

/**
 * 云函数入口 - 仅测试 Token 获取
 */
async function main(event, context) {
  console.log('=== OCR 测试云函数被调用 ===')
  console.log('Event:', JSON.stringify(event))

  try {
    // 测试 Token 获取
    const token = await getBaiduAccessToken()
    
    return {
      success: true,
      message: 'Token 获取成功',
      token: token.substring(0, 20) + '...', // 只显示前 20 位
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('=== 测试失败 ===')
    console.error('错误:', error.message)
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

exports.main = main
