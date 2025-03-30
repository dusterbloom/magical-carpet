# Task: Fix Sun Position Rendering Issue

## 1. Task & Context
The sun is incorrectly rendering with a green line connecting it to the player. This issue appears to be caused by the sun's position being tied to the player's position rather than being fixed in world space following the proper day/night cycle.

**Files**:
- `C:\Users\PC\Desktop\magical-carpet\src\game\systems\AtmosphereSystem.js`

## 2. Quick Plan
1. Remove any code that ties the sun's position to the player
2. Fix the sun position calculation to properly follow the day/night cycle
3. Ensure the sun's position is consistent with the sunlight direction

**Complexity**: 2/3
**Uncertainty**: 1/3

## 3. Implementation
The issue is in the `AtmosphereSystem.js` file. The sun appears to be properly positioned in the `updateSkyColors` method, but there's an issue with the sun sphere position in the update method.

Looking at the code, we need to fix the sun sphere positioning by:
1. Removing the code that connects the sun to the player
2. Ensuring the sun follows a proper arc across the sky
3. Making sure the sun and sunlight positions are synchronized

## 4. Check & Commit
**Changes Made**:
- Completely redesigned the sun creation and positioning system to fix the following issues:
  1. Sun was following the camera instead of being fixed in world space
  2. Sun was too large and dominating the screen
  3. Sun had a green connecting line to the player (carpet)

- Key fixes:
  1. Prevented sky from following camera by removing the camera-tracking code
  2. Completely rebuilt the sun geometry with much smaller dimensions
  3. Fixed proper parent-child relationships to ensure sun stays in world space
  4. Added safety checks to ensure sun is a direct child of scene
  5. Drastically reduced sun scale to make it appear as a distant object
  6. Positioned sun much farther away in world coordinates
  7. Added proper logging to help debug sun positioning

**Commit Message**: 
"Fix sun positioning to follow proper day/night trajectory instead of being tied to player position"
