# Copy core files
Copy-Item -Path "SpacetimeDBManager.ts" -Destination "core/" -Force
Copy-Item -Path "SpacetimeDBManager.new.ts" -Destination "core/" -Force
Copy-Item -Path "config.ts" -Destination "core/" -Force

# Copy client files
Copy-Item -Path "client/playerSync.ts" -Destination "client/" -Force
Copy-Item -Path "client/terrainSync.ts" -Destination "client/" -Force
Copy-Item -Path "client/network.ts" -Destination "client/" -Force
Copy-Item -Path "client/index.ts" -Destination "client/" -Force

# Copy utils files
Copy-Item -Path "utils/EventManager.ts" -Destination "utils/" -Force
Copy-Item -Path "integrationUtils.ts" -Destination "utils/" -Force
Copy-Item -Path "legacyAdapter.ts" -Destination "utils/" -Force

# Copy types
Copy-Item -Path "types.ts" -Destination "types/" -Force

# Copy integration files
Copy-Item -Path "../ui/spacetimedbIntegration.ts" -Destination "integration/" -Force
Copy-Item -Path "../ui/spacetimedbService.ts" -Destination "integration/" -Force
Copy-Item -Path "../ui/spacetimedbEnhanced.ts" -Destination "integration/" -Force
Copy-Item -Path "../ui/spacetimedbPlayerIntegration.ts" -Destination "integration/" -Force
Copy-Item -Path "../ui/spacetimedbTerrainIntegration.ts" -Destination "integration/" -Force

# Copy shader files
Copy-Item -Path "../../../src/shaders/wormhole.glsl" -Destination "shaders/" -Force
Copy-Item -Path "../../../src/shaders/modules/wormholeDistortion.glsl" -Destination "shaders/" -Force
Copy-Item -Path "../../../src/shaders/nebulaSmoke.frag" -Destination "shaders/" -Force

# Copy UI files
Copy-Item -Path "../ui/isolatedTerrainViewerSpacetimeActions.ts" -Destination "ui/" -Force
Copy-Item -Path "../ui/mainDebugPanel.ts" -Destination "ui/" -Force
Copy-Item -Path "../ui/types.ts" -Destination "ui/" -Force 