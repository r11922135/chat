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
              let lastDate = null;

              // 使用原始順序的訊息來處理日期分隔符
              messages.forEach((message, index) => {
                const messageDate = new Date(message.createdAt).toDateString();
                
                // 如果是新的一天，顯示日期分隔符
                if (lastDate !== messageDate) {
                  elements.push(
                    <div key={`date-${messageDate}`} className="date-separator" style={{ 
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
                  lastDate = messageDate;
                }

                elements.push(
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
                );
              });

              // 反轉整個元素陣列，這樣日期分隔符就會出現在正確的位置
              return elements.reverse();
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
    </div>
  )
}

export default ChatWindow
