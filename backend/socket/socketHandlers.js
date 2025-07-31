const { User, Room, RoomUser, Message } = require('../config/database');

const setupSocketHandlers = (io) => {
  // Socket.IO 連接處理
  io.on('connection', (socket) => {
    console.log('用戶連接:', socket.id);
    
    // 🚀 自動加入所有房間
    for (const roomId of socket.roomIds) {
      socket.join(roomId.toString())
    }
    socket.emit('auto-joined-rooms', { roomIds: socket.roomIds })
    
    // 用戶加入聊天室
    socket.on('join-room', (roomId) => {
      const roomName = roomId.toString(); // 確保轉換為字串，與後續邏輯一致
      socket.join(roomName);
      console.log(`用戶 ${socket.id} 加入聊天室 ${roomName}`);
      console.log(`聊天室 ${roomName} 目前用戶數量:`, io.sockets.adapter.rooms.get(roomName)?.size || 0);
    });

    // 用戶離開聊天室
    socket.on('leave-room', (roomId) => {
      const roomName = roomId.toString(); // 確保轉換為字串，與後續邏輯一致
      socket.leave(roomName);
      console.log(`用戶 ${socket.id} 離開聊天室 ${roomName}`);
      console.log(`聊天室 ${roomName} 剩餘用戶數量:`, io.sockets.adapter.rooms.get(roomName)?.size || 0);
    });

    // 處理即時訊息
    socket.on('send-message', async (data) => {
      try {
        console.log('收到即時訊息:', data);
        console.log('發送者 Socket ID:', socket.id);
        
        // 驗證資料
        if (!data.roomId || !data.content || !data.userId) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        // 檢查發送者是否在目標房間內
        const roomName = data.roomId.toString();
        const isInRoom = socket.rooms.has(roomName);
        console.log(`Socket ${socket.id} 是否在房間 ${roomName} 內:`, isInRoom);
        console.log(`Socket 當前在的房間:`, Array.from(socket.rooms));
        
        if (!isInRoom) {
          console.log(`用戶不在房間內，強制加入房間 ${roomName}`);
          socket.join(roomName);
        }

        // 檢查用戶是否有權限發送到此聊天室
        const roomUser = await RoomUser.findOne({
          where: { roomId: data.roomId, userId: data.userId }
        });

        if (!roomUser) {
          socket.emit('error', { message: 'Access denied to this room' });
          return;
        }

        // 取得完整的訊息資訊（包含用戶資訊和聊天室資訊）
        const messageWithUser = await Message.findByPk(data.id, {
          include: [
            { model: User, attributes: ['id', 'username'] },
            { model: Room, attributes: ['id', 'name'] }  // 🆕 加入聊天室資訊
          ]
        });

        // 廣播給聊天室內的所有用戶
        const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
        
        console.log(`準備廣播訊息到聊天室 ${roomName}，房間內用戶數量: ${roomSize}`);
        
        io.to(roomName).emit('new-message', messageWithUser);
        
        console.log(`訊息已廣播到聊天室 ${data.roomId}，訊息內容:`, {
          id: messageWithUser.id,
          content: messageWithUser.content,
          roomId: messageWithUser.roomId,
          username: messageWithUser.User.username
        });
      } catch (error) {
        console.error('Socket 訊息處理錯誤:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // 處理邀請用戶加入 Socket 房間
    socket.on('invite-users-to-room', (data) => {
      try {
        console.log('收到邀請用戶到房間請求:', data);
        
        const { roomId, userIds } = data;
        
        if (!roomId || !Array.isArray(userIds)) {
          throw new Error('Invalid data');
        }
        
        // 讓被邀請的在線用戶加入 Socket 房間
        const roomName = roomId.toString();
        let joinedCount = 0;
        
        console.log('當前線上 Socket 連接數:', io.sockets.sockets.size);
        console.log('要邀請的用戶 ID:', userIds);
        
        io.sockets.sockets.forEach((clientSocket) => {
          console.log(`檢查 Socket ${clientSocket.id}, userId: ${clientSocket.userId}`);
          if (clientSocket.userId && userIds.includes(clientSocket.userId)) {
            clientSocket.join(roomName);
            joinedCount++;
            console.log(`✅ 用戶 ${clientSocket.userId} 的 Socket 已加入房間 ${roomName}`);
          }
        });
        
        console.log(`邀請處理完成，${joinedCount} 位在線用戶已加入 Socket 房間`);
        
      } catch (error) {
        console.error('邀請用戶到房間錯誤:', error);
        socket.emit('error', { message: error.message || 'Failed to invite users to room' });
      }
    });

    // 用戶斷線
    socket.on('disconnect', () => {
      console.log('用戶斷線:', socket.id);
    });
  });
};

// 輔助函數：讓在線用戶加入新創建的房間
const joinRoomSocket = (io, roomId, userIds) => {
  const roomIdStr = roomId.toString();
  let joinedCount = 0;
  
  io.sockets.sockets.forEach((socket) => {
    if (socket.userId && userIds.includes(socket.userId)) {
      socket.join(roomIdStr);
      joinedCount++;
      console.log(`✅ 用戶 ${socket.userId} 已立即加入聊天室 ${roomId}`);
      
      // 可以發送房間創建通知
      socket.emit('new-room-created', { roomId });
    }
  });
  
  console.log(`${joinedCount} 位在線用戶已加入聊天室 Socket 房間`);
  return joinedCount;
};

module.exports = { setupSocketHandlers, joinRoomSocket };
