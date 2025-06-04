@echo off
REM Infinia Multiplayer Startup Script (Batch version)
REM This batch script helps you start the SpacetimeDB server and set up the multiplayer system

echo === Infinia Multiplayer Setup ===
echo.

REM Check if SpacetimeDB CLI is installed
echo Checking SpacetimeDB CLI installation...
spacetimedb --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] SpacetimeDB CLI not found
    echo Please install SpacetimeDB CLI first:
    echo curl --proto "=https" --tlsv1.2 -sSf https://install.spacetimedb.com ^| sh
    pause
    exit /b 1
) else (
    echo [OK] SpacetimeDB CLI found
)

REM Check if Rust is installed
echo Checking Rust installation...
rustc --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Rust not found
    echo Please install Rust first:
    echo curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs ^| sh
    pause
    exit /b 1
) else (
    echo [OK] Rust found
)

echo.

REM Navigate to server directory
set "serverPath=%~dp0server"
if not exist "%serverPath%" (
    echo [ERROR] Server directory not found: %serverPath%
    pause
    exit /b 1
)

echo Navigating to server directory: %serverPath%
cd /d "%serverPath%"

REM Build the SpacetimeDB module
echo Building SpacetimeDB module...
cargo build --release
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build module
    echo Please check the Cargo.toml and source files for errors
    pause
    exit /b 1
) else (
    echo [OK] Module built successfully
)

echo.

REM Check if SpacetimeDB is already running
echo Checking if SpacetimeDB is already running...
tasklist /FI "IMAGENAME eq spacetimedb.exe" 2>NUL | find /I /N "spacetimedb.exe">NUL
if %errorlevel% equ 0 (
    echo [OK] SpacetimeDB is already running
) else (
    echo Starting SpacetimeDB server...
    start /B spacetimedb start
    timeout /t 3 /nobreak >nul
    
    REM Check if it started successfully
    tasklist /FI "IMAGENAME eq spacetimedb.exe" 2>NUL | find /I /N "spacetimedb.exe">NUL
    if %errorlevel% equ 0 (
        echo [OK] SpacetimeDB server started successfully
    ) else (
        echo [ERROR] Failed to start SpacetimeDB server
        echo Please try starting it manually: spacetimedb start
        pause
        exit /b 1
    )
)

echo.

REM Wait a moment for the server to be ready
echo Waiting for server to be ready...
timeout /t 2 /nobreak >nul

REM Check if database exists and create if needed
echo Checking for existing database...
spacetimedb list-databases 2>nul | find "infinia_game" >nul
if %errorlevel% equ 0 (
    echo [OK] Database 'infinia_game' already exists
) else (
    echo Creating database 'infinia_game'...
    spacetimedb create-database infinia_game
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create database
        echo Please try creating it manually: spacetimedb create-database infinia_game
    ) else (
        echo [OK] Database created successfully
    )
)

REM Publish the module
echo Publishing module to database...
spacetimedb publish infinia_game
if %errorlevel% neq 0 (
    echo [ERROR] Failed to publish module
    echo Please try publishing manually: spacetimedb publish infinia_game
) else (
    echo [OK] Module published successfully
)

echo.
echo === Setup Complete ===
echo.
echo SpacetimeDB server is running on: ws://localhost:3000
echo Database name: infinia_game
echo Module name: infinia_multiplayer
echo.
echo Next steps:
echo 1. Start your Infinia client application
echo 2. The multiplayer system should connect automatically
echo 3. Check the browser console for connection status
echo.
echo To stop the server later, run: taskkill /IM spacetimedb.exe /F
echo.
echo Press any key to exit...
pause >nul