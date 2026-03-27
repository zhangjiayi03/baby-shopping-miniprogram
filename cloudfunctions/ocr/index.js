// 云函数入口文件 - 百度 OCR 识别（优化版 v2）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置
const BAIDU_OCR_CONFIG = {
  apiKey: 'aWb1o2tbEqXuH2TN41iUuhIt',
  secretKey: 'TLwVw2OCU5JoQtjS56HI5OcGVgihlfqH',
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
  
  // 京东 - 关键词更多
  if (text.includes('京东') || text.includes('jd.com') || text.includes('jd ') || 
      text.includes('自营') || text.includes('京东超市') || text.includes('京东到家')) {
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
  
  return 'other'
}

// ==================== 京东解析（重点优化）====================

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
  
  console.log('开始解析京东订单, 行数:', lines.length)
  
  // 京东订单特征分析：
  // 1. 商品名通常在"京东超市XXX"或"自营XXX"后面
  // 2. 商品名包含品牌+商品名+规格（如：贝亲桃子水200ml*2）
  // 3. 价格格式：￥45.77 或 到手￥45.77
  
  // 商品名关键词（用于识别商品行）
  const productKeywords = ['ml', 'g', 'kg', '片', '装', '包', '瓶', '罐', '袋', '盒', '套', '件', '只', '双', '本']
  
  // 过滤掉的非商品行关键词
  const excludeKeywords = [
    '售后', '服务', '完成', '感谢', '支持', '评价', '客服', '问题',
    '订单', '编号', '支付', '方式', '发票', '物流', '退货', '保障',
    '查看', '全部', '更多', '复制', '购买', '购物车', '上市', '周年',
    '旗舰店', '自营店', '无理由', '政策', '安心', '快速', '破损',
    '缺少', '配件', '附件', '银行卡', 'PLUS'
  ]
  
  // 1. 找商品名 - 优先找包含"京东超市"的行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // 检查是否是商品行
    if (line.startsWith('京东超市') || line.startsWith('京东自营') || line.includes('京东超市')) {
      // 这行就是商品名
      if (line.length > 10) {
        result.productName = line.replace(/京东超市|京东自营/g, '').trim()
        console.log('找到商品名(京东前缀):', result.productName)
        break
      }
    }
    
    // 备选：找包含商品规格的行
    if (!result.productName && line.length > 15 && line.length < 80) {
      const hasSpec = productKeywords.some(kw => line.toLowerCase().includes(kw))
      const isExcluded = excludeKeywords.some(kw => line.includes(kw))
      
      if (hasSpec && !isExcluded && !line.includes('￥') && !line.includes('¥')) {
        result.productName = line
        console.log('找到商品名(规格匹配):', result.productName)
        break
      }
    }
  }
  
  // 2. 如果还没找到，用最后一招：找最长的非价格、非排除行
  if (!result.productName) {
    const candidates = lines.filter(line => {
      const trimmed = line.trim()
      if (trimmed.length < 10 || trimmed.length > 80) return false
      if (trimmed.includes('￥') || trimmed.includes('¥')) return false
      if (excludeKeywords.some(kw => trimmed.includes(kw))) return false
      return true
    })
    
    if (candidates.length > 0) {
      // 取最长的
      result.productName = candidates.reduce((a, b) => a.length >= b.length ? a : b)
      console.log('找到商品名(最长匹配):', result.productName)
    }
  }
  
  // 3. 找价格
  const pricePatterns = [
    /(?:到手|实付款?|合计|总价|总额)[:\s]*[¥￥]?\s*(\d+\.?\d*)/i,
    /[¥￥]\s*(\d+\.\d{2})/g
  ]
  
  for (const pattern of pricePatterns) {
    const matches = allText.match(pattern)
    if (matches) {
      // 如果有多个价格，取最后一个（通常是实付）
      const match = Array.isArray(matches) ? matches[matches.length - 1] : matches
      const priceMatch = match.match(/(\d+\.?\d*)/)
      if (priceMatch) {
        result.price = parseFloat(priceMatch[1]).toFixed(2)
        result.unitPrice = result.price
        console.log('找到价格:', result.price)
        break
      }
    }
  }
  
  // 4. 找数量
  const qtyMatch = allText.match(/数量[×x*]\s*(\d+)/i)
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1])
    console.log('找到数量:', result.quantity)
  }
  
  // 5. 找时间（京东订单通常没有时间，用当前日期）
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1]
  } else {
    result.orderTime = new Date().toISOString().split('T')[0]
  }
  
  return result
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
  
  // 淘宝订单特征：商品名在"宝贝"后面
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('宝贝') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (nextLine.length > 2 && !nextLine.includes('¥')) {
        result.productName = nextLine.substring(0, 50)
        break
      }
    }
  }
  
  if (!result.productName) {
    for (const line of lines) {
      if (line.length > 5 && !line.includes('¥') && !line.includes('订单') && 
          !line.includes('时间') && !line.includes('地址')) {
        result.productName = line.substring(0, 50)
        break
      }
    }
  }
  
  // 找实付款
  const priceMatch = allText.match(/(?:实付款?|合计)[:\s]*[¥￥]?\s*(\d+\.?\d*)/)
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1]).toFixed(2)
    result.unitPrice = result.price
  }
  
  // 找时间
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1]
  }
  
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
  
  for (const line of lines) {
    if (line.length > 5 && !line.includes('¥') && !line.includes('订单') && 
        !line.includes('时间') && !line.includes('地址')) {
      result.productName = line.substring(0, 50)
      break
    }
  }
  
  const priceMatch = allText.match(/(?:实付款?|总价|合计)[:\s]*[¥￥]?\s*(\d+\.?\d*)/)
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1]).toFixed(2)
    result.unitPrice = result.price
  }
  
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1]
  }
  
  return result
}

// ==================== 通用解析 ====================

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
  
  // 找最长的非价格行
  const candidates = lines.filter(l => {
    const trimmed = l.trim()
    return trimmed.length > 3 && 
           !trimmed.includes('¥') && 
           !trimmed.includes('￥') &&
           !trimmed.includes('订单') &&
           !trimmed.includes('时间') &&
           !trimmed.includes('地址')
  })
  
  if (candidates.length > 0) {
    result.productName = candidates.reduce((a, b) => a.length >= b.length ? a : b).substring(0, 50)
  }
  
  // 找价格
  const priceMatch = allText.match(/(?:实付款?|合计|总计|总额)[:\s]*[¥￥]?\s*(\d+\.?\d*)/)
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1]).toFixed(2)
    result.unitPrice = result.price
  }
  
  const timeMatch = allText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
  if (timeMatch) {
    result.orderTime = timeMatch[1]
  }
  
  return result
}

// ==================== 智能分类 ====================

function guessCategory(productName) {
  const name = (productName || '').toLowerCase()
  
  const categoryKeywords = {
    1: ['奶粉', '奶瓶', '辅食', '米粉', '营养', '水杯', '喂养', '吸管杯', '保温杯', '奶嘴', '咬咬乐', '贝亲'],
    2: ['纸尿裤', '尿布', '湿巾', '洗澡', '洗护', '护肤', '防晒', '洗衣液', '沐浴露', '洗发', '面霜', '护臀', '棉柔巾', '拉拉裤', '爽身露', '桃子水'],
    3: ['衣服', '裤子', '鞋子', '袜子', '帽子', '外套', '连衣裙', '连体衣', '哈衣', '围嘴', '内衣', '套装'],
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
        productName: parsed.productName,
        price: parsed.price,
        quantity: parsed.quantity,
        unitPrice: parsed.unitPrice,
        orderTime: parsed.orderTime,
        platform: parsed.platform,
        categoryId,
        rawText: allText,
        words: lines
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
