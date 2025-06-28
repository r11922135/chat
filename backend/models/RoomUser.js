const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User');
const Room = require('./Room');

const RoomUser = sequelize.define('RoomUser', {
  // 可加上其他欄位如角色、加入時間等
});

Room.belongsToMany(User, { through: RoomUser, foreignKey: 'roomId' });
User.belongsToMany(Room, { through: RoomUser, foreignKey: 'userId' });

module.exports = RoomUser;
