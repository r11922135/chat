const express = require('express')
const cors = require('cors')
const path = require('path')

// 導入控制器
const authController = require('./controllers/auth')
const userController = require('./controllers/users')
const roomController = require('./controllers/rooms')
const messageController = require('./controllers/messages')

// 導入錯誤處理中間件
const { errorHandler, notFound } = require('./utils/middleware')

const app = express()

// 基本中間件
app.use(cors())
app.use(express.json())

// 提供靜態文件（前端 build 檔案）
app.use(express.static(path.join(__dirname, 'dist')))

// API 路由
app.use('/api/auth', authController)
app.use('/api/users', userController)
app.use('/api/rooms', roomController)
app.use('/api/messages', messageController)

// 404 處理 - 必須在所有路由之後
app.use(notFound)

// 全域錯誤處理中間件 - 必須在最後
app.use(errorHandler)

module.exports = app
