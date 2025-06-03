# Move core files
Move-Item -Path "SpacetimeDBManager.ts" -Destination "core/"
Move-Item -Path "SpacetimeDBManager.new.ts" -Destination "core/"
Move-Item -Path "config.ts" -Destination "core/"

# Move client files
Move-Item -Path "client/playerSync.ts" -Destination "client/"
Move-Item -Path "client/terrainSync.ts" -Destination "client/"
Move-Item -Path "client/network.ts" -Destination "client/"
Move-Item -Path "client/index.ts" -Destination "client/"

# Move utils files
Move-Item -Path "utils/EventManager.ts" -Destination "utils/"
Move-Item -Path "integrationUtils.ts" -Destination "utils/"
Move-Item -Path "legacyAdapter.ts" -Destination "utils/"

# Move types
Move-Item -Path "types.ts" -Destination "types/"

# Move integration files
Move-Item -Path "../ui/spacetimedbIntegration.ts" -Destination "integration/"
Move-Item -Path "../ui/spacetimedbService.ts" -Destination "integration/"
Move-Item -Path "../ui/spacetimedbEnhanced.ts" -Destination "integration/"
Move-Item -Path "../ui/spacetimedbPlayerIntegration.ts" -Destination "integration/"
Move-Item -Path "../ui/spacetimedbTerrainIntegration.ts" -Destination "integration/"

# Move shader files
Move-Item -Path "../../../src/shaders/wormhole.glsl" -Destination "shaders/"
Move-Item -Path "../../../src/shaders/modules/wormholeDistortion.glsl" -Destination "shaders/"
Move-Item -Path "../../../src/shaders/nebulaSmoke.frag" -Destination "shaders/"

# Move UI files
Move-Item -Path "../ui/isolatedTerrainViewerSpacetimeActions.ts" -Destination "ui/"
Move-Item -Path "../ui/mainDebugPanel.ts" -Destination "ui/"
Move-Item -Path "../ui/types.ts" -Destination "ui/" 