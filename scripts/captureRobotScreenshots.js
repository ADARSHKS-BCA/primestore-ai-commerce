const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '..', 'screenshots');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('📸 [ROBOT MASCOT SCREENSHOT GENERATOR] Capturing robot companion in action...\n');

// 1. Robot Mascot Overview with Welcome Speech Bubble (1920x1080)
console.log('1. Capturing Robot Mascot & Welcome Bubble...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,1080 --screenshot="${path.join(screenshotsDir, '05_robot_mascot_greeting.png')}" --virtual-time-budget=3500 http://localhost:3000`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/05_robot_mascot_greeting.png');

console.log('\n🎉 Robot companion screenshots successfully captured!');
