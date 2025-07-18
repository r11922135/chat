import { useState, useEffect, useRef } from 'react'
import chatService from '../services/chatService'
import socketService from '../services/socketService'
import InviteUsers from '../components/InviteUsers'
import UserSearch from '../components/UserSearch'
import './Chat.css'

const Chat = ({ onLogout, onAuthExpired }) => {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showUserSearch, setShowUserSearch] = useState(false)
  const messagesEndRef = useRef(null)
  
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
    
    // 🚀 直接在 useEffect 中處理，不需要額外函數
    const initializeChat = async () => {
      try {
        setLoading(true)
        
        // 1. 載入房間資料 - 只是為了顯示聊天室列表
        const roomsData = await chatService.getUserRooms()
        setRooms(roomsData)

        // 2. 設定 Socket 連接成功後的回調
        socketService.setOnConnectedCallback(() => {
          console.log('✅ Socket 已連接，後端會自動加入房間')
          
          // 🆕 在 Socket 連接成功後註冊新聊天室監聽器
          const handleNewRoom = (data) => {
            console.log('收到新聊天室:', data.room);
            
            // 將新聊天室加入列表
            setRooms(prev => {
              const exists = prev.find(room => room.id === data.room.id);
              if (!exists) {
                return [data.room, ...prev]; // 新聊天室放在最上面
              }
              return prev;
            });
          };
          
          socketService.setOnNewRoomCallback(handleNewRoom);
        })

        // 3. 連接 Socket - 後端中間件會自動處理房間加入
        socketService.connect()
        
        setError('')
      } catch (err) {
        console.error('Initialize chat error:', err)
        
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('chatToken')
          localStorage.removeItem('chatUsername')
          localStorage.removeItem('chatUserId')
          onAuthExpired()
        } else {
          setError('Failed to initialize chat')
        }
      } finally {
        setLoading(false)
      }
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
      
      // 🆕 簡化：不再手動加入房間，後端會自動處理
      socketService.setOnConnectedCallback(() => {
        console.log('✅ Socket 已連接，後端會自動加入房間')
        // 移除原本的 joinRooms 調用
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
        chatService.markRoomAsRead(newMessage.roomId) // 標記為已讀
        
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
        
        // 【補強功能2】更新聊天室列表中的最新訊息預覽並移動到最上方
        // 當收到屬於當前聊天室的新訊息時，更新聊天室列表的最新訊息顯示
        setRooms(prev => {
          const updatedRooms = prev.map(room => {
            if (room.id === selectedRoom.id) {
              return {
                ...room,
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
          
          // 將更新的聊天室移動到最上方
          const targetRoom = updatedRooms.find(room => room.id === selectedRoom.id)
          const otherRooms = updatedRooms.filter(room => room.id !== selectedRoom.id)
          return [targetRoom, ...otherRooms]
        })
        
      } else {
        // 🆕 如果訊息不屬於當前聊天室，更新聊天室列表中的未讀數和最新訊息
        console.log('訊息不屬於當前聊天室，更新聊天室列表')
        setRooms(prev => {
          const existingRoom = prev.find(room => room.id === newMessage.roomId)
          
          if (existingRoom) {
            // 如果房間已存在，更新未讀數和最新訊息，並移動到最上方
            const updatedRooms = prev.map(room => {
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
            
            // 將更新的聊天室移動到最上方
            const targetRoom = updatedRooms.find(room => room.id === newMessage.roomId)
            const otherRooms = updatedRooms.filter(room => room.id !== newMessage.roomId)
            return [targetRoom, ...otherRooms]
          } else {
            // 如果房間不存在，新增一個新房間到列表最上面
            const newRoom = {
              id: newMessage.roomId,
              name: newMessage.Room.name,
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

  // 這個函數處理用戶發送新訊息的邏輯
  const handleSendMessage = async (e) => {
    e.preventDefault() // 阻止表單默認提交行為
    
    // 驗證輸入：檢查訊息內容和聊天室是否有效
    // trim() 移除前後空格，確保不發送空訊息
    if (!newMessage.trim() || !selectedRoom) return

    // 【用戶體驗優化】立即清空輸入框
    // 這提供即時反饋，讓用戶感覺訊息發送很快
    // 即使後端處理有延遲，用戶也能立即開始輸入下一條訊息
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      // 【新架構】先使用 API 儲存訊息到資料庫
      // API 負責：資料驗證、資料庫儲存、返回完整訊息物件
      const messageResponse = await chatService.sendMessage(selectedRoom.id, messageContent)
      console.log('API 儲存訊息成功:', messageResponse)

      // 【新架構】再使用 Socket 發送即時訊息給其他用戶
      // Socket 負責：即時廣播給聊天室其他成員
      if (socketService.getSocket()?.connected) {
        // 使用 API 返回的完整訊息物件進行廣播
        socketService.sendMessage(messageResponse)
        console.log('Socket 廣播訊息成功:', messageResponse)
      } else {
        console.warn('Socket 未連接，無法即時廣播訊息')
      }
      // 【更新當前用戶的訊息列表
      setMessages(prev => [...prev, messageResponse])
      // 【標記聊天室為已讀】
      try {
        await chatService.markRoomAsRead(selectedRoom.id)
        console.log('發送訊息後已標記聊天室為已讀')
      } catch (readErr) {
        console.error('標記已讀失敗:', readErr)
      }
      
      //【更新聊天室列表中的最新訊息預覽並移動到最上方】
      setRooms(prev => {
        const updatedRooms = prev.map(room => {
          if (room.id === selectedRoom.id) {
            return {
              ...room,
              Messages: [{
                id: messageResponse.id,
                content: messageResponse.content,
                createdAt: messageResponse.createdAt,
                User: messageResponse.User
              }],
              unreadCount: 0, // 發送者看到的是已讀狀態
              lastReadAt: new Date()
            }
          }
          return room
        })
        const targetRoom = updatedRooms.find(room => room.id === selectedRoom.id)
        const otherRooms = updatedRooms.filter(room => room.id !== selectedRoom.id)
        return [targetRoom, ...otherRooms]
      })
      setError('')
    } catch (err) {
      console.error('發送訊息失敗:', err)
      setError('Failed to send message')
      // 【用戶體驗優化】發送失敗時恢復輸入框內容
      setNewMessage(messageContent)
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
      
      setSelectedRoom(newRoom)
      setMessages([]) // 清空訊息列表
    } catch (err) {
      console.error('Create room error:', err)
      alert('建立聊天室失敗，請重試')
    }
  }

  // 新增處理開始一對一聊天的函數
  const handleStartDirectChat = async (room) => {
    try {
      // 重新載入聊天室列表
      const roomsData = await chatService.getUserRooms()
      setRooms(roomsData)
      
      // 選擇新建的聊天室
      setSelectedRoom(room)
      setShowUserSearch(false)
    } catch (err) {
      console.error('Start direct chat error:', err)
      alert('開啟聊天失敗，請重試')
    }
  }

  // 邀請成功後的處理
  const handleInviteSuccess = () => {
    setShowInviteModal(false)
    // 重新載入聊天室資訊以更新成員列表
    loadRoomsAndJoinAll()
  }

  // 新增獲取聊天室顯示名稱的函數
  const getRoomDisplayName = (room) => {
    console.log('getRoomDisplayName - room:', room)
    console.log('getRoomDisplayName - currentUser:', currentUser)
    console.log('getRoomDisplayName - room.members:', room.members)
    if (room.isGroup) {
      return (
        <span className="room-display-name">
          <span className="room-icon group-icon">👥</span>
          {room.name || 'Unnamed Group'}
        </span>
      )
    } else {
      // 🆕 一對一聊天室：顯示對方的名字
      const otherMember = room.members?.find(member => member.username !== currentUser)
      const displayName = otherMember?.username || room.name || 'Direct Message'
      
      return (
        <span className="room-display-name">
          <span className="room-icon direct-icon">👤</span>
          {displayName}
        </span>
      )
    }
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
            <div className="header-buttons">
              <button 
                className="search-user-btn" 
                onClick={() => setShowUserSearch(true)}
                title="搜尋用戶開始聊天"
              >
                👤
              </button>
              <button className="new-chat-btn" onClick={handleCreateRoom}>👥</button>
            </div>
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
                    <div className="room-name">{getRoomDisplayName(room)}</div>
                    <div className="room-badges">
                      {<div className="room-type">{room.isGroup ? 'Group' : 'Direct'}</div>}
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
                  {(!room.Messages || room.Messages.length === 0) && (
                    <div className="last-message">
                      <span className="content no-message">(No messages)</span>
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
                  <h3>
                    {selectedRoom.isGroup 
                      ? (selectedRoom.name || 'Unnamed Group')
                      : (selectedRoom.members?.find(member => member.username !== currentUser)?.username || selectedRoom.name || 'Direct Message')
                    }
                  </h3>
                  {/*<span className="room-type-badge">
                    {selectedRoom.isGroup ? 'Group Chat' : 'Direct Message'}
                  </span>*/}
                </div>
                <div className="header-actions">
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
      {showUserSearch && (
        <UserSearch
          onStartChat={handleStartDirectChat}
          onClose={() => setShowUserSearch(false)}
        />
      )}
    </div>
  )
}

export default Chat
