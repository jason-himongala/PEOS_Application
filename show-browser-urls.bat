@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
set "PORT=3002"
set "LOCAL_URL=http://localhost:%PORT%/"
set "IP_FILE=%TEMP%\peos_network_ips.txt"
set "HOST_IPS="

cls
echo.
echo ============================================
echo PEOS Frontend URLs
echo ============================================
echo.
echo Localhost URL:
echo   %LOCAL_URL%
echo.

del "%IP_FILE%" 2>nul
node "%~dp0get-network-ip.js" > "%IP_FILE%"
if exist "%IP_FILE%" (
    set /p HOST_IPS=<"%IP_FILE%"
    del "%IP_FILE%" 2>nul
)

if defined HOST_IPS (
    echo Network URL for other devices:
    for %%I in (!HOST_IPS!) do echo   http://%%I:%PORT%/
    echo.
) else (
    echo Could not detect LAN IP automatically.
    echo Use your host machine's IPv4 address with port %PORT%.
    echo.
)

echo Open the network URL on other devices.
echo Keep the backend window open while using PEOS.
echo.
echo ============================================
echo Press any key to close...
pause >nul
