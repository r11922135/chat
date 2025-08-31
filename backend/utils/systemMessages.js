const Message = require('../models/Message')
const User = require('../models/User')
const { getIO } = require('../socket/socketHandlers')
const logger = require('./logger')

const SystemMessageTypes = {
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left'
}

const createSystemMessage = async (roomId, type, data = {}) => {
  try {
    let content = ''
    let systemData = { type, ...data }

    switch (type) {
    case SystemMessageTypes.USER_JOINED:
      if (data.username) {
        content = `${data.username} joined the room`
      } else {
        content = 'A user joined the room'
      }
      break
    case SystemMessageTypes.USER_LEFT:
      if (data.username) {
        content = `${data.username} left the room`
      } else {
        content = 'A user left the room'
      }
      break
    default:
      content = 'System event occurred'
    }

    const systemMessage = await Message.create({
      content,
      type: 'system',
      systemData,
      roomId,
      userId: null
    })

    const messageWithData = await Message.findByPk(systemMessage.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
          required: false
        }
      ]
    })

    const io = getIO()
    if (io) {
      const messageData = {
        id: messageWithData.id,
        content: messageWithData.content,
        type: messageWithData.type,
        systemData: messageWithData.systemData,
        createdAt: messageWithData.createdAt,
        roomId: messageWithData.roomId,
        User: messageWithData.User,
        Room: { id: roomId }
      }

      logger.info(`Broadcasting system message to room ${roomId}:`, messageData.content)
      io.to(roomId.toString()).emit('new-message', messageData)
    }

    return messageWithData
  } catch (error) {
    logger.error('Error creating system message:', error)
    throw error
  }
}

module.exports = {
  SystemMessageTypes,
  createSystemMessage
}