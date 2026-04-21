const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function getInfo(event, context) {
  try {
    const { OPENID } = cloud.getWXContext()
    
    const userRes = await db.collection('users').where({
      _openid: OPENID
    }).get()
    
    if (userRes.data.length > 0) {
      return {
        success: true,
        data: userRes.data[0]
      }
    }
    
    const defaultUser = {
      nickname: '用户',
      avatar: '',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      _openid: OPENID
    }
    
    await db.collection('users').add({
      data: defaultUser
    })
    
    return {
      success: true,
      data: defaultUser
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      success: false,
      error: error.message || '获取用户信息失败'
    }
  }
}

async function updateInfo(event, context) {
  try {
    const { OPENID } = cloud.getWXContext()
    const { data } = event

    const allowedFields = ['nickname', 'avatar']
    const updateData = { updateTime: db.serverDate() }

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field]
      }
    }

    await db.collection('users').where({
      _openid: OPENID
    }).update({
      data: updateData
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
