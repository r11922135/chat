# 超簡單的前端 Dockerfile
FROM node:22-alpine

# 設定工作目錄
WORKDIR /app

# 複製並安裝依賴
COPY package*.json ./
RUN npm install

# 複製程式碼
COPY . .

# 建置專案
RUN npm run build

# 使用簡單的靜態檔案伺服器
RUN npm install -g serve

# 暴露端口
EXPOSE 3000

# 啟動服務
CMD ["serve", "-s", "dist", "-l", "3000"]
