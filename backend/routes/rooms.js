const express = require('express');
const { User, Room, RoomUser, Message, sequelize } = require('../config/database');
const { authenticateToken, checkRoomAccess } = require('../middleware/auth');

const router = express.Router();

// 存儲 io 實例的變量
let ioInstance = null;

// 設置 io 實例的函數
const setIo = (io) => {
  ioInstance = io;
};

// 輔助函數：讓在線用戶加入新創建的房間
const joinRoomSocket = (roomId, userIds, roomData) => {
  if (!ioInstance) return 0;
  
  const roomIdStr = roomId.toString();
  let joinedCount = 0;
  
  ioInstance.sockets.sockets.forEach((socket) => {
    if (socket.userId && userIds.includes(socket.userId)) {
      socket.join(roomIdStr);
      joinedCount++;
      console.log(`✅ 用戶 ${socket.userId} 已立即加入聊天室 ${roomId}`);
      
      socket.emit('new-room-created', { room: roomData });
    }
  });
  
  console.log(`${joinedCount} 位在線用戶已加入聊天室 Socket 房間`);
  return joinedCount;
};

// 取得用戶所有聊天室（包含未讀訊息數量）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const rooms = await sequelize.query(`
      SELECT r.*, ru."lastReadAt",
             CAST((SELECT COUNT(*) FROM "Messages" m WHERE m."roomId" = r."id" AND m."createdAt" > COALESCE(ru."lastReadAt", '1970-01-01')) AS INTEGER) as "unreadCount"
      FROM "Rooms" r
      JOIN "RoomUsers" ru ON r."id" = ru."roomId"
      WHERE ru."userId" = :userId
      ORDER BY r."updatedAt" DESC
    `, {
      replacements: { userId: userId },
      type: sequelize.QueryTypes.SELECT
    });

    // 🆕 為每個聊天室查詢成員資訊
    const roomsWithMembers = await Promise.all(rooms.map(async (room) => {
      // 查詢最新訊息
      const latestMessage = await Message.findOne({
        where: { roomId: room.id },
        include: [{ model: User, attributes: ['id', 'username'] }],
        order: [['createdAt', 'DESC']]
      });

      // 🆕 查詢聊天室成員
      const members = await sequelize.query(`
        SELECT u."id", u."username", ru."createdAt" as "joinedAt"
        FROM "Users" u
        JOIN "RoomUsers" ru ON u."id" = ru."userId"
        WHERE ru."roomId" = :roomId
        ORDER BY ru."createdAt" ASC
      `, {
        replacements: { roomId: room.id },
        type: sequelize.QueryTypes.SELECT
      });

      return {
        ...room,
        Messages: latestMessage ? [latestMessage] : [],
        members: members // 🆕 新增成員列表
      };
    }));

    res.json(roomsWithMembers);
  } catch (err) {
    console.error('Get rooms error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 建立聊天室
router.post('/', authenticateToken, async (req, res) => {
  const { name, isGroup } = req.body;
  
  try {
    const room = await Room.create({ name, isGroup });
    
    const creatorId = req.user.userId;
    await room.setUsers([creatorId]);
    
    // 🆕 查詢建立者資訊作為成員
    const creator = await User.findByPk(creatorId, {
      attributes: ['id', 'username']
    });

    const roomData = {
      id: room.id,
      name: room.name,
      isGroup: room.isGroup,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      unreadCount: 0,
      lastReadAt: null,
      Messages: [],
      members: [{ // 🆕 新增成員列表
        id: creator.id,
        username: creator.username,
        joinedAt: new Date()
      }]
    };

    // Socket 房間加入邏輯
    joinRoomSocket(room.id, [creatorId], roomData);
    
    res.status(201).json(roomData);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 創建或取得一對一聊天室
router.post('/direct', authenticateToken, async (req, res) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.userId;
  
  if (!targetUserId || targetUserId === currentUserId) {
    return res.status(400).json({ message: 'Invalid target user' });
  }
  
  try {
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
    });
    
    if (existingRooms.length > 0) {
      const room = existingRooms[0];
      console.log('找到現有一對一聊天室:', room.id);
      
      // 🆕 查詢現有聊天室的成員
      const members = await sequelize.query(`
        SELECT u."id", u."username", ru."createdAt" as "joinedAt"
        FROM "Users" u
        JOIN "RoomUsers" ru ON u."id" = ru."userId"
        WHERE ru."roomId" = :roomId
        ORDER BY ru."createdAt" ASC
      `, {
        replacements: { roomId: room.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      return res.json({
        id: room.id,
        name: room.name,
        isGroup: room.isGroup,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        unreadCount: 0,
        lastReadAt: room.lastReadAt,
        Messages: [],
        members: members // 🆕 新增成員列表
      });
    }
    
    console.log('未找到現有聊天室，創建新的一對一聊天室');
    
    const newRooms = await sequelize.query(`
      INSERT INTO "Rooms" (name, "isGroup", "createdAt", "updatedAt")
      VALUES (NULL, false, NOW(), NOW())
      RETURNING *
    `, {
      type: sequelize.QueryTypes.INSERT
    });
    
    const newRoom = newRooms[0][0];
    
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
    });
    
    console.log('新聊天室創建成功:', newRoom.id);
    
    // 🆕 查詢兩個用戶的資訊作為成員
    const members = await sequelize.query(`
      SELECT u."id", u."username", ru."createdAt" as "joinedAt"
      FROM "Users" u
      JOIN "RoomUsers" ru ON u."id" = ru."userId"
      WHERE ru."roomId" = :roomId
      ORDER BY ru."createdAt" ASC
    `, {
      replacements: { roomId: newRoom.id },
      type: sequelize.QueryTypes.SELECT
    });
    
    const roomData = {
      id: newRoom.id,
      name: newRoom.name,
      isGroup: newRoom.isGroup,
      createdAt: newRoom.createdAt,
      updatedAt: newRoom.updatedAt,
      unreadCount: 0,
      lastReadAt: null,
      Messages: [],
      members: members // 🆕 新增成員列表
    };
    
    // Socket 房間加入邏輯
    joinRoomSocket(newRoom.id, [currentUserId, targetUserId], roomData);
    
    res.status(201).json(roomData);
    
  } catch (err) {
    console.error('Create direct room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 邀請用戶加入聊天室
router.post('/:roomId/invite', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const { userIds } = req.body;
  const currentUserId = req.user.userId;
  
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'Invalid user IDs' });
  }
  
  try {
    // 檢查當前用戶是否在聊天室中
    const roomUser = await RoomUser.findOne({
      where: { roomId, userId: currentUserId }
    });
    
    if (!roomUser) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // 檢查聊天室是否存在
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // 檢查被邀請用戶是否存在
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'username']
    });
    
    if (users.length !== userIds.length) {
      return res.status(400).json({ message: 'Some users not found' });
    }
    
    // 過濾掉已經在聊天室中的用戶
    const existingRoomUsers = await RoomUser.findAll({
      where: { roomId, userId: userIds }
    });
    
    const existingUserIds = existingRoomUsers.map(ru => ru.userId);
    const newMemberIds = userIds.filter(id => !existingUserIds.includes(id));
    
    if (newMemberIds.length === 0) {
      return res.status(400).json({ message: 'All users are already in the room' });
    }
    
    // 將新用戶加入聊天室
    const roomUsersToCreate = newMemberIds.map(userId => ({
      roomId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await RoomUser.bulkCreate(roomUsersToCreate);
    
    // 🆕 更新聊天室的 updatedAt 時間，用於排序
    console.log(`📝 準備更新聊天室 ${roomId} 的 updatedAt 時間 (邀請用戶)`);
    await sequelize.query(
      'UPDATE "Rooms" SET "updatedAt" = NOW() WHERE "id" = :roomId',
      {
        replacements: { roomId },
        type: sequelize.QueryTypes.UPDATE
      }
    );
    console.log(`✅ 聊天室 ${roomId} 的 updatedAt 已更新 (邀請用戶)`);
    
    // 🆕 查詢更新後的聊天室資訊（包含所有成員）
    const updatedRoom = await Room.findByPk(roomId, {
      include: [
        {
          model: User,
          through: { attributes: ['createdAt'] },
          attributes: ['id', 'username']
        }
      ]
    });
    
    // 🆕 格式化成員資訊
    const members = updatedRoom.Users.map(user => ({
      id: user.id,
      username: user.username,
      joinedAt: user.RoomUser.createdAt
    }));
    
    const roomData = {
      id: updatedRoom.id,
      name: updatedRoom.name,
      isGroup: updatedRoom.isGroup,
      createdAt: updatedRoom.createdAt,
      updatedAt: updatedRoom.updatedAt,
      unreadCount: 0,
      lastReadAt: null,
      Messages: [],
      members: members // 🆕 新增成員列表
    };
    
    // Socket 房間加入邏輯
    joinRoomSocket(roomId, newMemberIds, roomData);
    
    res.json({ 
      message: 'Users invited successfully',
      invitedCount: newMemberIds.length,
      room: roomData // 🆕 返回包含成員資訊的聊天室資料
    });
    
  } catch (err) {
    console.error('Invite users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 標記聊天室為已讀
router.post('/:roomId/mark-read', authenticateToken, checkRoomAccess, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    
    // 更新最後讀取時間為當前時間
    await RoomUser.update(
      { lastReadAt: new Date() },
      { where: { userId, roomId } }
    );
    
    res.json({ message: 'Room marked as read', timestamp: new Date() });
  } catch (err) {
    console.error('Mark room as read error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = { router, setIo };
