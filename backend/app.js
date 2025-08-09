const express = require('express');
const cors = require('cors');
const path = require('path');

// 導入控制器
const authController = require('./controllers/auth');
const userController = require('./controllers/users');
const { router: roomController } = require('./controllers/rooms');
const messageController = require('./controllers/messages');

const app = express();

// 基本中間件
app.use(cors());
app.use(express.json());

// 提供靜態文件（前端 build 檔案）
app.use(express.static(path.join(__dirname, 'dist')));

// 公開路由
app.get('/', (req, res) => {
  res.send('Chat backend is running!');
});

// API 路由
app.use('/api/auth', authController);
app.use('/api/users', userController);
app.use('/api/rooms', roomController);
app.use('/api/messages', messageController);

module.exports = app;
