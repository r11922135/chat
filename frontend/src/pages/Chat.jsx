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
    
    // 載入聊天室並加入所有 Socket 房間
    loadRoomsAndJoinAll()

    // 清理函數
    return () => {
      socketService.disconnect()
    }
  }, [token])

  // 載入用戶的聊天室並加入所有 Socket 房間
  const loadRoomsAndJoinAll = async () => {
    try {
      setLoading(true)
      const roomsData = await chatService.getUserRooms()
      setRooms(roomsData)
      
      // 等待 Socket 連接完成後加入所有聊天室
      const checkSocketAndJoin = () => {
        if (socketService.getSocket()?.connected) {
          const roomIds = roomsData.map(room => room.id)
          socketService.joinRooms(roomIds)
          console.log('已加入所有聊天室:', roomIds)
        } else {
          // 如果還沒連接，稍後重試
          setTimeout(checkSocketAndJoin, 100)
        }
      }
      
      checkSocketAndJoin()
      setError('')
    } catch (err) {
      console.error('Load rooms error:', err)
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('chatToken')
        localStorage.removeItem('chatUsername')
        localStorage.removeItem('chatUserId')
        window.location.href = '/login'
      } else {
        setError('Failed to load chat rooms')
      }
    } finally {
      setLoading(false)
    }
  }
  
  // 設定重新連接回調
  useEffect(() => {
    socketService.setOnReconnectCallback(() => {
      console.log('Socket 重新連接，重新加入所有聊天室')
      const roomIds = rooms.map(room => room.id)
      socketService.joinRooms(roomIds)
    })
  }, [rooms])

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
    const handleNewMessage = (newMessage) => {
      console.log('收到新訊息:', newMessage)
      
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
      }
      
      // 這裡可以添加其他功能：
      // - 更新聊天室列表的最後訊息
      // - 顯示通知
      // - 更新未讀訊息計數等
    }

    // 註冊訊息回調函數
    socketService.addMessageCallback(handleNewMessage)

    // 清理函數
    return () => {
      socketService.removeMessageCallback(handleNewMessage)
    }
  }, [selectedRoom])

  // 選擇聊天室並載入訊息
  const selectRoom = async (room) => {
    try {
      console.log('選擇聊天室:', room)
      
      // 設定新的聊天室
      setSelectedRoom(room)
      setMessages([])
      setError('')
      
      console.log('正在載入聊天室訊息..., roomId:', room.id)
      const messagesData = await chatService.getRoomMessages(room.id)
      console.log('收到訊息資料:', messagesData)
      setMessages(messagesData)
      console.log('訊息設定完成')
      
      // 不再需要處理 Socket 房間加入/離開，因為已經在所有房間中了
    } catch (err) {
      console.error('Load messages error:', err)
      console.error('錯誤詳情:', err.response?.data || err.message)
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
      
      // 立即加入新建的聊天室
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
