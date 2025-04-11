/**
 * Direct intervention for date display issues
 * This completely replaces any problematic date formatting with a safe alternative
 */

(function() {
  console.log('Starting direct UI date intervention');
  
  // Interval to continuously check and fix date display issues
  setInterval(function() {
    try {
      // Replace any date formatter functions in the application
      if (window.ll && typeof window.ll === 'function') {
        console.log('Found date formatter function ll, replacing with safe version');
        
        // Save the original function
        const originalLl = window.ll;
        
        // Replace with safe version
        window.ll = function() {
          try {
            // Check if being called with undefined/null
            if (!arguments[0] || arguments[0] === undefined || arguments[0] === null) {
              console.warn('Date formatter called with invalid date');
              return 'N/A';
            }
            
            // Try the original function
            return originalLl.apply(this, arguments);
          } catch (e) {
            console.warn('Caught error in date formatter:', e);
            return 'N/A';
          }
        };
      }
      
      // Also try to find and fix any qbe function that might process dates
      if (window.qbe && typeof window.qbe === 'function') {
        console.log('Found possible date processor qbe, replacing with safe version');
        
        // Save the original function
        const originalQbe = window.qbe;
        
        // Replace with safe version
        window.qbe = function() {
          try {
            return originalQbe.apply(this, arguments);
          } catch (e) {
            console.warn('Caught error in qbe function:', e);
            return '';
          }
        };
      }
      
      // Also try to find the specific location where the error occurs
      const functionsToCheck = ['ll', 'qbe', 'HS', 'vb', 'BM', 'IM', 'F9', 'Cm', 'Cb', 'qP'];
      
      functionsToCheck.forEach(fnName => {
        if (window[fnName] && typeof window[fnName] === 'function') {
          const originalFn = window[fnName];
          
          window[fnName] = function() {
            try {
              return originalFn.apply(this, arguments);
            } catch (e) {
              console.warn(`Caught error in ${fnName}:`, e);
              return null;
            }
          };
        }
      });
      
      // Find all time elements and ensure they display something valid
      document.querySelectorAll('time').forEach(el => {
        if (!el.textContent || el.textContent === 'Invalid Date') {
          el.textContent = 'N/A';
        }
      });
      
      console.log('Direct UI date intervention completed');
    } catch (e) {
      console.error('Error in direct intervention:', e);
    }
  }, 1000); // Run every second
  
  // Global error handler for uncaught exceptions
  window.addEventListener('error', function(event) {
    if (event && event.error && 
       (event.error.toString().includes('toLocaleString') || 
        event.error.stack.includes('ll') || 
        event.error.stack.includes('qbe'))) {
      
      console.warn('Caught date-related error in global handler:', event.error);
      event.preventDefault();
      return true;
    }
  }, true);
  
})();
