import { Engine } from './game/core/Engine';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Create and initialize game engine
    const engine = new Engine();
    
    // Expose engine globally for debugging and performance monitoring
    window.gameEngine = engine;
    
    await engine.initialize();
    
    console.log('Magical Vibe Carpet initialized successfully!');
    console.log('Use window.getPerformanceReport() to view performance metrics');
  } catch (error) {
    console.error('Error initializing game:', error);
    document.getElementById('loading-text').textContent = 'Error loading game. Please refresh.';
  }
});
