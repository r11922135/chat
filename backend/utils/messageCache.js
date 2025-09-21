const { getRedisClient, isRedisAvailable } = require('./redis')
const logger = require('./logger')

/**
 * Cache a message in Redis
 * Uses two data structures:
 * 1. ZSET room:{roomId}:zmsgs with score=messageId, member=messageId
 * 2. STRING msg:{messageId} with JSON of the full message data
 */
async function cacheMessage(messageData) {
  if (!isRedisAvailable()) {
    return // Graceful degradation - skip caching if Redis unavailable
  }

  try {
    const redis = getRedisClient()
    const { id: messageId, roomId } = messageData
    // Check if messageId is valid
    if (messageId === undefined || messageId === null) {
      logger.error('Message data missing id field:', messageData)
      return
    }
    const roomKey = `room:${roomId}:zmsgs`
    const msgKey = `msg:${messageId}`

    // Store message JSON and add to room's sorted set
    // Using messageId as both score and member for monotonic ordering
    const results = await Promise.all([
      redis.set(msgKey, JSON.stringify(messageData), { EX: 86400 }), // 1天過期
      redis.zAdd(roomKey, [{ value: messageId.toString(), score: messageId }])
    ])

    // 設定 sorted set 的過期時間
    await redis.expire(roomKey, 86400) // 1天過期
    logger.info('Redis set result:', results[0])
    logger.info('Redis zAdd result:', results[1])
    logger.info(`Cached message ${messageId} in room ${roomId}`)
  } catch (error) {
    logger.error(`Failed to cache message: ${error.message}`)
    // Don't throw - continue execution even if caching fails
  }
}

/**
 * Get latest N messages from Redis cache
 * Falls back to DB if cache miss
 */
async function getLatestMessages(roomId, limit = 15) {
  if (!isRedisAvailable()) {
    return [] // Signal cache miss - caller should use DB
  }

  try {
    const redis = getRedisClient()
    const roomKey = `room:${roomId}:zmsgs`

    // Get latest message IDs (highest scores first)
    const messageIds = await redis.zRange(roomKey, 0, limit - 1, { REV: true })

    if (messageIds.length === 0) {
      return [] // Cache miss - no messages in cache
    }

    // Get message data for all IDs
    const operations = []
    messageIds.forEach(id => operations.push(redis.get(`msg:${id}`)))
    const results = await Promise.all(operations)
    logger.info(results)

    const messages = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result) {
        try {
          messages.push(JSON.parse(result))
        } catch (parseError) {
          logger.error(`Failed to parse cached message ${messageIds[i]}:`, parseError.message)
        }
      }
    }

    // Sort by id descending (newest first) to match DB ordering
    //messages.sort((a, b) => b.id - a.id)

    logger.info(`Retrieved ${messages.length} messages from cache for room ${roomId}`)
    return messages

  } catch (error) {
    logger.error(`Failed to get cached messages: ${error.message}`)
    return null // Cache miss - caller should use DB
  }
}

/**
 * Get older messages before a specific message ID
 * Used for pagination/lazy loading
 */
async function getOlderMessages(roomId, beforeId, limit = 15) {
  if (!isRedisAvailable()) {
    return [] // Signal cache miss
  }

  try {
    const redis = getRedisClient()
    const roomKey = `room:${roomId}:zmsgs`

    // Get messages with ID less than beforeId (older messages)
    // ZREVRANGEBYSCORE with max=(beforeId-1) to exclude beforeId itself
    const maxScore = beforeId - 1
    const messageIds = await redis.zRange(roomKey, maxScore, '-inf', { REV: true, BY: 'SCORE', LIMIT: { offset: 0, count: limit } })
    logger.info(`Fetched ${messageIds.length} older message IDs from cache for room ${roomId} before ${beforeId}`)

    if (messageIds.length === 0) {
      return [] // No older messages in cache
    }

    // Get message data
    const operations = []
    messageIds.forEach(id => operations.push(redis.get(`msg:${id}`)))
    const results = await Promise.all(operations)
    //logger.info(results)

    const messages = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result) {
        try {
          messages.push(JSON.parse(result))
        } catch (parseError) {
          logger.error(`Failed to parse cached message ${messageIds[i]}:`, parseError.message)
        }
      }
    }

    // Sort by id descending (newest first)
    //messages.sort((a, b) => b.id - a.id)

    logger.info(`Retrieved ${messages.length} older messages from cache for room ${roomId} before ${beforeId}`)
    return messages

  } catch (error) {
    logger.error(`Failed to get older cached messages: ${error.message}`)
    return [] // Cache miss
  }
}

/**
 * Backfill Redis cache with messages from DB
 * Used when cache is cold or incomplete
 */
async function backfillCache(roomId, messages) {
  if (!isRedisAvailable() || messages.length === 0) {
    return
  }

  try {
    const redis = getRedisClient()
    const roomKey = `room:${roomId}:zmsgs`

    // Filter out messages without valid id first
    //const validMessages = messages.filter(message => message.id !== undefined && message.id !== null)

    // Prepare all operations for Promise.all
    const operations = []
    const zAdds = []
    messages.forEach(message => {
      const messageId = message.id
      console.log('Processing message:', messageId, 'type:', typeof messageId)
      const msgKey = `msg:${messageId}`
      // Add set operation with 1 day expiration
      operations.push(redis.set(msgKey, JSON.stringify(message), { EX: 86400 })) // 1天過期
      // Try different parameter format for zAdd
      zAdds.push({ score: messageId, value: messageId.toString() })
    })
    operations.push(redis.zAdd(roomKey, zAdds))
    const results = await Promise.all(operations)

    // 設定 sorted set 的過期時間
    await redis.expire(roomKey, 86400) // 1天過期
    logger.info('Backfill Redis set results:', results.slice(0, -1))
    logger.info('Backfill Redis zAdd result:', results[results.length - 1])
    logger.info(`Backfilled cache with ${messages.length} messages for room ${roomId}`)

  } catch (error) {
    logger.error(`Failed to backfill cache: ${error.message}`)
  }
}

module.exports = {
  cacheMessage,
  getLatestMessages,
  getOlderMessages,
  backfillCache
}