/**
 * Emergency frontend patch to handle undefined date values
 */

// Wait for the page to load
window.addEventListener('DOMContentLoaded', function() {
  console.log('Applying emergency frontend patch for undefined dates');
  
  // Safely patch Date methods
  const originalToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      return originalToLocaleString.apply(this, arguments);
    } catch (e) {
      console.warn('Date formatting error caught by patch:', e);
      return 'N/A';
    }
  };
  
  // Patch other Date methods that might be used
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function() {
    try {
      return originalToLocaleDateString.apply(this, arguments);
    } catch (e) {
      console.warn('Date formatting error caught by patch:', e);
      return 'N/A';
    }
  };
  
  const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function() {
    try {
      return originalToLocaleTimeString.apply(this, arguments);
    } catch (e) {
      console.warn('Date formatting error caught by patch:', e);
      return 'N/A';
    }
  };
  
  // Global error handler to catch any missed date formatting errors
  window.addEventListener('error', function(event) {
    if (event.error && event.error.toString().includes('toLocaleString')) {
      console.warn('Caught date formatting error:', event.error);
      event.preventDefault();
    }
  });
  
  console.log('Frontend patch applied successfully');
});
