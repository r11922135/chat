const { createClient } = require('redis')
const logger = require('./logger')
const config = require('./config')

// Redis client instance
let redisClient = null

/**
 * Initialize Redis connection
 * Creates a Redis client using REDIS_URL from environment variables
 * If Redis is unavailable, logs error but doesn't crash the app
 */
async function initRedis() {
  try {
    const redisUrl = config.REDIS_URL || 'redis://localhost:6379'

    redisClient = createClient({
      url: redisUrl,
      password: config.REDIS_PASSWORD,
      // Graceful error handling - don't crash app if Redis is down
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Too many reconnection attempts, giving up')
            return false
          }
          return Math.min(retries * 100, 3000)
        }
      }
    })

    // Handle Redis connection events
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err.message)
    })

    redisClient.on('connect', () => {
      logger.info('Redis client connected')
    })

    redisClient.on('ready', () => {
      logger.info('Redis client ready')
    })

    redisClient.on('end', () => {
      logger.info('Redis client disconnected')
    })

    await redisClient.connect()
    logger.info('Redis initialized successfully')

  } catch (error) {
    logger.error('Failed to initialize Redis:', error.message)
    redisClient = null
  }
}

/**
 * Get the Redis client instance
 * Returns null if Redis is not available (graceful degradation)
 */
function getRedisClient() {
  return redisClient
}

/**
 * Check if Redis is available and connected
 */
function isRedisAvailable() {
  return redisClient && redisClient.isOpen
}

/**
 * Gracefully close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit()
      logger.info('Redis connection closed')
    } catch (error) {
      logger.error('Error closing Redis connection:', error.message)
    }
    redisClient = null
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisAvailable,
  closeRedis
}