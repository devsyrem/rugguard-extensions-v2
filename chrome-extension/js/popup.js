/**
 * RugGuard - Popup Script
 * Handles the extension popup UI
 */

// DOM elements
const tokenInput = document.getElementById('token-input');
const checkButton = document.getElementById('check-button');
const errorMessage = document.getElementById('error-message');
const loadingElement = document.getElementById('loading');
const currentTokenElement = document.getElementById('current-token');
const tokenNameElement = document.getElementById('token-name');
const riskBadgeElement = document.getElementById('risk-badge');
const tokenAddressElement = document.getElementById('token-address');
const tokenSymbolRow = document.getElementById('token-symbol-row');
const tokenSymbolElement = document.getElementById('token-symbol');
const riskScoreRow = document.getElementById('risk-score-row');
const riskScoreElement = document.getElementById('risk-score');
const viewOnRugcheckLink = document.getElementById('view-on-rugcheck');
const addToWatchlistButton = document.getElementById('add-to-watchlist');
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');
const clearHistoryButton = document.getElementById('clear-history');

// Watchlist elements
const watchlistContainer = document.getElementById('watchlist-container');
const emptyWatchlist = document.getElementById('empty-watchlist');
const clearWatchlistButton = document.getElementById('clear-watchlist');
const monitorStatusElement = document.getElementById('monitor-status');
const watchlistTokenInput = document.getElementById('watchlist-token-input');
const addToWatchlistManualButton = document.getElementById('add-to-watchlist-manual');
const watchlistErrorMessage = document.getElementById('watchlist-error-message');
const watchlistLoading = document.getElementById('watchlist-loading');

// Tab navigation elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Current token data
let currentToken = null;

// Event handlers
checkButton.addEventListener('click', checkCurrentUrl);
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    checkCurrentUrl();
  }
});
clearHistoryButton.addEventListener('click', clearHistory);
clearWatchlistButton.addEventListener('click', clearWatchlist);
addToWatchlistManualButton.addEventListener('click', addManualTokenToWatchlist);
watchlistTokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addManualTokenToWatchlist();
  }
});
addToWatchlistButton.addEventListener('click', addCurrentTokenToWatchlist);

// Tab navigation
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    
    // Update active tab button
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Show the corresponding tab content
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // If switching to watchlist tab, refresh the watchlist
    if (tabName === 'watchlist') {
      loadWatchlist();
    }
  });
});

// Load token history and watchlist on popup open
loadTokenHistory();
loadWatchlist();

// Check if there's a current URL in the active tab
getCurrentTabUrl();

/**
 * Get the current tab URL
 */
function getCurrentTabUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      const url = tabs[0].url;
      const tokenAddress = extractTokenAddressFromUrl(url);
      
      if (tokenAddress) {
        tokenInput.value = url;
      }
    }
  });
}

/**
 * Check the current URL or token address input
 */
function checkCurrentUrl() {
  const input = tokenInput.value.trim();
  
  if (!input) {
    showError('Please enter a token address or URL');
    return;
  }
  
  // Clear previous data
  hideError();
  currentTokenElement.style.display = 'none';
  loadingElement.style.display = 'flex';
  
  // Check if input is a URL
  let tokenAddress = input;
  if (input.startsWith('http')) {
    tokenAddress = extractTokenAddressFromUrl(input);
    
    if (!tokenAddress) {
      loadingElement.style.display = 'none';
      showError('Could not find a token address in the provided URL');
      return;
    }
  } else if (!validateInput(input)) {
    loadingElement.style.display = 'none';
    showError('Please enter a valid Solana token address or URL');
    return;
  }
  
  // Check token with background script
  chrome.runtime.sendMessage(
    { action: 'checkToken', address: tokenAddress },
    function(response) {
      loadingElement.style.display = 'none';
      
      if (response && response.success && response.data) {
        updateTokenInfo(response.data);
        currentTokenElement.style.display = 'block';
      } else {
        showError(response?.error || 'Failed to check token');
      }
      
      // Refresh token history
      loadTokenHistory();
    }
  );
}

/**
 * Extract token address from various URL formats
 */
function extractTokenAddressFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;
    const pathParts = pathname.split('/').filter(part => part);
    
    // For Raydium URLs
    if (hostname.includes('raydium.io')) {
      const inputMint = parsedUrl.searchParams.get('inputMint') || parsedUrl.searchParams.get('inputCurrency');
      const outputMint = parsedUrl.searchParams.get('outputMint') || parsedUrl.searchParams.get('outputCurrency');
      
      if (outputMint && outputMint.toLowerCase() !== 'sol') {
        return outputMint;
      } else if (inputMint && inputMint.toLowerCase() !== 'sol') {
        return inputMint;
      } else if ((inputMint && inputMint.toLowerCase() === 'sol') || 
                 (outputMint && outputMint.toLowerCase() === 'sol')) {
        return 'So11111111111111111111111111111111111111112'; // Wrapped SOL
      }
    }
    // For Meteora URLs
    else if (hostname.includes('meteora.ag')) {
      if ((pathParts[0] === 'swap' || pathParts[0] === 'pool') && pathParts.length >= 2) {
        return pathParts[1];
      }
      
      const tokenParam = parsedUrl.searchParams.get('token') || 
                         parsedUrl.searchParams.get('inputToken') || 
                         parsedUrl.searchParams.get('outputToken');
      if (tokenParam && tokenParam.toLowerCase() !== 'sol') {
        return tokenParam;
      }
    }
    // For Pump.fun URLs
    else if (hostname.includes('pump.fun')) {
      if (pathParts[0] === 'pump' && pathParts.length >= 2) {
        return pathParts[1];
      }
      
      const tokenParam = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('address');
      if (tokenParam) {
        return tokenParam;
      }
    }
    // For Fluxbeam URLs
    else if (hostname.includes('fluxbeam.xyz')) {
      // Direct address format (fluxbeam.xyz/ADDRESS)
      if (pathParts.length === 1 && pathParts[0].length >= 32) {
        return pathParts[0];
      }
      // Standard format with /swap/ or /pool/
      else if ((pathParts[0] === 'swap' || pathParts[0] === 'pool') && pathParts.length >= 2) {
        return pathParts[1];
      }
      
      // Check query parameters
      const tokenParam = parsedUrl.searchParams.get('inputToken') || 
                         parsedUrl.searchParams.get('outputToken') || 
                         parsedUrl.searchParams.get('token');
      if (tokenParam && tokenParam.toLowerCase() !== 'sol') {
        return tokenParam;
      }
    }
    // For RugCheck URLs
    else if (hostname.includes('rugcheck.xyz')) {
      if (pathParts[0] === 'tokens' && pathParts.length >= 2) {
        return pathParts[1];
      }
    }
    
    // Handle direct token addresses
    if (validateInput(url)) {
      return url;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing URL:', error);
    
    // Handle direct token addresses
    if (validateInput(url)) {
      return url;
    }
    
    return null;
  }
}

/**
 * Validate token address input
 */
function validateInput(input) {
  // Simple validation for Solana addresses (should be base58 and around 32-44 chars)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
}

/**
 * Update token information in the UI
 */
function updateTokenInfo(token) {
  // Store current token
  currentToken = token;
  
  // Set token details
  tokenNameElement.textContent = token.name || 'Unknown Token';
  tokenAddressElement.textContent = token.address;
  viewOnRugcheckLink.href = `https://rugcheck.xyz/tokens/${token.address}`;
  
  // Set risk badge
  let riskBadgeClass = 'token-badge-unknown';
  riskBadgeElement.textContent = token.risk_level || 'Unknown';
  
  if (token.is_rug) {
    riskBadgeElement.textContent = 'RUG PULL';
    riskBadgeClass = 'token-badge-danger';
  } else if (token.risk_level) {
    const riskLevel = token.risk_level.toLowerCase();
    if (riskLevel === 'safe') {
      riskBadgeClass = 'token-badge-safe';
    } else if (riskLevel === 'warning') {
      riskBadgeClass = 'token-badge-warning';
    } else if (riskLevel === 'danger') {
      riskBadgeClass = 'token-badge-danger';
    }
  }
  
  riskBadgeElement.className = `token-badge ${riskBadgeClass}`;
  
  // Set symbol if available
  if (token.symbol) {
    tokenSymbolElement.textContent = token.symbol;
    tokenSymbolRow.style.display = 'flex';
  } else {
    tokenSymbolRow.style.display = 'none';
  }
  
  // Set risk score if available
  if (token.risk_score) {
    riskScoreElement.textContent = token.risk_score;
    riskScoreRow.style.display = 'flex';
  } else {
    riskScoreRow.style.display = 'none';
  }
  
  // Check if token is already in watchlist
  chrome.runtime.sendMessage(
    { action: 'isTokenInWatchlist', address: token.address },
    function(response) {
      if (response && response.exists) {
        addToWatchlistButton.textContent = 'Remove from Watchlist';
        addToWatchlistButton.style.backgroundColor = '#ef4444';
      } else {
        addToWatchlistButton.textContent = 'Add to Watchlist';
        addToWatchlistButton.style.backgroundColor = '#10b981';
      }
    }
  );
}

/**
 * Load token history from storage
 */
function loadTokenHistory() {
  chrome.runtime.sendMessage(
    { action: 'getTokenHistory' },
    function(response) {
      if (response && response.success) {
        displayTokenHistory(response.history);
      }
    }
  );
}

/**
 * Display token history in the UI
 */
function displayTokenHistory(history) {
  // Clear current history
  while (historyList.firstChild) {
    historyList.removeChild(historyList.firstChild);
  }
  
  // Show empty state if no history
  if (!history || history.length === 0) {
    historyList.appendChild(emptyState);
    return;
  }
  
  // Add history items
  history.forEach((token) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.addEventListener('click', () => {
      tokenInput.value = token.address;
      checkCurrentUrl();
    });
    
    const historyItemHeader = document.createElement('div');
    historyItemHeader.className = 'history-item-header';
    
    const historyItemTitle = document.createElement('div');
    historyItemTitle.className = 'history-item-title';
    historyItemTitle.textContent = token.name || 'Unknown Token';
    historyItemTitle.style.color = '#111827'; // Very dark gray, almost black for better visibility
    
    const historyItemTime = document.createElement('div');
    historyItemTime.className = 'history-item-time';
    historyItemTime.textContent = formatRelativeTime(token.checkedAt);
    historyItemTime.style.color = '#6b7280'; // Medium gray for secondary text
    
    historyItemHeader.appendChild(historyItemTitle);
    historyItemHeader.appendChild(historyItemTime);
    
    const historyItemAddress = document.createElement('div');
    historyItemAddress.className = 'history-item-address';
    historyItemAddress.textContent = token.address;
    historyItemAddress.style.color = '#4b5563'; // Darker gray for code elements
    
    // Add risk badge if available
    if (token.riskLevel) {
      const badgeSpan = document.createElement('span');
      let badgeColor = '#6b7280';
      
      switch (token.riskLevel.toLowerCase()) {
        case 'safe':
          badgeColor = '#10b981';
          break;
        case 'warning':
          badgeColor = '#f59e0b';
          break;
        case 'danger':
          badgeColor = '#ef4444';
          break;
      }
      
      badgeSpan.style.backgroundColor = badgeColor;
      badgeSpan.style.color = 'white';
      badgeSpan.style.borderRadius = '4px';
      badgeSpan.style.padding = '1px 4px';
      badgeSpan.style.fontSize = '10px';
      badgeSpan.style.marginLeft = '6px';
      badgeSpan.textContent = token.riskLevel;
      
      historyItemTitle.appendChild(badgeSpan);
    }
    
    historyItem.appendChild(historyItemHeader);
    historyItem.appendChild(historyItemAddress);
    historyList.appendChild(historyItem);
  });
}

/**
 * Clear token history
 */
function clearHistory() {
  chrome.runtime.sendMessage(
    { action: 'clearTokenHistory' },
    function(response) {
      if (response && response.success) {
        loadTokenHistory();
      }
    }
  );
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.style.display = 'none';
}

/**
 * Format relative time for history items
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hr ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  return date.toLocaleDateString();
}

/**
 * Add current token to watchlist
 */
function addCurrentTokenToWatchlist() {
  if (!currentToken) {
    showError('No token selected');
    return;
  }
  
  // Check if token is already in watchlist (to toggle)
  chrome.runtime.sendMessage(
    { action: 'isTokenInWatchlist', address: currentToken.address },
    function(response) {
      if (response && response.exists) {
        // Remove from watchlist
        chrome.runtime.sendMessage(
          { action: 'removeFromWatchlist', address: currentToken.address },
          function(response) {
            if (response && response.success) {
              addToWatchlistButton.textContent = 'Add to Watchlist';
              addToWatchlistButton.style.backgroundColor = '#10b981';
              
              // Flash success message
              showError('Removed from watchlist');
              setTimeout(hideError, 2000);
              
              // Refresh watchlist if visible
              const watchlistTab = document.getElementById('watchlist-tab');
              if (watchlistTab.classList.contains('active')) {
                loadWatchlist();
              }
            } else {
              showError('Failed to remove from watchlist');
            }
          }
        );
      } else {
        // Add to watchlist
        chrome.runtime.sendMessage(
          { 
            action: 'addToWatchlist', 
            token: {
              address: currentToken.address,
              name: currentToken.name,
              symbol: currentToken.symbol,
              riskLevel: currentToken.risk_level,
              riskScore: currentToken.risk_score,
              isRug: currentToken.is_rug,
              addedAt: new Date().toISOString()
            }
          },
          function(response) {
            if (response && response.success) {
              addToWatchlistButton.textContent = 'Remove from Watchlist';
              addToWatchlistButton.style.backgroundColor = '#ef4444';
              
              // Flash success message
              showError('Added to watchlist');
              setTimeout(hideError, 2000);
              
              // Refresh watchlist if visible
              const watchlistTab = document.getElementById('watchlist-tab');
              if (watchlistTab.classList.contains('active')) {
                loadWatchlist();
              }
            } else {
              showError('Failed to add to watchlist');
            }
          }
        );
      }
    }
  );
}

/**
 * Load watchlist from storage
 */
function loadWatchlist() {
  chrome.runtime.sendMessage(
    { action: 'getWatchlist' },
    function(response) {
      if (response && response.success) {
        displayWatchlist(response.watchlist);
        
        // Update monitor status
        chrome.runtime.sendMessage(
          { action: 'getMonitorStatus' },
          function(statusResponse) {
            if (statusResponse && statusResponse.success) {
              const isActive = statusResponse.isActive;
              monitorStatusElement.textContent = isActive ? 
                `Active (checking every ${statusResponse.interval/1000} seconds)` : 
                'Monitoring paused';
              
              if (!isActive) {
                monitorStatusElement.style.color = '#ef4444';
              } else {
                monitorStatusElement.style.color = '#10b981';
              }
            }
          }
        );
      }
    }
  );
}

/**
 * Display watchlist in the UI
 */
function displayWatchlist(watchlist) {
  // Clear current watchlist
  while (watchlistContainer.firstChild) {
    watchlistContainer.removeChild(watchlistContainer.firstChild);
  }
  
  // Show empty state if no watchlist
  if (!watchlist || watchlist.length === 0) {
    watchlistContainer.appendChild(emptyWatchlist);
    return;
  }
  
  // Add watchlist items
  watchlist.forEach((token) => {
    const watchlistItem = document.createElement('div');
    watchlistItem.className = 'watchlist-item';
    
    const watchlistItemInfo = document.createElement('div');
    watchlistItemInfo.className = 'watchlist-item-info';
    
    const itemTitle = document.createElement('div');
    itemTitle.className = 'history-item-title';
    itemTitle.textContent = token.name || 'Unknown Token';
    itemTitle.style.marginBottom = '4px';
    itemTitle.style.color = '#111827';
    
    const itemAddress = document.createElement('div');
    itemAddress.className = 'history-item-address';
    itemAddress.textContent = token.address;
    itemAddress.style.color = '#4b5563';
    
    // Add risk badge
    if (token.riskLevel) {
      const badgeSpan = document.createElement('span');
      let badgeColor = '#6b7280';
      
      switch (token.riskLevel.toLowerCase()) {
        case 'safe':
          badgeColor = '#10b981';
          break;
        case 'warning':
          badgeColor = '#f59e0b';
          break;
        case 'danger':
          badgeColor = '#ef4444';
          break;
      }
      
      badgeSpan.style.backgroundColor = badgeColor;
      badgeSpan.style.color = 'white';
      badgeSpan.style.borderRadius = '4px';
      badgeSpan.style.padding = '1px 4px';
      badgeSpan.style.fontSize = '10px';
      badgeSpan.style.marginLeft = '6px';
      badgeSpan.textContent = token.riskLevel;
      
      itemTitle.appendChild(badgeSpan);
    }
    
    watchlistItemInfo.appendChild(itemTitle);
    watchlistItemInfo.appendChild(itemAddress);
    
    const watchlistActions = document.createElement('div');
    watchlistActions.className = 'watchlist-actions';
    
    // View details button
    const viewButton = document.createElement('button');
    viewButton.className = 'watchlist-action-button';
    viewButton.title = 'View Details';
    viewButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    viewButton.addEventListener('click', () => {
      tokenInput.value = token.address;
      checkCurrentUrl();
      
      // Switch to token checker tab
      tabButtons.forEach(btn => {
        if (btn.dataset.tab === 'checker') {
          btn.click();
        }
      });
    });
    
    // Remove button
    const removeButton = document.createElement('button');
    removeButton.className = 'watchlist-action-button';
    removeButton.title = 'Remove from Watchlist';
    removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      
      // Remove from watchlist
      chrome.runtime.sendMessage(
        { action: 'removeFromWatchlist', address: token.address },
        function(response) {
          if (response && response.success) {
            loadWatchlist();
            
            // Update button in token checker if this is the current token
            if (currentToken && currentToken.address === token.address) {
              addToWatchlistButton.textContent = 'Add to Watchlist';
              addToWatchlistButton.style.backgroundColor = '#10b981';
            }
          }
        }
      );
    });
    
    watchlistActions.appendChild(viewButton);
    watchlistActions.appendChild(removeButton);
    
    watchlistItem.appendChild(watchlistItemInfo);
    watchlistItem.appendChild(watchlistActions);
    watchlistContainer.appendChild(watchlistItem);
  });
}

/**
 * Clear watchlist
 */
function clearWatchlist() {
  chrome.runtime.sendMessage(
    { action: 'clearWatchlist' },
    function(response) {
      if (response && response.success) {
        loadWatchlist();
        
        // Update button in token checker if showing a token
        if (currentToken) {
          addToWatchlistButton.textContent = 'Add to Watchlist';
          addToWatchlistButton.style.backgroundColor = '#10b981';
        }
      }
    }
  );
}