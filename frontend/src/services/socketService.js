import { io } from 'socket.io-client'

/**
 * Socket 服務類 - 管理與後端的 WebSocket 連接
 * 
 * 【設計模式】單例模式 (Singleton Pattern)
 * - 確保整個應用只有一個 Socket 連接實例
 * - 避免多個組件創建重複的連接
 * - 提供全局訪問點
 */
class SocketService {
  constructor() {
    this.socket = null
    this.messageCallbacks = []
    this.onConnectedCallback = null // 連接成功後的回調（初始連接和重連都會執行）
  }

  getSocketURL() {
    if (process.env.NODE_ENV === 'production') {
      return window.location.origin
    }
    else if (process.env.NODE_ENV === 'render') {
      return 'https://chat-n5a3.onrender.com' 
    }
    return 'http://localhost:5000'
  }
  
  connect() {
    if (!this.socket) {
      const socketURL = this.getSocketURL()
      console.log('🔌 Socket 連接到:', socketURL)
      
      // 🆕 只加這一行：傳遞 token 給後端
      const token = localStorage.getItem('chatToken')
      
      this.socket = io(socketURL, {
        autoConnect: true,
        // 🆕 只加這個配置
        auth: {
          token: token
        }
      })

      this.socket.on('connect', () => {
        console.log('Socket 連接成功:', this.socket.id)
        if (this.onConnectedCallback) {
          this.onConnectedCallback()
        }
      })

      this.socket.on('auto-joined-rooms', (data) => {
        console.log('🏠 後端已自動加入房間:', data.roomIds)
      })
      
      this.socket.on('disconnect', () => {
        console.log('Socket 連接斷開')
      })

      this.socket.on('new-message', (data) => {
        this.messageCallbacks.forEach(callback => {
          try {
            callback(data)
          } catch (error) {
            console.error('訊息回調執行錯誤:', error)
          }
        })
      })

      // 統一的錯誤處理
      this.socket.on('error', (error) => {
        console.error('Socket 錯誤:', error)
        // 可以在這裡添加更多錯誤處理邏輯，比如顯示用戶友好的錯誤訊息
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket 連接錯誤:', error)
      })
    }
    return this.socket
  }

  // 設置連接回調（初始連接和重連都會執行）
  setOnConnectedCallback(callback) {
    this.onConnectedCallback = callback
    
    // 如果已經連接，立即執行
    if (this.socket?.connected) {
      callback()
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.messageCallbacks = []
      this.onConnectedCallback = null // 清理回調
    }
  }

  joinRooms(roomIds) {
    if (this.socket && Array.isArray(roomIds)) {
      roomIds.forEach(roomId => {
        this.socket.emit('join-room', roomId)
      })
    }
  }

  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('join-room', roomId)
    }
  }

  sendMessage(messageData) {
    if (this.socket) {
      this.socket.emit('send-message', messageData)
    }
  }

  // 🆕 邀請用戶加入 Socket 房間
  inviteUsersToRoom(roomId, userIds) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('invite-users-to-room', { roomId, userIds })
      console.log('發送邀請用戶到房間請求:', { roomId, userIds })
    } else {
      console.warn('Socket 未連接，無法邀請用戶到房間')
    }
  }

  addMessageCallback(callback) {
    if (typeof callback === 'function') {
      this.messageCallbacks.push(callback)
    }
  }

  removeMessageCallback(callback) {
    const index = this.messageCallbacks.indexOf(callback)
    if (index > -1) {
      this.messageCallbacks.splice(index, 1)
    }
  }

  // 在 socketService 中添加新聊天室監聽
  setOnNewRoomCallback(callback) {
    if (this.socket) {
      this.socket.on('new-room-created', callback);
    }
  }

  removeNewRoomCallback(callback) {
    if (this.socket) {
      this.socket.off('new-room-created', callback);
    }
  }

  getSocket() {
    return this.socket
  }
}

// 【單例模式】建立並導出唯一的 socketService 實例
// 這確保整個應用共享同一個 Socket 連接，避免資源浪費和狀態不一致
const socketService = new SocketService()
export default socketService
