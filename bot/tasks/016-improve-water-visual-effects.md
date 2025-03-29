# Task 016: Improve Water Visual Effects

## Task & Context
- **Files to modify:** `src/game/systems/WaterSystem.js` and `src/game/systems/WorldSystem.js`
- **Current state:** Water appears as a flat blue plane positioned 10 units below terrain minimum
- **Goal:** Create visually appealing water with enhanced effects while maintaining performance

## Quick Plan
**Complexity: 2/3** - Requires shader modifications and height-based effects
**Uncertainty: 2/3** - Need to ensure performance and compatibility with terrain system

1. Add wave animation and reflective properties to water
2. Introduce height-based fog/atmospheric effects for depth perception
3. Create smoother shoreline transitions with biome-specific colors
4. Add speed-based visual feedback (wake effects, ripples)

## Implementation

### 1. Enhanced Water Material
Replace the basic material with a custom shader material that:
- Implements subtle wave animation using time-based vertex displacement
- Adds reflective properties based on viewing angle
- Introduces color variation based on depth and biome

### 2. Atmospheric Effects
- Add height-based fog density to create sense of altitude
- Implement distance-based color shift for improved depth perception
- Create mist/spray effects near water surface when flying at low altitudes

### 3. Improved Shoreline
- Add foam/splash effects at water/land boundary
- Create smoother color transitions at shorelines based on terrain biome
- Implement subtle shore wave animations

### 4. Speed Effects
- Introduce speed-dependent water deformation (wake) when flying low
- Add particle effects (spray) when moving fast over water
- Create subtle ripple patterns that respond to movement direction

## Code Changes
The implementation requires:
1. Updating the `WaterSystem.js` to implement the enhanced water shader
2. Modifying `WorldSystem.js` to better integrate with water effects
3. Adding speed-dependent visual feedback triggered by player movement

## Check & Commit
The improvements should:
- Maintain stable performance even on lower-end systems
- Eliminate any flickering or visual artifacts
- Create visually pleasing effects that enhance the flying experience
- Work well with the existing height and biome system
