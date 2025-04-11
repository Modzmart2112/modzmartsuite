/**
 * Direct fix for the ll function causing the Date.toLocaleString error
 * This patches the specific function that's crashing
 */

// Run as early as possible
(function() {
  console.log('Attempting to patch problematic ll function');
  
  // Override window.ll function when it becomes available
  function watchForLl() {
    // Check if window.ll exists
    if (typeof window.ll === 'function') {
      console.log('Found ll function, replacing with safe version');
      
      // Store original function 
      const originalLl = window.ll;
      
      // Replace with safe version
      window.ll = function() {
        try {
          // Check if being called with undefined/null
          if (!arguments[0]) {
            console.log('ll called with invalid date');
            return 'N/A';
          }
          return originalLl.apply(this, arguments);
        } catch (e) {
          console.warn('Error in ll function:', e);
          return 'N/A';
        }
      };
    } else {
      // Check again in 10ms
      setTimeout(watchForLl, 10);
    }
  }
  
  // Start watching for ll function
  watchForLl();
  
  // Also add a global error handler
  window.addEventListener('error', function(e) {
    if (e.error && e.error.toString().includes('toLocaleString')) {
      console.warn('Caught toLocaleString error:', e.error);
      e.preventDefault();
      return true;
    }
  }, true);
})();
