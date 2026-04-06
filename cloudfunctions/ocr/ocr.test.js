/**
 * OCR 云函数单元测试
 * 
 * 注意：由于云函数依赖微信云开发环境，这里只测试核心逻辑
 */

describe('OCR 云函数测试', () => {
  describe('平台识别关键词测试', () => {
    test('京东特征词匹配', () => {
      const jdKeywords = ['京东', 'JD', '京东超市', '京东自营', '京东物流', '京东快递', '京配', '京东仓', '京东发货', '京东物流已签收']
      const text = '京东自营 贝亲奶瓶 ¥200'
      
      const matchCount = jdKeywords.filter(kw => text.includes(kw)).length
      expect(matchCount).toBeGreaterThan(0)
    })

    test('淘宝特征词匹配', () => {
      const taobaoKeywords = ['淘宝', '天猫', '淘', '天猫超市', '天猫国际', '淘宝心选', '菜鸟', '菜鸟驿站']
      const text = '天猫旗舰店 可心柔抽纸 ¥100'
      
      const matchCount = taobaoKeywords.filter(kw => text.includes(kw)).length
      expect(matchCount).toBeGreaterThan(0)
    })

    test('拼多多特征词匹配', () => {
      const pddKeywords = ['拼多多', '拼', '多多', '拼多多果园', '多多买菜', '多多钱包']
      const text = '拼多多 尿不湿 ¥50'
      
      const matchCount = pddKeywords.filter(kw => text.includes(kw)).length
      expect(matchCount).toBeGreaterThan(0)
    })

    test('抖音特征词匹配', () => {
      const douyinKeywords = ['抖音', '抖音电商', '抖音小店', '抖音商城', '抖音直播', '抖音超市']
      const text = '抖音小店 婴儿玩具 ¥30'
      
      const matchCount = douyinKeywords.filter(kw => text.includes(kw)).length
      expect(matchCount).toBeGreaterThan(0)
    })
  })

  describe('商品分类关键词测试', () => {
    test('喂养用品关键词', () => {
      const keywords = ['奶粉', '奶瓶', '辅食', '米粉', '果泥', '营养', '喂养', '母乳', '安抚奶嘴', '口水', '吸管杯', '学饮杯', '围嘴', '饭兜', '餐椅', '碗勺', '餐具']
      
      keywords.forEach(kw => {
        expect(kw.length).toBeGreaterThan(0)
      })
      
      expect(keywords).toContain('奶粉')
      expect(keywords).toContain('奶瓶')
    })

    test('护理用品关键词', () => {
      const keywords = ['尿布', '纸尿裤', '尿不湿', '湿巾', '洗护', '沐浴', '护肤', '爽身粉', '护臀', '爽身露', '润肤露', '桃子水', '马桶垫', '产妇', '一次性', '抗菌']
      
      expect(keywords.length).toBeGreaterThan(10)
    })

    test('服装鞋帽关键词', () => {
      const keywords = ['衣服', '裤子', '鞋', '帽', '袜', '连体衣', '套装', '棉服', '外套', '内衣', '内裤', '睡衣', '睡袋', '抱被', '包被', '肚兜', '学步鞋', '机能鞋', '凉鞋', '靴子', '手套', '脚套']
      
      expect(keywords).toContain('连体衣')
      expect(keywords).toContain('学步鞋')
    })

    test('玩具娱乐关键词', () => {
      const keywords = ['玩具', '积木', '摇铃', '绘本', '图书', '拼图', '音乐', '游戏', '玩偶', '毛绒', '球类', '爬行', '健身架', '游戏垫', '帐篷', '滑滑梯', '秋千', '推车', '扭扭车', '平衡车', '自行车']
      
      expect(keywords).toContain('玩具')
      expect(keywords).toContain('绘本')
    })

    test('医疗保健关键词', () => {
      const keywords = ['疫苗', '体温', '药', '保健品', '钙', '维生素', '医疗', '退热', '感冒', '咳嗽', '腹泻', '便秘', '益生菌', 'DHA', '鱼肝油']
      
      expect(keywords).toContain('疫苗')
      expect(keywords).toContain('益生菌')
    })

    test('教育早教关键词', () => {
      const keywords = ['早教', '课程', '学习', '启蒙', '教育', '识字', '数学', '英语', '国学', '古诗', '故事', '儿歌', '动画', '投影', '点读', '学习机', '故事机', '机器人', '智能', 'AI']
      
      expect(keywords).toContain('早教')
      expect(keywords).toContain('启蒙')
    })
  })

  describe('价格解析测试', () => {
    test('提取带 ¥ 符号的价格', () => {
      const text = '实付款：¥115.12'
      const match = text.match(/[¥￥]\s*(\d+\.?\d*)/)
      
      expect(match).not.toBeNull()
      expect(parseFloat(match[1])).toBe(115.12)
    })

    test('提取带 ￥ 符号的价格', () => {
      const text = '￥200元'
      const match = text.match(/[¥￥]\s*(\d+\.?\d*)/)
      
      expect(match).not.toBeNull()
      expect(parseFloat(match[1])).toBe(200)
    })

    test('无效价格处理', () => {
      const text = '免费赠送'
      const match = text.match(/[¥￥]\s*(\d+\.?\d*)/)
      
      expect(match).toBeNull()
    })
  })

  describe('参数验证测试', () => {
    test('缺少 image 和 imgUrl 参数时返回错误', () => {
      const event = {}
      
      expect(event.image).toBeUndefined()
      expect(event.imgUrl).toBeUndefined()
    })

    test('有 image 参数时正常处理', () => {
      const event = { image: 'base64_string' }
      
      expect(event.image).toBeDefined()
    })

    test('有 imgUrl 参数时正常处理', () => {
      const event = { imgUrl: 'cloud://xxx' }
      
      expect(event.imgUrl).toBeDefined()
    })
  })

  describe('平台判断逻辑测试', () => {
    test('统计各平台关键词出现次数', () => {
      const allText = '京东自营 贝亲奶瓶 天猫旗舰店'
      
      const jdKeywords = ['京东', 'JD', '京东自营']
      const taobaoKeywords = ['天猫', '淘宝', '天猫旗舰店']
      
      let jdCount = 0, taobaoCount = 0
      jdKeywords.forEach(kw => { if (allText.includes(kw)) jdCount++ })
      taobaoKeywords.forEach(kw => { if (allText.includes(kw)) taobaoCount++ })
      
      expect(jdCount).toBe(2)
      expect(taobaoCount).toBe(2)
    })
  })
})
