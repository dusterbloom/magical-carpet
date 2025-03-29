# Task 016: Fix Missing Water ("H20 MIA")

## Task & Context
- **Files modified:** `src/game/systems/WaterSystem.js` 
- **Issue:** Water completely missing from the game world (H20 MIA)
- **Goal:** Restore water visibility in terrain depressions while maintaining z-fighting fix

## Quick Plan
- **Approach:** Adjust water level to be visible but avoid z-fighting
- **Complexity:** 1/3
- **Uncertainty:** 2/3

## Implementation

The core issue was that water was positioned too far below the terrain minimum height (-10 units). While this successfully eliminated z-fighting, it also made the water completely invisible within the terrain depressions.

Key changes:
1. **Repositioned water plane above terrain minimum**: Changed water level from `minHeight - 10` to `minHeight + 1.5` so it would be visible in terrain depressions
2. **Increased water color brightness**: Changed from `0x0077cc` to `0x0099ff` for better visibility
3. **Increased water opacity**: From 0.8 to 0.95 to ensure water is clearly visible
4. **Expanded water plane size**: From 25x to 40x chunk size to guarantee complete coverage
5. **Added debug visualization**: Red markers that show water level when 'D' key is pressed
6. **Added extensive logging**: To help diagnose water level and position issues

The key insight was finding the right balance: water needs to be above terrain minimum height to be visible in depressions, while still avoiding z-fighting with terrain at the shoreline.

## Check & Commit
The water is now clearly visible in terrain depressions with a bright blue color. The debug markers allow easy verification of water level position in the world. Additional logging helps diagnose any remaining issues.

This completes the restoration of the water system while maintaining the z-fighting fix from task 015.
