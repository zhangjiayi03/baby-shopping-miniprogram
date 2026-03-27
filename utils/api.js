/**
 * utils/api.js - API 接口封装
 * 
 * 注意：小程序端通常使用云开发或后端 API
 * 这里提供接口结构，实际需要配置后端服务
 */

// API 基础配置
const BASE_URL = 'https://your-api-server.com/api'
const TIMEOUT = 30000

/**
 * 通用请求方法
 */
const request = (options) => {
  const { url, method = 'GET', data, header = {} } = options

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      timeout: TIMEOUT,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error(res.data.message || '请求失败'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * OCR 识别接口
 * @param {string} imageUrl 图片URL
 * @returns {Promise} 识别结果
 */
const recognizeOrder = (imageUrl) => {
  return request({
    url: '/ocr/order',
    method: 'POST',
    data: { imageUrl }
  })
}

/**
 * 获取用户信息
 */
const getUserInfo = () => {
  return request({
    url: '/user/info',
    method: 'GET'
  })
}

/**
 * 获取记录列表
 */
const getRecords = (params = {}) => {
  return request({
    url: '/records',
    method: 'GET',
    data: params
  })
}

/**
 * 创建记录
 */
const createRecord = (data) => {
  return request({
    url: '/records',
    method: 'POST',
    data
  })
}

/**
 * 更新记录
 */
const updateRecord = (id, data) => {
  return request({
    url: `/records/${id}`,
    method: 'PUT',
    data
  })
}

/**
 * 删除记录
 */
const deleteRecord = (id) => {
  return request({
    url: `/records/${id}`,
    method: 'DELETE'
  })
}

/**
 * 获取统计数据
 */
const getStats = (params = {}) => {
  return request({
    url: '/stats',
    method: 'GET',
    data: params
  })
}

/**
 * 获取宝宝列表
 */
const getBabies = () => {
  return request({
    url: '/babies',
    method: 'GET'
  })
}

/**
 * 创建/更新宝宝信息
 */
const saveBaby = (data) => {
  return request({
    url: '/babies',
    method: 'POST',
    data
  })
}

/**
 * 删除宝宝
 */
const deleteBaby = (id) => {
  return request({
    url: `/babies/${id}`,
    method: 'DELETE'
  })
}

module.exports = {
  request,
  recognizeOrder,
  getUserInfo,
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  getStats,
  getBabies,
  saveBaby,
  deleteBaby
}
