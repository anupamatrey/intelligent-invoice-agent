@echo off
echo Testing WebSocket Setup...
echo.

echo 1. Check app is running:
curl -s http://localhost:8081/api/v1/test
echo.
echo.

echo 2. Check WebSocket info endpoint:
curl -s http://localhost:8081/ws/info
echo.
echo.

echo 3. Trigger test broadcast:
curl -X POST http://localhost:8081/api/v1/test/broadcast-rejected
echo.
echo.

echo Done! If step 2 is empty, restart the app with: gradlew bootRun
pause
