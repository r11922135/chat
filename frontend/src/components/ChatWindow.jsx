import { useRef, useEffect } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import './ChatWindow.css'

const ChatWindow = ({ 
  selectedRoom, 
  messages, 
  newMessage, 
  onSendMessage, 
  onMessageChange,
  onShowInviteModal,
  onBackToSidebar,
  currentUser,
  isMobile,
  onLoadMore,        // 新增：載入更多訊息的函數
  hasMoreMessages,   // 新增：是否還有更多訊息
  loadingMessages    // 新增：載入狀態
}) => {
  const messagesEndRef = useRef(null)

  /*useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])*/

  if (!selectedRoom) {
    return (
      <div className="chat-window">
        <div className="no-room-selected">
          <h3>Select a chat room to start messaging</h3>
          <p>Choose a room from the sidebar to view and send messages.</p>
        </div>
      </div>
    )
  }

  const roomDisplayName = selectedRoom.isGroup 
    ? (selectedRoom.name || 'Unnamed Group')
    : (selectedRoom.members?.find(member => member.username !== currentUser)?.username || selectedRoom.name || 'Direct Message')

  return (
    <div className={`chat-window ${isMobile ? 'mobile' : ''}`}>
      <div className="chat-window-header">
        {isMobile && (
          <button className="back-btn" onClick={onBackToSidebar}>←</button>
        )}
        <div className="room-info">
          <h3>{roomDisplayName}</h3>
        </div>
        <div className="header-actions">
          {selectedRoom.isGroup && (
            <button 
              className="invite-btn"
              onClick={onShowInviteModal}
              title="邀請用戶加入聊天室"
            >
              Invite Users
            </button>
          )}
        </div>
      </div>

      <div 
        className="messages-container"
        id="scrollableDiv"
        style={{ 
          height: '400px', 
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column-reverse' // 關鍵：反向顯示，新訊息在下方
        }}
      >
        <div ref={messagesEndRef} />
        <InfiniteScroll
          dataLength={messages.length}
          next={onLoadMore}
          hasMore={hasMoreMessages && !loadingMessages}
          loader={
            <div className="loading-more" style={{ textAlign: 'center', padding: '10px' }}>
              Loading more messages...
            </div>
          }
          endMessage={
            <div className="no-more-messages" style={{ textAlign: 'center', padding: '10px', color: '#666' }}>
              end of messages
            </div>
          }
          scrollableTarget="scrollableDiv"
          inverse={true} // 關鍵：反向滾動，適合聊天應用
          style={{ 
            display: 'flex', 
            flexDirection: 'column-reverse' 
          }}
        >
          {messages.length === 0 ? (
            <div className="no-messages">No messages yet. Start the conversation!</div>
          ) : (
            [...messages].reverse().map(message => (
              <div
                key={message.id}
                className={`message ${message.User.username === currentUser ? 'own-message' : 'other-message'}`}
                style={{ marginBottom: '16px', padding: '8px 12px', borderRadius: '8px' }} // 新增間距與美化
              >
                <div className="message-header">
                  <span className="message-sender">{message.User.username}</span>
                  <span className="message-time">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-content">{message.content}</div>
              </div>
            ))
          )}
        </InfiniteScroll>
        
      </div>

      <form onSubmit={onSendMessage} className="message-form">
        <input
          type="text"
          value={newMessage}
          onChange={onMessageChange}
          placeholder="Type a message..."
          className="message-input"
        />
        <button type="submit" className="send-btn">Send</button>
      </form>
    </div>
  )
}

export default ChatWindow
