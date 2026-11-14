@echo off
title ExamGuard Fullstack & Tunnel Launcher
chcp 65001 >nul
echo ========================================================
echo    ĐANG KHỞI ĐỘNG HỆ THỐNG KHẢO THÍ EXAMGUARD
echo ========================================================
echo [1/3] Đang khởi chạy Backend (Cổng 5000)...
start "ExamGuard - Backend (Port 5000)" cmd /k "node server/server.js"

echo [2/3] Đang khởi chạy Frontend (Cổng 5174)...
start "ExamGuard - Frontend (Port 5174)" cmd /k "cd client && npm run dev"

timeout /t 3 >nul

echo [3/3] Đang kết nối Cloudflare Tunnel để tạo link HTTPS...
echo --------------------------------------------------------
echo Đường link truy cập sẽ xuất hiện bên dưới (có dạng: https://xxx.trycloudflare.com)
echo --------------------------------------------------------
.\cloudflared.exe tunnel --url http://localhost:5174
pause
