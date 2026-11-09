// Renders scripts/og/og.html to src/app/opengraph-image.png (1200x630) with a local headless Chrome/Edge.
// Usage: node scripts/og/render.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) throw new Error('Chrome/Edge not found — set CHROME_PATH');

const html = path.join(__dirname, 'og.html');
const out = path.join(__dirname, '..', '..', 'src', 'app', 'opengraph-image.png');

execFileSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--virtual-time-budget=5000', // let Google Fonts load
  '--window-size=1200,630',
  `--screenshot=${out}`,
  `file:///${html.replace(/\\/g, '/')}`,
]);
console.log('wrote', out, fs.statSync(out).size, 'bytes');
