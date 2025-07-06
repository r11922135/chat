import { useState, useEffect, useRef } from 'react'
import chatService from '../services/chatService'
import socketService from '../services/socketService'
import InviteUsers from '../components/InviteUsers'
import './Chat.css'

const Chat = ({ onLogout, onAuthExpired }) => {
  // 【狀態管理】聊天組件的核心狀態
  
  // 用戶的聊天室列表 - 存儲從後端獲取的所有聊天室資訊
  // 包含聊天室 ID、名稱、參與者等資訊
  const [rooms, setRooms] = useState([])
  
  // 當前選中的聊天室 - 用戶正在查看的聊天室
  // 這個狀態決定了右側顯示哪個聊天室的訊息
  // 也影響了新訊息的過濾邏輯（只顯示屬於當前聊天室的訊息）
  const [selectedRoom, setSelectedRoom] = useState(null)
  
  // 當前聊天室的訊息列表 - 顯示在聊天區域的所有訊息
  // 包含歷史訊息（從後端載入）和即時訊息（透過 Socket 接收）
  const [messages, setMessages] = useState([])
  
  // 輸入框中的新訊息內容 - 用戶正在輸入的訊息
  // 這是受控組件的狀態，與輸入框的值綁定
  const [newMessage, setNewMessage] = useState('')
  
  // 頁面載入狀態 - 控制載入指示器的顯示
  // 在載入聊天室列表時為 true，載入完成後為 false
  const [loading, setLoading] = useState(true)
  
  // 錯誤訊息 - 存儲和顯示各種錯誤情況
  // 例如：網路錯誤、API 錯誤、身份驗證錯誤等
  const [error, setError] = useState('')
  
  // 邀請用戶模態窗口的顯示狀態
  // 控制邀請用戶對話框的開啟和關閉
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  // 【Ref 引用】用於 DOM 操作
  // 指向訊息列表底部的元素，用於實現自動滾動功能
  // 當有新訊息時，自動滾動到底部讓用戶看到最新訊息
  const messagesEndRef = useRef(null)
  
  // 【本地存儲資料】從瀏覽器的 localStorage 獲取用戶資訊
  // 這些資料在用戶登入時被存儲，用於身份驗證和訊息發送
  const currentUser = localStorage.getItem('chatUsername')       // 用戶名
  const currentUserId = localStorage.getItem('chatUserId')       // 用戶 ID
  const token = localStorage.getItem('chatToken')                // 身份驗證 token

  // 【應用初始化】檢查身份驗證並初始化聊天環境
  // 這是整個聊天組件的入口點，負責建立聊天所需的基礎環境
  useEffect(() => {
    if (!token) {
      onAuthExpired()
      return
    }
    
    // 🎯 正確的執行順序：
    // 1. 先載入房間資料並設置連接回調
    // 2. 再建立 Socket 連接
    const initializeChat = async () => {
      await loadRoomsAndJoinAll()  // 確保房間載入完成且回調已設置
      socketService.connect()      // 然後才連接 Socket
    }
    
    initializeChat()
    
    return () => {
      socketService.disconnect()
    }
  }, [token])
  
  // 【為什麼要監聽 token 變化？】
  // 當用戶重新登入時，會有新的 token，我們需要重新初始化整個聊天環境
  // 當用戶登出時，token 會被清空，我們需要斷開連接並清理資源

  // 【核心功能】載入用戶的聊天室
  // 這個函數負責：
  // 1. 從後端 API 獲取用戶的聊天室列表
  // 2. 更新 rooms 狀態（觸發 useEffect 重新設置 Socket 回調）
  // 3. 處理載入過程中的錯誤情況
  // 
  // 注意：Socket 房間的加入由 rooms 狀態變化觸發的 useEffect 處理，
  // 而不是在這個函數中直接處理，這樣可以確保使用最新的 rooms 狀態
  const loadRoomsAndJoinAll = async () => {
    try {
      setLoading(true)
      
      const roomsData = await chatService.getUserRooms()
      setRooms(roomsData)
      
      // 🆕 設置連接回調，連接成功後自動加入聊天室
      socketService.setOnConnectedCallback(() => {
        const roomIds = roomsData.map(room => room.id)
        socketService.joinRooms(roomIds)
        console.log('已加入聊天室:', roomIds)
      })
      
      setError('')
    } catch (err) {
      console.error('Load rooms error:', err)
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('chatToken')
        localStorage.removeItem('chatUsername')
        localStorage.removeItem('chatUserId')
        onAuthExpired()
      } else {
        setError('Failed to load chat rooms')
      }
    } finally {
      setLoading(false)
    }
  }
  
  // 【關鍵修正】當 rooms 狀態改變時，更新 Socket 連接回調
  // 這解決了一個重要的閉包問題：
  // 
  // 問題描述：
  // 如果只在 loadRoomsAndJoinAll 中設置一次回調，那麼這個回調函數會「記住」
  // 它被創建時的 roomsData，即使之後 rooms 狀態改變了，回調仍然使用舊的房間列表。
  // 
  // 解決方案：
  // 每當 rooms 狀態改變時，重新設置 onConnectedCallback，
  // 確保回調函數始終使用最新的 rooms 狀態。
  // 
  // 這個 useEffect 會在以下情況觸發：
  // 1. 初始載入聊天室後
  // 2. 創建新聊天室後
  // 3. 未讀訊息數量更新後
  // 4. 聊天室列表任何其他變化後
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      // 使用最新的 rooms 狀態設置連接回調
      socketService.setOnConnectedCallback(() => {
        const roomIds = rooms.map(room => room.id)
        socketService.joinRooms(roomIds)
        console.log('已加入聊天室（使用最新的 rooms 狀態）:', roomIds)
      })
    }
  }, [rooms]) // 依賴項：當 rooms 狀態改變時重新設置回調
  
  // 【自動滾动功能】讓聊天視窗始終顯示最新訊息
  const scrollToBottom = () => {
    // 使用 optional chaining (?.) 安全地呼叫 scrollIntoView
    // 如果 messagesEndRef.current 是 null，不會拋出錯誤
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth'  // 平滑滾動效果，提供更好的用戶體驗
    })
  }

  // 【響應式滾動】當訊息列表更新時自動滾動到底部
  // 這確保用戶總是能看到最新的訊息，無論是歷史訊息載入還是新訊息到達
  useEffect(() => {
    scrollToBottom()
  }, [messages]) // 依賴項：當 messages 狀態改變時執行滾動
  
  useEffect(() => {
    // 定義處理新訊息的回調函數
    // 這個函數會在每次 selectedRoom 改變時重新創建，確保它能存取到最新的 selectedRoom 值
    const handleNewMessage = (newMessage) => {
      console.log('收到新訊息:', newMessage)
      
      // 檢查新訊息是否屬於當前選中的聊天室
      if (selectedRoom && String(newMessage.roomId) === String(selectedRoom.id)) {
        console.log('訊息屬於當前聊天室，更新訊息列表')
        
        // 更新當前聊天室的訊息列表
        setMessages(prev => {
          const exists = prev.find(msg => msg.id === newMessage.id)
          if (exists) {
            console.log('訊息已存在，跳過更新')
            return prev
          }
          
          console.log('添加新訊息到列表')
          return [...prev, newMessage]
        })
      } else {
        // 🆕 如果訊息不屬於當前聊天室，更新聊天室列表中的未讀數和最新訊息
        console.log('訊息不屬於當前聊天室，更新聊天室列表')
        setRooms(prev => {
          const existingRoom = prev.find(room => room.id === newMessage.roomId)
          
          if (existingRoom) {
            // 如果房間已存在，更新未讀數和最新訊息
            return prev.map(room => {
              if (room.id === newMessage.roomId) {
                return {
                  ...room,
                  unreadCount: (room.unreadCount || 0) + 1,
                  Messages: [{
                    id: newMessage.id,
                    content: newMessage.content,
                    createdAt: newMessage.createdAt,
                    User: newMessage.User
                  }]
                }
              }
              return room
            })
          } else {
            // 如果房間不存在，新增一個新房間到列表最上面
            const newRoom = {
              id: newMessage.roomId,
              name: newMessage.Room.name, // 簡單的預設名稱
              isGroup: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              unreadCount: 1,
              lastReadAt: null,
              Messages: [{
                id: newMessage.id,
                content: newMessage.content,
                createdAt: newMessage.createdAt,
                User: newMessage.User
              }]
            }
            console.log('新增新聊天室到列表:', newRoom)
            return [newRoom, ...prev] // 放在最上面
          }
        })
      }
    }

    // 向 socketService 註冊訊息回調函數
    // socketService 內部維護一個回調函數列表，當收到新訊息時會調用所有註冊的回調
    socketService.addMessageCallback(handleNewMessage)

    // 清理函數：當組件卸載或 selectedRoom 改變時執行
    // 這是 React useEffect 的關鍵特性，用於避免內存泄漏和副作用
    // 
    // 為什麼清理很重要：
    // 1. 防止內存泄漏：如果不移除監聽器，舊的函數會一直被保留在內存中
    // 2. 避免重複處理：每次切換聊天室都會註冊新的監聽器，如果不清理舊的，
    //    最終會有多個監聽器同時運行，造成重複處理和性能問題
    // 3. 確保狀態一致性：移除舊的監聽器確保只有最新的監聽器在運行
    return () => {
      socketService.removeMessageCallback(handleNewMessage)
    }
  }, [selectedRoom]) // 依賴項：當 selectedRoom 改變時，重新執行這個 useEffect
  
  // 【技術細節】為什麼不能省略 selectedRoom 依賴項？
  // 如果依賴項陣列是空的 []，useEffect 只會在組件首次掛載時執行一次
  // 這樣 handleNewMessage 函數就會永遠使用初始的 selectedRoom 值（通常是 null）
  // 即使用戶後來選擇了聊天室，監聽器仍然使用舊的值，導致訊息無法正確過濾和顯示

  // 選擇聊天室並載入訊息
  // 這是用戶點擊聊天室列表中的某個聊天室時觸發的函數
  const selectRoom = async (room) => {
    try {
      console.log('選擇聊天室:', room)
      
      // 【重要順序】先設定新的聊天室，再清空訊息列表
      // 設定 selectedRoom 會觸發上面的 useEffect 重新註冊訊息監聽器
      // 這確保了新的監聽器能夠正確過濾屬於這個聊天室的訊息
      setSelectedRoom(room)
      
      // 清空當前訊息列表，為新聊天室的訊息做準備
      // 這提供了即時的視覺反饋，用戶會看到舊訊息立即消失
      setMessages([])
      setError('')
      
      console.log('正在載入聊天室訊息..., roomId:', room.id)
      
      // 從後端 API 載入歷史訊息
      // 這是一個異步操作，可能需要一些時間
      const messagesData = await chatService.getRoomMessages(room.id)
      console.log('收到訊息資料:', messagesData)
      
      // 設定載入的歷史訊息
      // 之後如果有新訊息透過 Socket 到達，會通過上面的 useEffect 添加到這個列表中
      setMessages(messagesData)
      console.log('訊息設定完成')
      
      // 🆕 標記聊天室為已讀（如果有未讀訊息）
      if (room.unreadCount > 0) {
        try {
          await chatService.markRoomAsRead(room.id)
          console.log('聊天室已標記為已讀')
          
          // 更新本地聊天室列表中的未讀數量
          setRooms(prev => prev.map(r => 
            r.id === room.id ? { ...r, unreadCount: 0, lastReadAt: new Date() } : r
          ))
        } catch (readErr) {
          console.error('標記已讀失敗:', readErr)
        }
      }
      
      // 【架構說明】為什麼不需要處理 Socket 房間加入/離開？
      // 在這個實現中，我們在應用初始化時就加入了用戶所有的聊天室（見 loadRoomsAndJoinAll）
      // 所以這裡不需要額外的 Socket 房間管理
      // 優點：簡化了代碼，減少了 Socket 操作
      // 缺點：如果用戶有很多聊天室，會佔用更多 Socket 資源
    } catch (err) {
      console.error('Load messages error:', err)
      console.error('錯誤詳情:', err.response?.data || err.message)
      setError('Failed to load messages')
    }
  }

  // 【開發工具】測試 Socket 連接狀態
  // 這是一個調試函數，幫助開發者檢查 Socket 連接和發送測試訊息
  const testSocketConnection = () => {
    console.log('=== Socket 連接測試 ===')
    console.log('Socket 連接狀態:', socketService.getSocket()?.connected)
    console.log('Socket ID:', socketService.getSocket()?.id)
    console.log('當前選中聊天室:', selectedRoom)
    
    if (selectedRoom) {
      console.log('測試發送訊息到聊天室:', selectedRoom.id)
      const testMessage = {
        roomId: selectedRoom.id,
        userId: parseInt(currentUserId),
        content: `測試訊息 - ${new Date().toLocaleTimeString()}`
      }
      socketService.sendMessage(testMessage)
    } else {
      console.log('沒有選中聊天室')
    }
  }

  // 發送訊息函數
  // 這個函數處理用戶發送新訊息的邏輯
  const handleSendMessage = async (e) => {
    e.preventDefault() // 阻止表單默認提交行為
    
    // 驗證輸入：檢查訊息內容和聊天室是否有效
    // trim() 移除前後空格，確保不發送空訊息
    if (!newMessage.trim() || !selectedRoom) return

    // 構建訊息資料對象
    const messageData = {
      roomId: selectedRoom.id,
      userId: parseInt(currentUserId), // 確保 userId 是數字類型
      content: newMessage.trim()
    }

    // 【用戶體驗優化】立即清空輸入框
    // 這提供即時反饋，讓用戶感覺訊息發送很快
    // 即使後端處理有延遲，用戶也能立即開始輸入下一條訊息
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      // 【優先使用 Socket.IO】發送即時訊息
      // Socket.IO 提供更快的即時通訊體驗
      if (socketService.getSocket()?.connected) {
        // 使用 Socket.IO 發送即時訊息
        socketService.sendMessage(messageData)
        console.log('訊息已透過 Socket 發送:', messageData)
        setError('')
      } else {
        throw new Error('Socket not connected')
      }
    } catch (err) {
      console.error('Socket send message error:', err)
      
      // 【備用方案】如果 Socket 發送失敗，回退到 HTTP API
      // 這是一個重要的容錯機制，確保在網路問題時訊息仍能發送
      // 比如：Socket 連接不穩定、伺服器重啟、網路切換等情況
      try {
        const messageResponse = await chatService.sendMessage(selectedRoom.id, messageContent)
        
        // 【手動更新訊息列表】
        // 因為 Socket 沒有運作，不會收到即時訊息回調
        // 所以需要手動將發送的訊息添加到列表中
        setMessages(prev => [...prev, messageResponse])
        console.log('使用 HTTP API 發送訊息成功')
        setError('')
      } catch (httpErr) {
        console.error('HTTP send message error:', httpErr)
        setError('Failed to send message')
        
        // 【用戶體驗優化】發送失敗時恢復輸入框內容
        // 讓用戶可以重試，而不需要重新輸入整個訊息
        setNewMessage(messageContent)
      }
    }
  }

  // 【用戶登出】清理資源並返回登入頁面
  const handleLogout = () => {
    // 斷開 Socket 連接，清理網路資源
    socketService.disconnect()
    // 通知父組件執行登出邏輯（清理 localStorage、切換頁面等）
    onLogout()
  }

  // 【建立新聊天室】讓用戶創建新的群組聊天室
  const handleCreateRoom = async () => {
    // 使用 prompt 獲取聊天室名稱（簡單的用戶輸入方式）
    const roomName = prompt('請輸入聊天室名稱：')
    if (!roomName || !roomName.trim()) return

    try {
      // 構建新聊天室的資料
      const roomData = {
        name: roomName.trim(),
        isGroup: true,        // 標記為群組聊天室
        userIds: []          // 初始成員為空，之後可以邀請用戶加入
      }

      // 向後端 API 發送建立聊天室的請求
      const newRoom = await chatService.createRoom(roomData)
      
      // 【立即加入新建的聊天室】
      // 確保創建者能夠立即開始使用新聊天室
      if (socketService.getSocket()?.connected) {
        socketService.joinRoom(newRoom.id)
        console.log(`加入新建的聊天室: ${newRoom.id}`)
      }
      
      await loadRoomsAndJoinAll() // 重新載入所有聊天室
      setSelectedRoom(newRoom)
    } catch (err) {
      console.error('Create room error:', err)
      alert('建立聊天室失敗，請重試')
    }
  }

  // 邀請成功後的處理
  const handleInviteSuccess = () => {
    setShowInviteModal(false)
    // 重新載入聊天室資訊以更新成員列表
    loadRoomsAndJoinAll()
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="chat-container">
      {/* 頂部導航 */}
      <div className="chat-header">
        <h1>Chat App</h1>
        <div className="user-info">
          <span>Welcome, {currentUser}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      <div className="chat-main">
        {/* 左側聊天室列表 */}
        <div className="rooms-sidebar">
          <div className="rooms-header">
            <h3>Chats</h3>
            <button className="new-chat-btn" onClick={handleCreateRoom}>+</button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="rooms-list">
            {rooms.length === 0 ? (
              <div className="no-rooms">No chat rooms yet</div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.id}
                  data-room-id={room.id}
                  className={`room-item ${selectedRoom?.id === room.id ? 'active' : ''} ${room.unreadCount > 0 ? 'has-unread' : ''}`}
                  onClick={() => selectRoom(room)}
                >
                  <div className="room-header">
                    <div className="room-name">{room.name || 'Unnamed Room'}</div>
                    <div className="room-badges">
                      <div className="room-type">{room.isGroup ? 'Group' : 'Direct'}</div>
                      {room.unreadCount > 0 && (
                        <div className="unread-badge">{room.unreadCount}</div>
                      )}
                    </div>
                  </div>
                  {room.Messages && room.Messages.length > 0 && (
                    <div className="last-message">
                      <span className="sender">{room.Messages[0].User.username}:</span>
                      <span className="content">{room.Messages[0].content}</span>
                      <span className="time">
                        {new Date(room.Messages[0].createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右側聊天窗口 */}
        <div className="chat-window">
          {selectedRoom ? (
            <>
              <div className="chat-window-header">
                <div className="room-info">
                  <h3>{selectedRoom.name || 'Unnamed Room'}</h3>
                  <span className="room-type-badge">
                    {selectedRoom.isGroup ? 'Group Chat' : 'Direct Message'}
                  </span>
                </div>
                <div className="header-actions">
                  <button 
                    className="test-btn"
                    onClick={testSocketConnection}
                    title="測試 Socket 連接"
                    style={{marginRight: '10px', padding: '5px 10px', fontSize: '12px'}}
                  >
                    Test Socket
                  </button>
                  {selectedRoom.isGroup && (
                    <button 
                      className="invite-btn"
                      onClick={() => setShowInviteModal(true)}
                      title="邀請用戶加入聊天室"
                    >
                      Invite Users
                    </button>
                  )}
                </div>
              </div>

              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="no-messages">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map(message => (
                    <div
                      key={message.id}
                      className={`message ${message.User.username === currentUser ? 'own-message' : 'other-message'}`}
                    >
                      <div className="message-header">
                        <span className="message-sender">{message.User.username}</span>
                        <span className="message-time">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="message-content">{message.content}</div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} /> {/* 自動滾動參考點 */}
              </div>

              <form onSubmit={handleSendMessage} className="message-form">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="message-input"
                />
                <button type="submit" className="send-btn">Send</button>
              </form>
            </>
          ) : (
            <div className="no-room-selected">
              <h3>Select a chat room to start messaging</h3>
              <p>Choose a room from the sidebar to view and send messages.</p>
            </div>
          )}
        </div>
      </div>

      {/* 邀請用戶模態窗口 */}
      {showInviteModal && selectedRoom && (
        <InviteUsers
          room={selectedRoom}
          onClose={() => setShowInviteModal(false)}
          onInviteSuccess={handleInviteSuccess}
        />
      )}
    </div>
  )
}

export default Chat
