/**
 * IntroScreen.js
 * Displays the game intro screen with logo, game name, and play button
 */
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
    this.container.style.backgroundColor = '#E5D3B3';
    this.container.style.backgroundImage = 'linear-gradient(45deg, #D9C09F, #F0E6D2)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.zIndex = '1000';
    this.container.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
    this.container.style.color = 'white';
    
    // Create logo
    const logoContainer = document.createElement('div');
    logoContainer.style.marginBottom = '20px';
    
    const logo = document.createElement('div');
    logo.style.width = '150px';
    logo.style.height = '150px';
    logo.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    logo.style.borderRadius = '50%';
    logo.style.display = 'flex';
    logo.style.justifyContent = 'center';
    logo.style.alignItems = 'center';
    logo.style.boxShadow = '0 0 50px rgba(139, 69, 19, 0.5)';
    
    // Create inner logo with a magic carpet icon
    const innerLogo = document.createElement('div');
    // innerLogo.style.width = '120px';
    // innerLogo.style.height = '120px';
    // innerLogo.style.borderRadius = '50%';
    // innerLogo.style.background = 'linear-gradient(135deg, #2255a4, #4f7cac)';
    // innerLogo.style.display = 'flex';
    // innerLogo.style.justifyContent = 'center';
    // innerLogo.style.alignItems = 'center';
    
    // Add simple carpet icon
    innerLogo.innerHTML = `
<svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
  <circle cx="70" cy="70" r="70" fill="#F5F0E6"/>
  <g transform="translate(35, 20)">
    <!-- Simple, clean carpet design -->
    <rect x="10" y="10" width="50" height="80" rx="3" fill="#C87137" stroke="#A05A2C" stroke-width="1.5"/>
    
    <!-- Minimalist carpet patterns -->
    <path d="M15 30 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M15 45 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M15 60 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M15 75 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    
    <!-- Rolled top -->
    <path d="M10 10 Q35 5 60 10 V15 Q35 10 10 15 Z" fill="#A05A2C"/>
  </g>
</svg>
    `;
    
    logo.appendChild(innerLogo);
    logoContainer.appendChild(logo);
    
    // Create title
    const title = document.createElement('h1');
    title.textContent = 'Vibe Carpet';
    title.style.fontSize = '42px';
title.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
title.style.fontWeight = 'bold';
title.style.color = '#8B4513'; // Dark brown color to match Image 3
    title.style.marginBottom = '20px';
    title.style.textShadow = '0 0 10px rgba(139, 69, 19, 0.7)'; // Brown shadow matching logo
    
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
    playButton.style.backgroundColor = '#8B4513';
    playButton.style.color = '#ffffff';
    playButton.style.border = 'none';
    playButton.style.borderRadius = '30px';
    playButton.style.cursor = 'pointer';
    playButton.style.fontWeight = 'bold';
    playButton.style.boxShadow = '0 0 20px rgba(139, 69, 19, 0.5)';
    playButton.style.transition = 'all 0.3s';
    
    // Hover effect
    playButton.addEventListener('mouseover', () => {
      playButton.style.transform = 'scale(1.05)';
      playButton.style.boxShadow = '0 0 30px rgba(139, 69, 19, 0.7)';
    });
    
    playButton.addEventListener('mouseout', () => {
      playButton.style.transform = 'scale(1)';
      playButton.style.boxShadow = '0 0 20px rgba(139, 69, 19, 0.5)';
    });
    
    // Click event
    playButton.addEventListener('click', () => {
      this.hide();
      // Show time UI when game starts
      if (this.engine.systems.ui && this.engine.systems.ui.showTimeControls) {
        this.engine.systems.ui.showTimeControls();
      }
      if (this.onPlayCallback) {
        this.onPlayCallback();
      }
    });
    
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
