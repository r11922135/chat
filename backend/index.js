const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./models');
const User = require('./models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors()); // 讓前後端可以跨網域請求，就算不同port也是不同網域
app.use(express.json()); // 可以解析JSON如果header是application/json

app.get('/', (req, res) => {
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
  if (!password || typeof password !== 'string' || password.length < 6) {
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
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 先同步資料庫，成功後才啟動伺服器
sequelize.sync().then(() => {
  console.log('PostgreSQL synced!');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Sync error:', err);
});
