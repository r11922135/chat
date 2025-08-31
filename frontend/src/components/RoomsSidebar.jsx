import './RoomsSidebar.css'

const RoomsSidebar = ({ 
  rooms, 
  selectedRoom, 
  onSelectRoom, 
  onCreateRoom, 
  onShowUserSearch, 
  getRoomDisplayName,
  error,
  isMobile 
}) => {
  const formatRoomTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = (today - msgDay) / (1000 * 60 * 60 * 24)

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString()
    }
  }
  return (
    <div className={`rooms-sidebar ${isMobile ? 'mobile' : ''}`}>
      <div className="rooms-header">
        <h3>Chats</h3>
        <div className="header-buttons">
          <button className="search-direct-btn" onClick={onShowUserSearch}><span>👤</span></button>
          <button className="new-chat-btn" onClick={onCreateRoom}><span>👥</span></button>
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
              onClick={() => onSelectRoom(room)}
            >
              <div className="room-header">
                <div className="room-name">{getRoomDisplayName(room)}</div>
                <div className="room-badges">
                  <div className="room-type">{room.isGroup ? 'Group' : 'Direct'}</div>
                  {room.unreadCount > 0 && (
                    <div className="unread-badge">{room.unreadCount}</div>
                  )}
                </div>
              </div>
              {room.Messages && room.Messages.length > 0 ? (
                <div className="last-message">
                  <span className="sender">
                    {room.Messages[0].type === 'system' 
                      ? '' 
                      : <> {room.Messages[0].User?.username || 'Unknown'}:</>}
                  </span>
                  <span className="content">{room.Messages[0].content}</span>
                  <span className="time">
                    {formatRoomTime(room.Messages[0].createdAt)}
                  </span>
                </div>
              ) : (
                <div className="last-message">
                  <span className="content no-message">(No messages)</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default RoomsSidebar
