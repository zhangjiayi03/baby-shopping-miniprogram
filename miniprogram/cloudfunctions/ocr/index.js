// 云函数入口文件 - 百度 OCR 识别（支持云存储 URL）
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度 OCR 配置 - 从云函数环境变量读取
// 在云函数控制台设置：BAIDU_API_KEY 和 BAIDU_SECRET_KEY
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
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

/**
 * 百度 OCR 识别
 */
async function baiduOCR(imageBase64, accessToken) {
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`
  
  console.log('调用百度 OCR API...')
  
  const res = await axios.post(
    url,
    `image=${encodeURIComponent(imageBase64)}&detect_direction=true`,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    }
  )

  console.log('百度 OCR 返回:', JSON.stringify(res.data).substring(0, 200))
  return res.data
}

/**
 * 从云存储下载图片并转为 base64
 */
async function downloadImageFromCloudStorage(imgUrl) {
  console.log('从云存储下载图片:', imgUrl)
  
  const result = await cloud.downloadFile({
    fileID: imgUrl
  })
  
  if (result.fileContent) {
    console.log('图片下载成功, 大小:', result.fileContent.length)
    return result.fileContent.toString('base64')
  }
  
  throw new Error('下载文件内容为空')
}

/**
 * 解析订单（通用解析逻辑）
 */
function parseOrder(texts) {
  console.log('开始解析订单, 文字行数:', texts.length)
  
  let productName = ''
  let price = 0
  let quantity = 1

  const excludeKeywords = ['售后', '服务', '完成', '感谢', '支持', '订单', 
                           '时间', '地址', '电话', '收货', '支付', '配送',
                           '查看', '评价', '申请', '客服', '详情', '更多',
                           '京东物流', '京东快递', '电子面单',
                           '已签收', '联系商家', '申请退款', '极速发货',
                           '拼多多', '淘宝', '天猫', '抖音',
                           // 排除店铺名相关
                           '店铺', '专营店', '旗舰店', '官方', '旗舰店', '专卖店',
                           '官方旗舰店', '自营旗舰店', '官方专卖店', '品牌旗舰店',
                           '京东自营', '天猫旗舰店', '天猫专营', '淘宝店铺']

  const isAddressOrPhone = (text) => {
    if (/\d{3,4}\*\*\*\d{4}/.test(text)) return true
    if (/(工业园|开发区|路|号|楼|室|栋|单元|街道|镇|村)/.test(text)) return true
    return false
  }

  // 检查是否主要是价格数字（排除包含大量数字的行）
  const isPriceOnly = (text) => {
    // 如果文本主要是数字和货币符号，认为是价格
    const digits = text.replace(/[^0-9.]/g, '')
    const nonDigits = text.replace(/[0-9.¥￥\s]/g, '')
    // 如果数字占比超过 70%，且没有 meaningful 的文字，认为是价格
    if (digits.length > 0 && nonDigits.length < 3) {
      return true
    }
    // 单独的价格行（如 "¥199.00" 或 "实付：99"）
    if (/^[\s¥￥实付应付原价]*\d+\.?\d*[\s¥￥元]*$/.test(text)) {
      return true
    }
    return false
  }

  // 查找商品名
  for (const text of texts) {
    // 跳过纯价格数字的行
    if (isPriceOnly(text)) {
      console.log('跳过价格行:', text)
      continue
    }
    
    const hasSpec = /(\d+ml|\d+g|\d+片|\d+包|\d+装|婴儿|儿童|宝宝|奶粉|尿不湿|纸尿裤|爽身露|润肤露|马桶垫|产妇|一次性|抗菌|加厚|夹棉|旅行|酒店|月子|湿巾|洗护|沐浴|护肤|爽身粉|护臀|桃子水|口水|辅食|米粉|果泥|奶瓶|喂养|安抚奶嘴|衣服|裤子|鞋|帽|袜|连体衣|套装|棉服|外套|玩具|积木|摇铃|绘本|图书|拼图|疫苗|体温|保健品|钙|维生素|早教|课程|学习|启蒙)/i.test(text)
    const hasBrand = /(贝亲|可心柔|babycare|好孩子|全棉时代|英氏|启初|红色小象|洁丽雅|GRACE|帮宝适|好奇|花王|大王|尤妮佳|露安适|妮飘|宜婴|雀巢|惠氏|美赞臣|爱他美|诺优能|合生元|飞鹤|伊利|君乐宝|完达山|贝因美|澳优|海普诺凯|佳贝艾特|蓝河|绵羊奶|可瑞康|牛栏|喜宝|泓乐|特福芬|康维多|美素佳儿)/i.test(text)
    const shouldExclude = excludeKeywords.some(kw => text.includes(kw))
    const isAddress = isAddressOrPhone(text)
    
    if ((hasSpec || hasBrand) && !shouldExclude && !isAddress && text.length > 5 && text.length < 150) {
      productName = text.trim()
      break
    }
  }

  // 如果没找到，查找包含母婴关键词的行
  if (!productName) {
    for (const text of texts) {
      // 跳过纯价格数字的行
      if (isPriceOnly(text)) {
        continue
      }
      
      const hasBabyKeyword = /(婴儿|儿童|宝宝|母婴|孕妇|产妇|新生儿|幼儿|少儿|童|婴|幼)/i.test(text)
      const shouldExclude = excludeKeywords.some(kw => text.includes(kw))
      const isAddress = isAddressOrPhone(text)
      
      if (hasBabyKeyword && !shouldExclude && !isAddress && text.length > 5 && text.length < 150) {
        productName = text.trim()
        break
      }
    }
  }

  // 提取价格
  for (const text of texts) {
    if (text.includes('¥') || text.includes('￥')) {
      const priceMatch = text.match(/[¥￥]\s*(\d+\.?\d*)/)
      if (priceMatch) {
        const possiblePrice = parseFloat(priceMatch[1])
        if (possiblePrice > 1 && possiblePrice < 10000) {
          price = possiblePrice
          break
        }
      }
    }
  }

  console.log('解析结果:', { productName, price, quantity })
  return { productName, price, quantity }
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
  console.log('OCR 云函数被调用, event:', JSON.stringify(event).substring(0, 200))

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
      console.log('错误：没有提供图片')
      return {
        success: false,
        error: '请提供图片数据 (image 或 imgUrl)'
      }
    }

    // 获取百度 Access Token
    let accessToken
    try {
      accessToken = await getBaiduAccessToken()
    } catch (tokenErr) {
      console.error('获取 Token 失败:', tokenErr)
      return {
        success: false,
        error: '获取百度授权失败: ' + tokenErr.message
      }
    }

    // 调用百度 OCR
    let result
    try {
      result = await baiduOCR(imageBase64, accessToken)
    } catch (ocrErr) {
      console.error('调用百度 OCR 失败:', ocrErr)
      return {
        success: false,
        error: 'OCR 调用失败: ' + ocrErr.message
      }
    }

    // 检查百度返回错误
    if (result.error_code) {
      console.error('百度 OCR 返回错误:', result)
      return {
        success: false,
        error: 'OCR 识别失败: ' + (result.error_msg || '未知错误'),
        errorCode: result.error_code
      }
    }

    // 提取文字
    const words = result.words_result || []
    const texts = words.map(item => item.words)
    console.log('识别到文字行数:', texts.length, '内容:', texts.slice(0, 3).join(' | '))

    // 如果没有识别到任何文字
    if (texts.length === 0) {
      console.log('没有识别到任何文字')
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
    
    if (allText.includes('淘宝') || allText.includes('天猫')) {
      platform = 'taobao'
    } else if (allText.includes('拼多多') || allText.includes('拼')) {
      platform = 'pdd'
    } else if (allText.includes('抖音')) {
      platform = 'douyin'
    }

    // 解析订单信息
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
    return {
      success: false,
      error: error.message || '识别失败，请重试'
    }
  }
}

// 导出
exports.main = main
exports.recognizeCategory = recognizeCategory
exports.parseOrder = parseOrder
