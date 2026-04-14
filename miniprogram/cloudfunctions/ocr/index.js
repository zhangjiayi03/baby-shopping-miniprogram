// 云函数入口文件 - 多模态大模型识别订单截图（VL 版本）
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取配置
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''
// 千帆平台专用密钥（VL 多模态模型需要）
const QIANFAN_API_KEY = process.env.QIANFAN_API_KEY || BAIDU_API_KEY
const QIANFAN_SECRET_KEY = process.env.QIANFAN_SECRET_KEY || BAIDU_SECRET_KEY

if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
  console.error('⚠️ 警告：百度 API Key 未配置，请设置云函数环境变量')
}
if (!QIANFAN_API_KEY || !QIANFAN_SECRET_KEY) {
  console.log('💡 提示：千帆 API Key 未单独配置，将使用百度通用密钥（可能不支持 VL 模型）')
}

let cachedBaiduToken = null
let baiduTokenExpire = 0
let cachedQianfanToken = null
let qianfanTokenExpire = 0

// 结果缓存
const resultCache = new Map()
const MAX_CACHE_SIZE = 50

/**
 * 获取百度 Access Token（用于 OCR）
 */
async function getBaiduAccessToken() {
  if (cachedBaiduToken && Date.now() < baiduTokenExpire) {
    return cachedBaiduToken
  }
  
  console.log('🔑 获取百度 Access Token...')
  
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

  if (res.data.access_token) {
    cachedBaiduToken = res.data.access_token
    baiduTokenExpire = Date.now() + (res.data.expires_in - 3600) * 1000
    console.log('✅ 获取百度 Access Token 成功')
    return cachedBaiduToken
  }
  
  throw new Error(res.data.error_description || '获取 Access Token 失败')
}

/**
 * 获取千帆平台 Access Token（用于 VL 多模态模型）
 */
async function getQianfanAccessToken() {
  if (cachedQianfanToken && Date.now() < qianfanTokenExpire) {
    return cachedQianfanToken
  }
  
  console.log('🔑 获取千帆 Access Token...')
  
  const params = new URLSearchParams()
  params.append('grant_type', 'client_credentials')
  params.append('client_id', QIANFAN_API_KEY)
  params.append('client_secret', QIANFAN_SECRET_KEY)

  const res = await axios.post(
    'https://aip.baidubce.com/oauth/2.0/token',
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    }
  )

  if (res.data.access_token) {
    cachedQianfanToken = res.data.access_token
    qianfanTokenExpire = Date.now() + (res.data.expires_in - 3600) * 1000
    console.log('✅ 获取千帆 Access Token 成功')
    return cachedQianfanToken
  }
  
  throw new Error(res.data.error_description || '获取千帆 Access Token 失败')
}

/**
 * 下载云存储图片并转 base64
 */
async function downloadImageFromCloudStorage(imgUrl) {
  console.log('📥 从云存储下载图片:', imgUrl)
  const result = await cloud.downloadFile({ fileID: imgUrl })
  if (result.fileContent) {
    console.log('✅ 图片下载成功，大小:', result.fileContent.length)
    return result.fileContent.toString('base64')
  }
  throw new Error('下载文件内容为空')
}

/**
 * 使用 ERNIE-4.5-Turbo-VL 多模态模型识别订单截图
 */
async function recognizeWithVL(imageBase64) {
  // 获取千帆专用 Token
  let accessToken
  try {
    accessToken = await getQianfanAccessToken()
  } catch (err) {
    console.error('❌ 获取千帆 Token 失败:', err.message)
    return null
  }
  
  console.log('🤖 调用 ERNIE-4.5-Turbo-VL 识别...')
  
  const prompt = `你是一个母婴购物账本助手。请分析这张订单截图，提取以下信息：

1. **商品名称**：
   - 必须是真实的商品名，包含品牌+产品名+规格
   - 排除：扣款、自动扣款、先用后付、支付成功、物流信息、售后服务、客服、评价、店铺名、广告语
   - 保留规格（如：240ml、3段、超薄款、L码）

2. **实付金额**：
   - 只取最终实付金额，不是原价或划线价

3. **购物平台**：
   - 淘宝/天猫 → "taobao"
   - 京东 → "jd"
   - 拼多多 → "pdd"
   - 抖音 → "douyin"
   - 美团 → "meituan"
   - 其他 → "other"

请严格按以下 JSON 格式返回，不要有任何多余文字：
{"productName":"商品名","price":数字,"platform":"平台代码"}`

  try {
    // 千帆平台 OpenAI 兼容格式
    const res = await axios.post(
      `https://qianfan.baidubce.com/v2/chat/completions?access_token=${accessToken}`,
      {
        model: 'ernie-4.5-turbo-vl-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    )

    const content = res.data?.choices?.[0]?.message?.content
    if (!content) {
      console.log('⚠️ VL 返回空结果，响应:', JSON.stringify(res.data))
      return null
    }

    console.log('📝 VL 原始返回:', content.substring(0, 300))

    // 解析 JSON
    const jsonMatch = content.match(/\{[^{}]*\}/)
    if (!jsonMatch) {
      console.log('⚠️ 无法解析 JSON')
      return null
    }

    const result = JSON.parse(jsonMatch[0])
    
    if (!result.productName || result.productName === '未识别商品') {
      return null
    }

    console.log('✅ VL 识别成功:', result)
    return {
      productName: String(result.productName).trim(),
      price: parseFloat(result.price) || 0,
      platform: String(result.platform || 'other')
    }

  } catch (error) {
    console.error('❌ VL 调用失败:', error.message)
    if (error.response?.data) {
      console.error('错误详情:', JSON.stringify(error.response.data))
    }
    return null
  }
}

/**
 * 根据商品名识别分类
 */
function recognizeCategory(productName) {
  if (!productName) return 7
  
  const categoryMap = {
    '2': ['尿布', '纸尿裤', '尿不湿', '湿巾', '洗护', '沐浴', '护肤', '爽身', '护臀', '润肤', '桃子水', '产妇', '一次性', '护理', '清洁', '洗衣', '柔顺', '消毒', '浴盆', '浴巾', '毛巾', '口水巾', '纸巾', '抽纸', '棉柔巾', '洗脸巾', '隔尿垫'],
    '1': ['奶粉', '奶瓶', '辅食', '米粉', '果泥', '营养', '喂养', '母乳', '安抚奶嘴', '吸管杯', '学饮杯', '围嘴', '饭兜', '餐椅', '碗勺', '餐具'],
    '3': ['衣服', '裤子', '鞋', '帽', '袜', '连体衣', '套装', '棉服', '外套', '内衣', '睡袋', '抱被', '学步鞋'],
    '4': ['玩具', '积木', '摇铃', '绘本', '拼图', '音乐', '游戏', '玩偶', '爬行', '健身架', '帐篷'],
    '5': ['疫苗', '体温', '药', '保健品', '钙', '维生素', '医疗', '退热', '益生菌', 'DHA', '鱼肝油'],
    '6': ['早教', '课程', '学习', '启蒙', '教育', '识字', '英语', '国学', '古诗', '故事', '儿歌', '动画', '点读', '学习机', '故事机']
  }

  for (const [categoryId, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (productName.includes(keyword)) {
        console.log('✅ 匹配分类:', categoryId, '关键词:', keyword)
        return parseInt(categoryId)
      }
    }
  }
  
  console.log('⚠️ 未匹配分类，返回 7（其他）')
  return 7
}

/**
 * 后备方案：使用百度通用 OCR（VL 失败时）
 */
async function fallbackOCR(imageBase64, accessToken) {
  console.log('📋 使用 OCR 后备方案...')
  
  try {
    const res = await axios.post(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`,
      `image=${encodeURIComponent(imageBase64)}&detect_direction=true`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      }
    )

    if (res.data.error_code) {
      console.log('⚠️ OCR 失败:', res.data.error_msg)
      return null
    }

    const words = res.data.words_result || []
    const texts = words.map(item => item.words)
    console.log('📝 OCR 识别到', texts.length, '行文字')

    if (texts.length === 0) return null

    // 简单规则提取商品名
    let productName = ''
    const excludeKeywords = ['售后', '服务', '完成', '感谢', '订单', '时间', '地址', '电话', '收货', '支付', '配送', '客服', '京东', '淘宝', '天猫', '拼多多', '抖音', '店铺', '签收', '取件']
    
    for (const text of texts) {
      if (excludeKeywords.some(kw => text.includes(kw))) continue
      if (text.length < 3 || text.length > 100) continue
      if (/^[\d.￥¥:：\s]+$/.test(text)) continue
      
      productName = text.trim()
      break
    }

    // 提取价格
    let price = 0
    for (const text of texts) {
      const match = text.match(/[￥¥]\s*(\d+\.?\d*)/)
      if (match) {
        price = parseFloat(match[1])
        if (price > 0 && price < 10000) break
      }
    }

    // 判断平台
    const allText = texts.join(' ')
    let platform = 'other'
    if (allText.includes('淘宝') || allText.includes('天猫')) platform = 'taobao'
    else if (allText.includes('京东') || allText.includes('JD')) platform = 'jd'
    else if (allText.includes('拼多多')) platform = 'pdd'
    else if (allText.includes('抖音')) platform = 'douyin'

    console.log('📋 OCR 结果:', { productName, price, platform })
    return {
      productName: productName || '未识别商品',
      price: price,
      platform: platform,
      rawTexts: texts.slice(0, 10)
    }

  } catch (error) {
    console.error('❌ OCR 调用失败:', error.message)
    return null
  }
}

/**
 * 云函数主入口
 */
async function main(event, context) {
  console.log('🚀 OCR 云函数被调用')

  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    return { 
      success: false, 
      error: '百度 API Key 未配置，请设置云函数环境变量 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' 
    }
  }

  try {
    const { image, imgUrl } = event
    let imageBase64 = null
    
    if (image) {
      console.log('📷 使用 base64 图片')
      imageBase64 = image
    } else if (imgUrl) {
      imageBase64 = await downloadImageFromCloudStorage(imgUrl)
    } else {
      return { success: false, error: '请提供图片数据 (image 或 imgUrl)' }
    }

    // 检查缓存
    const cacheKey = imageBase64.substring(0, 100)
    if (resultCache.has(cacheKey)) {
      console.log('✅ 使用缓存结果')
      return resultCache.get(cacheKey)
    }

    // 获取 Access Token
    const accessToken = await getBaiduAccessToken()

    // 第一步：尝试 VL 多模态识别
    console.log('🔄 开始 VL 多模态识别...')
    let result = await recognizeWithVL(imageBase64)

    // 第二步：VL 失败则使用 OCR 后备
    if (!result) {
      console.log('⚠️ VL 失败，切换 OCR 后备方案...')
      result = await fallbackOCR(imageBase64, accessToken)
    }

    // 第三步：仍然失败则返回默认值
    if (!result) {
      return {
        success: true,
        data: {
          productName: '未识别商品',
          price: 0,
          quantity: 1,
          platform: 'other',
          categoryId: 7,
          orderTime: new Date().toISOString().split('T')[0],
          rawTexts: []
        }
      }
    }

    // 识别分类
    const categoryId = recognizeCategory(result.productName)

    const response = {
      success: true,
      data: {
        productName: result.productName,
        price: result.price || 0,
        quantity: 1,
        platform: result.platform || 'other',
        categoryId: categoryId,
        orderTime: new Date().toISOString().split('T')[0],
        rawTexts: result.rawTexts || []
      }
    }

    // 缓存结果
    if (resultCache.size > MAX_CACHE_SIZE) {
      const firstKey = resultCache.keys().next().value
      resultCache.delete(firstKey)
    }
    resultCache.set(cacheKey, response)

    console.log('✅ 最终返回结果:', JSON.stringify(response))
    return response

  } catch (error) {
    console.error('❌ 识别失败:', error)
    return { success: false, error: error.message || '识别失败，请重试' }
  }
}

exports.main = main
exports.recognizeCategory = recognizeCategory
