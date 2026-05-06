@echo off
title PEOS Monitoring System

cd /d "%~dp0"

echo ============================================
echo PEOS Monitoring System - Start
echo ============================================
echo.

echo 1) Starting Tailwind watch (rebuilds CSS on change)...
start "Tailwind Watch" cmd /k "npx.cmd tailwindcss -i resources/css/app.css -o public/css/app.css --watch"

echo 2) Generating simplified PEOS output...
start "Simplify PEOS" cmd /k ".venv\Scripts\python.exe scripts\simplify_peos.py & pause"

echo 3) Starting Electron desktop app...
start "PEOS Electron" cmd /k "npm run electron"

echo.
echo ============================================
echo Services started in separate windows:
echo - Electron app with embedded backend
echo - Backend API is started automatically inside Electron
echo ============================================
echo.
echo Press CTRL+C in each window to stop services
pause
