import axios from 'axios'

// 🎯 動態 API URL 設定
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return '/api'
  }
  else if (process.env.NODE_ENV === 'render') {
    return 'https://chat-n5a3.onrender.com/api' 
  }
  return 'http://localhost:5000/api'
}

const baseURL = getBaseURL()

console.log('🔗 API Base URL:', baseURL)

const register = async (credentials) => {
  const response = await axios.post(`${baseURL}/register`, credentials)
  return response.data
}

const login = async (credentials) => {
  const response = await axios.post(`${baseURL}/login`, credentials)
  return response.data
}

export default { register, login }
