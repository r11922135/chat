const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('資料庫配置 - 環境變數載入:', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS ? '***' : undefined,
  JWT_SECRET: process.env.JWT_SECRET ? '***' : undefined,
  PORT: process.env.PORT
});

const sequelize = require('../models');
const User = require('../models/User');
const Room = require('../models/Room');
const RoomUser = require('../models/RoomUser');
const Message = require('../models/Message');

const initializeDatabase = async () => {
  try {
    console.log('開始連接資料庫...');
    console.log('資料庫配置:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER
    });

    await sequelize.authenticate();
    console.log('資料庫連接成功！');
    
    await sequelize.sync();
    console.log('PostgreSQL synced!');
    
    return { sequelize, User, Room, RoomUser, Message };
  } catch (err) {
    console.error('資料庫錯誤:', err);
    console.error('錯誤詳情:', err.message);
    throw err;
  }
};

module.exports = { initializeDatabase, sequelize, User, Room, RoomUser, Message };
