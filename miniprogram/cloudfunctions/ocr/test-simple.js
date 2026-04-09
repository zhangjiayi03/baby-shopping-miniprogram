// 最简单的测试云函数
exports.main = async (event, context) => {
  return {
    success: true,
    message: 'OCR 云函数运行正常！',
    timestamp: new Date().toISOString()
  }
}
