@echo off
setlocal EnableExtensions

set "PORT=3002"
set "BACKEND_DIR=%~dp0backend"

cd /d "%~dp0"
call :CheckPortInUse
if errorlevel 2 exit /b 1
if not errorlevel 1 exit /b 0

cd /d "%BACKEND_DIR%"
node server.js
exit /b %errorlevel%

:CheckPortInUse
node -e "const net=require('net'); const server=net.createServer(); server.once('error', (error) => { process.exit(error && error.code === 'EADDRINUSE' ? 0 : 2); }); server.once('listening', () => { server.close(() => process.exit(1)); }); server.listen(%PORT%, '0.0.0.0');"
set "PORT_CHECK=%errorlevel%"

if "%PORT_CHECK%"=="0" (
	echo Backend is already running on port %PORT%.
	echo Reusing the existing backend instead of starting a duplicate process.
	exit /b 0
)

if "%PORT_CHECK%"=="1" exit /b 1

echo Could not verify whether port %PORT% is available.
echo Stop any existing backend or free the port, then try again.
exit /b 2
