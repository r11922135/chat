const path = require('path')

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const PORT = process.env.PORT || 5000
const DB_HOST = process.env.DB_HOST
const DB_PORT = process.env.DB_PORT
const DB_NAME = process.env.DB_NAME
const DB_USER = process.env.DB_USER
const DB_PASS = process.env.DB_PASS
const JWT_SECRET = process.env.JWT_SECRET
const NODE_ENV = process.env.NODE_ENV

module.exports = {
  PORT,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASS,
  JWT_SECRET,
  NODE_ENV
}
