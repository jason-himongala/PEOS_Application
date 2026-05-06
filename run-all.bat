@echo off
title PEOS Monitoring System

cd /d "%~dp0"

echo ============================================
echo PEOS Monitoring System - Full Start
echo ============================================
echo.

echo Starting all services using the standard launcher...
call run.bat

echo.
echo ============================================
echo Launcher completed.
echo ============================================
echo.
exit /b 0
