@echo off
REM Run as Administrator to set up firewall rules for PEOS
REM Right-click this file and select "Run as administrator"

echo.
echo ========================================
echo PEOS Firewall Setup
echo ========================================
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: This script requires administrator privileges!
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [Step 1/2] Adding firewall rule for Port 3000 (Frontend)...
netsh advfirewall firewall add rule name="PEOS Frontend (Port 3000)" ^
    dir=in action=allow protocol=tcp localport=3000 ^
    profile=private,public description="Allow PEOS frontend access from network devices"

if %errorLevel% equ 0 (
    echo OK - Port 3000 rule added
) else (
    echo WARNING - Port 3000 rule may already exist
)

echo.
echo [Step 2/2] Adding firewall rule for Port 3002 (Backend API)...
netsh advfirewall firewall add rule name="PEOS Backend API (Port 3002)" ^
    dir=in action=allow protocol=tcp localport=3002 ^
    profile=private,public description="Allow PEOS backend API access from network devices"

if %errorLevel% equ 0 (
    echo OK - Port 3002 rule added
) else (
    echo WARNING - Port 3002 rule may already exist
)

echo.
echo ========================================
echo Firewall setup complete!
echo.
echo You can now access PEOS from other devices:
echo - Frontend: http://192.168.0.202:3000
echo - Backend:  http://192.168.0.202:3002/api
echo ========================================
echo.
pause
