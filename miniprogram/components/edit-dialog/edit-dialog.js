// components/edit-dialog/edit-dialog.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    initialData: {
      type: Object,
      value: {
        productName: '',
        price: '',
        quantity: 1,
        categoryId: 1,
        platform: 'taobao',
        orderTime: new Date().toISOString().split('T')[0]
      }
    }
  },

  data: {
    formData: {
      productName: '',
      price: '',
      quantity: 1,
      categoryIndex: 0,
      platformIndex: 0,
      orderTime: ''
    },
    categories: [],
    platforms: []
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        categories: app.globalData.categories.filter(c => c.id !== 0),
        platforms: app.globalData.platforms.filter(p => p.id !== 0)
      });
    }
  },

  observers: {
    'initialData': function(data) {
      if (data && Object.keys(data).length > 0 && this.data._dialogVisible) {
        this.initFormData(data);
      }
    },
    'visible': function(visible) {
      this.data._dialogVisible = visible;
      if (visible && this.properties.initialData) {
        this.initFormData(this.properties.initialData);
      }
    }
  },

  methods: {
    // 初始化表单数据
    initFormData(data) {
      console.log('🔧 edit-dialog 收到 initialData:', data)
      
      // 确保类型正确（categoryId 可能是字符串）
      const categoryId = parseInt(data.categoryId)
      const platform = data.platform || 'jd'
      
      const categoryIndex = this.data.categories.findIndex(c => c.id === categoryId)
      const platformIndex = this.data.platforms.findIndex(p => p.id === platform)
      
      console.log('分类索引:', categoryIndex, '平台索引:', platformIndex)
      
      this.setData({
        'formData.productName': data.productName || '',
        'formData.price': data.price ? String(data.price) : '',
        'formData.quantity': data.quantity || 1,
        'formData.categoryIndex': categoryIndex >= 0 ? categoryIndex : 0,
        'formData.platformIndex': platformIndex >= 0 ? platformIndex : 0,
        'formData.orderTime': data.orderTime || new Date().toISOString().split('T')[0]
      }, () => {
        console.log('✅ 表单数据已设置，当前 categoryIndex:', this.data.formData.categoryIndex, 'platformIndex:', this.data.formData.platformIndex)
        console.log('当前分类:', this.data.categories[this.data.formData.categoryIndex])
        console.log('当前平台:', this.data.platforms[this.data.formData.platformIndex])
      })
    },

    // 点击遮罩层
    onMaskTap() {
      // 点击遮罩层不关闭，需要用户明确点击取消或确认
    },

    // 点击内容区域
    onContentTap() {
      // 阻止事件冒泡
    },

    // 取消
    onCancel() {
      this.triggerEvent('cancel');
    },

    // 确认
    onConfirm() {
      const { formData } = this.data;
      
      // 表单验证
      if (!formData.productName || !formData.productName.trim()) {
        wx.showToast({ title: '请输入商品名称', icon: 'none' });
        return;
      }
      
      // 验证价格 - 必须是有效数字
      const priceValue = parseFloat(formData.price);
      if (isNaN(priceValue) || priceValue <= 0 || priceValue > 100000) {
        wx.showToast({ title: '请输入有效价格 (0-100000)', icon: 'none' });
        return;
      }
      
      // 验证数量 - 必须是正整数
      const quantityValue = parseInt(formData.quantity);
      if (isNaN(quantityValue) || quantityValue <= 0 || quantityValue > 9999) {
        wx.showToast({ title: '请输入有效数量 (1-9999)', icon: 'none' });
        return;
      }
      
      // 返回编辑数据（包含分类名和平台名）
      const categoryObj = this.data.categories[formData.categoryIndex];
      const platformObj = this.data.platforms[formData.platformIndex];
      
      const result = {
        productName: formData.productName.trim(),
        price: priceValue.toFixed(2),
        quantity: quantityValue,
        categoryId: categoryObj.id,
        categoryName: categoryObj.name,
        platform: platformObj.id,
        platformName: platformObj.name,
        orderTime: formData.orderTime
      };
      
      console.log('📦 编辑确认返回:', result);
      this.triggerEvent('confirm', result);
    },

    // 表单输入处理
    onProductNameInput(e) {
      this.setData({
        'formData.productName': e.detail.value
      });
    },

    onPriceInput(e) {
      this.setData({
        'formData.price': e.detail.value
      });
    },

    onQuantityInput(e) {
      this.setData({
        'formData.quantity': e.detail.value
      });
    },

    onCategoryChange(e) {
      this.setData({
        'formData.categoryIndex': e.detail.value
      });
    },

    onPlatformChange(e) {
      this.setData({
        'formData.platformIndex': e.detail.value
      });
    },

    onDateChange(e) {
      this.setData({
        'formData.orderTime': e.detail.value
      });
    }
  }
});
