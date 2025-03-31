# Task Template

## 1. Task & Context
**Task:** Change the carpet trail to output two fading lines that have physics like airplane contrails in the sky
**Scope:** src/game/systems/CarpetTrailSystem.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Replace the existing particle and ribbon trails with two contrail lines that emit from the bottom left and right corners of the carpet, having physics that make them stay in place and gradually fade away.
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- Exact dimensions of the carpet model to position the contrail origin points correctly
- Best parameters for contrail physics and visual appearance
**Human Input Needed:** No

## 3. Implementation
I'll modify the CarpetTrailSystem.js file to:
1. Remove the existing ribbon trail, motion lines, and steam particles
2. Add new contrail functionality with two separate lines
3. Ensure the contrails have proper physics behavior (staying in place in the world)
4. Implement fading effect for the contrails

The implementation will:
- Track points for two separate contrail lines (left and right)
- Draw lines connecting these points
- Apply fading based on age of each line segment
- Adjust emission rate based on carpet speed

```javascript
import * as THREE from 'three';

export class CarpetTrailSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Contrail system
    this.leftContrailPoints = [];
    this.rightContrailPoints = [];
    this.maxContrailPoints = 100;
    this.leftContrailLine = null;
    this.rightContrailLine = null;
    this.contrailMaterial = null;
    this.emissionRate = 5; // points per second
    this.minSpeedForEmission = 10; // Minimum speed to emit contrails
    this.contrailLifespan = 6.0; // seconds
    this.contrailFadeStart = 3.0; // when contrails start to fade
    this.timeSinceLastEmission = 0;
    
    // Carpet dimensions for contrail positioning
    this.carpetWidth = 5;  // Based on the BoxGeometry in PlayerModels.js
    this.carpetLength = 8; // Based on the BoxGeometry in PlayerModels.js
  }
  
  // ... rest of implementation
}
```

## 4. Check & Commit
**Changes Made:**
- Removed existing ribbon, particle, and steam effects
- Implemented two contrail lines emanating from carpet bottom corners
- Added physics to make contrails stay in place while fading over time
- Adjusted fading and emission parameters for visual appeal

**Commit Message:** feat: implement airplane-like contrail effects from carpet corners

**Status:** Complete

**Implemented Features:**
- Created airplane-like contrail effects from the bottom corners of the carpet
- Implemented smooth curves using CatmullRomCurve3 for natural trail appearance
- Added speed-dependent trail persistence (faster speed = longer-lasting trails)
- Made trails only appear when spacebar is pressed (boost mode)
- Created natural fading effect where trails gradually fade from end to start
