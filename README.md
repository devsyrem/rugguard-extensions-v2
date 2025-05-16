# RugGuard

![RugGuard Logo](chrome-extension/images/icon-128.png)

RugGuard is a browser extension that provides real-time Solana token security analysis directly in your browser. It automatically checks token risk when you visit popular Solana DEX platforms and warns you about potentially fraudulent tokens.

## Features

### 🔍 Automatic Token Detection
RugGuard automatically detects token addresses from URLs as you browse Solana DEX platforms like Raydium, Meteora, Pump.fun, and Fluxbeam.

### ⚠️ Real-Time Risk Assessment
Receive instant token security assessments with clear risk levels: Safe, Warning, or Danger.

### 👀 Token Watchlist
Add tokens to your watchlist and get notified when their risk level changes, even when you're not actively viewing them.

### 🔔 Desktop Notifications
Receive desktop notifications when tokens in your watchlist become more risky, allowing you to take action quickly.

### 📝 Token History
Keep track of tokens you've previously checked and their risk status.

## Supported Platforms

- Raydium.io
- Meteora.ag
- Pump.fun
- Fluxbeam.xyz
- RugCheck.xyz

## Installation

### Chrome
1. Download the extension from our website
2. Unzip the file
3. Go to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the unzipped folder

### Firefox
1. Download the extension from our website
2. Unzip the file
3. Go to `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select any file from the unzipped folder

## How It Works

1. RugGuard runs silently in the background while you browse Solana DEX platforms
2. When a token address is detected, it's automatically checked using the RugCheck API
3. If a risky token is found, a warning popup appears with detailed risk information
4. Safe tokens are discreetly confirmed with a small notification
5. Add tokens to your watchlist for continuous monitoring

## Privacy

RugGuard only accesses data on supported DEX websites to extract token addresses. Your browsing data is not collected or shared with any third parties.

## Development

This project consists of:
- Chrome/Firefox browser extension (in `/chrome-extension`)
- Web demo and landing page (in `/client`)
- Backend API server (in `/server`)

### Setup

1. Download Repo
2. Extract .ZIP files and upload file within 'rugguard-extensions-v2-main' and load the file 'chrome-extension' to chrome://extensions
3. Go to either Fluxbeam, Raydium or Pump.fun and you should get feedback on the tokens and thier analysis. Here are some Sample Links:
Risky Token: https://fluxbeam.xyz/DquYDEhcuCSaTxt9bCAJ8Z566aEpiRCmnhFmATQSY5N1
Safe Token: https://fluxbeam.xyz/Dnb9dLSXxAarXVexehzeH8W8nFmLMNJSuGoaddZSwtog
4. Have fun & HXCK THE PLANET


## Credits

This project uses the RugCheck API for token risk assessment.

## License

THIS IS A SUBMISSION FOR COLLESEUM BREAKOUT HACKATHON. ONLY JUDGES AND OFFICIALS CAN USE THIS PROGRAM FOR JUDGING AND CRITIQUEING.

'''
Project Created by </Syrem>
