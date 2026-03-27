// pages/baby/baby.js
const app = getApp()

Page({
  data: {
    babies: [],
    showAddModal: false,
    editingBaby: null,
    form: {
      name: '',
      birthDate: '',
      gender: 'unknown',
      avatar: ''
    },
    genderOptions: [
      { value: 'unknown', label: '未设置', icon: '👶' },
      { value: 'male', label: '男宝', icon: '👦' },
      { value: 'female', label: '女宝', icon: '👧' }
    ]
  },

  onLoad() {
    this.loadBabies()
  },

  onShow() {
    this.loadBabies()
  },

  loadBabies() {
    const { babies, records, categories } = app.globalData
    
    // 计算每个宝宝的花费
    const babiesWithStats = babies.map(baby => {
      const babyRecords = records.filter(r => r.babyId === baby.id)
      const totalAmount = babyRecords.reduce((sum, r) => sum + r.price, 0)
      
      // 计算月龄
      const birthDate = new Date(baby.birthDate)
      const now = new Date()
      const months = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth())
      
      return {
        ...baby,
        totalAmount: totalAmount.toFixed(2),
        recordCount: babyRecords.length,
        ageMonths: months,
        ageText: this.formatAge(months)
      }
    })

    this.setData({ babies: babiesWithStats })
  },

  formatAge(months) {
    if (months < 1) return '新生儿'
    if (months < 12) return `${months}个月`
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    if (remainingMonths === 0) return `${years}岁`
    return `${years}岁${remainingMonths}个月`
  },

  showAddBaby() {
    this.setData({
      showAddModal: true,
      editingBaby: null,
      form: {
        name: '',
        birthDate: new Date().toISOString().split('T')[0],
        gender: 'unknown',
        avatar: ''
      }
    })
  },

  editBaby(e) {
    const id = e.currentTarget.dataset.id
    const baby = this.data.babies.find(b => b.id === id)
    
    this.setData({
      showAddModal: true,
      editingBaby: baby,
      form: {
        name: baby.name,
        birthDate: baby.birthDate,
        gender: baby.gender || 'unknown',
        avatar: baby.avatar || ''
      }
    })
  },

  closeModal() {
    this.setData({ showAddModal: false })
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  onDateChange(e) {
    this.setData({
      'form.birthDate': e.detail.value
    })
  },

  onGenderChange(e) {
    const gender = e.currentTarget.dataset.gender
    this.setData({
      'form.gender': gender
    })
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          'form.avatar': tempFilePath
        })
      }
    })
  },

  saveBaby() {
    const { form, editingBaby } = this.data
    
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入宝宝名字', icon: 'none' })
      return
    }

    if (!form.birthDate) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }

    const babies = app.globalData.babies || []

    if (editingBaby) {
      // 编辑
      const index = babies.findIndex(b => b.id === editingBaby.id)
      if (index !== -1) {
        babies[index] = {
          ...babies[index],
          ...form,
          updateTime: new Date().toISOString()
        }
      }
    } else {
      // 新增
      babies.push({
        id: Date.now().toString(),
        ...form,
        createTime: new Date().toISOString()
      })
    }

    app.saveData('babies', babies)
    this.closeModal()
    this.loadBabies()

    wx.showToast({
      title: editingBaby ? '修改成功' : '添加成功',
      icon: 'success'
    })
  },

  deleteBaby() {
    const { editingBaby } = this.data
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${editingBaby.name}」吗？相关记录不会被删除。`,
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          const babies = app.globalData.babies.filter(b => b.id !== editingBaby.id)
          app.saveData('babies', babies)
          this.closeModal()
          this.loadBabies()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  viewRecords(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/record/record?babyId=${id}`
    })
  }
})
