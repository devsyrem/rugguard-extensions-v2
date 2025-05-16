/**
 * Solana RugCheck Monitor - Background Script
 * Handles token history storage and API communication
 */

// Store API key - in a real extension this would be securely managed
const API_KEY = ''; // You'll need to add your RugCheck API key here

// Maximum number of tokens in history
const MAX_HISTORY_SIZE = 10;

/**
 * Adds a token to the history, avoiding duplicates and maintaining the max history size
 * @param {Object} token - The token to add to history
 */
function addToTokenHistory(token) {
  // Load existing history
  chrome.storage.local.get(['tokenHistory'], function(result) {
    let history = result.tokenHistory || [];
    
    // Check if token already exists in history
    const existingIndex = history.findIndex(t => t.address === token.address);
    
    if (existingIndex !== -1) {
      // Update existing token
      const updated = {
        ...history[existingIndex],
        ...token,
        checkedAt: new Date().toISOString() // Always update timestamp
      };
      
      // Remove the existing entry
      history.splice(existingIndex, 1);
      
      // Add updated token to the front
      history.unshift(updated);
    } else {
      // Add new token to the beginning of the array
      history.unshift({
        ...token,
        checkedAt: new Date().toISOString()
      });
      
      // Limit history size
      if (history.length > MAX_HISTORY_SIZE) {
        history = history.slice(0, MAX_HISTORY_SIZE);
      }
    }
    
    // Save updated history
    chrome.storage.local.set({ tokenHistory: history });
  });
}

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle token check requests
  if (message.action === 'checkToken') {
    const tokenAddress = message.address;
    
    if (!tokenAddress) {
      sendResponse({ success: false, error: 'No token address provided' });
      return;
    }
    
    // Fetch token data from RugCheck API
    checkTokenWithAPI(tokenAddress)
      .then(data => {
        // Add to token history
        if (data && data.address) {
          addToTokenHistory({
            address: data.address,
            name: data.name,
            symbol: data.symbol,
            riskLevel: data.risk_level,
            score: data.risk_score,
            checkedAt: new Date().toISOString()
          });
        }
        
        // Send response back to content script
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Error checking token:', error);
        sendResponse({ success: false, error: 'Failed to check token' });
      });
    
    // Return true to indicate we will respond asynchronously
    return true;
  }
  
  // Handle history requests
  if (message.action === 'getTokenHistory') {
    chrome.storage.local.get(['tokenHistory'], function(result) {
      sendResponse({ success: true, history: result.tokenHistory || [] });
    });
    return true;
  }
  
  // Handle history clear requests
  if (message.action === 'clearTokenHistory') {
    chrome.storage.local.set({ tokenHistory: [] }, function() {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Check a token using the RugCheck API
 * @param {string} tokenAddress - The token address to check
 * @returns {Promise<Object>} - The token data
 */
async function checkTokenWithAPI(tokenAddress) {
  try {
    const apiUrl = `https://premium.rugcheck.xyz/v1/tokens/${tokenAddress}/report`;
    
    const response = await fetch(apiUrl, {
      headers: { 'x-api-key': API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process data to determine risk level
    let isRisky = false;
    let riskLevel = data.risk_level || 'Unknown';
    let issues = [];
    
    // Determine if token is risky based on RugCheck data
    if (data.is_rug || data.rugged) {
      isRisky = true;
      riskLevel = 'Danger';
      issues.push('Token is rugged (confirmed scam)');
    } else if (data.risk_level) {
      const level = data.risk_level.toLowerCase();
      if (level === 'danger' || level === 'high' || level === 'high risk') {
        isRisky = true;
        issues.push('High risk level detected');
      } else if (level === 'warning' || level === 'moderate' || level === 'medium risk') {
        isRisky = true;
        issues.push('Moderate risk level detected');
      }
    } else if (data.score || data.risk_score) {
      const score = data.score || data.risk_score;
      if (score > 3000) {
        riskLevel = 'Danger';
        isRisky = true;
        issues.push('Very high risk score detected');
      } else if (score > 1000) {
        riskLevel = 'Warning';
        isRisky = true;
        issues.push('Moderate risk score detected');
      } else {
        riskLevel = 'Safe';
      }
    }
    
    // Process known risk issues
    if (data.risks && Array.isArray(data.risks)) {
      data.risks.forEach(risk => {
        if (risk.name && typeof risk.name === 'string') {
          issues.push(risk.name);
        }
      });
    }
    
    // Return processed data
    return {
      address: tokenAddress,
      name: data.name || data.tokenMeta?.name || 'Unknown Token',
      symbol: data.symbol || data.tokenMeta?.symbol || 'Unknown',
      is_rug: data.is_rug || data.rugged || false,
      risk_score: data.score || data.risk_score || 0,
      risk_level: riskLevel,
      issues: issues,
      isRisky: isRisky
    };
  } catch (error) {
    console.error('Error in checkTokenWithAPI:', error);
    throw error;
  }
}