// Define a global function to access performance data
export function setupPerformanceTools() {
    window.getPerformanceReport = function() {
      if (window.gameEngine) {
        return window.gameEngine.getPerformanceReport();
      } else {
        console.error('Game engine not initialized yet');
        return null;
      }
    };
  }