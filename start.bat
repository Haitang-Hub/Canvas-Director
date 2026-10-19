@echo off
setlocal
chcp 65001 >nul

echo ============================================================
echo  Infinite Canvas - Startup
echo ============================================================
echo.

set "WEB_DIR=%~dp0web"

:: Write proxy config
if not exist "%WEB_DIR%\public" mkdir "%WEB_DIR%\public"
(
echo // Auto-injected by start script
echo window.__INFINITE_CANVAS_CONFIG__ = window.__INFINITE_CANVAS_CONFIG__ || {};
echo window.__INFINITE_CANVAS_CONFIG__.autoProxyEnabled = true;
echo window.__INFINITE_CANVAS_CONFIG__.autoProxyUrl = "http://127.0.0.1:23210";
) > "%WEB_DIR%\public\config.js"

echo Starting services...
echo.

:: 1. Agent (port 17371) - local source, includes unpublished fixes
start "Agent 17371" cmd /k "pushd "%~dp0canvas-agent" && npm run dev"
echo [OK] Agent started

:: 2. Proxy (port 23210) - output shown directly in window
start "Proxy 23210" cmd /k "pushd "%~dp0canvas-proxy" && node index.js"
echo [OK] Proxy started

:: 3. Web dev server (blocking, current window)
echo.
echo Web: http://localhost:5070
echo Press Ctrl+C to stop
echo.

pushd "%WEB_DIR%"
call npm run dev
popd

endlocal
