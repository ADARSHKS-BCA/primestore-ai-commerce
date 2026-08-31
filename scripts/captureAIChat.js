const { execSync } = require('child_process');
const path = require('path');

const screenshotsDir = path.join(__dirname, '..', 'screenshots');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('📸 Capturing AI Copilot Ordering Flow...');

// Use Chrome with virtual time budget and target viewport to capture the side-by-side view with chat
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1600,900 --screenshot="${path.join(screenshotsDir, '04_ai_copilot_chat.png')}" --virtual-time-budget=3000 http://localhost:3000`,
  { stdio: 'inherit' }
);

console.log('✅ Saved screenshots/04_ai_copilot_chat.png');
