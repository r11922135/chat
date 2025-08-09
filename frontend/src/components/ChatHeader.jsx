import './ChatHeader.css'

const ChatHeader = ({ currentUser, onLogout }) => {
  return (
    <div className="chat-header">
      <h1>💬Chat App</h1>
      <div className="header-user-info">
        <span>Welcome, {currentUser}</span>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>
    </div>
  )
}

export default ChatHeader
