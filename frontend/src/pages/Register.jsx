
import { useState } from 'react'

import userService from '../services/userService'

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null);

  const handleRegister = async (event) => {
    event.preventDefault()
    setMessage(null)
    try {
      await userService.register({ username, password })
      setMessage('註冊成功')
      setUsername('')
      setPassword('')
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message)
      } else {
        setMessage('網路錯誤')
      }
    }
  }

  return (
    <div>
      <h2>註冊</h2>
      <form onSubmit={handleRegister}>
        <div>
          帳號
          <input
            type="text"
            value={username}
            name="Username"
            onChange={({ target }) => setUsername(target.value)}
          />
        </div>
        <div>
          密碼
          <input
            type="password"
            value={password}
            name="Password"
            onChange={({ target }) => setPassword(target.value)}
          />
        </div>
        <button type="submit">註冊</button>
        {message && <div>{message}</div>}
      </form>
    </div>
  );
};

export default Register;