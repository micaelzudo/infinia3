# Windows Setup Script for Vibe Multiplayer

Write-Host "======================================"
Write-Host "Vibe Coding Starter Pack: 3D Multiplayer"
Write-Host "Windows Setup Script"
Write-Host "======================================"
Write-Host ""

# Check for Rust
if (!(Get-Command rustc -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust not found. Installing Rust..."
    Invoke-WebRequest -Uri https://win.rustup.rs -OutFile rustup-init.exe
    .\rustup-init.exe -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "✅ Rust is already installed"
}

# Add WASM target
Write-Host "Adding WASM target for Rust..."
rustup target add wasm32-unknown-unknown

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org/"
    exit 1
} else {
    Write-Host "✅ Node.js is installed"
}

# Check for SpacetimeDB
if (!(Get-Command spacetime -ErrorAction SilentlyContinue)) {
    Write-Host "❌ SpacetimeDB CLI not found. Please install from https://spacetimedb.com/docs/getting-started/installation"
    exit 1
} else {
    Write-Host "✅ SpacetimeDB CLI is installed"
}

# Install client dependencies
Write-Host "Installing client dependencies..."
Set-Location vibe-coding-starter-pack-3d-multiplayer-main/client
npm install

# Build server
Write-Host "Building server..."
Set-Location ../server
spacetime build

# Generate TypeScript bindings
Write-Host "Generating TypeScript bindings..."
spacetime generate --lang typescript --out-dir ../client/src/generated

Write-Host "Setup complete! You can now start the server and client:"
Write-Host "1. In one terminal: cd server && spacetime start"
Write-Host "2. In another terminal: cd client && npm run dev" 