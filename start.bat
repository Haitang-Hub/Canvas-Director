@echo off
setlocal
chcp 65001 >nul

echo ============================================================
echo  Infinite Canvas - Startup
echo ============================================================
echo.

set "WEB_DIR=%~dp0web"

:: Write proxy config (^| escapes the pipes so "|| {}" is written literally)
if not exist "%WEB_DIR%\public" mkdir "%WEB_DIR%\public"
(
echo // Auto-injected by start script
echo window.__INFINITE_CANVAS_CONFIG__ = window.__INFINITE_CANVAS_CONFIG__ ^|^| {};
echo window.__INFINITE_CANVAS_CONFIG__.autoProxyEnabled = true;
echo window.__INFINITE_CANVAS_CONFIG__.autoProxyUrl = "http://127.0.0.1:23210";
) > "%WEB_DIR%\public\config.js"

:: Install dependencies on first run (canvas-proxy has no dependencies)
:: web needs --legacy-peer-deps: antd 6 conflicts with pro-components beta peer range
if not exist "%~dp0canvas-agent\node_modules" (
    echo [..] Installing canvas-agent dependencies, first run only
    pushd "%~dp0canvas-agent"
    call npm install
    if errorlevel 1 (
        popd
        echo [ERR] canvas-agent npm install failed
        exit /b 1
    )
    popd
)
if not exist "%WEB_DIR%\node_modules" (
    echo [..] Installing web dependencies, first run only
    pushd "%WEB_DIR%"
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        popd
        echo [ERR] web npm install failed
        exit /b 1
    )
    popd
)

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
