const { Sequelize } = require('sequelize')

const config = require('../utils/config')
const logger = require('../utils/logger')

logger.info('models/index.js - 資料庫配置:', {
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  ssl: config.NODE_ENV === 'production'
})

const sequelize = new Sequelize(
  config.DB_NAME,
  config.DB_USER,
  config.DB_PASS,
  {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'postgres',
    dialectOptions: {
      ssl: config.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false  // AWS RDS 需要這個設定
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: false
  }
)

module.exports = sequelize