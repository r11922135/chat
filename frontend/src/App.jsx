import { useState, useEffect } from 'react'
import './App.css'
import Register from './pages/Register'
import Login from './pages/Login'
import Chat from './pages/Chat'

const App = () => {
  const [currentPage, setCurrentPage] = useState('login')
  const [token, setToken] = useState(localStorage.getItem('chatToken'))
  
  // 簡單的頁面切換函數
  const navigateTo = (page) => {
    setCurrentPage(page)
  }
  
  // 處理登出邏輯
  const handleLogout = () => {
    localStorage.removeItem('chatToken')
    localStorage.removeItem('chatUsername')
    localStorage.removeItem('chatUserId')
    setToken(null) // 清除 token state
    setCurrentPage('login')
  }
  
  // 監聽 localStorage 的變化（用於登入成功後更新 token）
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('chatToken'))
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])
  
  // 根據登入狀態決定要顯示的頁面
  const renderPage = () => {
    // 如果已登入，直接顯示聊天室
    if (token) {
      return <Chat onLogout={handleLogout} onAuthExpired={handleLogout} />
    }
    
    // 如果未登入，根據 currentPage 決定顯示登入還是註冊
    switch (currentPage) {
      case 'register':
        return <Register navigateTo={navigateTo} />
      default:
        return <Login navigateTo={navigateTo} />
    }
  }

  return (
    <div className="app-container">
      {renderPage()}
    </div>
  )
}

export default App