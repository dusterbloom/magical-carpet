# Task 008: Improve Vegetation System - Natural Distribution

## Task & Context
- **What**: Improve the vegetation system to make it more natural without increasing complexity
- **Where**: The issue is in the vegetation distribution - trees exist but there are no forests in mountains or smaller clusters in plains
- **Files**: `src/game/systems/VegetationSystem.js`

## Quick Plan
1. Implement biome-based vegetation distribution to create natural clustering
2. Add vegetation density variations using multi-octave noise
3. Create forest clusters and sparse regions via natural noise patterns
- **Complexity**: 2/3
- **Uncertainty**: 2/3

## Implementation

The current vegetation system places trees somewhat randomly but doesn't create natural clustering patterns like forests in mountains or vegetation groups in plains. We'll improve this with the following approach:

1. **Enhance the `shouldPlaceTree` method**:
   - Use multi-octave noise to create areas with varying tree density
   - Add biome-specific tree placement rules
   - Create natural clusters with higher density in appropriate regions

2. **Add biome awareness to tree placement**:
   - Use temperature and moisture data from WorldSystem for realistic biome placement
   - Add correlation between terrain height, slope and tree types/density
   - Create proper tree clustering in appropriate biomes

3. **Implement improved distribution patterns**:
   - Create forest clusters in mountains with pine trees
   - Add sparse tree distribution in plains with oak trees
   - Define unique distribution patterns for each biome type
   - Use noise at multiple scales for realistic variation

4. **Optimize the tree placement algorithm**:
   - Make better use of noise functions to create natural patterns
   - Ensure performance remains good with the improved system
   - Keep the system simple but effective

## Check & Commit
- Vegetation now appears in natural clusters and forests
- Mountains have appropriate forest distribution
- Plains have natural tree clusters and sparse areas
- No increase in system complexity or performance impact
- Commit message: "Improved vegetation system with natural distribution patterns for forests and clusters"