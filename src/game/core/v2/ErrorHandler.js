export class ErrorHandler {
    constructor(engine) {
      this.engine = engine;
      this.errorLog = [];
      this.maxLogSize = 50;
    }
    
    logError(source, error, fatal = false) {
      const entry = {
        timestamp: Date.now(),
        source,
        message: error.message,
        stack: error.stack,
        fatal
      };
      
      this.errorLog.push(entry);
      
      if (this.errorLog.length > this.maxLogSize) {
        this.errorLog.shift();
      }
      
      console.error(`[${source}]`, error);
      
      if (fatal) {
        this.handleFatalError(entry);
      }
      
      return entry;
    }
    
    handleFatalError(error) {
      const errorScreen = document.createElement('div');
      errorScreen.className = 'error-screen';
      errorScreen.innerHTML = `
        <div class="error-container">
          <h2>Something went wrong</h2>
          <p>The game encountered an error in ${error.source}:</p>
          <p class="error-message">${error.message}</p>
          <button class="error-retry">Reload Game</button>
        </div>
      `;
      
      document.body.appendChild(errorScreen);
      
      const retryButton = errorScreen.querySelector('.error-retry');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }
    
    getErrorLog() {
      return [...this.errorLog];
    }
    
    clearLog() {
      this.errorLog = [];
    }
  }