# Task: Fix Mountain Top Glitches

## Task & Context
The mountain tops have black spots where they should be white snow. This appears to be an issue with both the normals calculation and the rock exposure calculation at high elevations.

Files affected:
- `src/game/systems/WorldSystem.js` - The `computeSmoothedNormals` function and the `getBiomeColor` function

## Quick Plan
1. Analyze the mountain top rendering system in both normal calculation and color application
2. Fix the normal smoothing algorithm to better handle steep mountain peaks
3. Update the snow/rock blending logic for peaks to prevent dark spots
4. Make rock colors much lighter at high elevations and reduce rock exposure on mountaintops

Complexity: 2/3
Uncertainty: 2/3

## Implementation
The problem has two components that both need fixing to completely resolve the issue:

### 1. Normal Calculation Issues
The `computeSmoothedNormals` function was improved to:
- Add detection for high mountain peaks (above 340 units) with any downward-facing normals
- Apply stronger upward-normal blending at high elevations with an additional snow factor
- Ensure that no normals on peaks are downward-facing (negative Y)

```javascript
// Additional check for high mountain peaks with any downward facing normals
if (worldY > 340 && normalY < 0) {
  problematicVertices.add(i);
}

// Modified height factor calculation - stronger correction at higher elevation
const heightFactor = Math.min(1, (worldY - 200) / 200) * 0.5;

// Additional adjustment for peaks above snow line
const snowFactor = worldY > 340 ? 0.3 : 0;

// Apply stronger correction when we're at high elevations
const blendFactor = 0.5 + heightFactor + snowFactor;

// Ensure no downward-facing normals on peaks
if (worldY > 340 && tempNormals[vertexIndex].y < 0.1) {
  tempNormals[vertexIndex].y = 0.1;
  tempNormals[vertexIndex].normalize();
}
```

### 2. Rock Exposure and Color Issues
The more significant issue was in the `getBiomeColor` function for high elevations (the "PEAKS" section). 
The rock exposure calculation was allowing too much dark rock to appear on mountain tops, and the rock color itself was too dark.

Changes made:
1. Significantly reduced rock exposure at very high elevations with multiple factors:
   ```javascript
   // Significantly reduce rock exposure at very high elevations
   const exposureThresholdBase = 0.35;
   const highPeakReduction = Math.min(1.0, Math.pow(normalizedHeight * 2, 2)) * 0.3; // Stronger at peak
   const exposureThreshold = exposureThresholdBase - (heightCurve * 0.1) + highPeakReduction;
   
   // Add slope factor to reduce rock exposure on shallow slopes at high elevations
   const slopeReduction = height > 350 ? (1.0 - Math.min(1.0, slope * 2)) * 0.25 : 0;
   ```

2. Made the rock colors much lighter at high elevations to avoid black spots:
   ```javascript
   // Create rock color with height-dependent properties - MUCH lighter and less dark at peaks
   const rockColor = new THREE.Color(
     Math.max(0.5, 0.6 - adjustedHeight * 0.05), // Much lighter at peaks
     Math.max(0.48, 0.58 - adjustedHeight * 0.05), // Much lighter at peaks
     Math.max(0.52, 0.62 - adjustedHeight * 0.05) // Slightly bluer at higher elevations
   );
   ```

3. Added snow blending to rocks near the very top to ensure seamless transition:
   ```javascript
   // Blend with snow color at very high elevations to avoid stark contrast
   if (height > 360) {
     const snowBlendAmount = Math.min(1.0, (height - 360) / 30) * 0.7;
     const snowColor = new THREE.Color(0.92, 0.92, 0.96);
     rockColor.lerp(snowColor, snowBlendAmount);
   }
   ```

4. Limited the maximum rock exposure blending at high elevations:
   ```javascript
   // Heavy rock exposure with full transition - but limit max exposure blend at high elevations
   const maxExposureBlend = height > 360 ? 0.5 : 0.8;
   color.lerp(rockColor, rockExposure * maxExposureBlend);
   ```

## Check & Commit
The changes should eliminate the black spots on mountain tops through multiple approaches:

1. The normals themselves are now more consistently pointing upward at high elevations, which ensures proper lighting
2. Rock exposure has been significantly reduced on mountain peaks, especially on shallow slopes
3. Any rock that does still appear at high elevations is now much lighter in color, resembling snow-dusted rock
4. At the very highest elevations, rock colors are blended with snow colors to ensure smooth transitions

These combined changes should ensure that mountain tops appear consistently snow-covered, with natural transitions to rock on steep cliff faces. The fix preserves the dramatic terrain while eliminating the visual glitch of black spots on otherwise snowy peaks.
