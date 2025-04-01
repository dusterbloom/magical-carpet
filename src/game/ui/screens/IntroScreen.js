/**
 * IntroScreen.js
 * Displays the game intro screen with logo, game name, and play button
 */
import { useGameState, GameStates } from '../../state/gameState';
export class IntroScreen {
  constructor(engine) {
    this.engine = engine;
    this.container = document.createElement('div');
    this.visible = false;
    this.initialized = false;
    this.onPlayCallback = null;
  }
  
  /**
   * Initialize the intro screen
   */
  initialize() {
    // Create container
    this.container.id = 'intro-screen';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.background = 'url("/assets/bg.png") no-repeat center center';
    this.container.style.backgroundSize = 'cover';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.zIndex = '1000';
    this.container.style.pointerEvents = 'auto';
    this.container.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
    this.container.style.color = 'white';
    
    // Create logo
    const logoContainer = document.createElement('div');
    logoContainer.style.marginBottom = '20px';
    
    const logo = document.createElement('div');
    logo.style.width = '150px';
    logo.style.height = '150px';
    logo.style.display = 'flex';
    logo.style.justifyContent = 'center';
    logo.style.alignItems = 'center';
    
    // Use the crescent.png image instead of SVG
    const moonImage = document.createElement('img');
    moonImage.src = '/assets/crescent.png';
    moonImage.style.width = '140px';
    moonImage.style.height = 'auto';
    moonImage.style.filter = 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.5))';
    
    logo.appendChild(moonImage);
    logoContainer.appendChild(logo);
    
    // Create title
    const title = document.createElement('h1');
    title.textContent = 'Vibe Carpet';
    title.style.fontSize = '42px';
    title.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
    title.style.fontWeight = 'bold';
    title.style.color = '#FFFFFF'; // White color to match night sky theme
    title.style.marginBottom = '20px';
    title.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.7)'; // Gold shadow to match moon
    
    // Create multiplayer indicator
    const multiplayerIndicator = document.createElement('div');
    multiplayerIndicator.textContent = 'Multiplayer Edition';
    multiplayerIndicator.style.fontSize = '18px';
    multiplayerIndicator.style.marginBottom = '40px';
    multiplayerIndicator.style.display = 'none'; // Hide multiplayer edition text
    
    // Create play button
    const playButton = document.createElement('button');
    playButton.textContent = 'Start Journey';
    playButton.style.padding = '15px 40px';
    playButton.style.fontSize = '20px';
    playButton.style.backgroundColor = '#C87137';
    playButton.style.color = '#ffffff';
    playButton.style.border = 'none';
    playButton.style.borderRadius = '30px';
    playButton.style.cursor = 'pointer';
    playButton.style.pointerEvents = 'auto';
    playButton.style.fontWeight = 'bold';
    playButton.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
    playButton.style.transition = 'all 0.3s';
    
    // Hover effect
    playButton.addEventListener('mouseover', () => {
      playButton.style.transform = 'scale(1.05)';
      playButton.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.7)';
    });
    
    playButton.addEventListener('mouseout', () => {
      playButton.style.transform = 'scale(1)';
      playButton.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
    });
    
    // Click events for both mouse and touch
    playButton.addEventListener('click', handlePlayButtonPress);
    playButton.addEventListener('touchend', handlePlayButtonPress);
    
    const self = this;
    function handlePlayButtonPress(event) {
      // Prevent default to avoid double events
      event.preventDefault();
      console.log('Start Journey clicked');
      self.hide();
      
      // Delay showing controls until the exit animation completes
      setTimeout(() => {
        // Change game state to PLAYING
        useGameState.getState().setGameState(GameStates.PLAYING);
        
        // Call the play callback to start the game
        if (self.onPlayCallback) {
          console.log('Calling play callback');
          self.onPlayCallback();
        } else {
          console.warn('No play callback set for IntroScreen');
        }
      }, 500); // Match the 500ms transition from hide()
    }
    
    // Create server status indicator with green text for readability
    const serverStatus = document.createElement('div');
    serverStatus.style.display = 'none'; // Hide server status text completely
    serverStatus.style.marginTop = '30px';
    serverStatus.style.fontSize = '14px';
    serverStatus.style.opacity = '0.9';
    serverStatus.style.color = '#3a7d2d'; // Green text for better visibility on sand background
    this.serverStatus = serverStatus;
    
    // Append all elements (excluding server status)
    this.container.appendChild(logoContainer);
    this.container.appendChild(title);
    this.container.appendChild(multiplayerIndicator);
    this.container.appendChild(playButton);
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Hide by default
    this.container.style.display = 'none';
    this.initialized = true;
  }
  
  /**
   * Show the intro screen
   */
  show() {
    if (!this.initialized) {
      this.initialize();
    }
    
    this.container.style.display = 'flex';
    this.visible = true;
    
    // Add entrance animation
    this.container.style.opacity = '0';
    this.container.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      this.container.style.opacity = '1';
    }, 10);
  }
  
  /**
   * Hide the intro screen
   */
  hide() {
    if (!this.initialized || !this.visible) return;
    
    // Add exit animation
    this.container.style.opacity = '0';
    
    setTimeout(() => {
      this.container.style.display = 'none';
      this.visible = false;
    }, 500);
  }
  
  /**
   * Set callback for when play button is clicked
   * @param {Function} callback - Function to call when play is clicked
   */
  onPlay(callback) {
    this.onPlayCallback = callback;
  }
  
  /**
   * Update server status message
   * @param {string} message - Status message to show
   * @param {string} type - Type of message (info, success, error)
   */
  updateServerStatus(message, type = 'info') {
    if (!this.initialized) return;
    
    this.serverStatus.textContent = message;
    
    // Set color based on type
    switch (type) {
      case 'success':
        this.serverStatus.style.color = '#72e176';
        break;
      case 'error':
        this.serverStatus.style.color = '#ff6b6b';
        break;
      default:
        this.serverStatus.style.color = 'white';
        break;
    }
  }
}
