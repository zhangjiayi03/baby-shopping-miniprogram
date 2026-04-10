// 云函数入口文件 - 用户信息管理
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 获取用户信息
async function getInfo(event, context) {
  try {
    const { OPENID } = cloud.getWXContext()
    
    // 查询用户信息
    const userRes = await db.collection('users').where({
      openid: OPENID
    }).get()
    
    if (userRes.data.length > 0) {
      return {
        success: true,
        data: userRes.data[0]
      }
    } else {
      // 如果用户不存在，创建默认用户
      const defaultUser = {
        openid: OPENID,
        nickname: '用户',
        avatar: '',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
      
      await db.collection('users').add({
        data: defaultUser
      })
      
      return {
        success: true,
        data: defaultUser
      }
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      success: false,
      error: error.message || '获取用户信息失败'
    }
  }
}

// 更新用户信息
async function updateInfo(event, context) {
  try {
    const { OPENID } = cloud.getWXContext()
    const { data } = event
    
    await db.collection('users').where({
      openid: OPENID
    }).update({
      data: {
        ...data,
        updateTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: '更新成功'
    }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    return {
      success: false,
      error: error.message || '更新用户信息失败'
    }
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { action } = event
  
  switch (action) {
    case 'getInfo':
      return await getInfo(event, context)
    case 'updateInfo':
      return await updateInfo(event, context)
    default:
      return {
        success: false,
        error: '未知操作：' + action
      }
  }
}
