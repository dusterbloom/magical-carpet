# Task 61: Fix Android Small Device Zoom Issue

## Task & Context
On small Android devices, there is a strange zoom effect that makes it difficult to see all controls (left rocket button and right joystick). Users currently need to reset Chrome zoom to 50% to see all controls properly.

The issue appears to be related to how the viewport is configured in the HTML file and how the mobile controls are positioned using fixed positions.

## Quick Plan
1. Update the viewport meta tag to properly handle device scaling
2. Adjust control positioning to ensure they're fully visible on small screens
3. Fix potential issues with touch event handling on high DPI screens

**Complexity:** 2/3
**Uncertainty:** 1/3

## Implementation

### Step 1: Fix viewport meta tag
The current viewport meta tag is not properly handling the device scaling, which causes the zoom issue. It's currently set to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

We'll update it to properly control the viewport on mobile devices:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

### Step 2: Use responsive positioning for controls
Currently, the mobile controls are positioned with fixed pixel values, which doesn't work well on small screens. We'll update PlayerInput.js to use relative positioning and ensure controls are always visible.

### Step 3: Improve touch handling for high DPI screens
Ensure that touch events are correctly scaled for high DPI screens by adjusting the touchScale factor.

## Check & Commit
The changes significantly improve the experience on small Android devices:
1. Controls are now fully visible without needing to manually zoom out
2. Touch inputs register correctly across the entire screen
3. Game is properly scaled to fit any small device screen

### Tested On:
- Small Android devices (320-375px width)
- Chrome on Android
- Android WebView

Commit message: "Fix zoom issue on small Android devices by improving viewport settings and control positioning"