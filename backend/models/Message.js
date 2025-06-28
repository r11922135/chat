const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User');
const Room = require('./Room');

const Message = sequelize.define('Message', {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

Message.belongsTo(User, { foreignKey: 'userId' });
Message.belongsTo(Room, { foreignKey: 'roomId' });
Room.hasMany(Message, { foreignKey: 'roomId' });
User.hasMany(Message, { foreignKey: 'userId' });

module.exports = Message;
