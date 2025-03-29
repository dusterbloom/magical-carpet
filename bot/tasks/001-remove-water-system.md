# Task: Remove Water System

## Task & Context
**What:** Remove all water-related code from the game, including the `WaterSystem`, `ShorelineEffect`, and any references to water throughout the codebase.

**Where:**
- `src/game/systems/WaterSystem.js` - Complete file removal
- `src/game/core/ShorelineEffect.js` - Complete file removal
- `src/game/core/Engine.js` - Remove import and references to water system
- `src/game/systems/WorldSystem.js` - Remove water-related code, references, and methods
- `WaterSurface/` directory - Complete directory removal
- `public/water/` directory - Complete directory removal

## Quick Plan
**How:**
1. Remove the `WaterSystem.js` and `ShorelineEffect.js` files
2. Remove water-related imports, initialization, and update code from `Engine.js`
3. Remove water-related code, references, and waterLevel settings from `WorldSystem.js`
4. Remove the `WaterSurface` directory
5. Remove the `public/water` directory

**Complexity:** 2/3 - Multiple files need modification with careful attention to dependencies

**Uncertainty:** 1/3 - Clear understanding of which code needs to be removed, but need to ensure we don't break any dependencies

## Implementation

### Step 1: Remove the WaterSystem.js and ShorelineEffect.js files

Removing `WaterSystem.js`:

```bash
rm src/game/systems/WaterSystem.js
```

Removing `ShorelineEffect.js`:

```bash
rm src/game/core/ShorelineEffect.js
```

### Step 2: Update Engine.js to remove water references

Modifications needed in `Engine.js`:
- Remove import of `WaterSystem` and `ShorelineEffect`
- Remove water system initialization
- Remove water system from initialization and update order
- Remove any water/shoreline effect rendering code

### Step 3: Update WorldSystem.js to remove water references

Modifications needed in `WorldSystem.js`:
- Remove waterLevel variable
- Remove water material creation
- Remove createWater method 
- Remove water references in other methods
- Update biome color determination to not reference water

### Step 4: Remove WaterSurface directory

```bash
rm -rf WaterSurface
```

### Step 5: Remove public/water directory

```bash
rm -rf public/water
```

## Check & Commit

**Changes to verify:**
- No more water visible in game
- No errors related to missing water systems
- Game runs smoothly without water references
- Terrain generates correctly without water considerations

**Commit message:**
```
Remove water system and references

- Removed WaterSystem.js and ShorelineEffect.js files
- Removed water imports, initialization, and updates from Engine.js
- Cleaned up waterLevel references and water-related code from WorldSystem.js
- Deleted WaterSurface directory and public/water assets
- Game now runs without any water features as required
```
