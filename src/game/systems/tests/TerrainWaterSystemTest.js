// TerrainWaterSystemTest.js
// Test suite for validating terrain generation, water system, and chunk transitions

/**
 * Validates terrain-water boundary consistency
 * Ensures:
 * 1. No z-fighting between water and terrain
 * 2. Proper grid alignment at boundaries
 * 3. Consistent height transitions between chunks
 */
export function testTerrainWaterBoundary(worldSystem, waterSystem) {
    const results = {
        zFightingDetected: false,
        gridAlignmentIssues: false,
        heightDiscontinuities: false,
        issues: []
    };

    // Test grid alignment and z-fighting at chunk boundaries
    function checkBoundaryPoint(x, z) {
        const height = worldSystem.getTerrainHeight(x, z);
        const waterLevel = waterSystem.waterLevel;
        
        // Check for z-fighting (heights too close together)
        if (Math.abs(height - waterLevel) < 0.1) {
            results.zFightingDetected = true;
            results.issues.push(`Z-fighting detected at (${x}, ${z}): terrain=${height}, water=${waterLevel}`);
        }

        // Check grid alignment
        const gridX = Math.floor(x / worldSystem.cacheResolution) * worldSystem.cacheResolution;
        const gridZ = Math.floor(z / worldSystem.cacheResolution) * worldSystem.cacheResolution;
        const deterministicNoise = Math.sin(gridX * 0.1) * Math.cos(gridZ * 0.1) * 0.01;
        
        // Verify water position matches terrain grid
        const waterPos = waterSystem.water.position;
        const expectedWaterY = waterLevel + deterministicNoise - 0.05;
        if (Math.abs(waterPos.y - expectedWaterY) > 0.001) {
            results.gridAlignmentIssues = true;
            results.issues.push(`Water grid misalignment at (${x}, ${z})`);
        }
    }

    // Test height continuity between chunks
    function checkChunkTransition(x1, z1, x2, z2) {
        const height1 = worldSystem.getTerrainHeight(x1, z1);
        const height2 = worldSystem.getTerrainHeight(x2, z2);
        
        // Check for sudden height changes at chunk boundaries
        if (Math.abs(height1 - height2) > 5) {
            results.heightDiscontinuities = true;
            results.issues.push(`Height discontinuity between (${x1}, ${z1}) and (${x2}, ${z2})`);
        }
    }

    // Test multiple points around chunk boundaries
    const chunkSize = worldSystem.chunkSize;
    const testOffsets = [-0.1, 0, 0.1]; // Test points near boundary
    
    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
            const baseX = x * chunkSize;
            const baseZ = z * chunkSize;
            
            // Check points near chunk boundaries
            testOffsets.forEach(offsetX => {
                testOffsets.forEach(offsetZ => {
                    const testX = baseX + offsetX;
                    const testZ = baseZ + offsetZ;
                    checkBoundaryPoint(testX, testZ);
                });
            });

            // Check transitions between chunks
            if (x < 1 && z < 1) {
                checkChunkTransition(
                    baseX + chunkSize - 0.1,
                    baseZ + chunkSize - 0.1,
                    baseX + chunkSize + 0.1,
                    baseZ + chunkSize + 0.1
                );
            }
        }
    }

    return results;
}

/**
 * Tests terrain height caching and consistency
 * Ensures:
 * 1. Cache hits/misses work correctly
 * 2. Heights are consistent when recalculated
 * 3. Grid quantization is working properly
 */
export function testTerrainGeneration(worldSystem) {
    const results = {
        cacheWorking: true,
        heightsConsistent: true,
        gridQuantizationCorrect: true,
        issues: []
    };

    // Clear cache for testing
    worldSystem.clearHeightCache();
    
    // Test grid of points
    const gridSize = 5;
    const spacing = worldSystem.cacheResolution * 2;
    const testPoints = [];
    
    // Generate test points
    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            testPoints.push({
                x: x * spacing,
                z: z * spacing
            });
        }
    }

    // First pass - calculate and cache heights
    const initialHeights = new Map();
    testPoints.forEach(point => {
        const height = worldSystem.getTerrainHeight(point.x, point.z);
        initialHeights.set(`${point.x},${point.z}`, height);
    });

    // Verify cache hits
    let cacheStats = worldSystem.getCacheStats();
    if (cacheStats.misses !== testPoints.length) {
        results.cacheWorking = false;
        results.issues.push(`Unexpected cache misses: ${cacheStats.misses} vs ${testPoints.length}`);
    }

    // Second pass - verify consistency and cache hits
    testPoints.forEach(point => {
        const height = worldSystem.getTerrainHeight(point.x, point.z);
        const initialHeight = initialHeights.get(`${point.x},${point.z}`);
        
        if (Math.abs(height - initialHeight) > 0.0001) {
            results.heightsConsistent = false;
            results.issues.push(`Height inconsistency at (${point.x}, ${point.z})`);
        }

        // Check grid quantization
        const gridX = Math.floor(point.x / worldSystem.cacheResolution) * worldSystem.cacheResolution;
        const gridZ = Math.floor(point.z / worldSystem.cacheResolution) * worldSystem.cacheResolution;
        const gridHeight = worldSystem.getTerrainHeight(gridX, gridZ);
        
        if (Math.abs(height - gridHeight) > 1.0) {
            results.gridQuantizationCorrect = false;
            results.issues.push(`Grid quantization issue at (${point.x}, ${point.z})`);
        }
    });

    // Verify all second passes were cache hits
    cacheStats = worldSystem.getCacheStats();
    if (cacheStats.misses !== testPoints.length) {
        results.cacheWorking = false;
        results.issues.push('Unexpected cache misses in second pass');
    }

    return results;
}

/**
 * Run all tests and report results
 */
export function runAllTests(worldSystem, waterSystem) {
    console.log('Starting terrain and water system tests...');
    
    const terrainResults = testTerrainGeneration(worldSystem);
    console.log('\nTerrain Generation Test Results:');
    console.log('Cache working:', terrainResults.cacheWorking);
    console.log('Heights consistent:', terrainResults.heightsConsistent);
    console.log('Grid quantization correct:', terrainResults.gridQuantizationCorrect);
    if (terrainResults.issues.length > 0) {
        console.log('Issues found:');
        terrainResults.issues.forEach(issue => console.log('-', issue));
    }

    const boundaryResults = testTerrainWaterBoundary(worldSystem, waterSystem);
    console.log('\nTerrain-Water Boundary Test Results:');
    console.log('Z-fighting detected:', boundaryResults.zFightingDetected);
    console.log('Grid alignment issues:', boundaryResults.gridAlignmentIssues);
    console.log('Height discontinuities:', boundaryResults.heightDiscontinuities);
    if (boundaryResults.issues.length > 0) {
        console.log('Issues found:');
        boundaryResults.issues.forEach(issue => console.log('-', issue));
    }

    return {
        terrain: terrainResults,
        boundary: boundaryResults,
        success: terrainResults.issues.length === 0 && boundaryResults.issues.length === 0
    };
}