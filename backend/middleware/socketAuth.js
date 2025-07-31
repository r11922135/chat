const jwt = require('jsonwebtoken');
const { User, RoomUser } = require('../config/database');

const socketAuthMiddleware = async (socket, next) => {
  console.log('🔥 Socket 中間件開始執行')
  console.log('🔥 Socket ID:', socket.id)
  
  try {
    const token = socket.handshake.auth.token
    console.log('🔑 收到的 token:', token ? `${token.substring(0, 20)}...` : 'null')
    
    if (!token) {
      console.log('❌ 沒有提供 token')
      return next(new Error('No token provided'))
    }
    
    // 🔐 解析 token 獲取 userId
    console.log('🔍 使用的 JWT_SECRET:', process.env.JWT_SECRET ? '***已設定***' : '未設定')
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('✅ Token 解析成功:', decoded)
    
    const userId = decoded.userId
    console.log('👤 解析出的 userId:', userId)
    
    // 🔍 查詢資料庫獲取用戶資訊
    const user = await User.findByPk(userId)
    console.log('👤 資料庫查詢用戶結果:', user ? `${user.username} (${user.id})` : 'null')
    
    if (!user) {
      console.log('❌ 用戶不存在:', userId)
      return next(new Error('User not found'))
    }
    
    // 🏠 查詢用戶的聊天室
    const userRooms = await RoomUser.findAll({
      where: { userId: userId }
    })
    console.log('🏠 用戶聊天室查詢結果:', userRooms.length, '個房間')
    
    // 📝 把資訊存到 socket 上
    socket.userId = userId
    socket.username = user.username
    socket.roomIds = userRooms.map(ru => ru.roomId)
    
    console.log(`✅ 用戶認證成功: ${user.username} (${userId})`)
    console.log(`🏠 用戶房間: [${socket.roomIds.join(', ')}]`)
    
    next()
  } catch (err) {
    console.error('❌ Socket 認證失敗:', err.name, err.message)
    console.error('❌ 完整錯誤:', err)
    next(new Error('認證失敗: ' + err.message))
  }
};

module.exports = socketAuthMiddleware;
