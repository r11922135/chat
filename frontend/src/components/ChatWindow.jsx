import { useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import MembersList from './MembersList'
import InviteUsers from './InviteUsers'
import './ChatWindow.css'

const ChatWindow = ({ 
  selectedRoom, 
  messages, 
  newMessage, 
  onSendMessage, 
  onMessageChange,
  onBackToSidebar,
  currentUser,
  isMobile,
  onLoadMore,        // 新增：載入更多訊息的函數
  hasMoreMessages,   // 新增：是否還有更多訊息
  loadingMessages,   // 新增：載入狀態
  onRoomLeft,        // 新增：離開聊天室回調
}) => {
  const [showMembersList, setShowMembersList] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

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
    : (selectedRoom.name || 'Direct Message')

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
          <button 
            className="members-btn"
            onClick={() => setShowMembersList(true)}
            title="View members"
          >
            👥 Members
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
            (() => {
              const elements = [];

              // 因為 messages 是由新到舊排序，但畫面會被 flexDirection: 'column-reverse' 翻轉
              // 我們要在每天的最後一個訊息（最舊的）後面加上日期分隔符
              // 這樣翻轉後日期分隔符就會出現在每天訊息的前面
              messages.forEach((message, index) => {
                const messageDate = new Date(message.createdAt).toDateString();
                const nextMessage = messages[index + 1]; // 下一個（更舊的）訊息
                const nextMessageDate = nextMessage ? new Date(nextMessage.createdAt).toDateString() : null;

                // 先添加訊息
                if (message.type === 'system') {
                  // 系統訊息樣式
                  elements.push(
                    <div
                      key={message.id}
                      className="system-message"
                      style={{ 
                        textAlign: 'center', 
                        margin: '4px 0', 
                        fontSize: '11px', 
                        color: '#888',
                        padding: '0'
                      }}
                    >
                      {message.content} {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  );
                } else {
                  // 一般用戶訊息
                  elements.push(
                    <div
                      key={message.id}
                      className={`message ${message.User?.username === currentUser ? 'own-message' : 'other-message'}`}
                      style={{ marginBottom: '16px', padding: '8px 12px', borderRadius: '8px' }}
                    >
                      <div className="message-header">
                        <span className="message-sender">{message.User?.username || 'Unknown'}</span>
                        <span className="message-time">
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="message-content">{message.content}</div>
                    </div>
                  );
                }

                // 在這個訊息後面顯示日期分隔符的條件：
                // 1. 這是最後一個訊息（最舊的）
                // 2. 或者這個訊息和下一個訊息不是同一天
                if (index === messages.length - 1 || (nextMessageDate && messageDate !== nextMessageDate)) {
                  elements.push(
                    <div key={`date-${messageDate}-${index}`} className="date-separator" style={{ 
                      textAlign: 'center', 
                      margin: '16px 0', 
                      fontSize: '12px', 
                      color: '#666',
                      padding: '4px 0'
                    }}>
                      {new Date(message.createdAt).toLocaleDateString('zh-TW', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  );
                }
              });

              // 直接回傳元素陣列，不需要 reverse
              return elements;
            })()
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

      {showMembersList && (
        <MembersList
          room={selectedRoom}
          currentUser={currentUser}
          onClose={() => setShowMembersList(false)}
          onLeaveRoom={onRoomLeft}
        />
      )}
      
      {showInviteModal && selectedRoom && (
        <InviteUsers
          room={selectedRoom}
          onClose={() => setShowInviteModal(false)}
          onInviteSuccess={() => {
            setShowInviteModal(false)
          }}
        />
      )}
    </div>
  )
}

export default ChatWindow
