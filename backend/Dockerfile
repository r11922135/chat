# 超簡單的後端 Dockerfile
FROM node:22-alpine

# 設定工作目錄
WORKDIR /app

# 複製並安裝依賴
COPY package*.json ./
RUN npm install

# 複製所有程式碼
COPY . .

# 暴露端口
EXPOSE 5000

# 啟動程式
CMD ["node", "index.js"]
