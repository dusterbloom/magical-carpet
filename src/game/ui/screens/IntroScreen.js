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
    this.container.style.backgroundColor = 'rgba(18, 0, 82, 0.95)';
    this.container.style.backgroundImage = 'linear-gradient(45deg, #120052, #7b2cbf)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.zIndex = '1000';
    this.container.style.fontFamily = 'Arial, sans-serif';
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
    logo.style.boxShadow = '0 0 50px rgba(224, 170, 255, 0.5)';
    
    // Create inner logo with a magic carpet icon
    const innerLogo = document.createElement('div');
    innerLogo.style.width = '120px';
    innerLogo.style.height = '120px';
    innerLogo.style.borderRadius = '50%';
    innerLogo.style.background = 'linear-gradient(135deg, #e0aaff, #7b2cbf)';
    innerLogo.style.display = 'flex';
    innerLogo.style.justifyContent = 'center';
    innerLogo.style.alignItems = 'center';
    
    // Add simple carpet icon
    innerLogo.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 18C3 16.3431 4.34315 15 6 15H18C19.6569 15 21 16.3431 21 18V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V18Z" fill="#e0aaff"/>
        <path d="M5 15V9C5 6.79086 6.79086 5 9 5H15C17.2091 5 19 6.79086 19 9V15" stroke="white" stroke-width="2"/>
        <path d="M4 18.5H20" stroke="#7b2cbf" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 2"/>
      </svg>
    `;
    
    logo.appendChild(innerLogo);
    logoContainer.appendChild(logo);
    
    // Create title
    const title = document.createElement('h1');
    title.textContent = 'Magical Vibe Carpet';
    title.style.fontSize = '36px';
    title.style.marginBottom = '20px';
    title.style.textShadow = '0 0 10px rgba(224, 170, 255, 0.7)';
    
    // Create multiplayer indicator
    const multiplayerIndicator = document.createElement('div');
    multiplayerIndicator.textContent = 'Multiplayer Edition';
    multiplayerIndicator.style.fontSize = '18px';
    multiplayerIndicator.style.marginBottom = '40px';
    multiplayerIndicator.style.color = '#e0aaff';
    
    // Create play button
    const playButton = document.createElement('button');
    playButton.textContent = 'Start Journey';
    playButton.style.padding = '15px 40px';
    playButton.style.fontSize = '20px';
    playButton.style.backgroundColor = '#e0aaff';
    playButton.style.color = '#120052';
    playButton.style.border = 'none';
    playButton.style.borderRadius = '30px';
    playButton.style.cursor = 'pointer';
    playButton.style.fontWeight = 'bold';
    playButton.style.boxShadow = '0 0 20px rgba(224, 170, 255, 0.5)';
    playButton.style.transition = 'all 0.3s';
    
    // Hover effect
    playButton.addEventListener('mouseover', () => {
      playButton.style.transform = 'scale(1.05)';
      playButton.style.boxShadow = '0 0 30px rgba(224, 170, 255, 0.7)';
    });
    
    playButton.addEventListener('mouseout', () => {
      playButton.style.transform = 'scale(1)';
      playButton.style.boxShadow = '0 0 20px rgba(224, 170, 255, 0.5)';
    });
    
    // Click event
    playButton.addEventListener('click', () => {
      this.hide();
      if (this.onPlayCallback) {
        this.onPlayCallback();
      }
    });
    
    // Create server status indicator
    const serverStatus = document.createElement('div');
    serverStatus.textContent = 'Connecting to server...';
    serverStatus.style.marginTop = '30px';
    serverStatus.style.fontSize = '14px';
    serverStatus.style.opacity = '0.7';
    this.serverStatus = serverStatus;
    
    // Append all elements
    this.container.appendChild(logoContainer);
    this.container.appendChild(title);
    this.container.appendChild(multiplayerIndicator);
    this.container.appendChild(playButton);
    this.container.appendChild(serverStatus);
    
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
