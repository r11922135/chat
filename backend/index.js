const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// 導入配置和中間件
const { initializeDatabase } = require('./config/database');
const corsOptions = require('./config/cors');
const socketAuthMiddleware = require('./middleware/socketAuth');

// 導入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { router: roomRoutes, setIo } = require('./routes/rooms');
const messageRoutes = require('./routes/messages');

// 導入 Socket 處理器
const { setupSocketHandlers } = require('./socket/socketHandlers');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: corsOptions });
const PORT = process.env.PORT || 5000;

// 基本中間件
app.use(cors());
app.use(express.json());

// 提供靜態文件（前端 build 檔案）
app.use(express.static(path.join(__dirname, 'dist')));

// Socket.IO 中間件
io.use(socketAuthMiddleware);

// 設置 Socket.IO 事件處理
setupSocketHandlers(io);

// 設置房間路由的 io 實例
setIo(io);

// 公開路由
app.get('/', async (req, res) => {
  res.send('Chat backend is running!');
});

// API 路由
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', messageRoutes);

// 啟動伺服器
const startServer = async () => {
  try {
    await initializeDatabase();
    
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Socket.IO server is ready`);
    });
  } catch (err) {
    console.error('啟動伺服器失敗:', err);
    process.exit(1);
  }
};

startServer();