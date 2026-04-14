// 云函数入口文件 - 百度 OCR 识别 + 文心一言后处理（优化版）
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取配置（安全方式）
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''

if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
  console.error('⚠️ 警告：百度 API Key 未配置，请设置云函数环境变量')
}

let cachedToken = null
let tokenExpire = 0

// LLM 结果缓存（避免重复调用）
const llmCache = new Map()
const MAX_CACHE_SIZE = 100

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

/**
 * 使用文心一言从 OCR 文本中提取商品信息
 * @param {string[]} texts - OCR 识别的文字行
 * @param {string} accessToken - 百度 Access Token
 * @returns {Promise<{productName: string, price: number, platform: string} | null>}
 */
async function extractWithLLM(texts, accessToken) {
  // 生成缓存 key（取前 50 字符 + 行数）
  const cacheKey = texts.slice(0, 3).join('').substring(0, 50) + '|' + texts.length
  if (llmCache.has(cacheKey)) {
    console.log('✅ 使用缓存结果')
    return llmCache.get(cacheKey)
  }

  const prompt = `你是一个母婴购物账本助手。请从以下订单截图文字中准确提取：

1. **商品名称**：
   - 必须是真实的商品名，包含品牌和产品名
   - 排除干扰信息：扣款、自动扣款、先用后付、支付、物流、售后服务、客服、评价、店铺名、平台名、广告语
   - 保留规格信息（如：240ml、3段、超薄款）

2. **实付金额**：
   - 找"实付"、"到手价"、"合计"、"应付"后面的金额
   - 不要取原价、划线价

3. **购物平台**：
   - 淘宝/天猫 → "taobao"
   - 京东 → "jd"
   - 拼多多 → "pdd"
   - 抖音 → "douyin"
   - 美团 → "meituan"
   - 其他 → "other"

文字内容：
${texts.join('\n')}

请严格按以下 JSON 格式返回，不要有多余文字：
{"productName": "商品名", "price": 数字, "platform": "平台代码"}

如果无法识别，返回：
{"productName": "未识别商品", "price": 0, "platform": "other"}`

  try {
    console.log('🤖 调用文心一言提取商品信息...')
    
    // 调用文心一言 ERNIE-Bot-4 API
    const res = await axios.post(
      `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro?access_token=${accessToken}`,
      {
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,  // 低温度，更稳定
        top_p: 0.9
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    const content = res.data?.result
    if (!content) {
      console.log('⚠️ 文心一言返回空结果')
      return null
    }

    console.log('📝 文心一言原始返回:', content.substring(0, 200))

    // 解析 JSON
    const jsonMatch = content.match(/\{[^{}]*\}/)
    if (!jsonMatch) {
      console.log('⚠️ 无法从返回中解析 JSON')
      return null
    }

    const result = JSON.parse(jsonMatch[0])
    
    // 验证结果
    if (!result.productName || result.productName === '未识别商品') {
      return null
    }

    const extracted = {
      productName: String(result.productName || '未识别商品').trim(),
      price: parseFloat(result.price) || 0,
      platform: String(result.platform || 'other')
    }

    // 缓存结果
    if (llmCache.size > MAX_CACHE_SIZE) {
      const firstKey = llmCache.keys().next().value
      llmCache.delete(firstKey)
    }
    llmCache.set(cacheKey, extracted)

    console.log('✅ LLM 提取成功:', extracted)
    return extracted

  } catch (error) {
    console.error('❌ 文心一言调用失败:', error.message)
    return null
  }
}

function parseOrder(texts) {
  console.log('开始解析订单，文字行数:', texts.length)
  
  let productName = ''
  let price = 0
  let quantity = 1

  const excludeKeywords = ['售后', '服务', '完成', '感谢', '支持', '订单', '时间', '地址', '电话', '收货', '支付', '配送', '查看', '评价', '申请', '客服', '详情', '更多', '京东物流', '京东快递', '电子面单', '已签收', '联系商家', '申请退款', '极速发货', '拼多多', '淘宝', '天猫', '抖音', '店铺', '旗舰店', '宝贝', '详情', '评论', '推荐', '搜索', '购物车', '我的', '首页', '分类', '天前', '小时内', '自动确认', '自动扣款']

  const isAddressOrPhone = (text) => {
    if (/\d{3,4}\*\*\*\d{4}/.test(text)) return true
    if (/(工业园|开发区|路|号|楼|室|栋|单元|街道|镇|村)/.test(text)) return true
    return false
  }

  // 扩展品牌关键词
  const brandKeywords = ['贝亲', 'babycare', '好孩子', '全棉时代', '帮宝适', '好奇', '花王', '雀巢', '惠氏', '爱他美', '飞利浦', '新安怡', 'philips', 'avent', 'NUK', 'hegen', '可么多么', 'comotomo', '世喜', '小白熊', '小白象', '童泰', '巴拉巴拉', '安奈儿']
  
  // 扩展母婴产品关键词
  const babyKeywords = ['婴儿', '儿童', '宝宝', '母婴', '奶粉', '尿不湿', '纸尿裤', '湿巾', '玩具', '衣服', '鞋', '帽', '安抚', '奶嘴', '奶瓶', '吸奶器', '温奶器', '消毒柜', '洗澡盆', '浴盆', '推车', '安全座椅', '餐椅', '围兜', '口水巾', '毛巾', '被子', '睡袋', '枕头', '床垫', '摇篮', '床铃', '安抚玩偶', '牙胶', '磨牙棒', '辅食', '米粉', '果泥', '零食', '营养品', '维生素', '钙', '锌', '铁', '益生菌', '防晒', '面霜', '润肤', '洗发', '沐浴', '洗衣液', '洗衣皂', '防胀气', '防吐奶', '学饮杯', '水杯', '碗', '勺子', '叉子', '辅食机', '料理机', '围栏', '爬行垫', '地垫', '收纳']

  // 查找商品名 - 智能评分
  let candidateLines = []
  for (const text of texts) {
    if (isAddressOrPhone(text)) continue
    if (excludeKeywords.some(kw => text.includes(kw))) continue
    if (/^[\s\d.￥¥:：元]+$/.test(text)) continue
    if (text.length < 3 || text.length > 200) continue
    
    let score = 0
    
    // 品牌关键词高分
    for (const brand of brandKeywords) {
      if (text.toLowerCase().includes(brand.toLowerCase())) {
        score += 15
        break
      }
    }
    
    // 母婴产品关键词高分
    for (const kw of babyKeywords) {
      if (text.includes(kw)) {
        score += 12
        break
      }
    }
    
    // 规格信息加分
    if (/\d+ml|\d+g|\d+kg|\d+片|\d+包|\d+装|\d+个|\d+只|\d+套/i.test(text)) score += 5
    
    // 合理长度加分
    if (text.length > 5 && text.length < 50) score += 3
    
    // 包含数字和中文（常见商品名格式）
    if (/[\u4e00-\u9fa5].*\d|\d.*[\u4e00-\u9fa5]/.test(text)) score += 2
    
    // 排除纯价格行
    if (/^[￥¥]?\d+\.?\d*\s*(元)?$/.test(text.trim())) score -= 50
    
    // 排除时间格式
    if (/^\d{1,2}:\d{2}/.test(text.trim())) score -= 50
    
    candidateLines.push({ text: text.trim(), score })
  }
  
  candidateLines.sort((a, b) => b.score - a.score)
  
  // 输出调试信息
  console.log('商品名候选:', candidateLines.slice(0, 5))
  
  if (candidateLines.length > 0 && candidateLines[0].score > 0) {
    productName = candidateLines[0].text
    console.log('✅ 找到商品名:', productName, '分数:', candidateLines[0].score)
  } else {
    // 后备：取第一行非排除文本
    for (const text of texts) {
      if (!excludeKeywords.some(kw => text.includes(kw)) && text.length > 3) {
        productName = text.trim()
        break
      }
    }
    console.log('⚠️ 使用后备商品名:', productName)
  }

  // ========== 价格提取 - 优先提取关键词后的数字 ==========
  let actualPayPrice = null
  let totalPrice = null
  let allPrices = []
  
  for (const text of texts) {
    // 排除时间格式
    if (/^\d{1,2}:\d{2}$/.test(text.trim())) continue
    
    // 提取价格 - 支持多种格式
    const extractPricesFromText = (txt) => {
      const prices = []
      // 格式 1: 实付：9.9 / 到手价 9.9
      const keywordMatch = txt.match(/(?:实付 | 到手 | 应付 | 合计 | 共减|总额)[：:\s]*(\d+\.?\d*)/i)
      if (keywordMatch) {
        prices.push(parseFloat(keywordMatch[1]))
      }
      // 格式 2: ￥9.9 / ¥9.9
      const symbolMatch = txt.matchAll(/(?:￥|¥)\s*(\d+\.?\d*)/g)
      for (const m of symbolMatch) {
        prices.push(parseFloat(m[1]))
      }
      // 格式 3: 9.9 元
      const yuanMatch = txt.match(/(\d+\.?\d*)\s*元/i)
      if (yuanMatch) {
        prices.push(parseFloat(yuanMatch[1]))
      }
      return prices
    }
    
    const prices = extractPricesFromText(text)
    prices.forEach(p => {
      if (p > 0.1 && p < 10000) {
        allPrices.push({ price: p, text })
        
        if (text.includes('实付') || text.includes('到手')) {
          actualPayPrice = p
          console.log('💰 找到实付/到手价:', p, '|', text)
        }
        if ((text.includes('合计') || text.includes('总额') || text.includes('共减')) && !actualPayPrice) {
          totalPrice = p
          console.log('💰 找到合计/总额:', p, '|', text)
        }
      }
    })
  }
  
  console.log('📊 所有价格候选:', allPrices.map(p => ({ price: p.price, text: p.text.substring(0, 30) })))
  
  // 选择价格：实付 > 合计 > 最大值
  if (actualPayPrice !== null) {
    price = actualPayPrice
    console.log('✅ 使用实付价格:', price)
  } else if (totalPrice !== null) {
    price = totalPrice
    console.log('✅ 使用合计价格:', price)
  } else if (allPrices.length > 0) {
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
  
  // 分类关键词映射（按优先级排序）
  const categoryMap = {
    '2': ['尿布', '纸尿裤', '尿不湿', '湿巾', '洗护', '沐浴', '护肤', '爽身粉', '护臀', '爽身露', '润肤露', '桃子水', '马桶垫', '产妇', '一次性', '抗菌', '旅行', '酒店', '月子', '护理', '清洁', '洗衣', '柔顺', '消毒', '浴盆', '浴巾', '毛巾', '口水巾', '纸巾', '抽纸', '柔纸巾', '棉柔巾', '洗脸巾', '纸面巾', '手口湿巾'],
    '1': ['奶粉', '奶瓶', '辅食', '米粉', '果泥', '营养', '喂养', '母乳', '安抚奶嘴', '口水', '吸管杯', '学饮杯', '围嘴', '饭兜', '餐椅', '碗勺', '餐具'],
    '3': ['衣服', '裤子', '鞋', '帽', '袜', '连体衣', '套装', '棉服', '外套', '内衣', '睡衣', '睡袋', '抱被', '包被', '学步鞋', '机能鞋'],
    '4': ['玩具', '积木', '摇铃', '绘本', '图书', '拼图', '音乐', '游戏', '玩偶', '毛绒', '球类', '爬行', '健身架', '游戏垫', '帐篷'],
    '5': ['疫苗', '体温', '药', '保健品', '钙', '维生素', '医疗', '退热', '感冒', '咳嗽', '腹泻', '益生菌', 'DHA', '鱼肝油'],
    '6': ['早教', '课程', '学习', '启蒙', '教育', '识字', '数学', '英语', '国学', '古诗', '故事', '儿歌', '动画', '点读', '学习机', '故事机']
  }

  // 逐个检查
  for (const [categoryId, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (productName.includes(keyword)) {
        console.log('✅ 匹配到分类:', categoryId, '(' + (categoryId === '2' ? '洗护' : categoryId === '1' ? '喂养' : categoryId === '3' ? '服装' : categoryId === '4' ? '玩具' : categoryId === '5' ? '医疗' : '教育') + ')', '关键词:', keyword)
        return parseInt(categoryId)
      }
    }
  }
  
  console.log('⚠️ 未匹配到分类，返回默认值 7（其他）')
  return 7
}

async function main(event, context) {
  console.log('OCR 云函数被调用，event:', JSON.stringify(event).substring(0, 200))

  // 检查 API Key 配置
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    return { 
      success: false, 
      error: '百度 API Key 未配置，请在云函数环境变量中设置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' 
    }
  }

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

    // ========== 第一步：尝试用 LLM 提取商品信息 ==========
    let llmResult = null
    try {
      llmResult = await extractWithLLM(texts, accessToken)
    } catch (llmErr) {
      console.log('⚠️ LLM 提取失败，将使用规则解析:', llmErr.message)
    }

    let productName, price, platform, categoryId

    if (llmResult && llmResult.productName !== '未识别商品') {
      // LLM 提取成功
      productName = llmResult.productName
      price = llmResult.price
      platform = llmResult.platform
      categoryId = recognizeCategory(productName)
      console.log('✅ 使用 LLM 提取结果:', { productName, price, platform, categoryId })
    } else {
      // 回退到规则解析
      console.log('📋 LLM 未成功，使用规则解析...')
      
      // 判断平台 - 根据订单特征
      const allText = texts.join(' ')
      platform = 'other'
      if (allText.includes('淘宝') || allText.includes('天猫')) {
        platform = 'taobao'
      } else if (allText.includes('京东') || allText.includes('JD') || allText.includes('京')) {
        platform = 'jd'
      } else if (allText.includes('拼多多') || allText.includes('拼')) {
        platform = 'pdd'
      } else if (allText.includes('抖音')) {
        platform = 'douyin'
      } else if (allText.includes('美团') || allText.includes('美团外卖')) {
        platform = 'meituan'
      }

      const parsedResult = parseOrder(texts)
      productName = parsedResult.productName || '未识别商品'
      price = parsedResult.price || 0
      categoryId = recognizeCategory(productName)
      console.log('📊 规则解析结果 - 平台:', platform, '分类 ID:', categoryId, '商品名:', productName)
    }

    const now = new Date();
    const response = {
      success: true,
      data: {
        productName: productName,
        price: price,
        quantity: 1,
        platform: platform,
        categoryId: categoryId,
        orderTime: now.toISOString().split('T')[0],
        rawTexts: texts.slice(0, 10)
      }
    }
    
    console.log('✅ 返回给前端的数据:', JSON.stringify(response))
    return response

  } catch (error) {
    console.error('OCR 识别失败:', error)
    return { success: false, error: error.message || '识别失败，请重试' }
  }
}

exports.main = main
exports.recognizeCategory = recognizeCategory
exports.parseOrder = parseOrder
exports.extractWithLLM = extractWithLLM
