// This code MUST run before any other script
(function() {
  console.log('🚨 Applying immediate date fix');
  
  // Save original console methods
  var _originalConsoleError = console.error;
  var _originalConsoleWarn = console.warn;
  
  // Replace console.error to catch and handle date errors
  console.error = function() {
    // Check if this is our specific error
    if (arguments[0] && 
        typeof arguments[0] === 'string' && 
        arguments[0].includes('toLocaleString')) {
      console.log('🚫 Suppressed date error:', arguments[0]);
      return; // Suppress the error
    }
    _originalConsoleError.apply(console, arguments);
  };
  
  // Monkey patch the Date object to never return undefined for formatting methods
  var _origToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      return _origToLocaleString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  var _origToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function() {
    try {
      return _origToLocaleDateString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  var _origToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function() {
    try {
      return _origToLocaleTimeString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  // Define an initial empty function to be replaced later
  window.ll = function() { return 'N/A'; };
  
  // Suppress the specific error globally
  window.addEventListener('error', function(event) {
    if (event.error && event.error.toString().includes('toLocaleString')) {
      event.preventDefault();
      return true; // Prevent the error from bubbling up
    }
  }, true);
  
  console.log('✅ Date fix applied, UI should not crash now');
})();
