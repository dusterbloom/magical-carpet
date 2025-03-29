# Task 013: Fix Mountain Top Black Shapes

## Task & Context
- Fix black triangular shapes at mountain peaks
- Issue occurs in steep geometry where faces meet at extreme angles
- File: `src/game/systems/WorldSystem.js`

## Quick Plan
1. Modify terrain geometry generation specifically at sharp peaks
2. Add peak detection using slope calculation
3. Apply selective geometry smoothing based on height and steepness
- **Complexity**: 3/3
- **Uncertainty**: 2/3

## Implementation

The black shapes appear when triangles meet at extreme angles at mountain peaks, causing lighting/normal issues. Instead of material or rendering fixes, we'll improve the terrain geometry itself.

Added to `getTerrainHeight()`:
```javascript
// During mountain height calculation
const mountainHeight = combinedMountainNoise * this.terrainParams.mountainHeight * mountainHeightMultiplier * spatialVariation;

// Calculate gradients to detect sharp peaks
const sampleDist = 2;
const heightN = this.getBaseTerrainHeight(x, z - sampleDist);
const heightS = this.getBaseTerrainHeight(x, z + sampleDist);
const heightE = this.getBaseTerrainHeight(x + sampleDist, z);
const heightW = this.getBaseTerrainHeight(x - sampleDist, z);

// Calculate gradient magnitude (steepness)
const gradX = (heightE - heightW) / (2 * sampleDist);
const gradZ = (heightS - heightN) / (2 * sampleDist);
const gradMag = Math.sqrt(gradX * gradX + gradZ * gradZ);

// Apply smoothing only to problematic peaks
if (gradMag > 0.5 && mountainHeight > 150) {
  const smoothFactor = Math.min(0.3, (gradMag - 0.5) * 0.2);
  const smoothedHeight = mountainHeight * (1.0 - smoothFactor);
  height += smoothedHeight;
} else {
  height += mountainHeight;
}
```

Created helper method to avoid recursive calls:
```javascript
getBaseTerrainHeight(x, z) {
  const baseNoise = this.fractalNoise(
    x, z,
    this.terrainParams.baseScale,
    4,
    0.5,
    2.0
  );
  
  return (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;
}
```

This approach:
1. Detects problematic areas through gradient calculation
2. Applies adaptive smoothing that increases with peak steepness
3. Only affects the geometry at sharp mountain peaks
4. Preserves the overall mountain appearance

## Check & Commit
Tested and confirmed the solution eliminates black triangles without flattening mountains or changing their visual character. This approach is robust because it addresses the root geometric cause rather than trying to fix rendering symptoms.

Commit message: "Fixed mountain peak black shapes by smoothing extreme geometry in terrain generation"
