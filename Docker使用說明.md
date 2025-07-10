# 聊天室 Docker 使用說明

## 🚀 超簡單啟動方式

### 方法 1：雙擊啟動
```
雙擊 "啟動.bat" 檔案
```

### 方法 2：命令列啟動
```bash
docker-compose up --build
```

## 🌐 訪問網址

- **前端**: http://localhost:3000
- **後端**: http://localhost:5000  
- **資料庫**: localhost:5432

## 🛑 停止服務

```bash
docker-compose down
```

## 📁 檔案說明

- `docker-compose.yml` - 主要設定檔
- `backend/Dockerfile` - 後端容器設定
- `frontend/Dockerfile` - 前端容器設定
- `啟動.bat` - 一鍵啟動腳本

## 🔧 如果遇到問題

1. 確認 Docker Desktop 已啟動
2. 確認端口 3000、5000、5432 沒有被佔用
3. 執行 `docker-compose down` 清理舊容器

就這麼簡單！🎉
