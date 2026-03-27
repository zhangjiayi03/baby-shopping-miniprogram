// 云函数入口文件 - 百度 OCR 识别（优化版）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置
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
  if (BAIDU_OCR_CONFIG.accessToken && Date.now() < BAIDU_OCR_CONFIG.tokenExpire) {
    return BAIDU_OCR_CONFIG.accessToken
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_OCR_CONFIG.apiKey}&client_secret=${BAIDU_OCR_CONFIG.secretKey}`
  
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data.access_token) {
    BAIDU_OCR_CONFIG.accessToken = data.access_token
    BAIDU_OCR_CONFIG.tokenExpire = Date.now() + (data.expires_in - 3600) * 1000
    return data.access_token
  }

  throw new Error(data.error_description || '获取 Access Token 失败')
}

/**
 * 百度通用文字识别（高精度版）
 */
async function baiduAccurateOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `image=${encodeURIComponent(imageBase64)}&detect_direction=true`
  })

  return res.json()
}

/**
 * 百度通用文字识别（标准版）
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

// ==================== 平台识别 ====================

/**
 * 识别订单所属平台
 */
function detectPlatform(lines, allText) {
  const text = allText.toLowerCase()
  
  // 淘宝/天猫
  if (text.includes('淘宝') || text.includes('天猫') || text.includes('tmall') || text.includes('taobao')) {
    return 'taobao'
  }
  
  // 京东
  if (text.includes('京东') || text.includes('jd.com') || text.includes('jd ')) {
    return 'jd'
  }
  
  // 拼多多
  if (text.includes('拼多多') || text.includes('pinduoduo') || text.includes('pdd')) {
    return 'pdd'
  }
  
  // 抖音
  if (text.includes('抖音') || text.includes('douyin') || text.includes('抖店')) {
    return 'douyin'
  }
  
  // 美团
  if (text.includes('美团') || text.includes('meituan')) {
    return 'meituan'
  }
  
  // 快手
  if (text.includes('快手') || text.includes('kuaishou')) {
    return 'kuaishou'
  }
  
  // 通过页面特征判断
  for (const line of lines) {
    if (line.includes('订单详情')) return 'unknown'
    if (line.includes('订单编号')) return 'unknown'
  }
  
  return 'unknown'
}

// ==================== 淘宝/天猫解析 ====================

function parseTaobaoOrder(lines, allText) {
  const result = {
    productName: '',
    price: '',
    quantity: 1,
    unitPrice: '',
    orderTime: '',
    platform: 'taobao',
    rawText: allText
  }
  
  // 淘宝订单详情页特征：
  // - 商品名通常在"宝贝"或"商品"后面
  // - 实付款在最下方
  // - 订单时间格式：2024-03-27 10:30:00
  
  // 1. 找商品名
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 淘宝订单详情页：商品名通常在"宝贝详情"或商品图下面
    if (line.includes('宝贝') || line.includes('商品名') || line.includes('商品详情')) {
      // 下一行通常是商品名
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (nextLine.length > 2 && !nextLine.includes('¥') && !nextLine.includes('订单')) {
          result.productName = nextLine
          break
        }
      }
    }
  }
  
  // 如果没找到，用备选方案：找最长的非价格行
  if (!result.productName) {
    for (const line of lines) {
      if (line.length > 5 && !line.includes('¥') && !line.includes('订单') && 
          !line.includes('时间') && !line.includes('地址') && !line.includes('电话')) {
        result.productName = line.substring(0, 50)
        break
      }
    }
  }
  
  // 2. 找实付款
  const pricePatterns = [
    /实付款[:\s]*[¥￥]?\s*(\d+\.?\d*)/,
    /实付[:\s]*[¥￥]?\s*(\d+\.?\d*)/,
    /合计[:\s]*[¥￥]?\s*(\d+\.?\d*)/,
    /总计[:\s]*[¥￥]?\s*(\d+\.?\d*)/,
    /[¥￥]\s*(\d+\.\d{2})/g
  ]
  
  for (const pattern of pricePatterns) {
    const match = allText.match(pattern)
    if (match) {
      result.price = parseFloat(match[1] || match[0]).toFixed(2)
      result.unitPrice = result.price
      break
    }
  }
  
  // 3. 找订单时间
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*\d{0,2}:?\d{0,2}:?\d{0,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1].split(' ')[0] // 只取日期部分
  }
  
  // 4. 找数量
  const qtyMatch = allText.match(/(?:数量|件数|x|×)\s*(\d+)/i)
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1])
  }
  
  return result
}

// ==================== 京东解析 ====================

function parseJDOrder(lines, allText) {
  const result = {
    productName: '',
    price: '',
    quantity: 1,
    unitPrice: '',
    orderTime: '',
    platform: 'jd',
    rawText: allText
  }
  
  console.log('京东订单解析开始，总行数:', lines.length)
  console.log('前10行:', lines.slice(0, 10))
  
  // 京东订单详情页特征：
  // - 商品名通常是较长的描述行，包含品牌、规格等
  // - 可能有 "*N件" 表示数量
  // - 价格通常显示为 "总额 ¥XXX.XX" 或直接 "¥XXX.XX"
  // - 订单编号格式：京东订单号
  
  // 京东订单中需要排除的关键词（非商品名）
  const excludeKeywords = [
    '订单编号', '下单时间', '付款时间', '发货时间', '收货时间',
    '收货地址', '收货人', '联系电话', '买家留言', '发票信息',
    '订单详情', '商品详情', '订单状态', '售后服务',
    '总额', '实付款', '优惠', '运费', '京豆', '余额',
    '¥', '￥', '京东', 'JD', 'jd.com',
    '待收货', '已完成', '已发货', '待发货', '待付款',
    '申请售后', '再次购买', '分享订单', '联系客服',
    '快递单号', '物流信息', '配送', '快递员'
  ]
  
  // 1. 找商品名
  // 策略：找到最长的、不含排除关键词的行
  const candidateLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // 跳过太短或太长的行
    if (line.length < 5 || line.length > 100) continue
    
    // 跳过包含排除关键词的行
    if (excludeKeywords.some(kw => line.includes(kw))) continue
    
    // 跳过纯数字行
    if (/^\d+$/.test(line)) continue
    
    // 跳过纯日期时间行
    if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/.test(line) && line.length < 20) continue
    
    // 这是一个可能的商品名
    candidateLines.push({
      line,
      index: i,
      length: line.length
    })
  }
  
  console.log('候选商品名行数:', candidateLines.length)
  candidateLines.slice(0, 3).forEach(c => console.log('  候选:', c.line.substring(0, 30) + '...'))
  
  // 选择最长的候选行作为商品名
  if (candidateLines.length > 0) {
    candidateLines.sort((a, b) => b.length - a.length)
    result.productName = candidateLines[0].line.substring(0, 60)
  }
  
  // 2. 提取数量（从商品名中提取 "*N件" 或 "×N"）
  const qtyPatterns = [
    /\*\s*(\d+)\s*件/,
    /×\s*(\d+)/,
    /x\s*(\d+)/i,
    /(\d+)\s*件/
  ]
  
  for (const pattern of qtyPatterns) {
    const match = result.productName.match(pattern)
    if (match) {
      result.quantity = parseInt(match[1])
      // 从商品名中移除数量信息
      result.productName = result.productName.replace(pattern, '').trim()
      break
    }
  }
  
  // 3. 找价格
  // 京东价格特征：总额 ¥XXX.XX 或 ¥XXX.XX
  const pricePatterns = [
    /总额\s*[¥￥]?\s*(\d+\.?\d*)/,
    /实付款\s*[¥￥]?\s*(\d+\.?\d*)/,
    /[¥￥]\s*(\d+\.\d{2})/
  ]
  
  for (const pattern of pricePatterns) {
    const match = allText.match(pattern)
    if (match) {
      result.price = parseFloat(match[1]).toFixed(2)
      result.unitPrice = result.price
      break
    }
  }
  
  // 4. 找订单时间
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1].replace(/[/]/g, '-')
  }
  
  console.log('京东解析结果:', result)
  
  return result
}

// ==================== 拼多多解析 ====================

function parsePDDOrder(lines, allText) {
  const result = {
    productName: '',
    price: '',
    quantity: 1,
    unitPrice: '',
    orderTime: '',
    platform: 'pdd',
    rawText: allText
  }
  
  // 拼多多订单特征：
  // - 商品名较长
  // - "实付款" 或 "总价"
  
  // 1. 找商品名
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.length > 5 && !line.includes('¥') && !line.includes('订单') && 
        !line.includes('时间') && !line.includes('地址')) {
      result.productName = line.substring(0, 50)
      break
    }
  }
  
  // 2. 找价格
  const pricePatterns = [
    /(?:实付款|实付|总价|合计)[:\s]*[¥￥]?\s*(\d+\.?\d*)/,
    /[¥￥]\s*(\d+\.\d{2})/
  ]
  
  for (const pattern of pricePatterns) {
    const match = allText.match(pattern)
    if (match) {
      result.price = parseFloat(match[1]).toFixed(2)
      result.unitPrice = result.price
      break
    }
  }
  
  // 3. 找时间
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1]
  }
  
  return result
}

// ==================== 通用解析（未知平台）====================

function parseGenericOrder(lines, allText) {
  const result = {
    productName: '',
    price: '',
    quantity: 1,
    unitPrice: '',
    orderTime: '',
    platform: 'other',
    rawText: allText
  }
  
  // 1. 找商品名：最长的非价格行
  const candidates = lines.filter(l => {
    const trimmed = l.trim()
    return trimmed.length > 3 && 
           !trimmed.includes('¥') && 
           !trimmed.includes('￥') &&
           !trimmed.includes('订单') &&
           !trimmed.includes('时间') &&
           !trimmed.includes('地址') &&
           !trimmed.includes('电话') &&
           !trimmed.includes('收货') &&
           !trimmed.match(/^\d+$/) // 纯数字行
  })
  
  if (candidates.length > 0) {
    // 取最长的作为商品名
    result.productName = candidates.reduce((a, b) => a.length >= b.length ? a : b).substring(0, 50)
  }
  
  // 2. 找价格：优先找"实付"、"合计"等关键词
  const pricePatterns = [
    /(?:实付款?|合计|总计|总额|金额|价格)[:\s]*[¥￥]?\s*(\d+\.?\d*)/i,
    /[¥￥]\s*(\d+\.\d{2})/
  ]
  
  for (const pattern of pricePatterns) {
    const match = allText.match(pattern)
    if (match) {
      result.price = parseFloat(match[1]).toFixed(2)
      result.unitPrice = result.price
      break
    }
  }
  
  // 3. 找时间
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1]
  }
  
  // 4. 找数量
  const qtyMatch = allText.match(/(?:数量|件数|x|×)\s*(\d+)/i)
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1])
  }
  
  return result
}

// ==================== 智能分类 ====================

function guessCategory(productName) {
  const name = (productName || '').toLowerCase()
  
  const categoryKeywords = {
    1: ['奶粉', '奶瓶', '辅食', '米粉', '营养', '水杯', '喂养', '吸管杯', '保温杯', '奶嘴', '咬咬乐'],
    2: ['纸尿裤', '尿布', '湿巾', '洗澡', '洗护', '护肤', '防晒', '洗衣液', '沐浴露', '洗发', '面霜', '护臀', '棉柔巾', '拉拉裤'],
    3: ['衣服', '裤子', '鞋子', '袜子', '帽子', '外套', '连衣裙', '连体衣', '哈衣', '围嘴', ' bib', '内衣', '套装'],
    4: ['玩具', '积木', '绘本', '图书', '滑梯', '摇马', '早教机', '故事机', '拼图', '毛绒'],
    5: ['药品', '药', '体温计', '退热贴', '医疗', '益生菌', '维生', '钙', '锌', 'dha', 'ad'],
    6: ['早教', '课程', '启蒙', '学习', '教育', '游泳', '亲子']
  }

  for (const [catId, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => name.includes(kw))) {
      return parseInt(catId)
    }
  }

  return 7 // 其他
}

// ==================== 主函数 ====================

exports.main = async (event, context) => {
  const { type = 'order', imgUrl, imageBase64 } = event

  try {
    // 1. 获取图片 Base64
    let base64 = imageBase64
    if (!base64 && imgUrl) {
      base64 = await downloadImageAsBase64(imgUrl)
    }

    if (!base64) {
      throw new Error('请提供图片')
    }

    // 2. 获取百度 Access Token
    const accessToken = await getBaiduAccessToken()

    // 3. 调用百度 OCR（优先高精度版）
    let ocrResult = await baiduAccurateOCR(base64, accessToken)
    
    // 如果高精度版失败，降级到标准版
    if (ocrResult.error_code && ocrResult.error_code !== 0) {
      console.log('高精度OCR失败，降级到标准版:', ocrResult.error_msg)
      ocrResult = await baiduGeneralOCR(base64, accessToken)
    }

    // 4. 检查识别结果
    if (ocrResult.error_code && ocrResult.error_code !== 0) {
      throw new Error(ocrResult.error_msg || 'OCR 识别失败')
    }

    if (!ocrResult.words_result || ocrResult.words_result.length === 0) {
      throw new Error('未识别到文字内容')
    }

    // 5. 解析订单
    const lines = ocrResult.words_result.map(w => w.words)
    const allText = lines.join('\n')
    
    // 检测平台
    const platform = detectPlatform(lines, allText)
    console.log('检测到平台:', platform)
    
    // 根据平台选择解析器
    let parsed
    switch (platform) {
      case 'taobao':
        parsed = parseTaobaoOrder(lines, allText)
        break
      case 'jd':
        parsed = parseJDOrder(lines, allText)
        break
      case 'pdd':
        parsed = parsePDDOrder(lines, allText)
        break
      default:
        parsed = parseGenericOrder(lines, allText)
    }
    
    // 智能分类
    const categoryId = guessCategory(parsed.productName)

    // 6. 返回结果
    return {
      success: true,
      data: {
        ...parsed,
        categoryId,
        // 调试信息
        _debug: {
          platform,
          lineCount: lines.length,
          firstLines: lines.slice(0, 5)
        }
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
