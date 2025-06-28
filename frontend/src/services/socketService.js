import { io } from 'socket.io-client'

class SocketService {
  constructor() {
    this.socket = null
  }

  // 連接到 Socket.IO 服務器
  connect() {
    if (!this.socket) {
      console.log('正在建立 Socket 連接...')
      this.socket = io('http://localhost:4000', {
        autoConnect: true
      })

      this.socket.on('connect', () => {
        console.log('Socket 連接成功:', this.socket.id)
        console.log('Socket 連接狀態:', this.socket.connected)
        
        // 連接成功後，如果有回調函數則調用
        if (this.onReconnectCallback) {
          this.onReconnectCallback()
        }
      })

      this.socket.on('disconnect', () => {
        console.log('Socket 連接斷開')
      })

      this.socket.on('error', (error) => {
        console.error('Socket 錯誤:', error)
      })
      
      console.log('Socket 實例已創建')
    }
    return this.socket
  }

  // 設定重新連接後的回調函數
  setOnReconnectCallback(callback) {
    this.onReconnectCallback = callback
  }

  // 斷開連接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // 加入聊天室
  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('join-room', roomId)
      console.log(`加入聊天室: ${roomId}`)
    }
  }

  // 離開聊天室
  leaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit('leave-room', roomId)
      console.log(`離開聊天室: ${roomId}`)
    }
  }

  // 發送即時訊息
  sendMessage(messageData) {
    if (this.socket) {
      this.socket.emit('send-message', messageData)
      console.log('發送即時訊息:', messageData)
    }
  }

  // 監聽新訊息
  onNewMessage(callback) {
    if (this.socket) {
      // 先移除現有的監聽器避免重複
      this.socket.off('new-message')
      console.log('已移除舊的 new-message 監聽器')
      
      // 添加新的監聽器
      this.socket.on('new-message', (data) => {
        console.log('Socket 收到 new-message 事件:', data)
        console.log('Socket 狀態:', {
          connected: this.socket.connected,
          id: this.socket.id
        })
        callback(data)
      })
      
      console.log('已設定新的 new-message 監聽器')
    } else {
      console.error('Socket 未連接，無法設定監聽器')
    }
  }

  // 移除新訊息監聽器
  offNewMessage() {
    if (this.socket) {
      this.socket.off('new-message')
      console.log('已移除 new-message 監聽器')
    }
  }

  // 取得 socket 實例
  getSocket() {
    return this.socket
  }
}

// 建立單例
const socketService = new SocketService()
export default socketService
