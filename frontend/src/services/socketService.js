import { io } from 'socket.io-client'

class SocketService {
  constructor() {
    this.socket = null
    this.messageCallbacks = []
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

      // 在連接時就註冊訊息監聽器，只註冊一次
      this.socket.on('new-message', (data) => {
        console.log('Socket 收到 new-message 事件:', data)
        // 通知所有註冊的回調函數
        this.messageCallbacks.forEach(callback => {
          try {
            callback(data)
          } catch (error) {
            console.error('訊息回調函數執行錯誤:', error)
          }
        })
      })
      
      console.log('Socket 實例已創建並註冊監聽器')
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
      this.messageCallbacks = []
    }
  }

  // 批量加入聊天室
  joinRooms(roomIds) {
    if (this.socket && Array.isArray(roomIds)) {
      roomIds.forEach(roomId => {
        this.socket.emit('join-room', roomId)
        console.log(`加入聊天室: ${roomId}`)
      })
    }
  }

  // 加入單個聊天室
  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('join-room', roomId)
      console.log(`加入聊天室: ${roomId}`)
    }
  }

  // 發送即時訊息
  sendMessage(messageData) {
    if (this.socket) {
      this.socket.emit('send-message', messageData)
      console.log('發送即時訊息:', messageData)
    }
  }

  // 註冊訊息回調函數
  addMessageCallback(callback) {
    if (typeof callback === 'function') {
      this.messageCallbacks.push(callback)
      console.log('已註冊訊息回調函數，總數:', this.messageCallbacks.length)
    }
  }

  // 移除訊息回調函數
  removeMessageCallback(callback) {
    const index = this.messageCallbacks.indexOf(callback)
    if (index > -1) {
      this.messageCallbacks.splice(index, 1)
      console.log('已移除訊息回調函數，剩餘:', this.messageCallbacks.length)
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
