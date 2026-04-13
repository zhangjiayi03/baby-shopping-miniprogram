// 云函数入口文件 - 百度 OCR 识别（支持云存储 URL）
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置 - 从云函数环境变量读取
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || 'aWb1o2tbEqXuH2TN41iUuhIt'
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || 'TLwVw2OCU5JoQtjS56HI5OcGVgihlfqH'

// 缓存 access token
let cachedToken = null
let tokenExpire = 0

/**
 * 获取百度 Access Token
 */
async function getBaiduAccessToken() {
  if (cachedToken && Date.now() < tokenExpire) {
    return cachedToken
  }

  console.log('开始获取百度 Access Token...')
  
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', BAIDU_API_KEY)
  params.append('client_secret', BAIDU_SECRET_KEY)

  const res = await axios.post(
    'https://aip.baidubce.com/oauth/2.0/token',
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    }
  )

  const data = res.data
  if (data.access_token) {
    cachedToken = data.access_token
    tokenExpire = Date.now() + (data.expires_in - 3600) * 1000
    return data.access_token
  }

  throw new Error(data.error_description || '获取 Access Token 失败')
}

/**
 * 百度 OCR 识别
 */
async function baiduOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`
  
  const res = await axios.post(
    url,
    `image=${encodeURIComponent(imageBase64)}&detect_direction=true`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    }
  )

  return res.data
}

/**
 * 从云存储下载图片并转为 base64
 */
async function downloadImageFromCloudStorage(imgUrl) {
  const result = await cloud.downloadFile({ fileID: imgUrl })
  if (result.fileContent) {
    return result.fileContent.toString('base64')
  }
  throw new Error('下载文件内容为空')
}

// ============================================
// 商品名识别核心逻辑
// ============================================

/**
 * 检查是否为支付/金额/时间提示（应该排除的行）
 */
function isPaymentOrAmountHint(text) {
  // 匹配时间 + 金额的模式："5天18时后自动扣款5.73元"
  if (/\d+天\d+时/.test(text)) return true
  if (/自动扣款/.test(text)) return true
  if (/先用后付/.test(text)) return true
  if (/确认收货后/.test(text)) return true
  if (/天[后内].*扣/.test(text)) return true
  if (/时后.*扣/.test(text)) return true
  
  // 匹配单独的金额提示："XX元"（没有其他有意义文字）
  if (/^\s*\d+\.?\d*\s*元\s*$/.test(text)) return true
  
  // 支付状态提示
  if (/已支付|待支付|支付成功|付款成功/.test(text)) return true
  if (/待扣款|已扣款|扣款成功/.test(text)) return true
  
  return false
}

/**
 * 检查是否为物流信息
 */
function isLogisticsInfo(text) {
  const logisticsPatterns = [
    '已签收', '已发货', '派送中', '运输中', '已揽收',
    '快递员', '派件', '取件', '驿站', '快递柜',
    '京东物流', '京东快递', '圆通', '中通', '申通', '韵达', '顺丰', '极兔',
    '电子面单', '运单号', '快递单号'
  ]
  return logisticsPatterns.some(p => text.includes(p))
}

/**
 * 检查是否为地址或电话
 */
function isAddressOrPhone(text) {
  if (/\d{3,4}\*\*\*\d{4}/.test(text)) return true
  if (/(工业园|开发区|路|号|楼|室|栋|单元|街道|镇|村|小区)/.test(text)) return true
  if (/^[\d\s*]+$/.test(text) && text.length > 8) return true
  return false
}

/**
 * 检查是否为纯价格行
 */
function isPriceOnly(text) {
  // "¥199.00" 或 "实付：99" 或 "￥50"
  if (/^[\s¥￥实付应付原价合计总计]*\d+\.?\d*[\s¥￥元]*$/.test(text)) return true
  
  // 数字占比超过80%
  const digits = text.replace(/[^0-9.]/g, '')
  const nonDigits = text.replace(/[0-9.¥￥\s]/g, '')
  if (digits.length > 0 && nonDigits.length === 0) return true
  
  return false
}

/**
 * 检查是否为店铺名
 */
function isShopName(text) {
  const shopPatterns = [
    '旗舰店', '专营店', '专卖店', '官方店', '自营店',
    '店铺', '官方', '品牌', '京东自营', '天猫'
  ]
  return shopPatterns.some(p => text.includes(p))
}

/**
 * 检查是否为按钮或操作提示
 */
function isButtonOrAction(text) {
  const actionPatterns = [
    '售后', '评价', '申请', '投诉', '客服', '联系商家',
    '查看详情', '查看物流', '申请退款', '确认收货',
    '再次购买', '追加评价', '分享', '复制'
  ]
  return actionPatterns.some(p => text.includes(p))
}

/**
 * 计算商品名候选得分（越高越可能是商品名）
 */
function scoreProductName(text) {
  let score = 0
  
  // 长度评分：10-80字符最佳
  const len = text.length
  if (len >= 10 && len <= 80) score += 30
  else if (len >= 5 && len <= 120) score += 15
  else score -= 20
  
  // 包含规格信息加分
  const specPatterns = [
    /\d+ml/i, /\d+g/i, /\d+kg/i, /\d+片/, /\d+包/, /\d+装/,
    /婴儿/, /儿童/, /宝宝/, /新生儿/, /幼儿/,
    /奶粉/, /尿不湿/, /纸尿裤/, /湿巾/, /衣服/, /裤子/, /玩具/
  ]
  specPatterns.forEach(p => {
    if (p.test(text)) score += 40
  })
  
  // 包含品牌名加分
  const brands = [
    '贝亲', '可心柔', 'babycare', '好孩子', '全棉时代', '英氏', '启初',
    '红色小象', '洁丽雅', '帮宝适', '好奇', '花王', '大王', '尤妮佳',
    '雀巢', '惠氏', '美赞臣', '爱他美', '飞鹤', '伊利', '君乐宝'
  ]
  brands.forEach(b => {
    if (text.toLowerCase().includes(b.toLowerCase())) score += 50
  })
  
  // 排除项减分
  if (isPaymentOrAmountHint(text)) score -= 200
  if (isLogisticsInfo(text)) score -= 200
  if (isAddressOrPhone(text)) score -= 200
  if (isPriceOnly(text)) score -= 200
  if (isShopName(text)) score -= 100
  if (isButtonOrAction(text)) score -= 100
  
  // 包含金额减分（商品名不应该有"X元"）
  if (/\d+元/.test(text)) score -= 80
  if (/扣款/.test(text)) score -= 100
  if (/自动/.test(text) && /扣/.test(text)) score -= 150
  
  return score
}

/**
 * 解析订单（智能候选评分）
 */
function parseOrder(texts) {
  console.log('开始解析订单, 文字行数:', texts.length)
  console.log('原始文字:', texts)
  
  // 收集所有候选行并评分
  const candidates = texts.map(text => ({
    text: text.trim(),
    score: scoreProductName(text.trim())
  })).filter(c => c.score > 0)
  
  // 按分数排序
  candidates.sort((a, b) => b.score - a.score)
  
  console.log('商品名候选:', candidates.slice(0, 5))
  
  // 取最高分作为商品名
  let productName = candidates.length > 0 ? candidates[0].text : ''
  
  // 如果没找到，使用兜底逻辑：找第一个包含母婴关键词的行
  if (!productName) {
    for (const text of texts) {
      const t = text.trim()
      if (t.length < 5 || t.length > 150) continue
      if (isPaymentOrAmountHint(t)) continue
      if (isLogisticsInfo(t)) continue
      if (isAddressOrPhone(t)) continue
      if (isPriceOnly(t)) continue
      if (isShopName(t)) continue
      if (isButtonOrAction(t)) continue
      
      if (/(婴儿|儿童|宝宝|母婴|孕妇|产妇|奶粉|尿布|纸尿裤|湿巾|玩具|衣服)/.test(t)) {
        productName = t
        break
      }
    }
  }
  
  // 提取价格（优先找"实付"、"实付款"、"合计"等关键词附近的价格）
  let price = 0
  
  // 先找实付金额
  for (const text of texts) {
    if (text.includes('实付') || text.includes('实付款') || text.includes('合计') || text.includes('总计')) {
      const match = text.match(/[¥￥]?\s*(\d+\.?\d*)/)
      if (match) {
        const p = parseFloat(match[1])
        if (p > 0 && p < 10000) {
          price = p
          break
        }
      }
    }
  }
  
  // 如果没找到，找任意带 ¥ 的价格
  if (price === 0) {
    for (const text of texts) {
      if (text.includes('¥') || text.includes('￥')) {
        const match = text.match(/[¥￥]\s*(\d+\.?\d*)/)
        if (match) {
          const p = parseFloat(match[1])
          if (p > 1 && p < 10000) {
            price = p
            break
          }
        }
      }
    }
  }
  
  console.log('解析结果:', { productName, price })
  return { productName, price, quantity: 1 }
}

/**
 * 智能识别商品分类
 */
function recognizeCategory(productName) {
  if (!productName) return 7
  
  const categoryKeywords = {
    '1': ['奶粉', '奶瓶', '辅食', '米粉', '果泥', '营养', '喂养', '母乳', '安抚奶嘴', '口水', '吸管杯', '学饮杯', '围嘴', '饭兜', '餐椅', '碗勺', '餐具'],
    '2': ['尿布', '纸尿裤', '尿不湿', '湿巾', '洗护', '沐浴', '护肤', '爽身粉', '护臀', '爽身露', '润肤露', '桃子水', '马桶垫', '产妇', '一次性', '抗菌', '旅行', '酒店', '月子', '护理', '清洁', '洗衣', '柔顺', '消毒', '浴盆', '浴巾', '毛巾', '口水巾', '纸巾', '抽纸', '柔纸巾', '棉柔巾', '洗脸巾'],
    '3': ['衣服', '裤子', '鞋', '帽', '袜', '连体衣', '套装', '棉服', '外套', '内衣', '睡衣', '睡袋', '抱被', '包被', '学步鞋', '机能鞋'],
    '4': ['玩具', '积木', '摇铃', '绘本', '图书', '拼图', '音乐', '游戏', '玩偶', '毛绒', '球类', '爬行', '健身架', '游戏垫', '帐篷'],
    '5': ['疫苗', '体温', '药', '保健品', '钙', '维生素', '医疗', '退热', '感冒', '咳嗽', '腹泻', '益生菌', 'DHA', '鱼肝油'],
    '6': ['早教', '课程', '学习', '启蒙', '教育', '识字', '数学', '英语', '国学', '古诗', '故事', '儿歌', '动画', '点读', '学习机', '故事机']
  }

  for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (productName.includes(keyword)) {
        return parseInt(categoryId)
      }
    }
  }

  return 7
}

/**
 * 云函数入口函数
 */
async function main(event, context) {
  console.log('OCR 云函数被调用')

  try {
    const { image, imgUrl } = event
    
    let imageBase64 = null
    
    if (image) {
      imageBase64 = image
    } else if (imgUrl) {
      imageBase64 = await downloadImageFromCloudStorage(imgUrl)
    } else {
      return { success: false, error: '请提供图片数据 (image 或 imgUrl)' }
    }

    const accessToken = await getBaiduAccessToken()
    const result = await baiduOCR(imageBase64, accessToken)

    if (result.error_code) {
      return {
        success: false,
        error: 'OCR 识别失败: ' + (result.error_msg || '未知错误'),
        errorCode: result.error_code
      }
    }

    const words = result.words_result || []
    const texts = words.map(item => item.words)

    if (texts.length === 0) {
      return {
        success: true,
        data: {
          productName: '未识别商品',
          price: 0,
          quantity: 1,
          platform: 'other',
          categoryId: 7,
          rawTexts: []
        }
      }
    }

    // 判断平台
    const allText = texts.join(' ')
    let platform = 'jd'
    if (allText.includes('淘宝') || allText.includes('天猫')) platform = 'taobao'
    else if (allText.includes('拼多多')) platform = 'pdd'
    else if (allText.includes('抖音')) platform = 'douyin'

    const parsedResult = parseOrder(texts)
    const categoryId = recognizeCategory(parsedResult.productName || '')

    return {
      success: true,
      data: {
        productName: parsedResult.productName || '未识别商品',
        price: parsedResult.price || 0,
        quantity: parsedResult.quantity || 1,
        platform: platform,
        categoryId: categoryId,
        rawTexts: texts.slice(0, 10)
      }
    }

  } catch (error) {
    console.error('OCR 识别失败:', error)
    return { success: false, error: error.message || '识别失败，请重试' }
  }
}

exports.main = main
exports.recognizeCategory = recognizeCategory
exports.parseOrder = parseOrder
