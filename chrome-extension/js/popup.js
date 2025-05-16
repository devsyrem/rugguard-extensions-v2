/**
 * Solana RugCheck Monitor - Popup Script
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
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');
const clearHistoryButton = document.getElementById('clear-history');

// Event handlers
checkButton.addEventListener('click', checkCurrentUrl);
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    checkCurrentUrl();
  }
});
clearHistoryButton.addEventListener('click', clearHistory);

// Load token history on popup open
loadTokenHistory();

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