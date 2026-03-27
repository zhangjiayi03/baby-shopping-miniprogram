// 云函数入口文件 - 百度 OCR 识别（简化版）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置
const BAIDU_API_KEY = 'aWb1o2tbEqXuH2TN41iUuhIt'
const BAIDU_SECRET_KEY = 'TLwVw2OCU5JoQtjS56HI5OcGVgihlfqH'

// 缓存 access token
let cachedToken = null
let tokenExpire = 0

/**
 * 获取百度 Access Token
 */
async function getBaiduAccessToken() {
  // 如果有缓存且未过期，直接返回
  if (cachedToken && Date.now() < tokenExpire) {
    return cachedToken
  }

  console.log('开始获取百度 Access Token...')
  
  // 使用 URLSearchParams 构建请求体
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', BAIDU_API_KEY)
  params.append('client_secret', BAIDU_SECRET_KEY)

  const res = await fetch('https://aip.baidubce.com/oauth/2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  const data = await res.json()
  console.log('百度 Token 响应:', JSON.stringify(data))

  if (data.access_token) {
    cachedToken = data.access_token
    tokenExpire = Date.now() + (data.expires_in - 3600) * 1000
    console.log('Token 获取成功')
    return data.access_token
  }

  throw new Error(data.error_description || '获取 Token 失败: ' + JSON.stringify(data))
}

/**
 * 百度通用文字识别（高精度版）
 */
async function baiduOCR(imageBase64, accessToken) {
  console.log('开始调用百度 OCR API...')
  
  const params = new URLSearchParams()
  params.append('image', imageBase64)
  params.append('detect_direction', 'true')
  params.append('paragraph', 'false')

  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  const data = await res.json()
  console.log('百度 OCR 响应:', JSON.stringify(data).substring(0, 500))
  
  return data
}

/**
 * 解析京东订单
 */
function parseJDOrder(texts) {
  console.log('解析京东订单，文本行数:', texts.length)
  
  let productName = ''
  let price = 0
  let quantity = 1

  // 排除关键词
  const excludeKeywords = ['售后', '服务', '完成', '感谢', '评价', '客服', '物流', '配送', '订单', '编号', '时间', '地址', '电话', '收货', '京东快递', '京东自营', '平台']
  
  // 商品关键词
  const productKeywords = ['京东超市', '京东', '贝亲', '婴儿', '纸尿裤', '奶粉', '玩具', 'ml', 'g', 'kg', '片', '装', '盒', '瓶', '袋', '套装']

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i].trim()
    
    // 排除无关行
    if (excludeKeywords.some(k => text.includes(k))) continue
    
    // 提取价格（找 ¥ 或 数字.数字 格式）
    const priceMatch = text.match(/¥?\s*(\d+\.?\d*)/)
    if (priceMatch && !price) {
      const possiblePrice = parseFloat(priceMatch[1])
      if (possiblePrice > 1 && possiblePrice < 10000) {
        price = possiblePrice
      }
    }

    // 提取商品名（优先找包含商品关键词的行）
    if (productKeywords.some(k => text.includes(k))) {
      if (text.length > 5 && text.length < 100) {
        // 清理商品名
        let cleanName = text
          .replace(/京东超市/g, '')
          .replace(/京东/g, '')
          .replace(/自营/g, '')
          .trim()
        
        if (cleanName.length > 3) {
          productName = cleanName
        }
      }
    }
  }

  // 如果没找到商品名，取第一行有意义的文本
  if (!productName) {
    for (const text of texts) {
      const cleanText = text.trim()
      if (cleanText.length > 5 && cleanText.length < 50 && !excludeKeywords.some(k => cleanText.includes(k))) {
        productName = cleanText
        break
      }
    }
  }

  return { productName, price, quantity }
}

/**
 * 解析淘宝订单
 */
function parseTaobaoOrder(texts) {
  let productName = ''
  let price = 0
  let quantity = 1

  for (const text of texts) {
    const priceMatch = text.match(/¥?\s*(\d+\.?\d*)/)
    if (priceMatch && !price) {
      const possiblePrice = parseFloat(priceMatch[1])
      if (possiblePrice > 1 && possiblePrice < 10000) {
        price = possiblePrice
      }
    }

    if (text.includes('宝') || text.includes('淘') || text.length > 5) {
      if (!text.includes('订单') && !text.includes('时间') && !text.includes('地址')) {
        productName = text.trim()
      }
    }
  }

  return { productName, price, quantity }
}

/**
 * 解析拼多多订单
 */
function parsePDDOrder(texts) {
  let productName = ''
  let price = 0
  let quantity = 1

  for (const text of texts) {
    const priceMatch = text.match(/¥?\s*(\d+\.?\d*)/)
    if (priceMatch && !price) {
      const possiblePrice = parseFloat(priceMatch[1])
      if (possiblePrice > 1 && possiblePrice < 10000) {
        price = possiblePrice
      }
    }

    if (text.includes('拼多多') || text.includes('拼') || text.length > 5) {
      if (!text.includes('订单') && !text.includes('时间')) {
        productName = text.trim()
      }
    }
  }

  return { productName, price, quantity }
}

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  console.log('OCR 云函数被调用，参数:', JSON.stringify(event).substring(0, 200))

  try {
    const { image } = event
    
    if (!image) {
      return {
        success: false,
        error: '请提供图片数据'
      }
    }

    // 获取 access token
    const accessToken = await getBaiduAccessToken()
    console.log('Access Token 获取成功')

    // 调用 OCR
    const result = await baiduOCR(image, accessToken)

    if (result.error_code) {
      console.error('百度 OCR 错误:', result.error_msg)
      return {
        success: false,
        error: 'OCR 识别失败: ' + result.error_msg
      }
    }

    // 提取文字
    const texts = (result.words_result || []).map(item => item.words)
    console.log('识别到文字行数:', texts.length)
    console.log('文字内容:', texts.slice(0, 5).join(' | '))

    // 判断平台
    const allText = texts.join(' ')
    let platform = 'unknown'
    let parsedResult

    if (allText.includes('京东') || allText.includes('JD')) {
      platform = 'jd'
      parsedResult = parseJDOrder(texts)
    } else if (allText.includes('淘宝') || allText.includes('天猫')) {
      platform = 'taobao'
      parsedResult = parseTaobaoOrder(texts)
    } else if (allText.includes('拼多多') || allText.includes('拼')) {
      platform = 'pdd'
      parsedResult = parsePDDOrder(texts)
    } else {
      // 默认使用京东解析
      platform = 'jd'
      parsedResult = parseJDOrder(texts)
    }

    console.log('解析结果:', JSON.stringify(parsedResult))

    return {
      success: true,
      data: {
        productName: parsedResult.productName || '未知商品',
        price: parsedResult.price || 0,
        quantity: parsedResult.quantity || 1,
        platform: platform,
        rawTexts: texts.slice(0, 10) // 返回前10行文字，方便调试
      }
    }

  } catch (error) {
    console.error('OCR 识别失败:', error)
    return {
      success: false,
      error: error.message || '识别失败，请重试'
    }
  }
}
