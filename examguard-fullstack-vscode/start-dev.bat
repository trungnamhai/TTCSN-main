@echo off
title ExamGuard Fullstack & YOLOv8 AI Launcher
chcp 65001 >nul
echo ========================================================
echo    ĐANG KHỞI ĐỘNG HỆ THỐNG KHẢO THÍ EXAMGUARD (YOLOV8)
echo ========================================================
echo [1/4] Đang khởi chạy YOLOv8 AI Service (Cổng 5001)...
start "ExamGuard - YOLOv8 AI Service (Port 5001)" cmd /k "python server/ai_service/yolo_service.py"

timeout /t 2 >nul

echo [2/4] Đang khởi chạy Backend Node.js (Cổng 5000)...
start "ExamGuard - Backend (Port 5000)" cmd /k "node server/server.js"

echo [3/4] Đang khởi chạy Frontend Vite (Cổng 5174)...
start "ExamGuard - Frontend (Port 5174)" cmd /k "cd client && npm run dev"

timeout /t 3 >nul

echo [4/4] Đang kết nối Cloudflare Tunnel để tạo link HTTPS...
echo --------------------------------------------------------
echo Đường link truy cập sẽ xuất hiện bên dưới (có dạng: https://xxx.trycloudflare.com)
echo Cuộn chuột lên trên nếu link bị che khuất bởi các dòng log.
echo --------------------------------------------------------
.\cloudflared.exe tunnel --url http://localhost:5174
pause
