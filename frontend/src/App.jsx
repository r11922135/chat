import { useEffect, useState } from 'react'
import './App.css'
import Register from './pages/Register'
import Login from './pages/Login'
import Chat from './pages/Chat'

const App = () => {
  const [currentPage, setCurrentPage] = useState('login')
  
  useEffect(() => {
    // 簡單的路由處理
    const path = window.location.pathname
    const token = localStorage.getItem('chatToken')
    
    if (path === '/register') {
      setCurrentPage('register')
    } else if (path === '/chat') {
      if (token) {
        setCurrentPage('chat')
      } else {
        // 沒有 token，重導向到登入
        window.location.href = '/login'
      }
    } else {
      // 預設為登入頁面
      setCurrentPage('login')
    }
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'register':
        return <Register />
      case 'chat':
        return <Chat />
      default:
        return <Login />
    }
  }

  return (
    <div className="app-container">
      {renderPage()}
    </div>
  )
}

export default App