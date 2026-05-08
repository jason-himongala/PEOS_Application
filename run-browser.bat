@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
set "PORT=3002"
set "BACKEND_TITLE=PEOS Backend"
set "FRONTEND_TITLE=PEOS Frontend URLs"

cls
echo.
echo ============================================
echo PEOS Browser Launcher
echo ============================================
echo.

call :CheckBackend
if errorlevel 1 (
    echo Shared backend is not running.
    echo Starting backend on port %PORT%...
    echo.
    start "%BACKEND_TITLE%" "%~dp0run-backend.bat"
    call :WaitForBackend
    if errorlevel 1 (
        echo WARNING: Backend did not respond in time.
        echo The frontend URL window will still open, but the backend may not be ready yet.
        echo.
    ) else (
        echo Backend is ready.
        echo.
    )
) else (
    echo Shared backend is already running.
    echo.
)

start "%FRONTEND_TITLE%" "%~dp0show-browser-urls.bat"
exit /b 0

:CheckBackend
node -e "const http=require('http'); const req=http.get('http://127.0.0.1:3002/api/health',res=>{process.exit(res.statusCode===200?0:1)}); req.on('error',()=>process.exit(1)); req.setTimeout(2000,()=>{req.destroy(); process.exit(1)});"
exit /b %errorlevel%

:WaitForBackend
for /l %%I in (1,1,20) do (
    node -e "const http=require('http'); const req=http.get('http://127.0.0.1:3002/api/health',res=>{process.exit(res.statusCode===200?0:1)}); req.on('error',()=>process.exit(1)); req.setTimeout(1000,()=>{req.destroy(); process.exit(1)});"
    if not errorlevel 1 exit /b 0
    node -e "setTimeout(()=>process.exit(0),1000)"
)
exit /b 1

:GetHostIP
set "HOST_IPS="
set "IP_FILE=%TEMP%\peos_network_ips.txt"
del "%IP_FILE%" 2>nul
node "%~dp0get-network-ip.js" > "%IP_FILE%"
if exist "%IP_FILE%" (
    set /p HOST_IPS=<"%IP_FILE%"
    del "%IP_FILE%" 2>nul
)
exit /b 0
