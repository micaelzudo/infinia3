# Install SpacetimeDB on Windows
$ErrorActionPreference = "Stop"

Write-Host "Installing SpacetimeDB..."

# Create installation directory
$installDir = "$env:USERPROFILE\.spacetime"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Download SpacetimeDB using the official installer
Write-Host "Installing SpacetimeDB..."
iwr https://windows.spacetimedb.com -useb | iex

Write-Host "SpacetimeDB installed successfully!"
Write-Host "Please restart your terminal to use the spacetime command"