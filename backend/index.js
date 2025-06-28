const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('主 index.js - 環境變數載入:', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS ? '***' : undefined,
  JWT_SECRET: process.env.JWT_SECRET ? '***' : undefined,
  PORT: process.env.PORT
});

const sequelize = require('./models');
const User = require('./models/User');
const Room = require('./models/Room');
const RoomUser = require('./models/RoomUser');
const Message = require('./models/Message');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"], // 支援多個前端端口
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 4000;

app.use(cors()); // 讓前後端可以跨網域請求，就算不同port也是不同網域
app.use(express.json()); // 可以解析JSON如果header是application/json

// Socket.IO 連接處理
io.on('connection', (socket) => {
  console.log('用戶連接:', socket.id);

  // 用戶加入聊天室
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`用戶 ${socket.id} 加入聊天室 ${roomId}`);
    console.log(`聊天室 ${roomId} 目前用戶數量:`, io.sockets.adapter.rooms.get(roomId)?.size || 0);
  });

  // 用戶離開聊天室
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`用戶 ${socket.id} 離開聊天室 ${roomId}`);
    console.log(`聊天室 ${roomId} 剩餘用戶數量:`, io.sockets.adapter.rooms.get(roomId)?.size || 0);
  });

  // 處理即時訊息
  socket.on('send-message', async (data) => {
    try {
      console.log('收到即時訊息:', data);
      console.log('發送者 Socket ID:', socket.id);
      
      // 驗證資料
      if (!data.roomId || !data.content || !data.userId) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // 檢查發送者是否在目標房間內
      const roomName = data.roomId.toString();
      const isInRoom = socket.rooms.has(roomName);
      console.log(`Socket ${socket.id} 是否在房間 ${roomName} 內:`, isInRoom);
      console.log(`Socket 當前在的房間:`, Array.from(socket.rooms));
      
      if (!isInRoom) {
        console.log(`用戶不在房間內，強制加入房間 ${roomName}`);
        socket.join(roomName);
      }

      // 檢查用戶是否有權限發送到此聊天室
      const roomUser = await RoomUser.findOne({
        where: { roomId: data.roomId, userId: data.userId }
      });

      if (!roomUser) {
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      // 儲存訊息到資料庫
      const message = await Message.create({
        roomId: data.roomId,
        userId: data.userId,
        content: data.content.trim(),
      });

      // 取得完整的訊息資訊（包含用戶資訊）
      const messageWithUser = await Message.findByPk(message.id, {
        include: [{ model: User, attributes: ['id', 'username'] }]
      });

      // 廣播給聊天室內的所有用戶
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      
      console.log(`準備廣播訊息到聊天室 ${roomName}，房間內用戶數量: ${roomSize}`);
      
      io.to(roomName).emit('new-message', messageWithUser);
      
      console.log(`訊息已廣播到聊天室 ${data.roomId}，訊息內容:`, {
        id: messageWithUser.id,
        content: messageWithUser.content,
        roomId: messageWithUser.roomId,
        username: messageWithUser.User.username
      });
    } catch (error) {
      console.error('Socket 訊息處理錯誤:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // 用戶斷線
  socket.on('disconnect', () => {
    console.log('用戶斷線:', socket.id);
  });
});

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

// 公開路由 - 不需要驗證
// 這個路由用來測試伺服器是否運行正常
app.get('/', async (req, res) => {
  res.send('Chat backend is running!');
});

// 註冊
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!username || !usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Invalid username. Use 3-20 alphanumeric characters or underscores.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    const existUser = await User.findOne({ where: { username } });
    if (existUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 登入
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ message: 'Invalid username.' });
  }
  if (!password || typeof password !== 'string' || password.length < 3) {
    return res.status(400).json({ message: 'Invalid password.' });
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, username: user.username, userId: user.id });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 受保護的路由 - 需要 JWT 驗證
// 搜尋用戶
app.get('/api/users/search', authenticateToken, async (req, res) => {
  const { query } = req.query;
  
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }
  
  try {
    const users = await User.findAll({
      where: {
        username: {
          [sequelize.Sequelize.Op.iLike]: `%${query.trim()}%`
        },
        id: {
          [sequelize.Sequelize.Op.ne]: req.user.userId // 排除自己
        }
      },
      attributes: ['id', 'username'],
      limit: 20 // 限制結果數量
    });
    
    res.json(users);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 取得用戶所有聊天室
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 查詢用戶的聊天室，包含最新訊息
    const user = await User.findByPk(userId, {
      include: [{
        model: Room,
        include: [{
          model: Message,
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [{ model: User, attributes: ['username'] }]
        }]
      }]
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.Rooms);
  } catch (err) {
    console.error('Get rooms error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 取得聊天室訊息
app.get('/api/rooms/:roomId/messages', authenticateToken, checkRoomAccess, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const messages = await Message.findAll({
      where: { roomId },
      include: [{ model: User, attributes: ['id', 'username'] }],
      order: [['createdAt', 'ASC']],
    });
    
    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 發送訊息
app.post('/api/rooms/:roomId/messages', authenticateToken, checkRoomAccess, async (req, res) => {
  const { content } = req.body;
  const { roomId } = req.params;
  const userId = req.user.userId;
  
  // 驗證訊息內容
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: 'Message content is required' });
  }
  
  try {
    const message = await Message.create({
      roomId,
      userId,
      content: content.trim(),
    });
    
    // 返回完整的訊息資訊，包含發送者資訊
    const messageWithUser = await Message.findByPk(message.id, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });
    
    res.status(201).json(messageWithUser);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 建立聊天室
app.post('/api/rooms', authenticateToken, async (req, res) => {
  const { name, isGroup, userIds } = req.body; // userIds: [id1, id2, ...]
  
  try {
    // 建立聊天室
    const room = await Room.create({ name, isGroup });
    
    // 將建立者加入聊天室
    const creatorId = req.user.userId;
    const allUserIds = [creatorId]; // 確保建立者在聊天室內
    
    // 如果有指定其他用戶，也加入聊天室
    if (Array.isArray(userIds)) {
      userIds.forEach(id => {
        if (id !== creatorId && !allUserIds.includes(id)) {
          allUserIds.push(id);
        }
      });
    }
    
    // 將所有用戶加入聊天室
    await room.setUsers(allUserIds);
    
    // 返回聊天室資訊，包含成員資訊
    const roomWithUsers = await Room.findByPk(room.id, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });
    
    res.status(201).json(roomWithUsers);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 邀請用戶加入聊天室
app.post('/api/rooms/:roomId/invite', authenticateToken, async (req, res) => {
  const { userIds } = req.body; // 要邀請的用戶 ID 陣列
  const { roomId } = req.params;
  const inviterId = req.user.userId;

  try {
    // 檢查邀請者是否為聊天室成員
    const inviterMembership = await RoomUser.findOne({
      where: { roomId, userId: inviterId }
    });

    if (!inviterMembership) {
      return res.status(403).json({ message: 'You are not a member of this room' });
    }

    // 驗證要邀請的用戶 ID
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs are required' });
    }

    // 檢查用戶是否存在
    const existingUsers = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'username']
    });

    if (existingUsers.length !== userIds.length) {
      return res.status(400).json({ message: 'Some users do not exist' });
    }

    // 檢查哪些用戶已經在聊天室中
    const existingMembers = await RoomUser.findAll({
      where: { roomId, userId: userIds }
    });

    const existingMemberIds = existingMembers.map(member => member.userId);
    const newMemberIds = userIds.filter(id => !existingMemberIds.includes(id));

    if (newMemberIds.length === 0) {
      return res.status(400).json({ message: 'All users are already members of this room' });
    }

    // 建立新的聊天室成員關係
    const newMemberships = newMemberIds.map(userId => ({
      roomId: parseInt(roomId),
      userId
    }));

    await RoomUser.bulkCreate(newMemberships);

    // 獲取被邀請的用戶資訊
    const invitedUsers = existingUsers.filter(user => newMemberIds.includes(user.id));

    // 通知聊天室內的所有用戶有新成員加入
    const room = await Room.findByPk(roomId, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });

    // 透過 Socket.IO 通知聊天室成員
    invitedUsers.forEach(user => {
      io.to(roomId).emit('user-joined', {
        roomId,
        user: { id: user.id, username: user.username },
        invitedBy: req.user.username
      });
    });

    res.status(200).json({
      message: `Successfully invited ${invitedUsers.length} user(s)`,
      invitedUsers,
      room
    });

  } catch (err) {
    console.error('Invite users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 先同步資料庫，成功後才啟動伺服器
console.log('開始連接資料庫...');
console.log('資料庫配置:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER
});

sequelize.authenticate()
  .then(() => {
    console.log('資料庫連接成功！');
    return sequelize.sync();
  })
  .then(() => {
    console.log('PostgreSQL synced!');
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Socket.IO server is ready`);
      console.log(`API URL: http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('資料庫錯誤:', err);
    console.error('錯誤詳情:', err.message);
    process.exit(1);
  });