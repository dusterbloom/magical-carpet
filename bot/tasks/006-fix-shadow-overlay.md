# Task: Fix Dark Shadow Overlay Under Player

## Task & Context
When the game starts, there's a dark rectangular overlay visible under the player, creating an unnatural shadow effect across the terrain. This is visible in the screenshot as a color difference between the upper left and right sides.

**Files Affected:**
- `src/game/systems/player/PlayerModels.js`

## Quick Plan
1. Modify the carpet model shadow settings to prevent self-shadowing
2. Keep the carpets casting shadows but prevent them from receiving shadows

**Complexity: 1/3**
**Uncertainty: 1/3**

## Implementation
After examining the code, I've found that in `PlayerModels.js`, the carpet models are set to both cast and receive shadows:

```javascript
// Set up shadows
this.carpetModels.forEach(model => {
  model.castShadow = true;
  model.receiveShadow = true;
});
```

This causes the carpet to cast a shadow onto itself, creating the dark rectangular overlay seen in the game. 

The fix is to modify this code to:

```javascript
// Set up shadows
this.carpetModels.forEach(model => {
  model.castShadow = true;
  model.receiveShadow = false; // Changed from true to false
});
```

This way, the carpet will still cast shadows onto the terrain but won't receive shadows itself (including its own shadow), which should eliminate the dark rectangle effect.

## Check & Commit
This is a simple but effective change that should resolve the issue without affecting other game functionality. The carpet will still cast shadows normally, but won't create the unnatural self-shadowing effect.

Commit message: "Fix dark shadow overlay by preventing carpet from receiving shadows"