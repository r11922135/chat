const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User');
const Room = require('./Room');

const RoomUser = sequelize.define('RoomUser', {
  // 用戶最後閱讀訊息的時間
  // 用於計算未讀訊息數量和標記讀取狀態
  lastReadAt: {
    type: DataTypes.DATE,
    allowNull: true,          // 允許為空，新加入的用戶可能還沒讀過任何訊息
    defaultValue: null        // 預設值為 null
  }
  // 可加上其他欄位如角色、加入時間等
});

Room.belongsToMany(User, { through: RoomUser, foreignKey: 'roomId' });
User.belongsToMany(Room, { through: RoomUser, foreignKey: 'userId' });

// 🆕 為了支援 RoomUser.include([Room, User]) 查詢，需要定義 belongsTo 關係
RoomUser.belongsTo(Room, { foreignKey: 'roomId' });
RoomUser.belongsTo(User, { foreignKey: 'userId' });

module.exports = RoomUser;
