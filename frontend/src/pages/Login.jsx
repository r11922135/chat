
import { useState } from 'react'
import userService from '../services/userService'
import './Login.css'

const Login = ({ navigateTo }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)

  const handleLogin = async (event) => {
    event.preventDefault()
    setMessage(null)
    try {
      const data = await userService.login({ username, password })
      
      // 儲存 token 和用戶資訊到 localStorage
      localStorage.setItem('chatToken', data.token)
      localStorage.setItem('chatUsername', data.username)
      localStorage.setItem('chatUserId', data.userId)
      
      setMessage('Login successful!')
      
      // 清除表單
      setUsername('')
      setPassword('')
      
      // 觸發 storage 事件讓 App.jsx 更新 token 狀態
      window.dispatchEvent(new Event('storage'))
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message)
      } else {
        setMessage('Network error')
      }
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Login</h2>
        <form onSubmit={handleLogin}>
          <div className="login-input-group">
            <label className="login-label">
              Username
            </label>
            <input
              type="text"
              value={username}
              name="Username"
              onChange={({ target }) => setUsername(target.value)}
              className="login-input"
            />
          </div>
          <div className="login-input-group">
            <label className="login-label">
              Password
            </label>
            <input
              type="password"
              value={password}
              name="Password"
              onChange={({ target }) => setPassword(target.value)}
              className="login-input"
            />
          </div>
          <button 
            type="submit"
            className="login-submit-button"
          >
            Login
          </button>
        </form>
        <div className="login-link-container">
          <button 
            type="button"
            onClick={() => navigateTo('register')}
            className="login-link-button"
          >
            Don't have an account? Register here
          </button>
        </div>
        {message && (
          <div className={message.includes('successful') ? 'login-message-success' : 'login-message-error'}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default Login