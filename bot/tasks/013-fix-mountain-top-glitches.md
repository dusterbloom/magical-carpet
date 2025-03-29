# Task: Fix Mountain Top Glitches

## Task & Context
The mountain tops have black spots where they should be white snow. This appears to be a normals issue.

Files affected:
- `src/game/systems/WorldSystem.js` - The `computeSmoothedNormals` function needs improvement

## Quick Plan
1. Analyze the mountain top normals calculation in `computeSmoothedNormals`
2. Identify why some mountain top vertices have incorrect (possibly inverted) normals that appear black
3. Modify the normal smoothing algorithm to better handle steep mountain peaks
4. Ensure normal consistency at snow-covered mountain tops

Complexity: 2/3
Uncertainty: 2/3

## Implementation
The problem is in the `computeSmoothedNormals` function, which is responsible for calculating smooth normals for the terrain geometry. While the function already attempts to correct problematic normals on mountain peaks, some mountain tops still end up with black spots instead of white snow.

The issue appears to be that steep mountain peaks can have nearly horizontal normals that aren't being sufficiently corrected. When this happens at high altitudes, the snow isn't being properly applied because the normals don't reflect the upward-facing orientation that snow-covered areas should have.

The fix involves:
1. Improving the detection of problematic vertices at mountain peaks
2. Applying stronger upward-facing normal blending at high elevations
3. Ensuring more consistent normal handling, especially for nearly vertical faces

I'll modify the problematic vertices section of the `computeSmoothedNormals` function to better identify and handle mountain peaks.

```javascript
// Changes to the computeSmoothedNormals function in WorldSystem.js
// Find vertices with problematic normals (mountain peaks/sharp edges)
const problematicVertices = new Set();
for (let i = 0; i < vertexCount; i++) {
  // Check if this is a mountain peak (high altitude + nearly horizontal normal)
  const worldY = worldCoords.get(i).y;
  const normalY = tempNormals[i].y;
  
  // Identify sharper peaks at higher elevations with more horizontal normals
  if (worldY > 200 && Math.abs(normalY) < 0.5) {
    problematicVertices.add(i);
  }

  // Identify extremely sharp edges regardless of height
  if (Math.abs(normalY) < 0.2) {
    problematicVertices.add(i);
  }
  
  // NEW: Additional check for high mountain peaks with any downward facing normals
  if (worldY > 340 && normalY < 0) {
    problematicVertices.add(i);
  }
}

// Perform additional smoothing on problematic vertices
for (const vertexIndex of problematicVertices) {
  // Find neighboring vertices
  const neighbors = new Set();
  // ... existing neighbor finding code ...
  
  // Calculate smoothed normal from neighbors
  const smoothedNormal = new THREE.Vector3(0, 0, 0);
  for (const neighborIndex of neighbors) {
    smoothedNormal.add(tempNormals[neighborIndex].clone());
  }
  smoothedNormal.normalize();
  
  // Blend with an upward-facing normal proportional to the height
  // Higher elevations get more upward normal blending
  const worldY = worldCoords.get(vertexIndex).y;
  const upNormal = new THREE.Vector3(0, 1, 0);
  
  // NEW: Modified height factor calculation - stronger correction at higher elevation
  const heightFactor = Math.min(1, (worldY - 200) / 200) * 0.5;
  
  // NEW: Additional adjustment for peaks above snow line
  const snowFactor = worldY > 340 ? 0.3 : 0;
  
  // NEW: Apply stronger correction when we're at high elevations
  const blendFactor = 0.5 + heightFactor + snowFactor;
  
  // Apply smoothed normal with upward bias
  tempNormals[vertexIndex].copy(smoothedNormal).lerp(upNormal, blendFactor).normalize();
  
  // NEW: Ensure no downward-facing normals on peaks
  if (worldY > 340 && tempNormals[vertexIndex].y < 0.1) {
    tempNormals[vertexIndex].y = 0.1;
    tempNormals[vertexIndex].normalize();
  }
}
```

## Check & Commit
The changes specifically address the black spots on mountain tops by:

1. Adding a new detection case for high mountain peaks (above 340 units) with any downward-facing normals
2. Applying stronger upward-normal blending at high elevations based on height
3. Adding special handling for points above the snow line with an additional snow factor
4. Ensuring that no normals on peaks are downward-facing (negative Y)

These changes should make the snow on mountain tops appear more consistent, eliminating the black spots. The snow coverage will also look smoother and more natural.

The fix preserves the existing smoothed normals approach but adds additional special handling for the mountain peaks, particularly focusing on the high elevations where snow is present.
