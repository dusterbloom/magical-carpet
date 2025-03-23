import { Engine } from './game/core/Engine';

// Debug info for mobile detection
function logDeviceInfo() {
  console.log('Device Detection Info:');
  console.log('- Touch Points:', navigator.maxTouchPoints);
  console.log('- ontouchstart:', 'ontouchstart' in window);
  console.log('- User Agent:', navigator.userAgent);
  console.log('- Screen Size:', window.innerWidth, 'x', window.innerHeight);
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Log device info
    logDeviceInfo();
    
    // Create and initialize game engine
    const engine = new Engine();
    await engine.initialize();
    
    console.log('Magical Vibe Carpet initialized successfully!');
  } catch (error) {
    console.error('Error initializing game:', error);
    document.getElementById('loading-text').textContent = 'Error loading game. Please refresh.';
  }
});
