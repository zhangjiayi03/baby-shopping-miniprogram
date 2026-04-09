// 云函数入口文件 - 百度 OCR 识别（最终版 - 价格提取修复）
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置
const BAIDU_API_KEY = 'aWb1o2tbEqXuH2TN41iUuhIt'
const BAIDU_SECRET_KEY = 'TLwVw2OCU5JoQtjS56HI5OcGVgihlfqH'

let cachedToken = null
let tokenExpire = 0

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
    console.log('获取 Access Token 成功')
    return data.access_token
  }
  throw new Error(data.error_description || '获取 Access Token 失败')
}

async function baiduOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`
  console.log('调用百度 OCR API...')
  
  const res = await axios.post(
    url,
    `image=${encodeURIComponent(imageBase64)}&detect_direction=true`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    }
  )
  console.log('百度 OCR 返回:', JSON.stringify(res.data).substring(0, 500))
  return res.data
}

async function downloadImageFromCloudStorage(imgUrl) {
  console.log('从云存储下载图片:', imgUrl)
  const result = await cloud.downloadFile({ fileID: imgUrl })
  if (result.fileContent) {
    console.log('图片下载成功，大小:', result.fileContent.length)
    return result.fileContent.toString('base64')
  }
  throw new Error('下载文件内容为空')
}

function parseOrder(texts) {
  console.log('开始解析订单，文字行数:', texts.length)
  
  let productName = ''
  let price = 0
  let quantity = 1

  const excludeKeywords = ['售后', '服务', '完成', '感谢', '支持', '订单', '时间', '地址', '电话', '收货', '支付', '配送', '查看', '评价', '申请', '客服', '详情', '更多', '京东物流', '京东快递', '电子面单', '已签收', '联系商家', '申请退款', '极速发货', '拼多多', '淘宝', '天猫', '抖音', '店铺', '旗舰店']

  const isAddressOrPhone = (text) => {
    if (/\d{3,4}\*\*\*\d{4}/.test(text)) return true
    if (/(工业园 | 开发区 | 路 | 号 | 楼 | 室 | 栋 | 单元 | 街道 | 镇 | 村)/.test(text)) return true
    return false
  }

  // 查找商品名
  let candidateLines = []
  for (const text of texts) {
    if (isAddressOrPhone(text)) continue
    if (excludeKeywords.some(kw => text.includes(kw))) continue
    if (/^[\s\d.￥¥:：元]+$/.test(text)) continue
    if (text.length < 3 || text.length > 200) continue
    
    let score = 0
    if (/(?:婴儿 | 儿童 | 宝宝 | 母婴 | 奶粉 | 尿不湿 | 纸尿裤 | 湿巾 | 玩具 | 衣服 | 鞋 | 帽)/i.test(text)) score += 10
    if (/(?:贝亲|babycare|好孩子 | 全棉时代 | 帮宝适 | 好奇 | 花王 | 雀巢 | 惠氏 | 爱他美)/i.test(text)) score += 5
    if (/\d+ml|\d+g|\d+片|\d+包|\d+装/i.test(text)) score += 3
    if (text.length > 10) score += 2
    
    candidateLines.push({ text: text.trim(), score })
  }
  
  candidateLines.sort((a, b) => b.score - a.score)
  if (candidateLines.length > 0) {
    productName = candidateLines[0].text
    console.log('找到商品名:', productName, '分数:', candidateLines[0].score)
  }

  // ========== 价格提取 - 简化版 ==========
  let actualPayPrice = null  // 实付/到手价
  let totalPrice = null      // 合计/总额
  let allPrices = []
  
  for (const text of texts) {
    // 排除时间格式
    if (/^\d{1,2}:\d{2}$/.test(text.trim())) continue
    
    // 提取所有价格
    const priceMatches = text.matchAll(/(?:￥|¥)\s*(\d+\.?\d*)/g)
    for (const match of priceMatches) {
      const p = parseFloat(match[1])
      if (p > 0.1 && p < 10000) {
        allPrices.push({ price: p, text })
        
        // 检查关键词
        if (/(实付 | 到手)/i.test(text)) {
          actualPayPrice = p
          console.log('💰 找到实付/到手价:', p, '|', text)
        }
        if (/(合计 | 总额 | 共)/i.test(text) && !/(实付 | 到手)/i.test(text)) {
          totalPrice = p
          console.log('💰 找到合计/总额:', p, '|', text)
        }
      }
    }
  }
  
  console.log('📊 所有价格:', allPrices.map(p => p.price))
  
  // 选择价格
  if (actualPayPrice !== null) {
    price = actualPayPrice
    console.log('✅ 使用实付/到手价:', price)
  } else if (totalPrice !== null) {
    price = totalPrice
    console.log('✅ 使用合计/总额:', price)
  } else if (allPrices.length > 0) {
    // 取合理范围内的最大值
    const valid = allPrices.filter(p => p.price >= 0.1 && p.price <= 500)
    valid.sort((a, b) => b.price - a.price)
    if (valid.length > 0) {
      price = valid[0].price
      console.log('✅ 使用推测价格:', price)
    }
  }

  return { productName, price, quantity }
}

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

async function main(event, context) {
  console.log('OCR 云函数被调用，event:', JSON.stringify(event).substring(0, 200))

  try {
    const { image, imgUrl } = event
    let imageBase64 = null
    
    if (image) {
      console.log('使用 base64 图片')
      imageBase64 = image
    } else if (imgUrl) {
      console.log('使用云存储图片:', imgUrl)
      imageBase64 = await downloadImageFromCloudStorage(imgUrl)
    } else {
      return { success: false, error: '请提供图片数据 (image 或 imgUrl)' }
    }

    let accessToken
    try {
      accessToken = await getBaiduAccessToken()
    } catch (tokenErr) {
      return { success: false, error: '获取百度授权失败：' + tokenErr.message }
    }

    let result
    try {
      result = await baiduOCR(imageBase64, accessToken)
    } catch (ocrErr) {
      return { success: false, error: 'OCR 调用失败：' + ocrErr.message }
    }

    if (result.error_code) {
      return { success: false, error: 'OCR 识别失败：' + (result.error_msg || '未知错误'), errorCode: result.error_code }
    }

    const words = result.words_result || []
    const texts = words.map(item => item.words)
    console.log('识别到文字行数:', texts.length)

    if (texts.length === 0) {
      return {
        success: true,
        data: { productName: '未识别商品', price: 0, quantity: 1, platform: 'other', categoryId: 7, rawTexts: [] }
      }
    }

    const allText = texts.join(' ')
    let platform = 'jd'
    if (allText.includes('淘宝') || allText.includes('天猫')) platform = 'taobao'
    else if (allText.includes('拼多多') || allText.includes('拼')) platform = 'pdd'
    else if (allText.includes('抖音')) platform = 'douyin'

    const parsedResult = parseOrder(texts)
    const categoryId = recognizeCategory(parsedResult.productName || '')

    const response = {
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
    
    console.log('返回结果:', JSON.stringify(response))
    return response

  } catch (error) {
    console.error('OCR 识别失败:', error)
    return { success: false, error: error.message || '识别失败，请重试' }
  }
}

exports.main = main
exports.recognizeCategory = recognizeCategory
exports.parseOrder = parseOrder
