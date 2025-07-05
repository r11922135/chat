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
    this.socket = null                // Socket.IO 客戶端實例
    this.messageCallbacks = []        // 訊息回調函數列表
  }

  // 【連接建立】連接到 Socket.IO 服務器
  connect() {
    // 防止重複連接
    if (!this.socket) {
      console.log('正在建立 Socket 連接...')
      
      // 創建 Socket.IO 客戶端實例
      this.socket = io('http://localhost:4000', {
        autoConnect: true   // 自動連接
      })

      // 【連接成功事件】
      this.socket.on('connect', () => {
        console.log('Socket 連接成功:', this.socket.id)
        console.log('Socket 連接狀態:', this.socket.connected)
        
        // 【重連處理】如果有重連回調函數，則調用它
        // 這通常用於重新加入聊天室等恢復操作
        if (this.onReconnectCallback) {
          this.onReconnectCallback()
        }
      })

      // 【連接斷開事件】
      this.socket.on('disconnect', () => {
        console.log('Socket 連接斷開')
      })

      // 【錯誤處理】
      this.socket.on('error', (error) => {
        console.error('Socket 錯誤:', error)
      })

      // 【核心訊息監聽】註冊新訊息監聽器
      // 重要：這個監聽器只註冊一次，然後通過回調函數分發給各個組件
      this.socket.on('new-message', (data) => {
        console.log('Socket 收到 new-message 事件:', data)
        
        // 【觀察者模式】通知所有註冊的回調函數
        // 這允許多個組件同時監聽新訊息，無需重複註冊 Socket 事件
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

  // 【重連回調設置】設定重新連接後的回調函數
  setOnReconnectCallback(callback) {
    this.onReconnectCallback = callback
  }

  // 【連接清理】斷開連接並清理資源
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()          // 斷開 Socket 連接
      this.socket = null                // 清空 Socket 實例
      this.messageCallbacks = []        // 清空回調函數列表
    }
  }

  // 【批量加入聊天室】向伺服器請求加入多個聊天室
  // 重要：這個函數只是發送請求，實際的加入操作由伺服器端執行
  joinRooms(roomIds) {
    if (this.socket && Array.isArray(roomIds)) {
      roomIds.forEach(roomId => {
        // 發送 'join-room' 事件給伺服器
        // 伺服器端必須監聽這個事件並調用 socket.join(roomId) 才能真正加入房間
        this.socket.emit('join-room', roomId)
        console.log(`向伺服器請求加入聊天室: ${roomId}`)
      })
    }
  }

  // 【加入單個聊天室】向伺服器請求加入特定聊天室
  // 【重要概念】Socket Room 的工作機制：
  // 1. 客戶端：發送 'join-room' 事件（這裡）
  // 2. 伺服器端：監聽 'join-room' 事件，執行 socket.join(roomId)
  // 3. 只有伺服器端的 socket.join() 才能真正將 socket 加入房間
  // 4. 加入房間後，該 socket 才能接收到房間內的廣播訊息
  joinRoom(roomId) {
    if (this.socket) {
      // 這只是發送請求，不是真正的加入操作
      this.socket.emit('join-room', roomId)
      console.log(`向伺服器請求加入聊天室: ${roomId}`)
    }
  }

  // 【訊息發送】發送即時訊息到指定聊天室
  // 伺服器端會接收這個事件，然後廣播給房間內的所有用戶
  sendMessage(messageData) {
    if (this.socket) {
      this.socket.emit('send-message', messageData)
      console.log('向伺服器發送即時訊息:', messageData)
    }
  }

  // 【回調管理】註冊訊息回調函數
  // 【觀察者模式】允許多個組件訂閱新訊息事件
  addMessageCallback(callback) {
    if (typeof callback === 'function') {
      this.messageCallbacks.push(callback)
      console.log('已註冊訊息回調函數，總數:', this.messageCallbacks.length)
    }
  }

  // 【回調管理】移除訊息回調函數
  // 重要：防止記憶體洩漏，組件卸載時必須移除回調
  removeMessageCallback(callback) {
    const index = this.messageCallbacks.indexOf(callback)
    if (index > -1) {
      this.messageCallbacks.splice(index, 1)
      console.log('已移除訊息回調函數，剩餘:', this.messageCallbacks.length)
    }
  }

  // 【實例存取】取得 socket 實例
  // 用於外部組件檢查連接狀態等
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

【為什麼需要伺服器端管理 Socket Room？】
- 安全性：防止客戶端任意加入不該加入的房間
- 權限控制：伺服器可以驗證用戶是否有權限加入房間
- 狀態管理：伺服器維護房間狀態和用戶列表
- 資源管理：控制房間的創建、銷毀和用戶數量限制
*/
