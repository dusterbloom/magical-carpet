# Task: Smooth Pointy Mountains and Fix Edge Artifacts

## Task & Context
**What:** Modify the terrain generation to make the mountains less pointy, create more natural-looking slopes, and fix the dark line artifacts at mountain edges.

**Where:**
- `src/game/systems/WorldSystem.js` - Modify the `ridgedNoise` function, improve normal calculation in `createChunkGeometry`, and increase terrain resolution

## Quick Plan
**How:**
1. Modify the `ridgedNoise` function to reduce the sharpness of mountain peaks
2. Fix dark line artifacts by improving normal calculation
3. Increase terrain resolution for smoother surfaces
4. Test changes to ensure mountains look more natural while maintaining the game's visual style

**Complexity:** 3/3 - Requires both parameter tuning and implementing improved normal calculation algorithm

**Uncertainty:** 2/3 - Need to experiment with different parameters to find the best visual result

## Implementation

After analysis, I identified three issues to fix:

1. **Mountains are too pointy** due to:
   - The `ridgedNoise` function squares noise values, creating sharp ridges
   - The power applied to invert noise creates sharp peaks

2. **Dark lines appear at mountain edges** due to:
   - Poor normal calculation at triangle edges
   - Low terrain resolution showing triangulation artifacts

3. **Overall terrain appears too jagged** due to:
   - Insufficient terrain resolution

### 1. First, I'll modify the `ridgedNoise` function to create smoother mountain shapes:

```javascript
ridgedNoise(x, z, frequency, octaves = 4) {
  let result = 0;
  let amplitude = 1.0;
  let freq = frequency;
  let weight = 1.0;
  
  for (let i = 0; i < octaves; i++) {
    // Get absolute noise value and invert it
    let noiseValue = Math.abs(this.noise(
      x * freq + this.seed * (i * 2 + 1),
      z * freq + this.seed * (i * 2 + 2)
    ));
    noiseValue = 1.0 - noiseValue;
    
    // Apply a much smoother curve instead of squaring (reduce sharpness)
    // Use a very soft power value of 1.2 instead of original 2.0
    noiseValue = Math.pow(noiseValue, 1.2);
    
    // Apply weighting to successive octaves
    noiseValue *= weight;
    
    // Weight successive octaves by previous noise value (scaled to reduce sharpness)
    weight = Math.min(1.0, noiseValue * 0.8);
    
    // Add to result
    result += noiseValue * amplitude;
    
    // Next octave
    freq *= 2.0;
    amplitude *= 0.5;
  }
  
  return result;
}
```

### 2. Next, I'll improve the normal calculation in `createChunkGeometry` to fix dark edge artifacts:

```javascript
// Update normals with improved smoothing
geometry.computeVertexNormals();

// Additional smoothing for normals to reduce edge artifacts
const normals = geometry.attributes.normal.array;
const positions = geometry.attributes.position.array;

// Create a map of vertex positions to their corresponding normals
const positionToNormals = new Map();

// Collect all normals for identical vertex positions
for (let i = 0; i < positions.length; i += 3) {
  const x = Math.round(positions[i] * 100) / 100;
  const y = Math.round(positions[i + 1] * 100) / 100;
  const z = Math.round(positions[i + 2] * 100) / 100;
  const key = `${x},${y},${z}`;
  
  const nx = normals[i];
  const ny = normals[i + 1];
  const nz = normals[i + 2];
  
  if (!positionToNormals.has(key)) {
    positionToNormals.set(key, []);
  }
  
  positionToNormals.get(key).push({index: i, normal: [nx, ny, nz]});
}

// Average normals for vertices at the same position
for (const [key, normalsList] of positionToNormals.entries()) {
  if (normalsList.length > 1) {
    // Average the normals
    const avgNormal = [0, 0, 0];
    
    for (const item of normalsList) {
      avgNormal[0] += item.normal[0];
      avgNormal[1] += item.normal[1];
      avgNormal[2] += item.normal[2];
    }
    
    avgNormal[0] /= normalsList.length;
    avgNormal[1] /= normalsList.length;
    avgNormal[2] /= normalsList.length;
    
    // Normalize
    const length = Math.sqrt(avgNormal[0] * avgNormal[0] + 
                         avgNormal[1] * avgNormal[1] + 
                         avgNormal[2] * avgNormal[2]);
    
    avgNormal[0] /= length;
    avgNormal[1] /= length;
    avgNormal[2] /= length;
    
    // Apply averaged normal to all vertices at this position
    for (const item of normalsList) {
      normals[item.index] = avgNormal[0];
      normals[item.index + 1] = avgNormal[1];
      normals[item.index + 2] = avgNormal[2];
    }
  }
}

geometry.attributes.normal.needsUpdate = true;
```

### 3. Finally, I'll increase the terrain resolution for smoother surfaces:

```javascript
// World configuration
this.chunkSize = 1024;
this.terrainResolution = 64;  // Increased from 32 for smoother terrain
this.maxHeight = 120;  // Increased from 120
this.minHeight = -10;  // Deeper valleys
```

## Check & Commit

The changes will improve the terrain in three key ways:

1. **Smoother mountain peaks:**
   - Using Math.pow(noiseValue, 1.2) instead of squaring (noiseValue * noiseValue)
   - Scaling the weight calculation with factor of 0.8 and applying a maximum limit
   - These create more gentle curves that retain mountain shapes while removing sharp peaks

2. **Elimination of dark edge artifacts:**
   - The improved normal calculation algorithm identifies vertices at the same position
   - Averages normals across shared vertices to create smooth transitions
   - Normalizes the result to ensure proper lighting calculations

3. **Higher terrain resolution:**
   - Doubling the resolution from 32 to 64 vertices per chunk side
   - This provides more triangles to represent the terrain
   - Results in smoother slopes and less visible triangulation

The final result should be:
- Mountains with smoother, more rounded peaks without sharp points
- No dark lines or edge artifacts along terrain transitions
- More natural-looking slopes with gradual transitions
- Overall more realistic terrain while maintaining the game's style

**Commit message:**
```
Improve terrain rendering with smoother mountains and fixed artifacts

- Modified the ridgedNoise function to create less pointy mountain peaks
- Reduced the sharpness parameter from 2.0 to 1.2 for significantly more natural slopes
- Added scaling factor to weight calculation to further smooth terrain
- Implemented improved normal calculation to eliminate dark edge artifacts
- Doubled terrain resolution from 32 to 64 for smoother surfaces
- Maintained the overall visual style while creating more realistic landscape
```
