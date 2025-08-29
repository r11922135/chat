import { useState, useEffect } from 'react'
import chatService from '../services/chatService'
import './UserSearch.css'

const UserSearch = ({ onStartChat, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 使用 useEffect 和 setTimeout 實現 debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 500) // 延遲 500ms

    // 清理函數：如果 searchQuery 在 500ms 內再次變化，就取消之前的搜尋
    return () => clearTimeout(timer)
  }, [searchQuery]) // 當 searchQuery 變化時觸發

  // 搜尋用戶
  const searchUsers = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([])
      return
    }
    
    setLoading(true)
    try {
      const users = await chatService.searchUsers(query.trim())
      setSearchResults(users)
      setError('')
    } catch (err) {
      console.error('Search users error:', err)
      setError('搜尋用戶失敗')
    } finally {
      setLoading(false)
    }
  }

  // 開始一對一聊天
  const handleStartChat = async (user) => {
    try {
      setLoading(true)
      const room = await chatService.createDirectRoom(user.id)
      onStartChat(room)
      onClose()
    } catch (err) {
      console.error('Create direct room error:', err)
      setError('開啟聊天失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="user-search-modal-overlay">
      <div className="user-search-modal">
        <div className="user-search-header">
          <h3>搜尋用戶開始聊天</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="user-search-content">
          {error && <div className="error-message">{error}</div>}

          <div className="search-section">
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // 移除直接呼叫 searchUsers，改由 useEffect 的 debounce 處理
              }}
              placeholder="輸入用戶名稱搜尋..."
            />

            {loading && <div className="loading-spinner">搜尋中...</div>}

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className="user-item"
                    onClick={() => handleStartChat(user)}
                  >
                    <div className="user-info">
                      <div className="user-name">{user.username}</div>
                      {user.email && <div className="user-email">{user.email}</div>}
                    </div>
                    <button className="chat-btn">開始聊天</button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && searchResults.length === 0 && !loading && (
              <div className="search-results">
                <div className="no-results">找不到相關用戶</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserSearch