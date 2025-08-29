const express = require('express')
const sequelize = require('../models')
const User = require('../models/User')
const { authenticateToken } = require('../utils/middleware')

const router = express.Router()

// 搜尋用戶
router.get('/search', authenticateToken, async (req, res) => {
  const { query } = req.query

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' })
  }

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
  })

  res.json(users)
})

module.exports = router
