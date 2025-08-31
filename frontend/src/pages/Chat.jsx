import { useState, useEffect, useRef } from 'react'
import chatService from '../services/chatService'
import socketService from '../services/socketService'
import ChatHeader from '../components/ChatHeader'
import RoomsSidebar from '../components/RoomsSidebar'
import ChatWindow from '../components/ChatWindow'
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 650)
  const [showSidebar, setShowSidebar] = useState(true)
  
  // 新增：訊息緩存和無限滾動相關狀態
  const [messageCache, setMessageCache] = useState(new Map())
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  
  const selectedRoomRef = useRef(selectedRoom)
  
  const currentUser = localStorage.getItem('chatUsername')       // 用戶名
  const token = localStorage.getItem('chatToken')                // 身份驗證 token

  useEffect(() => {
    selectedRoomRef.current = selectedRoom
  }, [selectedRoom])
  
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
        // 🆕 在 Socket 連接成功後註冊新聊天室監聽器
        socketService.setOnNewRoomCallback((data) => {
          console.log('收到新聊天室:', data.room);
          // 將新聊天室加入列表
          setRooms(prev => {
            const exists = prev.find(room => room.id === data.room.id);
            if (!exists) {
              return [data.room, ...prev]; // 新聊天室放在最上面
            }
            return prev;
          });
        });

        // 向 socketService 註冊訊息回調函數
        // socketService 內部維護一個回調函數列表，當收到新訊息時會調用所有註冊的回調
        socketService.addMessageCallback((newMessage) => {
          console.log('收到新訊息:', newMessage)
          const currentRoom = selectedRoomRef.current

          // 先更新緩存（任何情況都執行）
          const cacheKey = newMessage.roomId.toString()
          setMessageCache(prevCache => {
            const cachedData = prevCache.get(cacheKey)
            if (cachedData) {
              return new Map(prevCache).set(cacheKey, {
                ...cachedData,
                messages: [newMessage, ...cachedData.messages] // 新訊息放在前面（由新到舊順序）
              })
            }
            // 如果還沒有緩存，初始化一個
            return new Map(prevCache).set(cacheKey, {
              messages: [newMessage],
              hasMore: true
            })
          })

          // 檢查新訊息是否屬於當前選中的聊天室
          if (currentRoom && String(newMessage.roomId) === String(currentRoom.id)) {
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
              return [newMessage, ...prev] // 新訊息放在前面（由新到舊順序）
            })
            // 【補強功能2】更新聊天室列表中的最新訊息預覽並移動到最上方
            // 當收到屬於當前聊天室的新訊息時，更新聊天室列表的最新訊息顯示
            setRooms(prev => {
              const updatedRooms = prev.map(room => {
                if (room.id === currentRoom.id) {
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
              const targetRoom = updatedRooms.find(room => room.id === currentRoom.id)
              const otherRooms = updatedRooms.filter(room => room.id !== currentRoom.id)
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
                      unreadCount: Number(room.unreadCount || 0) + 1,
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
  
  // 監聽螢幕尺寸變化
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 650
      setIsMobile(mobile)
      if (!mobile) setShowSidebar(true) // 桌面模式始終顯示側邊欄
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const scrollToBottom = () => {
    const scrollableDiv = document.getElementById('scrollableDiv')
    if (scrollableDiv) {
      scrollableDiv.scrollTop = scrollableDiv.scrollHeight
    }
  }

  // 選擇聊天室並載入訊息
  // 這是用戶點擊聊天室列表中的某個聊天室時觸發的函數
  // 載入初始訊息
  const loadInitialMessages = async (roomId) => {
    try {
      setLoadingMessages(true)
      const response = await chatService.getRoomMessages(roomId)
      
      setMessages(response.messages || response)
      setHasMoreMessages(response.hasMore !== undefined ? response.hasMore : response.length === 15)
      
      // 更新緩存
      const cacheKey = roomId.toString()
      setMessageCache(prev => new Map(prev).set(cacheKey, {
        messages: response.messages || response,
        hasMore: response.hasMore !== undefined ? response.hasMore : response.length === 15
      }))
      
    } catch (err) {
      console.error('Load initial messages error:', err)
      setError('Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }

  // 載入更多訊息（無限滾動）
  const loadMoreMessages = async () => {
    if (!selectedRoom || loadingMessages || !hasMoreMessages) return
    
    try {
      setLoadingMessages(true)
      
      // 取得目前最舊訊息的 ID（現在在陣列最後面）
      const earliestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null
      
      const response = await chatService.getRoomMessages(
        selectedRoom.id, 
        earliestMessageId
      )
      
      if ((response.messages || response).length > 0) {
        // 新載入的舊訊息加到陣列後面（維持由新到舊順序）
        const newMessages = [...messages, ...(response.messages || response)]
        setMessages(newMessages)
        
        // 更新緩存
        const cacheKey = selectedRoom.id.toString()
        setMessageCache(prev => new Map(prev).set(cacheKey, {
          messages: newMessages,
          hasMore: response.hasMore !== undefined ? response.hasMore : (response.messages || response).length === 15
        }))
      }
      
      setHasMoreMessages(response.hasMore !== undefined ? response.hasMore : (response.messages || response).length === 15)
      
    } catch (err) {
      console.error('Load more messages error:', err)
      setError('載入訊息失敗')
    } finally {
      setLoadingMessages(false)
    }
  }

  const selectRoom = async (room) => {
    try {
      console.log('選擇聊天室:', room)
      setSelectedRoom(room)
      setError('')
      
      // 檢查緩存中是否已有此聊天室的訊息
      const cacheKey = room.id.toString()
      const cachedData = messageCache.get(cacheKey)
      
      // 只有當緩存訊息數量 > 10 時才使用緩存，否則重新載入
      if (cachedData && cachedData.messages.length > 10) {
        console.log('從緩存載入訊息:', cachedData.messages.length)
        setMessages(cachedData.messages)
        setHasMoreMessages(cachedData.hasMore)
      } else {
        console.log('載入新聊天室訊息...')
        await loadInitialMessages(room.id)
      }
      
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
      // 手機模式下點選聊天室切換到訊息頁面
      if (isMobile) {
        setShowSidebar(false)
      }
    } catch (err) {
      console.error('Load messages error:', err)
      console.error('錯誤詳情:', err.response?.data || err.message)
      setError('Failed to load messages')
    }
  }

  // 返回聊天室列表（手機模式）
  const handleBackToSidebar = () => {
    setShowSidebar(true)
    setSelectedRoom(null)
    setMessages([])
  }

  // 這個函數處理用戶發送新訊息的邏輯
  const handleSendMessage = async (e) => {
    e.preventDefault() // 阻止表單預設提交行為
    
    // 驗證輸入：檢查訊息內容和聊天室是否有效
    // trim() 移除前後空格，確保不發送空訊息
    if (!newMessage.trim() || !selectedRoom) return

    // 立即清空輸入框
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      // 只需調用 API 發送訊息，後端會自動處理廣播
      // API 負責：資料驗證、資料庫儲存、Socket廣播
      await chatService.sendMessage(selectedRoom.id, messageContent)
      console.log('訊息發送成功')

      // 送出訊息後自動滾動到底部
      setTimeout(scrollToBottom, 100)
      
      setError('')
    } catch (err) {
      console.error('發送訊息失敗:', err)
      setError('Failed to send message')
      // 發送失敗時恢復輸入框內容
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
      setRooms(prev => {
        // 檢查是否已經存在這個聊天室
        const roomExists = prev.some(r => r.id === room.id)
        if (!roomExists) {
          return [room, ...prev]
        }
        return prev
      })
      
      setShowUserSearch(false)
      
      // 使用現有的 selectRoom 函數來正確載入訊息
      await selectRoom(room)
    } catch (err) {
      console.error('Start direct chat error:', err)
      alert('開啟聊天失敗，請重試')
    }
  }

  // 邀請成功後的處理
  const handleInviteSuccess = (room) => {
    setShowInviteModal(false)
    // 重新載入聊天室資訊以更新成員列表
    setRooms(prev => {
        const updatedRooms = prev.map(r => {
          if (r.id === room.id) {
            return {
              ...r,
              members: room.members
            }
          }
          return r
        })
        return updatedRooms
      })
  }

  // 離開聊天室處理
  const handleRoomLeft = (roomId) => {
    // 從聊天室列表中移除該聊天室
    setRooms(prev => prev.filter(room => room.id !== roomId))
    
    // 如果當前選中的是被離開的聊天室，清空選中狀態
    if (selectedRoom && selectedRoom.id === roomId) {
      setSelectedRoom(null)
      setMessages([])
      
      // 手機模式下返回聊天室列表
      if (isMobile) {
        setShowSidebar(true)
      }
    }
  }

  // 新增獲取聊天室顯示名稱的函數
  const getRoomDisplayName = (room) => {
    //console.log('getRoomDisplayName - room:', room)
    //console.log('getRoomDisplayName - currentUser:', currentUser)
    //console.log('getRoomDisplayName - room.members:', room.members)
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
      <ChatHeader 
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <div className="chat-main">
        {/* 手機模式：只顯示聊天室列表 */}
        {isMobile && showSidebar && (
          <RoomsSidebar
            rooms={rooms}
            selectedRoom={selectedRoom}
            onSelectRoom={selectRoom}
            onCreateRoom={handleCreateRoom}
            onShowUserSearch={() => setShowUserSearch(true)}
            getRoomDisplayName={getRoomDisplayName}
            error={error}
            isMobile={true}
          />
        )}

        {/* 手機模式：只顯示訊息畫面 */}
        {isMobile && !showSidebar && selectedRoom && (
          <ChatWindow
            selectedRoom={selectedRoom}
            messages={messages}
            newMessage={newMessage}
            onSendMessage={handleSendMessage}
            onMessageChange={(e) => setNewMessage(e.target.value)}
            onShowInviteModal={() => setShowInviteModal(true)}
            onBackToSidebar={handleBackToSidebar}
            currentUser={currentUser}
            isMobile={true}
            onLoadMore={loadMoreMessages}
            hasMoreMessages={hasMoreMessages}
            loadingMessages={loadingMessages}
            onRoomLeft={handleRoomLeft}
          />
        )}

        {/* 桌面模式：同時顯示列表和訊息 */}
        {!isMobile && (
          <>
            <RoomsSidebar
              rooms={rooms}
              selectedRoom={selectedRoom}
              onSelectRoom={selectRoom}
              onCreateRoom={handleCreateRoom}
              onShowUserSearch={() => setShowUserSearch(true)}
              getRoomDisplayName={getRoomDisplayName}
              error={error}
              isMobile={false}
            />
            <ChatWindow
              selectedRoom={selectedRoom}
              messages={messages}
              newMessage={newMessage}
              onSendMessage={handleSendMessage}
              onMessageChange={(e) => setNewMessage(e.target.value)}
              onShowInviteModal={() => setShowInviteModal(true)}
              onBackToSidebar={handleBackToSidebar}
              currentUser={currentUser}
              isMobile={false}
              onLoadMore={loadMoreMessages}
              hasMoreMessages={hasMoreMessages}
              loadingMessages={loadingMessages}
              onRoomLeft={handleRoomLeft}
            />
          </>
        )}
      </div>

      {/* 模態窗口 */}
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
