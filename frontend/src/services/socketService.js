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

  connect() {
    if (!this.socket) {
      this.socket = io('http://localhost:4000', {
        autoConnect: true
      })

      this.socket.on('connect', () => {
        console.log('Socket 連接成功:', this.socket.id)
        // 每次連接成功都執行初始化邏輯
        this.handleConnection()
      })

      // 監聽重連事件
      this.socket.on('reconnect', () => {
        console.log('Socket 連接成功:', this.socket.id)
        // 重連時也執行初始化邏輯
        this.handleConnection()
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
    }
    return this.socket
  }

  // 處理連接成功後的邏輯（初始連接和重連都會執行）
  handleConnection() {
    if (this.onConnectedCallback) {
      this.onConnectedCallback()
    }
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

  getSocket() {
    return this.socket
  }
}

// 【單例模式】建立並導出唯一的 socketService 實例
// 這確保整個應用共享同一個 Socket 連接，避免資源浪費和狀態不一致
const socketService = new SocketService()
export default socketService

/* 
【完整的 Socket Room 流程說明】

1. 客戶端流程（這個文件）：
   - socketService.connect()：建立與伺服器的連接
   - socketService.joinRoom(roomId)：發送加入房間請求
   - socketService.sendMessage(data)：發送訊息
   - socketService.addMessageCallback(callback)：註冊接收新訊息的回調

2. 伺服器端流程（需要後端實現）：
   - 監聽 'join-room' 事件
   - 執行 socket.join(roomId) 真正加入房間
   - 監聽 'send-message' 事件
   - 使用 io.to(roomId).emit() 廣播訊息給房間內所有用戶

3. 完整的訊息流程：
   用戶A發送訊息 → 伺服器接收 → 伺服器廣播給房間內所有用戶 → 用戶B接收訊息

【重連機制說明】
- 當 Socket 斷線時，Socket.IO 會自動嘗試重連
- 重連成功後會觸發 'reconnect' 事件
- 我們在重連事件中執行重連回調，重新加入所有房間
- 這樣確保用戶重連後能繼續接收訊息

【為什麼需要伺服器端管理 Socket Room？】
- 安全性：防止客戶端任意加入不該加入的房間
- 權限控制：伺服器可以驗證用戶是否有權限加入房間
- 狀態管理：伺服器維護房間狀態和用戶列表
- 資源管理：控制房間的創建、銷毀和用戶數量限制
*/
