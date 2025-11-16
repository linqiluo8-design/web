@echo off
echo 正在清理缓存...
rmdir /s /q .next 2>nul
echo 缓存已清理

echo.
echo 正在启动开发服务器...
npm run dev
