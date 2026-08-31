const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('📸 [SCREENSHOT GENERATOR] Capturing high-resolution screenshots...\n');

// 1. Storefront Overview (1920x1080)
console.log('1. Capturing Storefront Overview...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,1080 --screenshot="${path.join(screenshotsDir, '01_storefront_overview.png')}" --virtual-time-budget=4000 http://localhost:3000`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/01_storefront_overview.png');

// 2. Full Storefront & Product Grid (1920x2000)
console.log('2. Capturing Full Storefront & Product Catalog...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,2000 --screenshot="${path.join(screenshotsDir, '02_storefront_catalog_full.png')}" --virtual-time-budget=4000 http://localhost:3000`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/02_storefront_catalog_full.png');

// 3. Merchant Dashboard (1920x1200)
console.log('3. Capturing Merchant Dashboard & Real-Time Audit Trail...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,1200 --screenshot="${path.join(screenshotsDir, '03_merchant_dashboard.png')}" --virtual-time-budget=4000 http://localhost:3000/dashboard`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/03_merchant_dashboard.png');

// 4. Mobile Responsive View (390x844)
console.log('4. Capturing Mobile Responsive Storefront View...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=390,844 --screenshot="${path.join(screenshotsDir, '04_mobile_storefront_view.png')}" --virtual-time-budget=4000 http://localhost:3000`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/04_mobile_storefront_view.png');

console.log('\n🎉 All screenshots successfully captured in folder: d:\\Razor\\ai-commerce\\screenshots\\');
