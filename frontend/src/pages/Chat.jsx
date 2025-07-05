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
    // 【身份驗證檢查】如果沒有 token，用戶需要重新登入
    if (!token) {
      onAuthExpired() // 通知父組件切換到登入頁面
      return
    }
    
    // 【Socket 連接初始化】
    // 建立與後端的 WebSocket 連接，這是即時通訊的基礎
    socketService.connect()
    
    // 【聊天室環境設置】
    // 載入用戶的聊天室列表並加入所有 Socket 房間
    // 這確保用戶能夠接收到所有聊天室的即時訊息
    loadRoomsAndJoinAll()
    
    // 【清理函數】當組件卸載時執行
    // 這在以下情況會被調用：
    // 1. 用戶登出
    // 2. 頁面關閉
    // 3. 組件因為其他原因被卸載
    return () => {
      socketService.disconnect()
    }
  }, [token]) // 依賴項：當 token 改變時重新執行（例如登入/登出）
  
  // 【為什麼要監聽 token 變化？】
  // 當用戶重新登入時，會有新的 token，我們需要重新初始化整個聊天環境
  // 當用戶登出時，token 會被清空，我們需要斷開連接並清理資源

  // 載入用戶的聊天室並加入所有 Socket 房間
  // 這是應用初始化的核心函數，負責設置整個聊天環境
  const loadRoomsAndJoinAll = async () => {
    try {
      setLoading(true)
      
      // 從後端 API 獲取用戶的聊天室列表
      const roomsData = await chatService.getUserRooms()
      setRooms(roomsData)
      
      // 【重要的異步處理】等待 Socket 連接完成後加入所有聊天室
      // 這裡使用輪詢的方式檢查 Socket 是否已連接
      // 原因：Socket 連接是異步的，我們需要確保連接完成後才能加入房間
      const checkSocketAndJoin = () => {
        if (socketService.getSocket()?.connected) {
          // Socket 已連接，可以加入聊天室
          const roomIds = roomsData.map(room => room.id)
          socketService.joinRooms(roomIds)
          console.log('已加入所有聊天室:', roomIds)
        } else {
          // Socket 還沒連接，100ms 後重試
          // 這是一個簡單的輪詢機制，確保不會錯過連接時機
          setTimeout(checkSocketAndJoin, 100)
        }
      }
      checkSocketAndJoin()
      
      setError('')
    } catch (err) {
      console.error('Load rooms error:', err)
      
      // 【身份驗證錯誤處理】
      // 如果是 401 (未授權) 或 403 (禁止訪問)，說明 token 已過期或無效
      if (err.response?.status === 401 || err.response?.status === 403) {
        // 清理本地存儲的認證信息
        localStorage.removeItem('chatToken')
        localStorage.removeItem('chatUsername')
        localStorage.removeItem('chatUserId')
        // 通知父組件，需要重新登入
        onAuthExpired()
      } else {
        // 其他錯誤，顯示錯誤訊息但不登出
        setError('Failed to load chat rooms')
      }
    } finally {
      setLoading(false)
    }
  }
  
  // 設定重新連接回調
  // 【網路穩定性處理】當 Socket 因為網路問題斷線後重新連接時的處理邏輯
  // 這個 useEffect 確保重連後用戶能夠繼續正常使用聊天功能
  useEffect(() => {
    // 設定重連回調函數
    // 當 socketService 檢測到重新連接時，會自動調用這個函數
    socketService.setOnReconnectCallback(() => {
      console.log('Socket 重新連接，重新加入所有聊天室')
      
      // 重新加入所有聊天室
      // 這是必要的，因為 Socket 重連後，之前加入的房間狀態會丟失
      const roomIds = rooms.map(room => room.id)
      socketService.joinRooms(roomIds)
      
      // 這裡還可以添加其他重連後的恢復邏輯：
      // - 重新同步未讀訊息
      // - 更新用戶在線狀態
      // - 重新載入最新的聊天室資訊
    })
  }, [rooms]) // 依賴項：當 rooms 改變時，更新重連回調函數
  
  // 【為什麼需要 rooms 作為依賴項？】
  // 因為重連回調函數需要存取最新的 rooms 列表
  // 如果不將 rooms 放在依賴項中，回調函數會使用舊的 rooms 值（可能是空陣列）
  // 這會導致重連後無法正確加入聊天室

  // 【自動滾動功能】讓聊天視窗始終顯示最新訊息
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
  
  // 【滾動時機說明】
  // 這個 useEffect 會在以下情況觸發：
  // 1. 載入聊天室的歷史訊息後
  // 2. 收到新的即時訊息後
  // 3. 用戶發送訊息後
  // 
  // 為什麼選擇自動滾動？
  // - 聊天應用的慣例：最新訊息應該立即可見
  // - 避免用戶手動滾動的麻煩
  // - 提供連貫的對話體驗

  // 處理新訊息的 useEffect - 這是整個聊天應用最核心的邏輯之一
  // 【重要】這個 useEffect 必須在 selectedRoom 改變時重新執行，原因如下：
  // 
  // 1. JavaScript 閉包（Closure）問題：
  //    - 如果只註冊一次，handleNewMessage 函數會「記住」它被創建時的 selectedRoom 值
  //    - 即使後來 selectedRoom 改變了，已註冊的 handleNewMessage 仍然使用舊的值
  //    - 這就是所謂的「閉包陷阱」
  // 
  // 2. React 函數組件的重新渲染：
  //    - 每次 selectedRoom 改變時，整個組件會重新渲染
  //    - 但是 Socket 的事件監聽器還是指向舊的 handleNewMessage 函數
  //    - 新的 handleNewMessage 函數不會自動替換舊的監聽器
  //
  // 3. 解決方案：
  //    - 在 useEffect 中重新註冊監聽器，確保它使用最新的 selectedRoom 值
  //    - 使用清理函數移除舊的監聽器，避免重複註冊
  useEffect(() => {
    // 定義處理新訊息的回調函數
    // 這個函數會在每次 selectedRoom 改變時重新創建，確保它能存取到最新的 selectedRoom 值
    const handleNewMessage = (newMessage) => {
      console.log('收到新訊息:', newMessage)
      
      // 檢查新訊息是否屬於當前選中的聊天室
      // 使用 String() 轉換是為了確保類型一致性（ID 可能是數字或字串）
      // 這個檢查很重要，因為 Socket 會接收到所有聊天室的訊息
      // 我們只需要更新當前選中聊天室的訊息列表
      if (selectedRoom && String(newMessage.roomId) === String(selectedRoom.id)) {
        console.log('訊息屬於當前聊天室，更新訊息列表')
        
        // 使用函數式更新來避免競態條件（Race Condition）
        // prev 參數是當前的 messages 狀態，確保我們基於最新的狀態進行更新
        setMessages(prev => {
          // 檢查是否已存在相同的訊息（避免重複添加）
          // 這可能發生在以下情況：
          // - 網路延遲導致重複接收
          // - 多個事件監聽器同時觸發
          // - 後端重複發送相同訊息
          const exists = prev.find(msg => msg.id === newMessage.id)
          if (exists) {
            console.log('訊息已存在，跳過更新')
            return prev // 返回原狀態，不觸發重新渲染
          }
          
          console.log('添加新訊息到列表')
          // 使用展開運算符創建新陣列，這是 React 中更新陣列狀態的最佳實踐
          // 不能直接修改 prev 陣列，必須返回新的陣列才能觸發重新渲染
          return [...prev, newMessage]
        })
      }
      
      // 這裡可以添加其他功能：
      // - 更新聊天室列表的最後訊息時間和內容
      // - 顯示桌面通知或應用內通知
      // - 更新未讀訊息計數
      // - 播放訊息提示音
      // - 更新聊天室排序（將有新訊息的聊天室排到前面）
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
                  className={`room-item ${selectedRoom?.id === room.id ? 'active' : ''}`}
                  onClick={() => selectRoom(room)}
                >
                  <div className="room-name">{room.name || 'Unnamed Room'}</div>
                  <div className="room-type">{room.isGroup ? 'Group' : 'Direct'}</div>
                  {room.Messages && room.Messages.length > 0 && (
                    <div className="last-message">
                      {room.Messages[0].User.username}: {room.Messages[0].content}
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
