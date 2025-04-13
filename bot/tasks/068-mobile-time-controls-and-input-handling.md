# Task 068: Hide Time Controls on Mobile and Fix Concurrent Input on Mobile

## 1. Task & Context
**Task**: 
1. Hide the time controls when on mobile devices
2. Ensure boost and joystick inputs can work simultaneously on mobile as they do on desktop

**Context**: 
Working on the "slow-mode" branch in the magical-carpet project. Currently, the time controls are visible on mobile but take up valuable screen space. Also, there appears to be an issue where boost and joystick inputs don't work concurrently on mobile like they do on desktop.

## 2. Quick Plan
**How**:
1. Locate the time control UI components
2. Modify them to be hidden when on mobile devices using our device detection
3. Examine the input handling system to identify why concurrent inputs (boost + joystick) don't work on mobile
4. Update the input handling to support simultaneous inputs on mobile

**Complexity**: 2/3 - The UI visibility change is straightforward, but fixing input handling may require careful adjustment.
**Uncertainty**: 2/3 - We need to identify the root cause of the input handling difference between mobile and desktop.

## 3. Implementation
Based on our analysis, we need to make the following changes:

1. Hide time controls on mobile devices:
   - Modify the `createTimeControls()` method in UISystem.js to check for mobile devices and skip creating time controls
   - Update the `showGameUI()` and `showTimeControls()` methods to check for mobile devices before showing time controls

2. Fix simultaneous boost and joystick inputs on mobile:
   - Modify the `setupJoystickEvents()` method in PlayerInput.js to handle touch events differently
   - Only prevent default for touches that are specifically on the joystick element
   - Move event listeners from the joystick container to document.body for better touch tracking
   - Improve detection of joystick touches vs. other touches

First, let's modify UISystem.js to hide time controls on mobile:
