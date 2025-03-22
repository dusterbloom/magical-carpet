import { Engine } from './game/core/Engine';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Create and initialize game engine
    const engine = new Engine();
    await engine.initialize();
    
    console.log('Magical Vibe Carpet initialized successfully!');
  } catch (error) {
    console.error('Error initializing game:', error);
    document.getElementById('loading-text').textContent = 'Error loading game. Please refresh.';
  }
});
