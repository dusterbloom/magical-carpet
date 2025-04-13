import { createStore } from 'zustand/vanilla';

/**
 * Define possible game states
 */
export const GameStates = {
  LOADING: 'LOADING',
  INTRO: 'INTRO',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
};

/**
 * Define allowed state transitions to prevent invalid state changes
 */
const ALLOWED_TRANSITIONS = {
  [GameStates.LOADING]: [GameStates.INTRO],
  [GameStates.INTRO]: [GameStates.PLAYING],
  [GameStates.PLAYING]: [GameStates.PAUSED],
  [GameStates.PAUSED]: [GameStates.PLAYING],
};

/**
 * Create the game state store
 */
// Create vanilla JS store (no React dependency)
const gameState = createStore((set, get) => ({
  // State
  currentState: GameStates.LOADING,
  previousState: null,
  stateEnteredAt: Date.now(),
  stateMetadata: {},
  
  // Action to change the game state
  setGameState: (newState, metadata = {}) => {
    const currentState = get().currentState;
    
    // Validate transition
    if (!ALLOWED_TRANSITIONS[currentState]?.includes(newState)) {
      console.warn(`Invalid transition from ${currentState} to ${newState}`);
      return false;
    }
    
    console.log(`Game State changing from ${currentState} to: ${newState}`);
    set({ 
      currentState: newState, 
      previousState: currentState,
      stateEnteredAt: Date.now(),
      stateMetadata: metadata
    });
    return true;
  },
  
  // Helper actions
  pauseGame: (reason = "user_paused") => {
    if (get().currentState === GameStates.PLAYING) {
      get().setGameState(GameStates.PAUSED, { reason });
    }
  },
  
  resumeGame: () => {
    if (get().currentState === GameStates.PAUSED) {
      get().setGameState(GameStates.PLAYING);
    }
  },
  
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
}));

// Export the store instance for direct usage
export const useGameState = {
  getState: () => gameState.getState(),
  setState: gameState.setState,
  subscribe: gameState.subscribe,
  destroy: gameState.destroy
};

// Helper selectors (operate on state directly, not as selector functions)
export const selectCurrentState = () => gameState.getState().currentState;
export const selectIsPlaying = () => gameState.getState().currentState === GameStates.PLAYING;
export const selectIsPaused = () => gameState.getState().currentState === GameStates.PAUSED;
