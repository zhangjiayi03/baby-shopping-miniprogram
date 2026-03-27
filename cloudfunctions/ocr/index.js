// 云函数入口文件 - 百度 OCR 识别（支持云存储 URL）
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

  console.error('Token 获取失败:', data)
  throw new Error(data.error_description || '获取 Access Token 失败')
}

/**
 * 百度 OCR 识别
 */
async function baiduOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`
  
  console.log('调用百度 OCR API...')
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `image=${encodeURIComponent(imageBase64)}&detect_direction=true`
  })

  const result = await res.json()
  console.log('百度 OCR 响应:', JSON.stringify(result).substring(0, 500))
  
  return result
}

/**
 * 从云存储下载图片并转为 base64
 */
async function downloadImageFromCloudStorage(imgUrl) {
  console.log('从云存储下载图片:', imgUrl)
  
  // 提取文件 ID（格式：cloud://xxx/xxx）
  const fileId = imgUrl
  
  try {
    // 使用云开发 API 下载文件
    const result = await cloud.downloadFile({
      fileID: fileId
    })
    
    if (result.fileContent) {
      // 转为 base64
      const base64 = result.fileContent.toString('base64')
      console.log('图片下载成功，base64 长度:', base64.length)
      return base64
    } else {
      throw new Error('下载文件内容为空')
    }
  } catch (error) {
    console.error('下载图片失败:', error)
    throw error
  }
}

/**
 * 解析京东订单
 */
function parseJDOrder(texts) {
  let productName = ''
  let price = 0
  let quantity = 1

  // 排除关键词
  const excludeKeywords = ['售后', '服务', '完成', '感谢', '支持', '订单', 
                           '时间', '地址', '电话', '收货', '支付', '配送',
                           '查看', '评价', '申请', '客服', '详情', '更多']

  // 优先查找"京东超市"开头的商品
  for (const text of texts) {
    if (text.includes('京东超市')) {
      productName = text.trim()
      break
    }
  }

  // 如果没找到，查找包含商品规格的行
  if (!productName) {
    for (const text of texts) {
      const hasSpec = /(\d+ml|\d+g|\d+片|\d+装|婴儿|儿童|宝宝|奶粉|尿不湿)/i.test(text)
      const shouldExclude = excludeKeywords.some(kw => text.includes(kw))
      
      if (hasSpec && !shouldExclude && text.length > 5 && text.length < 100) {
        productName = text.trim()
        break
      }
    }
  }

  // 提取价格
  for (const text of texts) {
    const priceMatch = text.match(/¥?\s*(\d+\.\d{2})/)
    if (priceMatch) {
      const possiblePrice = parseFloat(priceMatch[1])
      if (possiblePrice > 1 && possiblePrice < 10000) {
        price = possiblePrice
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
  console.log('OCR 云函数被调用，参数:', JSON.stringify(event).substring(0, 500))

  try {
    const { image, imgUrl } = event
    
    let imageBase64 = null
    
    // 支持两种方式：直接传 base64 或传云存储 URL
    if (image) {
      // 直接传 base64
      imageBase64 = image
      console.log('使用直接传入的 base64 图片')
    } else if (imgUrl) {
      // 从云存储下载
      console.log('从云存储下载图片:', imgUrl)
      imageBase64 = await downloadImageFromCloudStorage(imgUrl)
    } else {
      return {
        success: false,
        error: '请提供图片数据 (image 或 imgUrl)'
      }
    }

    // 获取 access token
    const accessToken = await getBaiduAccessToken()
    console.log('Access Token 获取成功')

    // 调用 OCR
    const result = await baiduOCR(imageBase64, accessToken)

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
