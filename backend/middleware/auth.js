const jwt = require('jsonwebtoken');
const { RoomUser } = require('../config/database');

// JWT 驗證 middleware
// 這個 middleware 會檢查 Authorization header 中的 Bearer token
const authenticateToken = (req, res, next) => {
  // 從 Authorization header 取得 token
  // 格式: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // 如果沒有 token，返回 401 Unauthorized
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  // 驗證 token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // token 無效或過期
      console.log('JWT 驗證失敗:', err.name, err.message);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    // 顯示時間資訊 (開發時用)
    console.log('JWT payload:', user);
    console.log('簽發時間 (iat):', new Date(user.iat * 1000).toLocaleString());
    console.log('過期時間 (exp):', new Date(user.exp * 1000).toLocaleString());
    console.log('目前時間:', new Date().toLocaleString());
    console.log('剩餘時間:', Math.round((user.exp * 1000 - Date.now()) / 1000 / 60), '分鐘');
    console.log('---');
    
    // token 有效，將解碼後的用戶資訊加到 req.user
    req.user = user; // { userId, username, iat, exp }
    next(); // 繼續執行下一個 middleware 或路由處理器
  });
};

// 檢查用戶是否有權限存取指定聊天室的 middleware
const checkRoomAccess = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    // 檢查用戶是否為聊天室成員
    const roomUser = await RoomUser.findOne({
      where: { roomId, userId }
    });

    if (!roomUser) {
      return res.status(403).json({ message: 'Access denied: not a member of this room' });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { authenticateToken, checkRoomAccess };
