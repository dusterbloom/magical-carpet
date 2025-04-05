// Test script for terrain height caching

/**
 * This utility function can be used to test the terrain height caching system
 * by repeatedly querying heights at the same set of points and measuring performance.
 * 
 * Usage:
 * 1. Open the console in the game
 * 2. Copy and paste this function
 * 3. Call testTerrainHeightCache() to run the test
 */
function testTerrainHeightCache() {
  // Get reference to the world system
  const worldSystem = window.gameEngine.systems.world;
  
  if (!worldSystem) {
    console.error("World system not found! Make sure the game is initialized.");
    return;
  }
  
  // First, clear any existing cache
  if (typeof worldSystem.clearHeightCache === "function") {
    worldSystem.clearHeightCache();
    console.log("Cache cleared for testing.");
  } else {
    console.warn("Cache clearing function not found! Test may be inaccurate.");
  }
  
  // Grid of test points (10x10 grid around origin)
  const gridSize = 10;
  const spacing = 10;
  const testPoints = [];
  
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      testPoints.push({
        x: x * spacing,
        z: z * spacing
      });
    }
  }
  
  console.log(`Created ${testPoints.length} test points`);
  
  // Function to perform test
  function runTest(iterations) {
    const startTime = performance.now();
    
    // Query each point multiple times
    for (let i = 0; i < iterations; i++) {
      for (const point of testPoints) {
        worldSystem.getTerrainHeight(point.x, point.z);
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    return {
      iterations,
      points: testPoints.length,
      totalQueries: iterations * testPoints.length,
      duration: duration.toFixed(2) + "ms",
      queriesPerSecond: Math.floor((iterations * testPoints.length) / (duration / 1000))
    };
  }
  
  // Run tests with increasing iterations
  const tests = [
    { name: "Initial run (cache cold)", iterations: 1 },
    { name: "Small repeated run", iterations: 5 },
    { name: "Medium repeated run", iterations: 20 },
    { name: "Large repeated run", iterations: 100 }
  ];
  
  console.log("Starting terrain height cache tests...");
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    const results = runTest(test.iterations);
    console.table(results);
  }
  
  // Show cache statistics if available
  if (typeof worldSystem.getCacheStats === "function") {
    console.log("\n--- Cache Statistics ---");
    const stats = worldSystem.getCacheStats();
    console.table(stats);
  } else {
    console.warn("Cache statistics function not found!");
  }
  
  console.log("\nTests complete!");
}

// This function can be used to measure the real-world impact on terrain generation
function benchmarkTerrainGeneration() {
  const worldSystem = window.gameEngine.systems.world;
  
  if (!worldSystem) {
    console.error("World system not found!");
    return;
  }
  
  // Benchmark terrain chunk creation (with and without cache)
  function timeChunkCreation(x, z, useCache) {
    const startX = x * worldSystem.chunkSize;
    const startZ = z * worldSystem.chunkSize;
    
    if (!useCache) {
      // Clear cache before test
      worldSystem.clearHeightCache();
    }
    
    // Warm up JIT compiler
    const warmupStart = performance.now();
    const warmupGeometry = worldSystem.createChunkGeometry(startX, startZ);
    const warmupTime = performance.now() - warmupStart;
    console.log(`Warmup time: ${warmupTime.toFixed(2)}ms`);
    
    // Clear cache again if testing without cache
    if (!useCache) {
      worldSystem.clearHeightCache();
    }
    
    // Perform actual test
    const startTime = performance.now();
    const geometry = worldSystem.createChunkGeometry(startX, startZ);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    return {
      chunkPosition: `${x},${z}`,
      duration: duration.toFixed(2) + "ms",
      vertexCount: geometry.attributes.position.count,
      cacheMode: useCache ? "With Cache" : "Without Cache",
      cacheStats: useCache ? worldSystem.getCacheStats() : null
    };
  }
  
  // Run benchmarks
  console.log("Starting terrain generation benchmarks...");
  
  // Test multiple chunks
  const testChunks = [
    { x: 0, z: 0 },    // Origin chunk
    { x: 1, z: 0 },    // Adjacent chunk
    { x: 0, z: 1 },    // Adjacent chunk
    { x: -1, z: -1 }   // Diagonal chunk
  ];
  
  for (const chunk of testChunks) {
    console.log(`\n--- Testing chunk at (${chunk.x}, ${chunk.z}) ---`);
    
    // Test without cache first
    console.log("Without cache:");
    const withoutCache = timeChunkCreation(chunk.x, chunk.z, false);
    console.table(withoutCache);
    
    // Then test with cache
    console.log("With cache:");
    const withCache = timeChunkCreation(chunk.x, chunk.z, true);
    console.table(withCache);
    
    // Show improvement
    const improvement = (1 - (parseFloat(withCache.duration) / parseFloat(withoutCache.duration))) * 100;
    console.log(`Performance improvement: ${improvement.toFixed(2)}%`);
  }
  
  console.log("\nBenchmarks complete!");
}
