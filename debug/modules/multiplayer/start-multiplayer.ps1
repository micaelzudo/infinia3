# Infinia Multiplayer Startup Script
# This PowerShell script helps you start the SpacetimeDB server and set up the multiplayer system

Write-Host "=== Infinia Multiplayer Setup ==="
Write-Host ""

# Check if SpacetimeDB CLI is installed
Write-Host "Checking SpacetimeDB CLI installation..."
try {
    $spacetimeVersion = spacetimedb --version 2>$null
    if ($spacetimeVersion) {
        Write-Host "✓ SpacetimeDB CLI found: $spacetimeVersion" -ForegroundColor Green
    } else {
        throw "SpacetimeDB CLI not found"
    }
} catch {
    Write-Host "✗ SpacetimeDB CLI not found" -ForegroundColor Red
    Write-Host "Please install SpacetimeDB CLI first:" -ForegroundColor Yellow
    Write-Host "curl --proto '=https' --tlsv1.2 -sSf https://install.spacetimedb.com | sh" -ForegroundColor Cyan
    exit 1
}

# Check if Rust is installed
Write-Host "Checking Rust installation..."
try {
    $rustVersion = rustc --version 2>$null
    if ($rustVersion) {
        Write-Host "✓ Rust found: $rustVersion" -ForegroundColor Green
    } else {
        throw "Rust not found"
    }
} catch {
    Write-Host "✗ Rust not found" -ForegroundColor Red
    Write-Host "Please install Rust first:" -ForegroundColor Yellow
    Write-Host "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Navigate to server directory
$serverPath = Join-Path $PSScriptRoot "server"
if (Test-Path $serverPath) {
    Write-Host "Navigating to server directory: $serverPath"
    Set-Location $serverPath
} else {
    Write-Host "✗ Server directory not found: $serverPath" -ForegroundColor Red
    exit 1
}

# Build the SpacetimeDB module
Write-Host "Building SpacetimeDB module..."
try {
    cargo build --release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Module built successfully" -ForegroundColor Green
    } else {
        throw "Build failed"
    }
} catch {
    Write-Host "✗ Failed to build module" -ForegroundColor Red
    Write-Host "Please check the Cargo.toml and source files for errors" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if SpacetimeDB is already running
Write-Host "Checking if SpacetimeDB is already running..."
$spacetimeProcess = Get-Process -Name "spacetimedb" -ErrorAction SilentlyContinue
if ($spacetimeProcess) {
    Write-Host "✓ SpacetimeDB is already running (PID: $($spacetimeProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "Starting SpacetimeDB server..."
    try {
        # Start SpacetimeDB in the background
        Start-Process -FilePath "spacetimedb" -ArgumentList "start" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        
        # Check if it started successfully
        $spacetimeProcess = Get-Process -Name "spacetimedb" -ErrorAction SilentlyContinue
        if ($spacetimeProcess) {
            Write-Host "✓ SpacetimeDB server started successfully (PID: $($spacetimeProcess.Id))" -ForegroundColor Green
        } else {
            throw "Failed to start SpacetimeDB"
        }
    } catch {
        Write-Host "✗ Failed to start SpacetimeDB server" -ForegroundColor Red
        Write-Host "Please try starting it manually: spacetimedb start" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Wait a moment for the server to be ready
Write-Host "Waiting for server to be ready..."
Start-Sleep -Seconds 2

# Check if database exists
Write-Host "Checking for existing database..."
try {
    $databases = spacetimedb list-databases 2>$null
    if ($databases -match "infinia_game") {
        Write-Host "✓ Database 'infinia_game' already exists" -ForegroundColor Green
    } else {
        Write-Host "Creating database 'infinia_game'..."
        spacetimedb create-database infinia_game
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database created successfully" -ForegroundColor Green
        } else {
            throw "Failed to create database"
        }
    }
} catch {
    Write-Host "✗ Failed to create database" -ForegroundColor Red
    Write-Host "Please try creating it manually: spacetimedb create-database infinia_game" -ForegroundColor Yellow
}

# Publish the module
Write-Host "Publishing module to database..."
try {
    spacetimedb publish infinia_game
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Module published successfully" -ForegroundColor Green
    } else {
        throw "Failed to publish module"
    }
} catch {
    Write-Host "✗ Failed to publish module" -ForegroundColor Red
    Write-Host "Please try publishing manually: spacetimedb publish infinia_game" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "SpacetimeDB server is running on: ws://localhost:3000" -ForegroundColor Cyan
Write-Host "Database name: infinia_game" -ForegroundColor Cyan
Write-Host "Module name: infinia_multiplayer" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start your Infinia client application" -ForegroundColor White
Write-Host "2. The multiplayer system should connect automatically" -ForegroundColor White
Write-Host "3. Check the browser console for connection status" -ForegroundColor White
Write-Host ""
Write-Host "To stop the server later, run: Get-Process spacetimedb | Stop-Process" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")