
import { useState } from 'react'
import userService from '../services/userService'
import './Register.css'

const Register = ({ navigateTo }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)

  const handleRegister = async (event) => {
    event.preventDefault()
    setMessage(null)
    try {
      await userService.register({ username, password })
      setMessage('Registration successful!')
      setUsername('')
      setPassword('')
      setTimeout(() => {
        navigateTo('login')
      }, 1000)
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message)
      } else {
        setMessage('Network error')
      }
    }
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">Register</h2>
        <form onSubmit={handleRegister}>
          <div className="register-input-group">
            <label className="register-label">
              Username
            </label>
            <input
              type="text"
              value={username}
              name="Username"
              onChange={({ target }) => setUsername(target.value)}
              className="register-input"
            />
          </div>
          <div className="register-input-group">
            <label className="register-label">
              Password
            </label>
            <input
              type="password"
              value={password}
              name="Password"
              onChange={({ target }) => setPassword(target.value)}
              className="register-input"
            />
          </div>
          <button 
            type="submit"
            className="register-submit-button"
          >
            Register
          </button>
        </form>
        <div className="register-link-container">
          <button 
            type="button"
            onClick={() => navigateTo('login')}
            className="register-link-button"
          >
            Already have an account? Login here
          </button>
        </div>
        {message && (
          <div className={message.includes('successful') ? 'register-message-success' : 'register-message-error'}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default Register