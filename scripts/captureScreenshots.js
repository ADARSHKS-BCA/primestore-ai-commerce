const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('📸 [REDESIGN SCREENSHOT GENERATOR] Capturing fresh high-resolution screenshots...\n');

// 1. Redesigned Storefront (1920x1080)
console.log('1. Capturing Redesigned Storefront Overview...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,1080 --screenshot="${path.join(screenshotsDir, '01_redesigned_storefront.png')}" --virtual-time-budget=4000 http://localhost:3000`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/01_redesigned_storefront.png');

// 2. Full Multi-Brand Catalog (1920x2600)
console.log('2. Capturing Full Multi-Brand Product Catalog...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,2600 --screenshot="${path.join(screenshotsDir, '02_redesigned_catalog_full.png')}" --virtual-time-budget=4000 http://localhost:3000`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/02_redesigned_catalog_full.png');

// 3. User Account Center (1920x1080)
console.log('3. Capturing User Account & Order History Page...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,1080 --screenshot="${path.join(screenshotsDir, '03_user_account_orders.png')}" --virtual-time-budget=4000 http://localhost:3000/account`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/03_user_account_orders.png');

// 4. Merchant Dashboard (1920x1080)
console.log('4. Capturing Merchant Dashboard & Real-Time Audit Trail...');
execSync(
  `"${chromePath}" --headless=new --disable-gpu --window-size=1920,1080 --screenshot="${path.join(screenshotsDir, '04_merchant_dashboard.png')}" --virtual-time-budget=4000 http://localhost:3000/dashboard`,
  { stdio: 'inherit' }
);
console.log('  ✅ Saved screenshots/04_merchant_dashboard.png');

console.log('\n🎉 All redesigned screenshots successfully captured in folder: d:\\Razor\\ai-commerce\\screenshots\\');
