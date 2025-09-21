const { createServer } = require('http')
const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')
const { initializeSocketIO } = require('./socket/socketHandlers')
const { initRedis } = require('./utils/redis')
const sequelize = require('./models')

// 建立伺服器
const server = createServer(app)

// 初始化 Socket.IO
initializeSocketIO(server)

// 啟動伺服器
const startServer = async () => {
  try {
    logger.info('開始連接資料庫...')
    await sequelize.authenticate()
    logger.info('資料庫連接成功！')
    await sequelize.sync({ alter: true })
    logger.info('PostgreSQL synced!')
    await initRedis()
    server.listen(config.PORT, () => {
      logger.info(`Server is running on port ${config.PORT}`)
      logger.info('Socket.IO server is ready')
    })
  } catch (err) {
    logger.error('啟動伺服器失敗:', err)
    logger.error('錯誤詳情:', err.message)
    process.exit(1)
  }
}

startServer()