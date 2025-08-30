# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (CommonJS + Express + Socket.IO)
```bash
cd backend
npm run dev          # Development with nodemon hot reload
npm start            # Production server
npm run lint         # ESLint with stylistic rules
```

### Frontend (React + Vite)
```bash
cd frontend  
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint with React rules
```

### Docker Deployment
```bash
docker-compose up --build    # Full stack with PostgreSQL
docker-compose down          # Stop all services
# Or use start.bat for Windows one-click startup
```

## Architecture Overview

### Tech Stack
- **Backend**: Node.js + Express 5 + Socket.IO + Sequelize ORM + PostgreSQL
- **Frontend**: React 19 + Vite + TailwindCSS + Socket.IO Client  
- **Authentication**: JWT tokens with bcrypt password hashing
- **Real-time**: Socket.IO for bidirectional communication

### Key Architectural Patterns

#### Backend Structure
- **MVC Pattern**: Controllers (`controllers/`), Models (`models/`), Routes in controllers
- **Middleware Chain**: `utils/middleware.js` contains JWT auth, room access control, error handling
- **Socket Singleton**: `socket/socketHandlers.js` exports singleton `getIO()` for cross-module socket access
- **Sequelize Models**: `models/index.js` creates shared sequelize instance, individual model files define schemas

#### Database Schema Design
- **Users**: Basic auth (username, password hash)
- **Rooms**: Support both group chats (`isGroup: true, name: string`) and direct messages (`isGroup: false, name: null`)
- **Messages**: Content linked to User and Room
- **RoomUsers**: Junction table with `lastReadAt` for unread count calculation

#### Socket.IO Architecture
- **Auto-join Pattern**: Users automatically join all their room channels on connection
- **Room-based Broadcasting**: Messages broadcast to `roomId.toString()` channels
- **Permission Checking**: Socket middleware validates JWT, controller checks room membership
- **Cross-service Integration**: `joinRoomSocket()` helper allows REST endpoints to manage socket rooms

#### Frontend Architecture  
- **State Management**: Local React state with localStorage persistence
- **Socket Service Singleton**: `services/socketService.js` manages single WebSocket connection
- **Page-based Routing**: Simple state-based navigation (Register → Login → Chat)
- **Component Structure**: Reusable UI components in `components/`, main pages in `pages/`

### Critical Integration Points

#### Authentication Flow
1. REST login (`POST /api/auth/login`) returns JWT
2. Frontend stores JWT in localStorage
3. Socket connection passes JWT via `auth.token` 
4. Socket middleware (`socketAuth.js`) validates JWT and adds `socket.userId`, `socket.roomIds`
5. REST endpoints use `authenticateToken` middleware for protected routes

#### Real-time Message Flow
1. Frontend calls REST API (`POST /api/messages/:roomId`) to persist message
2. API returns saved message with DB ID
3. Frontend emits `send-message` socket event with message data
4. Socket handler validates sender permissions via `RoomUser` lookup
5. Socket broadcasts `new-message` to all users in `roomId.toString()` channel
6. Clients receive and display new message

#### Room Management Integration
- REST endpoints create rooms and manage membership in database
- `joinRoomSocket()` helper immediately adds online users to socket rooms
- Socket events handle real-time room joining for instant message delivery

### Development Notes

#### Environment Configuration
- Backend uses `.env` file loaded by `utils/config.js`
- Socket service detects environment via `NODE_ENV` for URL switching
- Docker Compose provides full-stack development environment

#### Database Considerations
- Sequelize ORM with PostgreSQL dialect
- Raw SQL queries used for complex joins (unread counts in `rooms.js:17`)
- Models auto-sync on server start (`sequelize.sync()`)
- Connection pooling configured for production SSL (AWS RDS ready)

#### Socket.IO Patterns
- Room names always converted to strings for consistency
- Extensive logging for debugging connection issues
- Error handling with structured error events
- Reconnection handled automatically by Socket.IO client

#### Code Style
- Backend: ESLint with @stylistic/js (2-space indent, single quotes, unix linebreaks)
- Frontend: ESLint with React hooks and refresh plugins
- Mixed Chinese/English comments throughout codebase