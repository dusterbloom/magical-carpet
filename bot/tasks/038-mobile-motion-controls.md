# Task Template

## 1. Task & Context
**Task:** Enable device motion controls for mobile platforms
**Scope:** 
- PlayerInput.js - Add device motion controls
- UISystem.js - Add toggle UI in time controls menu
- InputManager.js - Add device orientation event listeners
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Implement device motion controls using DeviceOrientationEvent API, add a toggle UI element under the time icon to switch between control modes
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- How exactly the device orientation maps to carpet movement
- Whether the existing mobile controls implementation is complete
**Human Input Needed:** No

## 3. Implementation

✅ Implementation complete. The following changes have been made:

1. Updated InputManager.js to handle device orientation events and add calibration.
2. Added device motion controls to PlayerInput.js with appropriate sensitivity settings.
3. Added a toggle UI control in the time controls menu for enabling/disabling motion controls.

## 4. Check & Commit
**Changes Made:**
- Added device orientation event handling to InputManager.js
- Implemented motion-based control system in PlayerInput.js
- Added toggle UI element for motion controls in UISystem.js's time controls menu
- Made controls react to device tilt - forward/backward tilt controls altitude, left/right tilt controls turning

**Commit Message:** feat(controls): Add motion controls for mobile devices

**Status:** Complete
