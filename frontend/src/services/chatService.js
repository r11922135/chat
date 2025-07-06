// 聊天室相關的 API 服務
import axios from 'axios'

const baseURL = 'http://localhost:4000/api'

// 取得儲存在 localStorage 的 token
const getToken = () => {
  return localStorage.getItem('chatToken')
}

// 設定 axios 預設的 Authorization header
const getAuthHeaders = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 取得用戶的所有聊天室
const getUserRooms = async () => {
  const config = {
    headers: getAuthHeaders()
  }
  
  const response = await axios.get(`${baseURL}/rooms`, config)
  return response.data
}

// 別名方法，保持向後兼容
const getRooms = getUserRooms

// 建立新聊天室
const createRoom = async (roomData) => {
  const config = {
    headers: getAuthHeaders()
  }
  
  const response = await axios.post(`${baseURL}/rooms`, roomData, config)
  return response.data
}

// 取得聊天室的訊息
const getRoomMessages = async (roomId) => {
  console.log('chatService.getRoomMessages 被調用, roomId:', roomId);
  const config = {
    headers: getAuthHeaders()
  }
  console.log('請求配置:', config);
  
  try {
    const response = await axios.get(`${baseURL}/rooms/${roomId}/messages`, config)
    console.log('API 回應:', response.data);
    return response.data
  } catch (error) {
    console.error('chatService.getRoomMessages 錯誤:', error);
    console.error('錯誤回應:', error.response?.data);
    throw error;
  }
}

// 發送訊息
const sendMessage = async (roomId, content) => {
  const config = {
    headers: getAuthHeaders()
  }
  
  const messageData = { content }
  const response = await axios.post(`${baseURL}/rooms/${roomId}/messages`, messageData, config)
  return response.data
}

// 搜尋用戶
const searchUsers = async (query) => {
  const config = {
    headers: getAuthHeaders(),
    params: { query }
  }
  
  const response = await axios.get(`${baseURL}/users/search`, config)
  return response.data
}

// 邀請用戶加入聊天室
const inviteUsers = async (roomId, userIds) => {
  const config = {
    headers: getAuthHeaders()
  }
  
  const inviteData = { userIds }
  const response = await axios.post(`${baseURL}/rooms/${roomId}/invite`, inviteData, config)
  return response.data
}

// 標記聊天室為已讀
const markRoomAsRead = async (roomId) => {
  const config = {
    headers: getAuthHeaders()
  }
  
  const response = await axios.post(`${baseURL}/rooms/${roomId}/mark-read`, {}, config)
  return response.data
}

export default {
  getUserRooms,
  getRooms,
  createRoom,
  getRoomMessages,
  sendMessage,
  searchUsers,
  inviteUsers,
  markRoomAsRead
}
