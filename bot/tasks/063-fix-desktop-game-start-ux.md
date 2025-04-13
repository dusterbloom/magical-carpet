# Task 063: Fix Desktop Game Start UX

## Context
When a user clicks "Start Journey" on desktop, the mouse pointer gets locked but the game doesn't fully start. The user has to press ESC to regain control of the mouse, making the game unplayable without workarounds. The issue is related to:

1. InputManager is requesting pointer lock on any document click
2. IntroScreen's "Start Journey" button is causing an invalid state transition (PLAYING to PLAYING)
3. Pointer lock is being acquired but the game isn't properly transitioning to gameplay

## Plan
1. Fix the IntroScreen to properly handle game state transitions - Complexity: 2, Uncertainty: 1 
2. Modify the InputManager to not request pointer lock during the intro screen - Complexity: 2, Uncertainty: 1

Total complexity: 4/6 - Implementation required adaptation for ES modules.

## Implementation

### 1. Updated IntroScreen.js
Modified the handlePlayButtonPress function to:
- Check if game is already in PLAYING state before attempting transition
- Stop propagation of the click event to prevent InputManager from also trying to acquire pointer lock
- Added clearer logging for game state transitions

```javascript
function handlePlayButtonPress(event) {
  // Prevent default to avoid double events
  event.preventDefault();
  // Stop propagation to prevent the document click handler from also firing
  event.stopPropagation();
  
  console.log('Start Journey clicked');
  
  // Get current game state
  const gameStateManager = useGameState.getState();
  const currentState = gameStateManager.currentState;
  
  // Only proceed if we're not already in PLAYING state
  if (currentState === GameStates.PLAYING) {
    console.log('Game already in PLAYING state, ignoring button click');
    return;
  }
  
  // Hide the intro screen
  self.hide();
  
  // Delay showing controls until the exit animation completes
  setTimeout(() => {
    // Change game state to PLAYING
    gameStateManager.setGameState(GameStates.PLAYING);
    
    // Call the play callback to start the game
    if (self.onPlayCallback) {
      console.log('Calling play callback');
      self.onPlayCallback();
    } else {
      console.warn('No play callback set for IntroScreen');
    }
  }, 500); // Match the 500ms transition from hide()
}
```

### 2. Updated InputManager.js  
Added import for gameState at the top of the file:

```javascript
// Import game state
import { useGameState, GameStates } from '../state/gameState.js';

export class InputManager {
  // ...
}
```

Modified the requestPointerLock function to check game state:

```javascript
requestPointerLock() {
  // Don't request pointer lock on touch devices
  if (this.isTouchDevice) return;

  // Don't request if already locked or requesting
  if (this.pointerLocked || this.pointerLockRequested) return;
  
  try {
    // Only request pointer lock when in PLAYING state
    const currentState = useGameState.getState().currentState;
    if (currentState !== GameStates.PLAYING) {
      console.log(`Not requesting pointer lock - game state is ${currentState}`);
      return;
    }

    // Only request pointer lock if we're in a user gesture and PLAYING state
    if (document.body.requestPointerLock) {
      console.log('Requesting pointer lock for gameplay');
      this.pointerLockRequested = true;
      document.body.requestPointerLock();
    }
  } catch (error) {
    console.warn('Pointer lock request failed:', error);
    this.pointerLockRequested = false;
  }
}
```

Updated document click handler:

```javascript
// Pointer lock for camera control - bind a specialized handler that checks game state
document.addEventListener('click', (event) => {
  try {
    // Don't request pointer lock from button clicks or UI elements
    if (event.target.tagName === 'BUTTON' || 
        event.target.closest('#intro-screen') ||
        event.target.closest('#ui-container')) {
      return;
    }
    
    // Only proceed with pointer lock if we're in PLAYING state
    const currentState = useGameState.getState().currentState;
    
    if (currentState === GameStates.PLAYING) {
      this.requestPointerLock();
    } else {
      console.log(`Click ignored for pointer lock - not in PLAYING state (${currentState})`);
    }
  } catch (error) {
    console.warn('Error checking game state for pointer lock:', error);
  }
});
```

### 3. Updated gameState.js
Added a new method to force game state changes in emergency situations:

```javascript
// Force a game state change regardless of allowed transitions
// Only use this for critical situations or recovery from errors
forceGameState: (newState, metadata = {}) => {
  const currentState = get().currentState;
  console.log(`Forcing game state from ${currentState} to: ${newState}`);
  set({ 
    currentState: newState, 
    previousState: currentState,
    stateEnteredAt: Date.now(),
    stateMetadata: {...metadata, forced: true}
  });
  return true;
}
```

### 4. Updated Engine.js
Modified the game start callback to ensure pointer lock is properly requested:

```javascript
// Set callback for when play button is clicked
this.introScreen.onPlay(() => {
  console.log("Game started from intro screen");
  this.gameStarted = true;
  
  // Explicitly request pointer lock now that we're in PLAYING state
  // This helps ensure consistent behavior across different devices
  setTimeout(() => {
    if (this.input && !this.input.isTouchDevice) {
      console.log("Auto-requesting pointer lock for gameplay");
      // Instead of calling the method directly, just simulate a click on the game area
      // This will trigger the existing click handler which has the proper game state checks
      this.canvas.click();
    }
  }, 300); // Increased timeout to ensure game state has fully updated
});
```

## Check & Commit
- Fixed variable reference (this.input instead of this.inputManager) in Engine.js
- Fixed module imports for gameState.js with proper ES module import syntax
- Added direct import of game state at the top of InputManager.js instead of dynamic imports
- Cleaned up the gameState check in the click handler
- Fixed the event propagation in the IntroScreen click handler
- Increased timeout for requesting pointer lock to ensure game state is fully updated
- Added additional error handling to prevent game crashes
