/**
 * Solana RugCheck Monitor - Content Script
 * Automatically extracts token addresses from pages and checks them
 */

// Global variables
let currentTokenAddress = null;
let warningModalShown = false;

// Add CSS for the warning modal
const style = document.createElement('style');
style.textContent = `
  .rugcheck-warning-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  
  .rugcheck-warning-modal {
    width: 90%;
    max-width: 450px;
    background-color: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  }
  
  .rugcheck-warning-header {
    background-color: #e11d48;
    color: white;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .rugcheck-warning-title {
    display: flex;
    align-items: center;
    font-weight: bold;
    font-size: 16px;
  }
  
  .rugcheck-warning-content {
    padding: 16px;
  }
  
  .rugcheck-warning-token-info {
    margin-bottom: 16px;
  }
  
  .rugcheck-warning-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .rugcheck-warning-label {
    color: #4b5563;
    font-size: 14px;
  }
  
  .rugcheck-warning-value {
    font-size: 14px;
    font-weight: 500;
  }
  
  .rugcheck-warning-risk {
    background-color: #fee2e2;
    border-left: 4px solid #ef4444;
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .rugcheck-warning-risk-header {
    display: flex;
    align-items: center;
    color: #b91c1c;
    font-weight: 500;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .rugcheck-warning-issues {
    margin-top: 12px;
  }
  
  .rugcheck-warning-issue {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 14px;
  }
  
  .rugcheck-warning-issue svg {
    margin-right: 8px;
    min-width: 16px;
  }
  
  .rugcheck-warning-actions {
    display: flex;
    gap: 12px;
  }
  
  .rugcheck-warning-button {
    flex: 1;
    padding: 10px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.2s;
    font-size: 14px;
    border: none;
  }
  
  .rugcheck-warning-button-secondary {
    background-color: #1f2937;
    color: white;
  }
  
  .rugcheck-warning-button-secondary:hover {
    background-color: #111827;
  }
  
  .rugcheck-warning-button-danger {
    background-color: #e11d48;
    color: white;
  }
  
  .rugcheck-warning-button-danger:hover {
    background-color: #be123c;
  }
  
  .rugcheck-safe-notification {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background-color: white;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 999998;
    max-width: 320px;
    animation: rugcheck-slide-in 0.3s ease-out forwards;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  
  @keyframes rugcheck-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .rugcheck-safe-notification-content {
    margin-left: 12px;
  }
  
  .rugcheck-safe-notification-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .rugcheck-safe-notification-message {
    font-size: 12px;
    color: #4b5563;
  }
  
  .rugcheck-token-address {
    font-family: monospace;
    background-color: #f3f4f6;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;
  }
`;
document.head.appendChild(style);

/**
 * Automatically extract token address from URL and check it
 */
function autoExtractAndCheck() {
  // Extract token address from current URL
  const tokenAddress = extractTokenAddressFromUrl(window.location.href);
  
  // If token address found and it's different from current, check it
  if (tokenAddress && tokenAddress !== currentTokenAddress) {
    console.log('Token address found in URL:', tokenAddress);
    currentTokenAddress = tokenAddress;
    checkToken(tokenAddress);
  }
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
    
    return null;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
}

/**
 * Check a token with the RugCheck API
 */
function checkToken(tokenAddress) {
  chrome.runtime.sendMessage(
    { action: 'checkToken', address: tokenAddress },
    function(response) {
      if (response && response.success && response.data) {
        const tokenData = response.data;
        
        console.log('Token data received:', tokenData);
        
        // If token is risky, show warning
        if (tokenData.isRisky) {
          createWarningModal(tokenData);
        } else {
          // Token is safe, show a small notification
          showSafeTokenNotification(tokenData);
        }
      } else {
        console.error('Failed to check token:', response?.error || 'Unknown error');
      }
    }
  );
}

/**
 * Create a warning modal for high-risk tokens
 */
function createWarningModal(tokenData) {
  // Only show one warning at a time
  if (warningModalShown) {
    removeWarningModal();
  }
  
  warningModalShown = true;
  
  // Create modal elements
  const overlay = document.createElement('div');
  overlay.className = 'rugcheck-warning-overlay';
  overlay.id = 'rugcheck-warning-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'rugcheck-warning-modal';
  
  // Header
  const header = document.createElement('div');
  header.className = 'rugcheck-warning-header';
  
  const title = document.createElement('div');
  title.className = 'rugcheck-warning-title';
  title.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    HIGH RISK TOKEN DETECTED
  `;
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.cursor = 'pointer';
  closeButton.onclick = removeWarningModal;
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Content
  const content = document.createElement('div');
  content.className = 'rugcheck-warning-content';
  
  // Token Info
  const tokenInfo = document.createElement('div');
  tokenInfo.className = 'rugcheck-warning-token-info';
  
  const tokenInfoHeader = document.createElement('h3');
  tokenInfoHeader.style.fontSize = '16px';
  tokenInfoHeader.style.fontWeight = '600';
  tokenInfoHeader.style.marginBottom = '8px';
  tokenInfoHeader.style.color = '#111827';
  tokenInfoHeader.textContent = 'Token Details:';
  
  tokenInfo.appendChild(tokenInfoHeader);
  
  // Address row
  const addressRow = document.createElement('div');
  addressRow.className = 'rugcheck-warning-row';
  
  const addressLabel = document.createElement('span');
  addressLabel.className = 'rugcheck-warning-label';
  addressLabel.textContent = 'Address:';
  addressLabel.style.color = '#4b5563'; // Darker text for visibility
  
  const addressValue = document.createElement('code');
  addressValue.className = 'rugcheck-token-address';
  addressValue.style.color = '#111827'; // Very dark gray, almost black for contrast
  addressValue.style.fontWeight = '500'; // Medium weight for better visibility
  addressValue.style.backgroundColor = '#f3f4f6'; // Light gray background for code
  addressValue.style.padding = '2px 4px'; // Padding for code
  addressValue.style.borderRadius = '3px'; // Rounded corners for code
  const shortAddress = `${tokenData.address.slice(0, 6)}...${tokenData.address.slice(-6)}`;
  addressValue.textContent = shortAddress;
  
  addressRow.appendChild(addressLabel);
  addressRow.appendChild(addressValue);
  tokenInfo.appendChild(addressRow);
  
  // Name row
  const nameRow = document.createElement('div');
  nameRow.className = 'rugcheck-warning-row';
  
  const nameLabel = document.createElement('span');
  nameLabel.className = 'rugcheck-warning-label';
  nameLabel.textContent = 'Name:';
  nameLabel.style.color = '#4b5563'; // Darker text for visibility
  
  const nameValue = document.createElement('span');
  nameValue.className = 'rugcheck-warning-value';
  nameValue.textContent = tokenData.name || 'Unknown Token';
  nameValue.style.color = '#111827'; // Very dark gray, almost black for contrast
  nameValue.style.fontWeight = '500'; // Medium weight for better visibility
  
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameValue);
  tokenInfo.appendChild(nameRow);
  
  // Symbol row (if available)
  if (tokenData.symbol) {
    const symbolRow = document.createElement('div');
    symbolRow.className = 'rugcheck-warning-row';
    
    const symbolLabel = document.createElement('span');
    symbolLabel.className = 'rugcheck-warning-label';
    symbolLabel.textContent = 'Symbol:';
    symbolLabel.style.color = '#4b5563'; // Darker text for visibility
    
    const symbolValue = document.createElement('span');
    symbolValue.className = 'rugcheck-warning-value';
    symbolValue.textContent = tokenData.symbol;
    symbolValue.style.color = '#111827'; // Very dark gray, almost black for contrast
    symbolValue.style.fontWeight = '500'; // Medium weight for better visibility
    
    symbolRow.appendChild(symbolLabel);
    symbolRow.appendChild(symbolValue);
    tokenInfo.appendChild(symbolRow);
  }
  
  content.appendChild(tokenInfo);
  
  // Risk Assessment
  const riskAssessment = document.createElement('div');
  riskAssessment.className = 'rugcheck-warning-risk-assessment';
  
  const riskHeader = document.createElement('h3');
  riskHeader.style.fontSize = '16px';
  riskHeader.style.fontWeight = '600';
  riskHeader.style.marginBottom = '8px';
  riskHeader.style.color = '#111827';
  riskHeader.textContent = 'Risk Assessment:';
  riskAssessment.appendChild(riskHeader);
  
  // Risk box
  const riskBox = document.createElement('div');
  riskBox.className = 'rugcheck-warning-risk';
  
  const riskBoxHeader = document.createElement('div');
  riskBoxHeader.className = 'rugcheck-warning-risk-header';
  riskBoxHeader.style.color = '#111827'; // Very dark gray, almost black for contrast
  riskBoxHeader.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
    Risk Level: <span style="font-weight: 700; margin-left: 4px; color: #b91c1c;">${tokenData.risk_level || 'DANGER'}</span>
  `;
  riskBox.appendChild(riskBoxHeader);
  
  // Risk score (if available)
  if (tokenData.risk_score) {
    const riskScore = document.createElement('p');
    riskScore.style.fontSize = '13px';
    riskScore.style.color = '#b91c1c';
    riskScore.style.marginTop = '4px';
    riskScore.style.marginBottom = '0';
    
    let riskCategory = 'High';
    if (tokenData.risk_score > 5000) {
      riskCategory = 'Extremely High';
    } else if (tokenData.risk_score > 1000) {
      riskCategory = 'Very High';
    } else if (tokenData.risk_score > 500) {
      riskCategory = 'High';
    } else if (tokenData.risk_score > 200) {
      riskCategory = 'Medium';
    } else {
      riskCategory = 'Low';
    }
    
    riskScore.textContent = `Risk Score: ${tokenData.risk_score} (${riskCategory})`;
    riskBox.appendChild(riskScore);
  }
  
  riskAssessment.appendChild(riskBox);
  
  // Issues list
  const issues = document.createElement('div');
  issues.className = 'rugcheck-warning-issues';
  
  // Add issues from token data
  if (tokenData.issues && tokenData.issues.length > 0) {
    tokenData.issues.forEach(issue => {
      const issueItem = document.createElement('div');
      issueItem.className = 'rugcheck-warning-issue';
      issueItem.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span style="color: #111827;">${issue}</span>
      `;
      issues.appendChild(issueItem);
    });
  } else {
    // Default issue
    const defaultIssue = document.createElement('div');
    defaultIssue.className = 'rugcheck-warning-issue';
    defaultIssue.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span style="color: #111827;">Potential risk detected</span>
    `;
    issues.appendChild(defaultIssue);
  }
  
  riskAssessment.appendChild(issues);
  content.appendChild(riskAssessment);
  
  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'rugcheck-warning-actions';
  
  // View on RugCheck button
  const viewButton = document.createElement('a');
  viewButton.className = 'rugcheck-warning-button rugcheck-warning-button-secondary';
  viewButton.textContent = 'View on RugCheck';
  viewButton.href = `https://rugcheck.xyz/tokens/${tokenData.address}`;
  viewButton.target = '_blank';
  viewButton.rel = 'noopener noreferrer';
  
  // Proceed button
  const proceedButton = document.createElement('button');
  proceedButton.className = 'rugcheck-warning-button rugcheck-warning-button-danger';
  proceedButton.textContent = 'Proceed With Caution';
  proceedButton.onclick = removeWarningModal;
  
  actions.appendChild(viewButton);
  actions.appendChild(proceedButton);
  content.appendChild(actions);
  
  // Assemble and add to page
  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Prevent scrolling on the background
  document.body.style.overflow = 'hidden';
}

/**
 * Remove the warning modal
 */
function removeWarningModal() {
  const overlay = document.getElementById('rugcheck-warning-overlay');
  if (overlay) {
    overlay.remove();
    warningModalShown = false;
    document.body.style.overflow = '';
  }
}

/**
 * Show a small notification for safe tokens
 */
function showSafeTokenNotification(tokenData) {
  // Create notification
  const notification = document.createElement('div');
  notification.className = 'rugcheck-safe-notification';
  notification.id = 'rugcheck-safe-notification';
  
  // Add content
  notification.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <div class="rugcheck-safe-notification-content">
      <div class="rugcheck-safe-notification-title" style="color: #111827; font-weight: 600;">Safe Token Detected</div>
      <div class="rugcheck-safe-notification-message" style="color: #4b5563;">
        ${tokenData.name || 'Token'} has been verified as safe by RugCheck
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    const notificationElement = document.getElementById('rugcheck-safe-notification');
    if (notificationElement) {
      notificationElement.style.animation = 'rugcheck-slide-out 0.3s ease-in forwards';
      setTimeout(() => {
        if (notificationElement.parentNode) {
          notificationElement.parentNode.removeChild(notificationElement);
        }
      }, 300);
    }
  }, 5000);
}

// Run the check when the page loads
window.addEventListener('load', () => {
  setTimeout(autoExtractAndCheck, 1000); // Delay slightly to ensure page is fully loaded
});

// Check again when URL changes
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(autoExtractAndCheck, 500);
  }
});

observer.observe(document, { subtree: true, childList: true });

// Create a small badge to show the extension is active
const badge = document.createElement('div');
badge.style.position = 'fixed';
badge.style.top = '10px';
badge.style.right = '10px';
badge.style.backgroundColor = '#3b82f6';
badge.style.color = 'white';
badge.style.padding = '4px 8px';
badge.style.borderRadius = '20px';
badge.style.fontSize = '12px';
badge.style.fontWeight = '500';
badge.style.zIndex = '9999';
badge.style.display = 'flex';
badge.style.alignItems = 'center';
badge.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
badge.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';

badge.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
  RugCheck Monitor Active
`;

document.body.appendChild(badge);

// Notify that content script is loaded
console.log('Solana RugCheck Monitor: Content script loaded');