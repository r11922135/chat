import { useState, useEffect, useRef } from 'react'
import chatService from '../services/chatService'
import socketService from '../services/socketService'
import InviteUsers from '../components/InviteUsers'
import './Chat.css'

const Chat = () => {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const messagesEndRef = useRef(null)
  
  const currentUser = localStorage.getItem('chatUsername')
  const currentUserId = localStorage.getItem('chatUserId')
  const token = localStorage.getItem('chatToken')

  // 如果沒有 token，重導向到登入頁面
  useEffect(() => {
    if (!token) {
      window.location.href = '/login'
      return
    }
    
    // 初始化 Socket 連接
    socketService.connect()
    
    loadRooms()

    // 清理函數
    return () => {
      socketService.disconnect()
    }
  }, [token])
  
  // 設定重新連接回調（單獨的 useEffect）
  useEffect(() => {
    socketService.setOnReconnectCallback(() => {
      if (selectedRoom) {
        console.log('Socket 重新連接，重新加入聊天室:', selectedRoom.id)
        socketService.joinRoom(selectedRoom.id)
      }
    })
  }, [selectedRoom])

  // 自動滾動到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 當訊息更新時自動滾動到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 處理新訊息的 useEffect
  useEffect(() => {
    // 監聽新訊息
    const handleNewMessage = (newMessage) => {
      console.log('收到新訊息:', newMessage)
      console.log('當前選中聊天室:', selectedRoom)
      console.log('新訊息 roomId 類型:', typeof newMessage.roomId, 'value:', newMessage.roomId)
      console.log('當前聊天室 id 類型:', typeof selectedRoom?.id, 'value:', selectedRoom?.id)
      
      // 如果新訊息是當前選中聊天室的，更新訊息列表
      if (selectedRoom && String(newMessage.roomId) === String(selectedRoom.id)) {
        console.log('訊息屬於當前聊天室，更新訊息列表')
        setMessages(prev => {
          // 檢查是否已存在相同的訊息（避免重複）
          const exists = prev.find(msg => msg.id === newMessage.id)
          if (exists) {
            console.log('訊息已存在，跳過更新')
            return prev
          }
          console.log('添加新訊息到列表')
          return [...prev, newMessage]
        })
      } else {
        console.log('訊息不屬於當前聊天室或沒有選中聊天室')
        console.log('比較結果:', {
          selectedRoomExists: !!selectedRoom,
          roomIdMatch: selectedRoom ? String(newMessage.roomId) === String(selectedRoom.id) : false
        })
      }
      
      // 可以在這裡添加通知或更新聊天室列表
    }

    console.log('設定新訊息監聽器，當前聊天室:', selectedRoom?.id)
    socketService.onNewMessage(handleNewMessage)

    // 清理函數
    return () => {
      console.log('清理新訊息監聽器')
      socketService.offNewMessage()
    }
  }, [selectedRoom]) // 依賴 selectedRoom，當聊天室改變時重新設定監聽器

  // 記錄上一個聊天室 ID，用於清理
  const [previousRoomId, setPreviousRoomId] = useState(null)
  
  // 當選中聊天室改變時，加入/離開 Socket 房間
  useEffect(() => {
    if (selectedRoom && socketService.getSocket()?.connected) {
      // 離開之前的聊天室
      if (previousRoomId && previousRoomId !== selectedRoom.id) {
        socketService.leaveRoom(previousRoomId)
        console.log(`離開聊天室: ${previousRoomId}`)
      }
      
      // 加入新的聊天室
      socketService.joinRoom(selectedRoom.id)
      console.log(`加入聊天室: ${selectedRoom.id}`)
      
      // 更新前一個聊天室 ID
      setPreviousRoomId(selectedRoom.id)
      
      // 驗證是否真的加入了房間
      setTimeout(() => {
        console.log('驗證 Socket 房間狀態...')
        console.log('Socket 連接狀態:', socketService.getSocket()?.connected)
        console.log('Socket ID:', socketService.getSocket()?.id)
      }, 1000)
    }
  }, [selectedRoom]) // 移除 previousRoomId 依賴，避免無限循環

  // 載入用戶的聊天室
  const loadRooms = async () => {
    try {
      setLoading(true)
      const roomsData = await chatService.getUserRooms()
      setRooms(roomsData)
      setError('')
    } catch (err) {
      console.error('Load rooms error:', err)
      if (err.response?.status === 401 || err.response?.status === 403) {
        // Token 無效，清除並重導向
        localStorage.removeItem('chatToken')
        localStorage.removeItem('chatUsername')
        window.location.href = '/login'
      } else {
        setError('Failed to load chat rooms')
      }
    } finally {
      setLoading(false)
    }
  }

  // 選擇聊天室並載入訊息
  const selectRoom = async (room) => {
    try {
      console.log('選擇聊天室:', room);
      
      // 設定新的聊天室
      setSelectedRoom(room)
      setMessages([])
      setError('')
      
      console.log('正在載入聊天室訊息..., roomId:', room.id);
      const messagesData = await chatService.getRoomMessages(room.id)
      console.log('收到訊息資料:', messagesData);
      setMessages(messagesData)
      console.log('訊息設定完成');
      
      // 移除重複的 joinRoom 調用，讓 useEffect 處理
    } catch (err) {
      console.error('Load messages error:', err)
      console.error('錯誤詳情:', err.response?.data || err.message);
      setError('Failed to load messages')
    }
  }

  // 測試 Socket 連接
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

  // 發送訊息
  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !selectedRoom) return

    const messageData = {
      roomId: selectedRoom.id,
      userId: parseInt(currentUserId),
      content: newMessage.trim()
    }

    // 立即清空輸入框以提供即時反饋
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      // 先檢查 Socket 是否連接
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
      
      // 如果 Socket 發送失敗，回退到 HTTP API
      try {
        const messageResponse = await chatService.sendMessage(selectedRoom.id, messageContent)
        setMessages(prev => [...prev, messageResponse])
        console.log('使用 HTTP API 發送訊息成功')
        setError('')
      } catch (httpErr) {
        console.error('HTTP send message error:', httpErr)
        setError('Failed to send message')
        // 發送失敗時恢復輸入框內容
        setNewMessage(messageContent)
      }
    }
  }

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('chatToken')
    localStorage.removeItem('chatUsername')
    localStorage.removeItem('chatUserId')
    window.location.href = '/login'
  }

  // 建立新聊天室
  const handleCreateRoom = async () => {
    const roomName = prompt('請輸入聊天室名稱：')
    if (!roomName || !roomName.trim()) return

    try {
      const roomData = {
        name: roomName.trim(),
        isGroup: true,
        userIds: []
      }

      const newRoom = await chatService.createRoom(roomData)
      await loadRooms()
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
    loadRooms()
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
