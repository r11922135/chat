const express = require('express')
const logger = require('../utils/logger')
const sequelize = require('../models')
const User = require('../models/User')
const Message = require('../models/Message')
const Room = require('../models/Room')
const { authenticateToken, checkRoomAccess } = require('../utils/middleware')
const { getIO } = require('../socket/socketHandlers')
const { cacheMessage, getLatestMessages, getOlderMessages, backfillCache } = require('../utils/messageCache')

const router = express.Router()

// 取得聊天室訊息 (基於 ID 的分頁)
router.get('/:roomId', authenticateToken, checkRoomAccess, async (req, res) => {
  const { roomId } = req.params
  const { before } = req.query // 只保留 before 參數
  const limit = 15 // 固定每次取 15 則訊息
  const start = Date.now()

  let messages = []

  try {
    if (before) {
      // Lazy loading - get older messages before a specific ID
      let beforeId = parseInt(before)

      // Try Redis first
      messages = await getOlderMessages(roomId, beforeId, limit)

      if (messages.length < limit) {
        // Cache miss - fall back to DB
        logger.info(`Cache miss for older messages in room ${roomId} before ${beforeId}, using DB`)

        if (messages.length > 0) {
          // 已經從快取拿到一些訊息，記錄最後一筆的 ID
          const lastCachedId = messages[messages.length - 1].id
          // 從資料庫撈比 lastCachedId 更舊的訊息
          beforeId = Math.min(beforeId, lastCachedId)
        }
        let oldMessages = await Message.findAll({
          where: {
            roomId,
            id: { [sequelize.Sequelize.Op.lt]: beforeId }
          },
          include: [{ model: User, attributes: ['id', 'username'] }],
          order: [['id', 'DESC']],
          limit: limit * 15 // 多取一些以便回填
        })

        // Backfill cache with fetched messages
        if (oldMessages.length > 0) {
          await backfillCache(roomId, oldMessages)
        }
        messages = messages.concat(oldMessages).slice(0, limit) // 只取前 15 筆回傳
      }
    } else {
      // Initial load - get latest messages

      // Try Redis first
      messages = await getLatestMessages(roomId, limit)

      if (messages.length === 0) {
        // Cache miss or empty cache - fall back to DB
        logger.info(`Cache miss for latest messages in room ${roomId}, using DB`)

        messages = await Message.findAll({
          where: { roomId },
          include: [{ model: User, attributes: ['id', 'username'] }],
          order: [['id', 'DESC']],
          limit: limit * 15 // 多取一些以便回填
        })

        // Backfill cache with fetched messages
        if (messages.length > 0) {
          await backfillCache(roomId, messages)
        }
        messages = messages.slice(0, limit) // 只取前 15 筆回傳
      }
    }
    const duration = Date.now() - start
    logger.info(`Fetch messages for room ${roomId} took ${duration}ms`)

    res.json({
      messages: messages, // 直接回傳，不要 reverse
      hasMore: messages.length === limit // 如果取滿 15 則，表示還有更多
    })

  } catch (error) {
    logger.error(`Error fetching messages for room ${roomId}:`, error.message)
    res.status(500).json({ message: 'Failed to fetch messages' })
  }
})

router.get('/:roomId/no-cache', authenticateToken, checkRoomAccess, async (req, res) => {
  const { roomId } = req.params
  const { before } = req.query
  const limit = 15
  const start = Date.now()
  let messages = []
  if (before) {
    // Lazy loading - get older messages before a specific ID
    const beforeId = parseInt(before)

    messages = await Message.findAll({
      where: {
        roomId,
        id: { [sequelize.Sequelize.Op.lt]: beforeId }
      },
      include: [{ model: User, attributes: ['id', 'username'] }],
      order: [['id', 'DESC']],
      limit: limit
    })
  } else {
    // Initial load - get latest messages
    messages = await Message.findAll({
      where: { roomId },
      include: [{ model: User, attributes: ['id', 'username'] }],
      order: [['id', 'DESC']],
      limit: limit
    })
  }

  const duration = Date.now() - start
  logger.info(`Fetch messages for room ${roomId} (NO CACHE) took ${duration}ms`)

  res.json({
    messages: messages,
    hasMore: messages.length === limit
  })
})

// 發送訊息
router.post('/:roomId', authenticateToken, checkRoomAccess, async (req, res) => {
  const { content } = req.body
  const { roomId } = req.params
  const userId = req.user.userId

  // 驗證訊息內容
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ message: 'Message content is required' })
  }

  const message = await Message.create({
    roomId,
    userId,
    content: content.trim(),
  })

  // 🆕 更新聊天室的 updatedAt 時間，用於排序
  logger.info(`📝 準備更新聊天室 ${roomId} 的 updatedAt 時間 (發送訊息)`)
  await sequelize.query(
    'UPDATE "Rooms" SET "updatedAt" = NOW() WHERE "id" = :roomId',
    {
      replacements: { roomId },
      type: sequelize.QueryTypes.UPDATE
    }
  )
  logger.info(`✅ 聊天室 ${roomId} 的 updatedAt 已更新 (發送訊息)`)

  // 返回完整的訊息資訊，包含發送者資訊和聊天室資訊
  const messageWithUser = await Message.findByPk(message.id, {
    include: [
      { model: User, attributes: ['id', 'username'] },
      { model: Room, attributes: ['id', 'name'] }
    ]
  })

  // Cache the new message in Redis (non-blocking)
  await cacheMessage(messageWithUser)

  // 使用 Socket.IO 廣播訊息給聊天室所有成員（包括發送者）
  const io = getIO()
  io.to(roomId.toString()).emit('new-message', messageWithUser)
  logger.info(`訊息已通過 Socket 廣播到聊天室 ${roomId}`)

  res.status(201).json(messageWithUser)
})

module.exports = router
