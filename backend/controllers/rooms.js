const express = require('express')
const logger = require('../utils/logger')
const sequelize = require('../models')
const User = require('../models/User')
const Room = require('../models/Room')
const RoomUser = require('../models/RoomUser')
const Message = require('../models/Message')
const { authenticateToken, checkRoomAccess } = require('../utils/middleware')
const { joinRoomSocket } = require('../socket/socketHandlers')
const { SystemMessageTypes, createSystemMessage } = require('../utils/systemMessages')

const router = express.Router()

// 取得用戶所有聊天室（包含未讀訊息數量）
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId

  // 一次查詢取得所有需要的資料
  const roomsData = await sequelize.query(`
    WITH LatestMessages AS (
      SELECT DISTINCT ON (m."roomId")
        m."roomId",
        json_build_object(
          'id', m."id",
          'content', m."content",
          'createdAt', m."createdAt",
          'User', json_build_object(
            'id', u."id",
            'username', u."username"
          )
        ) as latest_message
      FROM "Messages" m
      JOIN "Users" u ON m."userId" = u."id"
      WHERE m."roomId" IN (
        SELECT DISTINCT r."id" 
        FROM "Rooms" r
        JOIN "RoomUsers" ru ON r."id" = ru."roomId"
        WHERE ru."userId" = :userId
      )
      ORDER BY m."roomId", m."createdAt" DESC
    ),
    DirectMessageNames AS (
      SELECT 
        r."id" as "roomId",
        other_user."username" as "otherUsername"
      FROM "Rooms" r
      JOIN "RoomUsers" ru1 ON r."id" = ru1."roomId" AND ru1."userId" = :userId
      JOIN "RoomUsers" ru2 ON r."id" = ru2."roomId" AND ru2."userId" != :userId
      JOIN "Users" other_user ON other_user."id" = ru2."userId"
      WHERE r."isGroup" = false
    )
    SELECT 
      r."id",
      CASE 
        WHEN r."isGroup" = true THEN r."name"
        ELSE COALESCE(dmn."otherUsername", r."name")
      END as "name",
      r."isGroup",
      r."createdAt",
      r."updatedAt",
      ru."lastReadAt",
      CAST(COALESCE((
        SELECT COUNT(*)
        FROM "Messages" m 
        WHERE m."roomId" = r."id" 
        AND m."createdAt" > COALESCE(ru."lastReadAt", '1970-01-01')
      ), 0) AS INTEGER) as "unreadCount",
      CASE 
        WHEN lm.latest_message IS NOT NULL 
        THEN json_build_array(lm.latest_message)
        ELSE '[]'::json
      END as "Messages"
    FROM "Rooms" r
    JOIN "RoomUsers" ru ON r."id" = ru."roomId"
    LEFT JOIN DirectMessageNames dmn ON r."id" = dmn."roomId"
    LEFT JOIN LatestMessages lm ON r."id" = lm."roomId"
    WHERE ru."userId" = :userId
    ORDER BY r."updatedAt" DESC
  `, {
    replacements: { userId },
    type: sequelize.QueryTypes.SELECT
  })

  res.json(roomsData)
})

// 建立聊天室
router.post('/', authenticateToken, async (req, res) => {
  const { name, isGroup } = req.body

  const room = await Room.create({ name, isGroup })

  const creatorId = req.user.userId
  await room.setUsers([creatorId])

  const roomData = {
    id: room.id,
    name: room.name,
    isGroup: room.isGroup,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    unreadCount: 0,
    lastReadAt: null,
    Messages: []
  }

  // Socket 房間加入邏輯
  joinRoomSocket(room.id, [creatorId], roomData)

  res.status(201).json(roomData)
})

// 創建或取得一對一聊天室
router.post('/direct', authenticateToken, async (req, res) => {
  const { targetUserId } = req.body
  const currentUserId = req.user.userId

  if (!targetUserId || targetUserId === currentUserId) {
    return res.status(400).json({ message: 'Invalid target user' })
  }

  const existingRooms = await sequelize.query(`
    SELECT r.*, ru1."lastReadAt"
    FROM "Rooms" r, "RoomUsers" ru1, "RoomUsers" ru2
    WHERE r."id" = ru1."roomId" AND r."id" = ru2."roomId"
      AND r."isGroup" = false
      AND ru1."userId" = :currentUserId
      AND ru2."userId" = :targetUserId
      AND ru1."userId" != ru2."userId"
  `, {
    replacements: {
      currentUserId: currentUserId,
      targetUserId: targetUserId
    },
    type: sequelize.QueryTypes.SELECT
  })

  if (existingRooms.length > 0) {
    const room = existingRooms[0]
    logger.info('找到現有一對一聊天室:', room.id)

    // 查詢對方用戶名作為房間名稱
    const otherUser = await User.findByPk(targetUserId, {
      attributes: ['username']
    })

    return res.json({
      id: room.id,
      name: otherUser.username,
      isGroup: room.isGroup,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      unreadCount: 0,
      lastReadAt: room.lastReadAt,
      Messages: []
    })
  }

  logger.info('未找到現有聊天室，創建新的一對一聊天室')

  const newRooms = await sequelize.query(`
    INSERT INTO "Rooms" (name, "isGroup", "createdAt", "updatedAt")
    VALUES (NULL, false, NOW(), NOW())
    RETURNING *
  `, {
    type: sequelize.QueryTypes.INSERT
  })

  const newRoom = newRooms[0][0]

  await sequelize.query(`
    INSERT INTO "RoomUsers" ("roomId", "userId", "createdAt", "updatedAt")
    VALUES 
      (:roomId, :currentUserId, NOW(), NOW()),
      (:roomId, :targetUserId, NOW(), NOW())
  `, {
    replacements: {
      roomId: newRoom.id,
      currentUserId,
      targetUserId
    },
    type: sequelize.QueryTypes.INSERT
  })

  logger.info('新聊天室創建成功:', newRoom.id)

  // 查詢對方用戶名作為房間名稱
  const otherUser = await User.findByPk(targetUserId, {
    attributes: ['username']
  })

  const roomData = {
    id: newRoom.id,
    name: otherUser.username,
    isGroup: newRoom.isGroup,
    createdAt: newRoom.createdAt,
    updatedAt: newRoom.updatedAt,
    unreadCount: 0,
    lastReadAt: null,
    Messages: []
  }

  // Socket 房間加入邏輯
  joinRoomSocket(newRoom.id, [currentUserId, targetUserId], roomData)

  res.status(201).json(roomData)
})

// 邀請用戶加入聊天室
router.post('/:roomId/invite', authenticateToken, async (req, res) => {
  const { roomId } = req.params
  const { userIds } = req.body
  const currentUserId = req.user.userId

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'Invalid user IDs' })
  }

  // 檢查當前用戶是否在聊天室中
  const roomUser = await RoomUser.findOne({
    where: { roomId, userId: currentUserId }
  })

  if (!roomUser) {
    return res.status(403).json({ message: 'Access denied' })
  }

  // 檢查聊天室是否存在
  const room = await Room.findByPk(roomId)
  if (!room) {
    return res.status(404).json({ message: 'Room not found' })
  }

  // 檢查被邀請用戶是否存在
  const users = await User.findAll({
    where: { id: userIds },
    attributes: ['id', 'username']
  })

  if (users.length !== userIds.length) {
    return res.status(400).json({ message: 'Some users not found' })
  }

  // 過濾掉已經在聊天室中的用戶
  const existingRoomUsers = await RoomUser.findAll({
    where: { roomId, userId: userIds }
  })

  const existingUserIds = existingRoomUsers.map(ru => ru.userId)
  const newMemberIds = userIds.filter(id => !existingUserIds.includes(id))

  if (newMemberIds.length === 0) {
    return res.status(400).json({ message: 'All users are already in the room' })
  }

  // 將新用戶加入聊天室
  const roomUsersToCreate = newMemberIds.map(userId => ({
    roomId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }))

  await RoomUser.bulkCreate(roomUsersToCreate)

  // 只有群組聊天室才創建系統訊息
  if (room.isGroup) {
    // 為每個新加入的用戶創建系統訊息
    for (const userId of newMemberIds) {
      const user = users.find(u => u.id === userId)
      if (user) {
        await createSystemMessage(roomId, SystemMessageTypes.USER_JOINED, {
          userId: user.id,
          username: user.username
        })
      }
    }
  }

  // 🆕 更新聊天室的 updatedAt 時間，用於排序
  logger.info(`📝 準備更新聊天室 ${roomId} 的 updatedAt 時間 (邀請用戶)`)
  await sequelize.query(
    'UPDATE "Rooms" SET "updatedAt" = NOW() WHERE "id" = :roomId',
    {
      replacements: { roomId },
      type: sequelize.QueryTypes.UPDATE
    }
  )
  logger.info(`✅ 聊天室 ${roomId} 的 updatedAt 已更新 (邀請用戶)`)

  // 查詢更新後的聊天室資訊
  const updatedRoom = await Room.findByPk(roomId)

  // 查詢最新訊息
  const latestMessage = await Message.findOne({
    where: { roomId: updatedRoom.id },
    include: [{ model: User, attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']]
  })

  // 計算這個聊天室的總訊息數（新加入成員的未讀數）
  const totalMessagesCount = await sequelize.query(`
    SELECT CAST(COUNT(*) AS INTEGER) as "totalCount"
    FROM "Messages" m 
    WHERE m."roomId" = :roomId
  `, {
    replacements: { roomId: updatedRoom.id },
    type: sequelize.QueryTypes.SELECT
  })

  const roomData = {
    id: updatedRoom.id,
    name: updatedRoom.name,
    isGroup: updatedRoom.isGroup,
    createdAt: updatedRoom.createdAt,
    updatedAt: updatedRoom.updatedAt,
    unreadCount: totalMessagesCount[0].totalCount,
    lastReadAt: null,
    Messages: latestMessage ? [latestMessage] : []
  }

  // Socket 房間加入邏輯
  joinRoomSocket(roomId, newMemberIds, roomData)

  res.json({
    message: 'Users invited successfully',
    invitedCount: newMemberIds.length,
    room: roomData
  })
})

// 標記聊天室為已讀
router.post('/:roomId/mark-read', authenticateToken, checkRoomAccess, async (req, res) => {
  const { roomId } = req.params
  const userId = req.user.userId

  // 更新最後讀取時間為當前時間
  await RoomUser.update(
    { lastReadAt: new Date() },
    { where: { userId, roomId } }
  )

  res.json({ message: 'Room marked as read', timestamp: new Date() })
})

// 離開聊天室
router.delete('/:roomId/leave', authenticateToken, checkRoomAccess, async (req, res) => {
  const { roomId } = req.params
  const userId = req.user.userId

  // 檢查聊天室類型
  const room = await Room.findByPk(roomId)
  if (!room) {
    return res.status(404).json({ message: 'Room not found' })
  }

  // 獲取用戶資訊
  const user = await User.findByPk(userId, {
    attributes: ['id', 'username']
  })

  // 從聊天室中移除用戶
  await RoomUser.destroy({
    where: { roomId, userId }
  })

  // 只有群組聊天室才創建系統訊息
  if (room.isGroup) {
    await createSystemMessage(roomId, SystemMessageTypes.USER_LEFT, {
      userId: user.id,
      username: user.username
    })
  }

  logger.info(`User ${user.username} left room ${roomId}`)

  res.json({ message: 'Successfully left the room' })
})

// 獲取聊天室成員列表
router.get('/:roomId/members', authenticateToken, checkRoomAccess, async (req, res) => {
  const { roomId } = req.params

  const members = await sequelize.query(`
    SELECT u."id", u."username", ru."createdAt" as "joinedAt"
    FROM "Users" u
    JOIN "RoomUsers" ru ON u."id" = ru."userId"
    WHERE ru."roomId" = :roomId
    ORDER BY ru."createdAt" ASC
  `, {
    replacements: { roomId },
    type: sequelize.QueryTypes.SELECT
  })

  res.json(members)
})

module.exports = router
