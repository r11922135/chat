@echo off
echo 🚀 Starting Chat Application...
echo.

REM Stop and remove old containers
docker-compose down

REM Build and start
docker-compose up --build

echo.
echo ✅ Complete!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
pause
