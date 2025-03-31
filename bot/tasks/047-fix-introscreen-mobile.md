# Task 047: Fix Introscreen Experience on Mobile

## Task & Context 
The IntroScreen needs improvements on mobile:
1. Hide UI controls (speed button, joystick, debug overlay) that should not appear on the intro screen
2. Fix the "Start Journey" button functionality - currently clicking it does nothing

Files involved:
- `src/game/ui/screens/IntroScreen.js` - The intro screen implementation
- `src/game/systems/player/PlayerInput.js` - Contains mobile controls setup
- `src/game/core/Engine.js` - Main engine that initializes the game

## Quick Plan
1. Modify the IntroScreen to properly hide mobile UI controls when visible (Complexity: 1, Uncertainty: 1)
2. Ensure the Start Journey button callback is working correctly (Complexity: 1, Uncertainty: 2)
3. Add a way to properly show mobile controls only after game starts (Complexity: 1, Uncertainty: 1)

## Implementation
The issue appears to be that the mobile controls are initialized immediately upon PlayerSystem initialization, rather than after the intro screen is closed.

1. Update the PlayerInput.js to hide controls initially and provide a method to show them
2. Modify IntroScreen.js to ensure the onPlay callback is properly triggering the game start
3. Connect these systems so controls appear only after starting the journey

## Check & Commit
- Verified mobile controls are hidden on the intro screen
- Verified Start Journey button now properly starts the game and shows controls
- No regression on desktop experience
