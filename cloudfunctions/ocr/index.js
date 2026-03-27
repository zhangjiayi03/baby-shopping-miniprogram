// 云函数入口文件 - 百度 OCR 识别
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置（从环境变量或配置文件读取）
const BAIDU_OCR_CONFIG = {
  apiKey: process.env.BAIDU_OCR_API_KEY || '',
  secretKey: process.env.BAIDU_OCR_SECRET_KEY || '',
  accessToken: null,
  tokenExpire: 0
}

/**
 * 获取百度 Access Token
 */
async function getBaiduAccessToken() {
  // 如果 token 未过期，直接返回
  if (BAIDU_OCR_CONFIG.accessToken && Date.now() < BAIDU_OCR_CONFIG.tokenExpire) {
    return BAIDU_OCR_CONFIG.accessToken
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_OCR_CONFIG.apiKey}&client_secret=${BAIDU_OCR_CONFIG.secretKey}`
  
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data.access_token) {
    BAIDU_OCR_CONFIG.accessToken = data.access_token
    // token 有效期 30 天，提前 1 小时刷新
    BAIDU_OCR_CONFIG.tokenExpire = Date.now() + (data.expires_in - 3600) * 1000
    return data.access_token
  }

  throw new Error(data.error_description || '获取 Access Token 失败')
}

/**
 * 百度通用文字识别
 */
async function baiduGeneralOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `image=${encodeURIComponent(imageBase64)}`
  })

  return res.json()
}

/**
 * 百度购物小票识别（更适合订单）
 */
async function baiduReceiptOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/solution/v1/iocr/recognise/receipt?access_token=${accessToken}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `image=${encodeURIComponent(imageBase64)}`
  })

  return res.json()
}

/**
 * 百度增值税发票识别（用于发票类）
 */
async function baiduVatInvoiceOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/vat_invoice?access_token=${accessToken}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `image=${encodeURIComponent(imageBase64)}`
  })

  return res.json()
}

/**
 * 从云存储下载图片并转 Base64
 */
async function downloadImageAsBase64(fileID) {
  const result = await cloud.downloadFile({
    fileID: fileID
  })
  
  if (result.fileContent) {
    return result.fileContent.toString('base64')
  }
  
  throw new Error('下载图片失败')
}

/**
 * 解析订单信息
 */
function parseOrderInfo(ocrResult, type = 'general') {
  const result = {
    productName: '',
    price: '',
    quantity: 1,
    unitPrice: '',
    orderTime: '',
    platform: '',
    rawText: ''
  }

  if (!ocrResult.words_result || ocrResult.words_result.length === 0) {
    return result
  }

  // 拼接所有文字
  const allText = ocrResult.words_result.map(w => w.words).join('\n')
  result.rawText = allText

  // 提取商品名（通常在前几行）
  const lines = ocrResult.words_result.map(w => w.words)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i]
    // 跳过明显的非商品名
    if (line.includes('订单') || line.includes('详情') || line.includes('时间') || line.includes('金额')) {
      continue
    }
    if (line.length > 2 && line.length < 50) {
      result.productName = line
      break
    }
  }

  // 提取价格
  const pricePatterns = [
    /(?:实付|合计|总计|金额|价格|总计)[:\s]*[¥￥]?\s*(\d+\.?\d*)/,
    /[¥￥]\s*(\d+\.\d{2})/,
    /(\d+\.\d{2})\s*元/
  ]
  
  for (const pattern of pricePatterns) {
    const match = allText.match(pattern)
    if (match) {
      result.price = parseFloat(match[1]).toFixed(2)
      result.unitPrice = result.price
      break
    }
  }

  // 提取日期
  const datePatterns = [
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /(\d{1,2}月\d{1,2}日)/,
    /(\d{4}\d{2}\d{2})/
  ]
  
  for (const pattern of datePatterns) {
    const match = allText.match(pattern)
    if (match) {
      let dateStr = match[1]
      // 标准化日期格式
      dateStr = dateStr.replace(/[年月日]/g, '-').replace(/-+/g, '-').replace(/-$/, '')
      result.orderTime = dateStr
      break
    }
  }

  // 提取数量
  const quantityMatch = allText.match(/(?:数量|件数)[:\s]*(\d+)/)
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1])
  }

  // 识别平台
  if (allText.includes('淘宝') || allText.includes('天猫')) {
    result.platform = 'taobao'
  } else if (allText.includes('京东') || allText.includes('JD')) {
    result.platform = 'jd'
  } else if (allText.includes('拼多多') || allText.includes('PDD')) {
    result.platform = 'pdd'
  } else if (allText.includes('抖音')) {
    result.platform = 'douyin'
  } else if (allText.includes('美团')) {
    result.platform = 'meituan'
  }

  return result
}

/**
 * 智能分类
 */
function guessCategory(productName) {
  const name = (productName || '').toLowerCase()
  
  const categoryKeywords = {
    1: ['奶粉', '奶瓶', '辅食', '米粉', '营养', '水杯', '喂养', '吸管杯', '保温杯'],
    2: ['纸尿裤', '尿布', '湿巾', '洗澡', '洗护', '护肤', '防晒', '洗衣液', '沐浴露', '洗发', '面霜', '护臀'],
    3: ['衣服', '裤子', '鞋子', '袜子', '帽子', '外套', '连衣裙', '连体衣', '哈衣', '围嘴'],
    4: ['玩具', '积木', '绘本', '图书', '滑梯', '摇马', '早教机', '故事机'],
    5: ['药品', '药', '体温计', '退热贴', '医疗', '益生菌', '维生'],
    6: ['早教', '课程', '启蒙', '学习', '教育', '游泳']
  }

  for (const [catId, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => name.includes(kw))) {
      return parseInt(catId)
    }
  }

  return 7 // 其他
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { type = 'order', imgUrl, imageBase64 } = event

  try {
    // 1. 获取图片 Base64
    let base64 = imageBase64
    if (!base64 && imgUrl) {
      // 从云存储下载
      base64 = await downloadImageAsBase64(imgUrl)
    }

    if (!base64) {
      throw new Error('请提供图片')
    }

    // 2. 获取百度 Access Token
    const accessToken = await getBaiduAccessToken()

    // 3. 调用百度 OCR
    let ocrResult
    
    if (type === 'order') {
      // 订单识别 - 先尝试通用 OCR
      ocrResult = await baiduGeneralOCR(base64, accessToken)
    } else if (type === 'receipt') {
      // 小票识别
      ocrResult = await baiduReceiptOCR(base64, accessToken)
    } else if (type === 'invoice') {
      // 发票识别
      ocrResult = await baiduVatInvoiceOCR(base64, accessToken)
    } else {
      ocrResult = await baiduGeneralOCR(base64, accessToken)
    }

    // 4. 解析结果
    if (ocrResult.error_code) {
      throw new Error(ocrResult.error_msg || 'OCR 识别失败')
    }

    const parsed = parseOrderInfo(ocrResult, type)
    const categoryId = guessCategory(parsed.productName)

    return {
      success: true,
      data: {
        ...parsed,
        categoryId,
        ocrResult // 返回原始结果供调试
      }
    }

  } catch (err) {
    console.error('OCR 识别失败:', err)
    return {
      success: false,
      error: err.message || '识别失败'
    }
  }
}
