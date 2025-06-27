
import { useState } from 'react'
import userService from '../services/userService'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)

  const handleLogin = async (event) => {
    event.preventDefault()
    setMessage(null)
    try {
      const data = await userService.login({ username, password })
      setMessage('Login successful, token: ' + data.token)
      setUsername('')
      setPassword('')
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message)
      } else {
        setMessage('Network error')
      }
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          username
          <input
            type="text"
            value={username}
            name="Username"
            onChange={({ target }) => setUsername(target.value)}
          />
        </div>
        <div>
          password
          <input
            type="password"
            value={password}
            name="Password"
            onChange={({ target }) => setPassword(target.value)}
          />
        </div>
        <button type="submit">login</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  )
}

export default Login