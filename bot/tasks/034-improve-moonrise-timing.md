# Task 034: Improve Moon Rise Timing

## 1. Task & Context
**Task:** Change moon rise timing from 18:15 to 21:30 and make it more realistic
**Scope:** MoonSystem.js in src/game/systems/atmosphere
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Modify MoonSystem to make moon rise timing independent of the sun, based on a lunar calendar, and ensuring it rises at 21:30 instead of 18:15.
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- How to determine the exact time-to-angle conversion
- How to properly implement occlusion with skybox
**Human Input Needed:** No

## 3. Implementation
Modified MoonSystem.js to improve moon rise timing and behavior by:

```js
// Define moon rise time (21:30 = 0.896 of day)
const moonRiseTime = 0.896;
// Define moonset time (approx 12 hours later, looping if needed)
const moonSetTime = (moonRiseTime + 0.5) % 1.0;

// Calculate time-based progress for moon's travel
let moonProgress;
if (moonRiseTime < moonSetTime) {
  // Simple case: rise and set within same day
  if (timeOfDay >= moonRiseTime && timeOfDay <= moonSetTime) {
    moonProgress = (timeOfDay - moonRiseTime) / (moonSetTime - moonRiseTime);
  } else {
    moonProgress = -1; // Moon below horizon
  }
} else {
  // Complex case: moon rises today, sets tomorrow
  if (timeOfDay >= moonRiseTime || timeOfDay <= moonSetTime) {
    // Calculate progress wrapping around midnight
    if (timeOfDay >= moonRiseTime) {
      moonProgress = (timeOfDay - moonRiseTime) / ((1.0 - moonRiseTime) + moonSetTime);
    } else {
      moonProgress = ((1.0 - moonRiseTime) + timeOfDay) / ((1.0 - moonRiseTime) + moonSetTime);
    }
  } else {
    moonProgress = -1; // Moon below horizon
  }
}
```

## 4. Check & Commit
**Changes Made:**
- Decoupled moon position from sun position (previously it was positioned roughly opposite to the sun)
- Set moonrise to occur at 21:30 (0.896 in the 0-1 time scale)
- Implemented proper above/below horizon determination
- Added occlusion check to prevent moon from appearing to set inside visible terrain chunks
- Implemented natural rise/set trajectory with proper wrapping around midnight
- Added moon phase-dependent positioning along north/south axis

**Commit Message:** [Task-034] Improve moon rise timing to start at 21:30 with natural trajectory

**Status:** Complete
