# Install SpacetimeDB on Windows
$ErrorActionPreference = "Stop"

Write-Host "Installing SpacetimeDB..."

# Create installation directory
$installDir = "$env:USERPROFILE\.spacetime"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Download SpacetimeDB
$url = "https://github.com/clockworklabs/SpacetimeDB/releases/download/v1.1.2/spacetime-windows-x86_64.zip"
$zipFile = "$installDir\spacetime.zip"
Write-Host "Downloading SpacetimeDB..."
Invoke-WebRequest -Uri $url -OutFile $zipFile

# Extract the zip file
Write-Host "Extracting SpacetimeDB..."
Expand-Archive -Path $zipFile -DestinationPath $installDir -Force

# Add to PATH
$binPath = "$installDir"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binPath", "User")
    $env:Path = "$env:Path;$binPath"
}

# Clean up
Remove-Item $zipFile -Force

Write-Host "SpacetimeDB installed successfully!"
Write-Host "Please restart your terminal to use the 'spacetime' command." 