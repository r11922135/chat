const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Room = sequelize.define('Room', {
  name: {
    type: DataTypes.STRING,
    allowNull: true, // 一對一可為 null，群組可有名稱
  },
  isGroup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Room;
