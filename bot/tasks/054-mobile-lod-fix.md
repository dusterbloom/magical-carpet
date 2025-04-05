# Task: Fix Inefficient Water Reflection Toggling

## 1. Task & Context
**Task:** Refactor the water reflection toggling mechanism to be efficient, preventing performance hitches when quality levels change on mobile devices.
**Scope:**
    - `src/game/systems/WaterSystem.js`
    - `src/game/core/MobileLODManager.js`
**Branch:** slow-mode

**Problem Context:**
The `MobileLODManager` was attempting to disable/enable water reflections based on performance by triggering a quality setting change. This, in turn, caused the entire `WaterSystem` to destroy and recreate the complex `THREE.Water` object, resulting in significant frame drops and garbage collection stalls, negating the benefit of the optimization.

## 2. Quick Plan
**Approach:**
1.  Modify `WaterSystem` to include an internal state flag (`reflectionsEnabled`) and a method (`setReflectionEnabled`) to efficiently toggle reflections without object recreation.
2.  Achieve the toggle by conditionally skipping the reflection rendering steps within a wrapped `onBeforeRender` method.
3.  Update `MobileLODManager` to call the new `waterSystem.setReflectionEnabled()` method directly when quality adjustments dictate a change in reflection status, removing the inefficient object recreation pathway.

**Complexity:** 2/3 (Requires understanding `THREE.Water` internals and function wrapping)
**Uncertainty:** 1/3 (Solution is validated and working)
**Unknowns:** None.
**Human Input Needed:** No.

## 3. Implementation

**`WaterSystem.js` Changes:**

1.  **Added State:** Introduced `this.reflectionsEnabled` boolean flag, initialized based on platform (defaulting to `false` on mobile, `true` otherwise).
2.  **Added `setReflectionEnabled(enabled)` Method:** This public method simply updates the `reflectionsEnabled` flag. It does *not* recreate the water object.
3.  **Wrapped `onBeforeRender`:**
    *   Stored the original `THREE.Water` `onBeforeRender` function during `createWater`.
    *   Assigned a new wrapper function to `this.water.onBeforeRender`.
    *   Inside the wrapper:
        *   It first checks the `this.reflectionsEnabled` flag.
        *   If `true`: It performs the necessary checks for sun visibility in reflections (enabling/disabling layer 10 on the reflection camera) and then calls the *original* `onBeforeRender` function using `.call(this.water, ...)` to maintain the correct context.
        *   If `false`: It *skips* calling the original `onBeforeRender`, effectively disabling the reflection rendering pass for that frame. It also ensures the sun layer is disabled on the reflection camera.
4.  **Cleaned `update` Method:** Removed the per-frame mobile hacks (forcing color, zero matrix) as they are no longer necessary with the efficient toggle.
5.  **Updated `dispose`:** Ensured the original `onBeforeRender` is restored when the system is disposed.

**`MobileLODManager.js` Changes:**

1.  **Modified `updateQualityBasedOnLevel`:** Instead of setting `currentWaterReflectionEnabled` and relying on subsequent recreation logic, it now directly calls `this.engine.systems.water.setReflectionEnabled(true/false)` based on the target `qualityLevel`.
2.  **Removed Inefficient Logic:** Deleted the code block in `updateLODSettings` that previously checked `currentWaterReflectionEnabled`, called `engine.settings.setQuality`, and indirectly triggered the costly water recreation in `WaterSystem`.

## 4. Check & Commit

**Changes Made:**
- Implemented an efficient, state-based reflection toggle within `WaterSystem` using `onBeforeRender` wrapping.
- Updated `MobileLODManager` to use the new `waterSystem.setReflectionEnabled()` method for quality adjustments.
- Removed the performance-killing water object recreation logic triggered by the LOD manager.
- Cleaned up redundant mobile-specific hacks in `WaterSystem.update`.

**Verification:**
- [x] Water reflections correctly enable/disable based on performance adjustments triggered by `MobileLODManager`.
- [x] Toggling reflections on/off occurs *without* significant frame drops, stuttering, or visible hitches.
- [x] Sun visibility logic within reflections (using layer 10) still functions correctly when reflections *are* enabled.
- [x] Water appearance remains correct (appropriate color, no artifacts) when reflections are disabled.
- [x] Overall mobile performance stability during quality shifts is improved.

**Commit Message:** Mobile LOD fix