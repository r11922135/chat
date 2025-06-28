import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 全域錯誤處理 - 過濾非關鍵錯誤（可選）
window.addEventListener('unhandledrejection', (event) => {
  // 過濾瀏覽器擴充功能相關錯誤
  if (event.reason?.message?.includes('message channel closed')) {
    console.log('已過濾瀏覽器擴充功能相關錯誤');
    event.preventDefault(); // 阻止錯誤在 console 中顯示
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
