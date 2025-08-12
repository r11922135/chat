const express = require('express');
const logger = require('../utils/logger');
const sequelize = require('../models');
const User = require('../models/User');
const Message = require('../models/Message');
const { authenticateToken, checkRoomAccess } = require('../utils/middleware');

const router = express.Router();

// 取得聊天室訊息 (基於 ID 的分頁)
router.get('/:roomId', authenticateToken, checkRoomAccess, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { before } = req.query; // 只保留 before 參數
    const limit = 15; // 固定每次取 15 則訊息
    
    // 構建查詢條件
    const whereClause = { roomId };
    if (before) {
      whereClause.id = { [sequelize.Sequelize.Op.lt]: parseInt(before) };
    }
    
    const messages = await Message.findAll({
      where: whereClause,
      include: [{ model: User, attributes: ['id', 'username'] }],
      order: [['id', 'DESC']], // 按 id 降序，取更舊的訊息
      limit: limit
    });
    
    // 返回時反轉順序，讓最舊的在前面
    const reversedMessages = messages.reverse();
    
    res.json({
      messages: reversedMessages,
      hasMore: messages.length === limit // 如果取滿 15 則，表示還有更多
    });
  } catch (err) {
    logger.error('Get messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 發送訊息
router.post('/:roomId', authenticateToken, checkRoomAccess, async (req, res) => {
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
    
    // 🆕 更新聊天室的 updatedAt 時間，用於排序
    logger.info(`📝 準備更新聊天室 ${roomId} 的 updatedAt 時間 (發送訊息)`);
    await sequelize.query(
      'UPDATE "Rooms" SET "updatedAt" = NOW() WHERE "id" = :roomId',
      {
        replacements: { roomId },
        type: sequelize.QueryTypes.UPDATE
      }
    );
    logger.info(`✅ 聊天室 ${roomId} 的 updatedAt 已更新 (發送訊息)`);
    
    // 返回完整的訊息資訊，包含發送者資訊
    const messageWithUser = await Message.findByPk(message.id, {
      include: [{ model: User, attributes: ['id', 'username'] }]
    });
    
    res.status(201).json(messageWithUser);
  } catch (err) {
    logger.error('Send message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
