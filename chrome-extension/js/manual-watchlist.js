/**
 * Add token to watchlist manually from the watchlist tab
 */
function addManualTokenToWatchlist() {
  const tokenAddress = watchlistTokenInput.value.trim();
  
  // Show error if no address provided
  if (!tokenAddress) {
    watchlistErrorMessage.textContent = 'Please enter a token address';
    watchlistErrorMessage.style.display = 'block';
    return;
  }
  
  // Clear any previous errors
  watchlistErrorMessage.style.display = 'none';
  
  // Validate token address format
  if (!validateInput(tokenAddress)) {
    watchlistErrorMessage.textContent = 'Invalid token address format';
    watchlistErrorMessage.style.display = 'block';
    return;
  }
  
  // Show loading state
  watchlistLoading.style.display = 'flex';
  
  // First, check if the token is already in the watchlist
  chrome.runtime.sendMessage({
    action: 'isTokenInWatchlist',
    address: tokenAddress
  }, (response) => {
    if (response && response.exists) {
      watchlistLoading.style.display = 'none';
      watchlistErrorMessage.textContent = 'This token is already in your watchlist';
      watchlistErrorMessage.style.display = 'block';
      return;
    }
    
    // If not in watchlist, check the token with the API
    chrome.runtime.sendMessage({
      action: 'checkToken',
      address: tokenAddress
    }, (response) => {
      watchlistLoading.style.display = 'none';
      
      if (response && response.success) {
        const tokenData = response.data;
        
        // Add token to watchlist
        chrome.runtime.sendMessage({
          action: 'addToWatchlist',
          token: {
            address: tokenData.address,
            name: tokenData.name || 'Unknown Token',
            symbol: tokenData.symbol || 'Unknown',
            riskLevel: tokenData.risk_level || 'Unknown',
            riskScore: tokenData.risk_score || 0,
            isRug: tokenData.is_rug || false
          }
        }, (addResponse) => {
          if (addResponse && addResponse.success) {
            // Clear input field
            watchlistTokenInput.value = '';
            
            // Show success message
            watchlistErrorMessage.textContent = 'Token added to watchlist successfully';
            watchlistErrorMessage.style.display = 'block';
            watchlistErrorMessage.style.backgroundColor = '#d1fae5';
            watchlistErrorMessage.style.color = '#065f46';
            
            // Reset the message after a delay
            setTimeout(() => {
              watchlistErrorMessage.style.display = 'none';
              watchlistErrorMessage.style.backgroundColor = '#fee2e2';
              watchlistErrorMessage.style.color = '#b91c1c';
            }, 3000);
            
            // Refresh the watchlist
            loadWatchlist();
          }
        });
      } else {
        watchlistErrorMessage.textContent = 'Error checking token: ' + (response?.error || 'Unknown error');
        watchlistErrorMessage.style.display = 'block';
      }
    });
  });
}

// Add event listeners for manual token addition - but wait until the main popup.js has finished loading
setTimeout(function() {
  const watchlistTokenInput = document.getElementById('watchlist-token-input');
  const addToWatchlistManualButton = document.getElementById('add-to-watchlist-manual');
  const watchlistErrorMessage = document.getElementById('watchlist-error-message');
  const watchlistLoading = document.getElementById('watchlist-loading');
  
  // Get references to tab elements again to make sure they're properly initialized
  const tabButtons = document.querySelectorAll('.tab-button');
  
  // Ensure tab switching works by re-attaching event listeners
  tabButtons.forEach(button => {
    // Remove any existing click listeners to avoid duplicates
    button.replaceWith(button.cloneNode(true));
  });
  
  // Re-get the buttons after replacing them
  const refreshedTabButtons = document.querySelectorAll('.tab-button');
  refreshedTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update active tab button
      refreshedTabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      
      // Show the corresponding tab content
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
  
  // Now set up the manual watchlist feature
  if (addToWatchlistManualButton) {
    addToWatchlistManualButton.addEventListener('click', addManualTokenToWatchlist);
  }
  
  if (watchlistTokenInput) {
    watchlistTokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addManualTokenToWatchlist();
      }
    });
  }
}, 100); // Short delay to ensure main script has initialized