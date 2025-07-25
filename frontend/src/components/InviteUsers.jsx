import { useState } from 'react'
import chatService from '../services/chatService'
import socketService from '../services/socketService'
import './InviteUsers.css'

const InviteUsers = ({ room, onClose, onInviteSuccess }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 搜尋用戶
  const searchUsers = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([])
      return
    }
    
    try {
      const users = await chatService.searchUsers(query.trim())
      setSearchResults(users)
    } catch (err) {
      console.error('Search users error:', err)
      setError('搜尋用戶失敗')
    }
  }

  // 選擇/取消選擇用戶
  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.find(u => u.id === user.id)
      if (isSelected) {
        return prev.filter(u => u.id !== user.id)
      } else {
        return [...prev, user]
      }
    })
  }

  // 邀請用戶
  const handleInvite = async () => {
    if (selectedUsers.length === 0) {
      setError('請選擇要邀請的用戶')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userIds = selectedUsers.map(user => user.id)
      
      // 🆕 步驟1：先呼叫 API 更新資料庫
      console.log('正在邀請用戶到資料庫...')
      const result = await chatService.inviteUsers(room.id, userIds)
      
      // 🆕 步驟2：再呼叫 Socket 讓在線用戶加入房間
      /*console.log('正在讓被邀請的用戶加入 Socket 房間...')
      socketService.inviteUsersToRoom(room.id, userIds)*/
      
      alert(`成功邀請 ${result.invitedCount} 位用戶！`)
      
      if (onInviteSuccess) {
        onInviteSuccess(result.room)
      }
      
      if (onClose) {
        onClose()
      }
    } catch (err) {
      console.error('Invite users error:', err)
      if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('邀請失敗，請重試')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="invite-modal-overlay">
      <div className="invite-modal">
        <div className="invite-modal-header">
          <h3>邀請用戶到 "{room.name}"</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="invite-modal-content">
          {error && <div className="error-message">{error}</div>}

          <div className="search-section">
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                searchUsers(e.target.value)
              }}
              placeholder="輸入用戶名稱進行搜尋..."
            />

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className={`user-item ${selectedUsers.find(u => u.id === user.id) ? 'selected' : ''}`}
                    onClick={() => toggleUserSelection(user)}
                  >
                    <div className="user-info">
                      <div className="user-name">{user.username}</div>
                      {user.email && <div className="user-email">{user.email}</div>}
                    </div>
                    {selectedUsers.find(u => u.id === user.id) && (
                      <span className="select-indicator">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="search-results">
                <div className="no-results">找不到相關用戶</div>
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div className="selected-users-section">
              <h4>已選擇的用戶：</h4>
              <div className="selected-users-list">
                {selectedUsers.map(user => (
                  <span key={user.id} className="selected-user-tag">
                    {user.username}
                    <button
                      type="button"
                      onClick={() => toggleUserSelection(user)}
                      className="remove-user-btn"
                      title="移除此用戶"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="invite-actions">
            <button onClick={onClose} className="cancel-btn">
              取消
            </button>
            <button 
              onClick={handleInvite} 
              disabled={loading || selectedUsers.length === 0} 
              className="invite-confirm-btn"
            >
              {loading ? '邀請中...' : `邀請 ${selectedUsers.length} 位用戶`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteUsers
