const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../utils/config');
const logger = require('../utils/logger');
const User = require('../models/User');

const router = express.Router();

// 註冊
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, username: user.username, userId: user.id });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
