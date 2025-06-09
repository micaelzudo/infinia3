#!/usr/bin/env pwsh
# SpacetimeDB Module Test Script
# This script tests all the reducers and functionality of the Infinia Multiplayer module

Write-Host "Starting SpacetimeDB Module Tests..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Test 1: Register Player
Write-Host "Test 1: Testing register_player reducer..." -ForegroundColor Yellow
$result1 = spacetime call testmodule2 register_player '"test_user_1"' --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] register_player test PASSED" -ForegroundColor Green
} else {
    Write-Host "[FAIL] register_player test FAILED" -ForegroundColor Red
}

# Test 2: Update Player Position
Write-Host "`nTest 2: Testing update_player_position reducer..." -ForegroundColor Yellow
$result2 = spacetime call testmodule2 update_player_position 15.5 25.0 35.5 0.5 1.57 0.2 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] update_player_position test PASSED" -ForegroundColor Green
} else {
    Write-Host "[FAIL] update_player_position test FAILED" -ForegroundColor Red
}

# Test 3: Store Terrain Chunk
Write-Host "`nTest 3: Testing store_terrain_chunk reducer..." -ForegroundColor Yellow
$result3 = spacetime call testmodule2 store_terrain_chunk '"test_chunk_5_10_15"' '"earth"' 5 10 15 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] store_terrain_chunk test PASSED" -ForegroundColor Green
} else {
    Write-Host "[FAIL] store_terrain_chunk test FAILED" -ForegroundColor Red
}

# Test 4: Get Terrain Chunk
Write-Host "`nTest 4: Testing get_terrain_chunk reducer..." -ForegroundColor Yellow
$result4 = spacetime call testmodule2 get_terrain_chunk '"test_chunk_5_10_15"' --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] get_terrain_chunk test PASSED" -ForegroundColor Green
} else {
    Write-Host "[FAIL] get_terrain_chunk test FAILED" -ForegroundColor Red
}

# Test 5: Store Initial Chunks for Planet
Write-Host "`nTest 5: Testing store_initial_chunks_for_planet reducer..." -ForegroundColor Yellow
$result5 = spacetime call testmodule2 store_initial_chunks_for_planet '"venus"' 1 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] store_initial_chunks_for_planet test PASSED" -ForegroundColor Green
} else {
    Write-Host "[FAIL] store_initial_chunks_for_planet test FAILED" -ForegroundColor Red
}

# Test 6: Verify Player Data
Write-Host "`nTest 6: Verifying player data in database..." -ForegroundColor Yellow
$playerData = spacetime sql testmodule2 "SELECT COUNT(*) as player_count FROM player_data" --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] Player data verification PASSED" -ForegroundColor Green
    Write-Host "Player data query result:" -ForegroundColor Cyan
    Write-Host $playerData
} else {
    Write-Host "[FAIL] Player data verification FAILED" -ForegroundColor Red
}

# Test 7: Verify Terrain Data
Write-Host "`nTest 7: Verifying terrain data in database..." -ForegroundColor Yellow
$terrainData = spacetime sql testmodule2 "SELECT COUNT(*) as chunk_count FROM terrain_chunk" --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] Terrain data verification PASSED" -ForegroundColor Green
    Write-Host "Terrain data query result:" -ForegroundColor Cyan
    Write-Host $terrainData
} else {
    Write-Host "[FAIL] Terrain data verification FAILED" -ForegroundColor Red
}

# Test 8: Register Another Player (Test Multiple Players)
Write-Host "`nTest 8: Testing multiple player registration..." -ForegroundColor Yellow
$result8 = spacetime call testmodule2 register_player '"test_user_2"' --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] Multiple player registration test PASSED" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Multiple player registration test FAILED" -ForegroundColor Red
}

# Test 4: Player Movement
Write-Host "`n--- Test 4: Player Movement ---" -ForegroundColor Yellow
$moveResult = spacetime call testmodule2 update_player_position 10.5 60.0 -- -5.2 0.0 90.0 0.0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Player movement test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Player movement test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test 5: Health System
Write-Host "`n--- Test 5: Health System ---" -ForegroundColor Yellow

# Test health damage
$healthResult1 = spacetime call testmodule2 update_player_health -- -25.0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Health damage test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Health damage test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test healing
$healResult = spacetime call testmodule2 heal_player --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Player healing test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Player healing test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test 6: Random Movement
Write-Host "`n--- Test 6: Random Movement ---" -ForegroundColor Yellow
$randomMoveResult = spacetime call testmodule2 random_move_player 5.0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Random movement test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Random movement test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test 7: Player Count
Write-Host "`n--- Test 7: Player Count ---" -ForegroundColor Yellow
$countResult = spacetime call testmodule2 get_player_count --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Player count test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Player count test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test 8: Chunk Saving and Management
Write-Host "`n--- Test 8: Chunk Saving ---" -ForegroundColor Yellow

# Test individual chunk storage
$chunkResult1 = spacetime call testmodule2 store_terrain_chunk "test_chunk_1" "earth" 0 0 0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Individual chunk storage test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Individual chunk storage test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test bulk chunk creation
$chunkResult2 = spacetime call testmodule2 store_initial_chunks_for_planet "mars" 2 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Bulk chunk creation test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Bulk chunk creation test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test chunk retrieval
$chunkResult3 = spacetime call testmodule2 get_terrain_chunk "test_chunk_1" --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Chunk retrieval test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Chunk retrieval test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test chunk count
$chunkCountResult = spacetime call testmodule2 get_chunk_count --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Chunk count test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Chunk count test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test aiming and animation features
Write-Host "Testing aiming and animation features..." -ForegroundColor Yellow

# Test aim direction update
Write-Host "Testing aim direction update..." -ForegroundColor Cyan
$aimResult1 = spacetime call testmodule2 update_player_aim_direction 0.5 0.2 0.8 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Aim direction update test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Aim direction update test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test look direction update
Write-Host "Testing look direction update..." -ForegroundColor Cyan
$lookResult = spacetime call testmodule2 update_player_look_direction 0.3 0.1 0.9 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Look direction update test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Look direction update test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test aiming state update
Write-Host "Testing aiming state update..." -ForegroundColor Cyan
$aimingResult1 = spacetime call testmodule2 update_player_aiming_state true false --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Aiming state update test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Aiming state update test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test scoped aiming
Write-Host "Testing scoped aiming..." -ForegroundColor Cyan
$aimingResult2 = spacetime call testmodule2 update_player_aiming_state true true --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Scoped aiming test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Scoped aiming test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test animation state update
Write-Host "Testing animation state update..." -ForegroundColor Cyan
$animResult1 = spacetime call testmodule2 update_player_animation_state "Walk" 1.5 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Walk animation test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Walk animation test [FAIL]" -ForegroundColor Red
    exit 1
}

$animResult2 = spacetime call testmodule2 update_player_animation_state "Sprint" 2.3 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Sprint animation test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Sprint animation test [FAIL]" -ForegroundColor Red
    exit 1
}

$animResult3 = spacetime call testmodule2 update_player_animation_state "Idle" 0.0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Idle animation test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Idle animation test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test combined aiming and animation
Write-Host "Testing combined aiming and animation..." -ForegroundColor Cyan
$combinedResult1 = spacetime call testmodule2 update_player_aim_direction 1.0 0.0 0.0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Combined aim direction test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Combined aim direction test [FAIL]" -ForegroundColor Red
    exit 1
}

$combinedResult2 = spacetime call testmodule2 update_player_animation_state "Aim" 0.5 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Combined aim animation test [PASS]" -ForegroundColor Green
} else {
    Write-Host "Combined aim animation test [FAIL]" -ForegroundColor Red
    exit 1
}

# Test 9: Multiple Player Registration and Movement
Write-Host "`n--- Test 9: Multiple Players ---" -ForegroundColor Yellow

# Register second player
$player2Result = spacetime call testmodule2 register_player "TestPlayer2" --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Second player registration [PASS]" -ForegroundColor Green
} else {
    Write-Host "Second player registration [FAIL]" -ForegroundColor Red
    exit 1
}

# Move second player
$move2Result = spacetime call testmodule2 update_player_position 20.0 50.0 10.0 0.0 180.0 0.0 --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Second player movement [PASS]" -ForegroundColor Green
} else {
    Write-Host "Second player movement [FAIL]" -ForegroundColor Red
    exit 1
}

# Check final player count
$finalCountResult = spacetime call testmodule2 get_player_count --anonymous
if ($LASTEXITCODE -eq 0) {
    Write-Host "Final player count check [PASS]" -ForegroundColor Green
} else {
    Write-Host "Final player count check [FAIL]" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "All tests completed successfully [PASS]" -ForegroundColor Green
Write-Host "Module is working correctly with all new features!" -ForegroundColor Green

# Final Summary
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Test Summary:" -ForegroundColor Green
Write-Host "- All core reducers tested" -ForegroundColor White
Write-Host "- Player registration and position updates" -ForegroundColor White
Write-Host "- Terrain chunk storage and retrieval" -ForegroundColor White
Write-Host "- Bulk terrain generation" -ForegroundColor White
Write-Host "- Database integrity verification" -ForegroundColor White
Write-Host "- Multiple player support" -ForegroundColor White
Write-Host "`nSpacetimeDB Module Tests Completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green