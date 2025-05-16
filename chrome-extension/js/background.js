/**
 * RugGuard - Background Script
 * Handles token history storage, watchlist monitoring, and API communication
 */

// Store API key - in a real extension this would be securely managed
const API_KEY = ''; // You'll need to add your RugCheck API key here

// Maximum number of tokens in history
const MAX_HISTORY_SIZE = 10;

// Watchlist settings
const WATCHLIST_CHECK_INTERVAL = 5000; // 5 seconds
let watchlistMonitorTimer = null;
let isMonitoringActive = true;

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
 * Initialize watchlist monitoring when extension is loaded
 */
function initWatchlistMonitoring() {
  // Start the watchlist monitoring
  startWatchlistMonitor();
  
  // Also set up alarm for regular monitoring that persists even if background script unloads
  chrome.alarms.create('watchlistMonitor', {
    periodInMinutes: 1 // Set up an alarm every minute as backup
  });
}

/**
 * Start the watchlist monitoring process
 */
function startWatchlistMonitor() {
  // Clear any existing timer
  if (watchlistMonitorTimer) {
    clearInterval(watchlistMonitorTimer);
  }
  
  // Set up a new timer to check the watchlist regularly
  watchlistMonitorTimer = setInterval(checkWatchlistTokens, WATCHLIST_CHECK_INTERVAL);
  isMonitoringActive = true;
  
  console.log(`Watchlist monitoring started. Checking every ${WATCHLIST_CHECK_INTERVAL/1000} seconds.`);
}

/**
 * Stop the watchlist monitoring process
 */
function stopWatchlistMonitor() {
  if (watchlistMonitorTimer) {
    clearInterval(watchlistMonitorTimer);
    watchlistMonitorTimer = null;
  }
  isMonitoringActive = false;
  
  console.log('Watchlist monitoring stopped.');
}

/**
 * Check all tokens in the watchlist
 */
async function checkWatchlistTokens() {
  if (!isMonitoringActive) return;
  
  try {
    // Get the watchlist from storage
    const result = await chrome.storage.local.get(['watchlist']);
    const watchlist = result.watchlist || [];
    
    if (watchlist.length === 0) return;
    
    console.log(`Checking ${watchlist.length} tokens in watchlist...`);
    
    // Check each token in the watchlist
    for (const token of watchlist) {
      try {
        // Skip check if the token was checked very recently to avoid API rate limits
        const lastCheck = new Date(token.lastChecked || 0);
        const now = new Date();
        const timeSinceLastCheck = now.getTime() - lastCheck.getTime();
        
        // If token was checked in the last 3 seconds, skip to avoid rate limits
        if (timeSinceLastCheck < 3000) continue;
        
        // Check the token with the API
        const tokenData = await checkTokenWithAPI(token.address);
        
        // Update last checked timestamp
        token.lastChecked = new Date().toISOString();
        
        // Check if risk level changed
        const oldRiskLevel = token.riskLevel || 'Unknown';
        const newRiskLevel = tokenData.risk_level || 'Unknown';
        
        // Check if token became more risky
        if (riskLevelIncreased(oldRiskLevel, newRiskLevel) || 
            (tokenData.is_rug && !token.isRug)) {
          // Risk increased - send notification
          showRiskChangeNotification(token, tokenData);
          
          // Update the token data in watchlist
          token.riskLevel = newRiskLevel;
          token.riskScore = tokenData.risk_score;
          token.isRug = tokenData.is_rug;
          
          // Save updated watchlist
          await chrome.storage.local.set({ watchlist });
        } 
        // Check if any data has changed
        else if (oldRiskLevel !== newRiskLevel || 
                 token.riskScore !== tokenData.risk_score || 
                 token.isRug !== tokenData.is_rug) {
          // Update the token data in watchlist
          token.riskLevel = newRiskLevel;
          token.riskScore = tokenData.risk_score;
          token.isRug = tokenData.is_rug;
          
          // Save updated watchlist
          await chrome.storage.local.set({ watchlist });
        }
      } catch (error) {
        console.error(`Error checking token ${token.address}:`, error);
        // Don't update lastChecked on error to allow retry
      }
    }
  } catch (error) {
    console.error('Error checking watchlist tokens:', error);
  }
}

/**
 * Determine if risk level has increased
 */
function riskLevelIncreased(oldLevel, newLevel) {
  const riskValues = {
    'unknown': 0,
    'safe': 1,
    'warning': 2,
    'danger': 3
  };
  
  const oldValue = riskValues[oldLevel.toLowerCase()] || 0;
  const newValue = riskValues[newLevel.toLowerCase()] || 0;
  
  return newValue > oldValue;
}

/**
 * Identify specific risk level changes 
 */
function getRiskChangeType(oldLevel, newLevel) {
  if (!oldLevel || oldLevel === newLevel) return null;
  
  // Normalize values to lowercase for comparison
  const old = oldLevel.toLowerCase();
  const now = newLevel.toLowerCase();
  
  if ((old === 'safe' || old === 'unknown') && (now === 'warning' || now === 'moderate' || now === 'medium risk')) 
    return 'safe-to-warning';
    
  if ((old === 'safe' || old === 'unknown') && (now === 'danger' || now === 'high' || now === 'high risk')) 
    return 'safe-to-danger';
    
  if ((old === 'warning' || old === 'moderate' || old === 'medium risk') && 
      (now === 'danger' || now === 'high' || now === 'high risk')) 
    return 'warning-to-danger';
  
  return null; // No relevant change or risk decreased
}

/**
 * Show a notification for token risk change
 */
function showRiskChangeNotification(oldToken, newTokenData) {
  const tokenName = oldToken.name || oldToken.symbol || newTokenData.name || newTokenData.symbol || 'Token';
  const changeType = getRiskChangeType(oldToken.riskLevel, newTokenData.risk_level);
  
  // Always notify for rug pulls
  const isRugPull = newTokenData.is_rug && !oldToken.isRug;
  
  // Don't notify if no relevant risk change and not a rug pull
  if (!changeType && !isRugPull) return;
  
  let title, message;
  const notificationId = `risk-change-${oldToken.address}-${Date.now()}`;
  
  if (isRugPull) {
    // Rug pull detection takes priority
    title = '🚨 RUG PULL DETECTED! 🚨';
    message = `${tokenName} has been identified as a RUG PULL!\n\nRisk Score: ${newTokenData.risk_score}\nUrgent: Potential scam token detected`;
  } else if (changeType === 'safe-to-danger') {
    title = '🚨 CRITICAL RISK ALERT! 🚨';
    message = `${tokenName} has changed from SAFE to HIGH RISK!\n\nRisk Score: ${newTokenData.risk_score}\nIssues detected: ${newTokenData.issues?.join(', ') || 'Multiple issues'}`;
  } else if (changeType === 'warning-to-danger') {
    title = '🚨 Risk Level Increased!';
    message = `${tokenName} risk has escalated from WARNING to HIGH RISK!\n\nRisk Score: ${newTokenData.risk_score}`;
  } else if (changeType === 'safe-to-warning') {
    title = '⚠️ Token Risk Warning';
    message = `${tokenName} is now flagged with WARNINGS.\n\nRisk Score: ${newTokenData.risk_score}`;
  } else {
    // Fallback for other changes
    title = 'Token Risk Alert';
    message = `${tokenName}'s risk level changed to ${newTokenData.risk_level}`;
  }
  
  // Create desktop notification
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: '/images/icon-128.png',
    title: title,
    message: message,
    priority: 2,
    requireInteraction: isRugPull || changeType === 'safe-to-danger' // Require interaction for critical alerts
  });
  
  // Log notification data
  console.log(`Notification sent: ${changeType || 'rug-pull'} for ${tokenName} (${oldToken.address})`);
  
  // Update badge to indicate new alerts
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  
  // Clear badge after 5 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 5000);
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
  
  // Handle watchlist requests
  if (message.action === 'getWatchlist') {
    chrome.storage.local.get(['watchlist'], function(result) {
      sendResponse({ success: true, watchlist: result.watchlist || [] });
    });
    return true;
  }
  
  // Handle add to watchlist requests
  if (message.action === 'addToWatchlist') {
    const newToken = message.token;
    
    if (!newToken || !newToken.address) {
      sendResponse({ success: false, error: 'Invalid token data' });
      return;
    }
    
    chrome.storage.local.get(['watchlist'], function(result) {
      let watchlist = result.watchlist || [];
      
      // Check if token already in watchlist
      const existingIndex = watchlist.findIndex(t => t.address === newToken.address);
      
      if (existingIndex !== -1) {
        // Update existing token
        watchlist[existingIndex] = {
          ...watchlist[existingIndex],
          ...newToken,
          lastChecked: new Date().toISOString()
        };
      } else {
        // Add new token
        watchlist.push({
          ...newToken,
          lastChecked: new Date().toISOString()
        });
      }
      
      // Save updated watchlist
      chrome.storage.local.set({ watchlist }, function() {
        sendResponse({ success: true });
        
        // Make sure monitoring is active
        if (!watchlistMonitorTimer && isMonitoringActive) {
          startWatchlistMonitor();
        }
      });
    });
    
    return true;
  }
  
  // Handle remove from watchlist requests
  if (message.action === 'removeFromWatchlist') {
    const tokenAddress = message.address;
    
    if (!tokenAddress) {
      sendResponse({ success: false, error: 'No token address provided' });
      return;
    }
    
    chrome.storage.local.get(['watchlist'], function(result) {
      let watchlist = result.watchlist || [];
      
      // Remove token from watchlist
      watchlist = watchlist.filter(t => t.address !== tokenAddress);
      
      // Save updated watchlist
      chrome.storage.local.set({ watchlist }, function() {
        sendResponse({ success: true });
      });
    });
    
    return true;
  }
  
  // Handle clear watchlist requests
  if (message.action === 'clearWatchlist') {
    chrome.storage.local.set({ watchlist: [] }, function() {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Handle check if token in watchlist
  if (message.action === 'isTokenInWatchlist') {
    const tokenAddress = message.address;
    
    if (!tokenAddress) {
      sendResponse({ success: false, error: 'No token address provided', exists: false });
      return;
    }
    
    chrome.storage.local.get(['watchlist'], function(result) {
      const watchlist = result.watchlist || [];
      const exists = watchlist.some(t => t.address === tokenAddress);
      
      sendResponse({ success: true, exists });
    });
    
    return true;
  }
  
  // Handle watchlist monitoring status requests
  if (message.action === 'getMonitorStatus') {
    sendResponse({ 
      success: true, 
      isActive: isMonitoringActive,
      interval: WATCHLIST_CHECK_INTERVAL 
    });
    return true;
  }
  
  // Handle toggle monitoring
  if (message.action === 'toggleMonitoring') {
    if (isMonitoringActive) {
      stopWatchlistMonitor();
    } else {
      startWatchlistMonitor();
    }
    
    sendResponse({ 
      success: true, 
      isActive: isMonitoringActive 
    });
    return true;
  }
});

/**
 * Listen for alarms to perform background checks even if the background script unloads
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'watchlistMonitor') {
    // If the interval timer has been cleared (script reloaded), restart monitoring
    if (!watchlistMonitorTimer && isMonitoringActive) {
      startWatchlistMonitor();
    }
    
    // Perform an immediate check
    checkWatchlistTokens();
  }
});

/**
 * Initialize the extension when loaded
 */
function initExtension() {
  console.log('RugGuard - Extension initialized');
  
  // Start watchlist monitoring
  initWatchlistMonitoring();
  
  // Request permission for notifications if needed
  chrome.permissions.contains({ permissions: ['notifications'] }, (hasPermission) => {
    if (!hasPermission) {
      chrome.permissions.request({ permissions: ['notifications'] }, (granted) => {
        if (granted) {
          console.log('Notifications permission granted');
        } else {
          console.warn('Notifications permission denied');
        }
      });
    }
  });
}

// Start the extension
initExtension();

/**
 * Check a token using the RugCheck API
 * @param {string} tokenAddress - The token address to check
 * @returns {Promise<Object>} - The token data
 */
// API key is defined at the top of the file

async function checkTokenWithAPI(tokenAddress) {
  try {
    const apiUrl = `https://premium.rugcheck.xyz/v1/tokens/${tokenAddress}/report`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'x-api-key': API_KEY
      }
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