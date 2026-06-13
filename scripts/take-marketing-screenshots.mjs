// Capture marketing-site screenshots from a real AxiOM run.
//
// Usage:  npm run build && node scripts/take-marketing-screenshots.mjs
//
// AxiOM's window is created hidden (show: false) and auto-hides on blur.
// We launch the Electron app, strip the blur handler, force the window
// visible, then walk the three views (list → settings → first-app info).
//
// Output: marketing/assets/screenshots/*.png

import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = path.join(ROOT, 'marketing', 'assets', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const MAIN_ENTRY = path.join(ROOT, 'dist-electron', 'main.js');
if (!fs.existsSync(MAIN_ENTRY)) {
  console.error(`Build output missing: ${MAIN_ENTRY}\nRun: npm run build`);
  process.exit(1);
}

const env = { ...process.env };
delete env.VITE_DEV_SERVER_URL;
delete env.ELECTRON_RUN_AS_NODE;

console.log('[shots] launching AxiOM');
const app = await electron.launch({ args: [MAIN_ENTRY], env });

// AxiOM's createPopupWindow uses show:false and hides on blur. Wait for the
// hidden window to be created, then force it visible and disable the blur
// auto-hide so it survives Playwright driving it.
const win = await app.waitForEvent('window');
await win.waitForLoadState('domcontentloaded');

await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  if (!w) return;
  // Strip the blur-hide handler that createPopupWindow attaches.
  w.removeAllListeners('blur');
  w.setSize(320, 420);
  w.center();
  w.show();
  w.focus();
});
await win.waitForTimeout(900);

async function shot(name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await win.screenshot({ path: file });
  console.log(`[shots]   wrote ${name}.png`);
}

// Wait for the app list to populate. Each AppRow renders the app name as
// text — wait for at least one canonical Axi app name to appear.
console.log('[shots] waiting for app list');
await win.waitForFunction(
  () => /AxiBridge|AxiForge|AxiPulse|AxiAM|AxiTools/.test(document.body.innerText),
  null,
  { timeout: 15000 },
);
await win.waitForTimeout(500);

// 1. App list — the canonical AxiOM popup view.
await shot('app-list');
fs.copyFileSync(path.join(OUT_DIR, 'app-list.png'), path.join(OUT_DIR, 'hero-app.png'));
console.log('[shots]   duplicated app-list.png -> hero-app.png');

// If anything happens to be updating, that already shows in the list shot.
// We also save a copy as update-available.png so the gallery slot fills —
// re-run after `AXIOM_FAKE_UPDATE=1` if you want a guaranteed update state.
fs.copyFileSync(path.join(OUT_DIR, 'app-list.png'), path.join(OUT_DIR, 'update-available.png'));

// 2. App info — click the first row's "..." dropdown, then the "Info" item.
console.log('[shots] opening app info via row menu');
const menuOpened = await win.evaluate(() => {
  const btn = document.querySelector('button[title="More options"]');
  if (btn instanceof HTMLElement) { btn.click(); return true; }
  return false;
});
if (menuOpened) {
  await win.waitForTimeout(400);
  await win.evaluate(() => {
    // Dropdown items are rendered as siblings — find one whose text is "Info".
    const candidate = Array.from(document.querySelectorAll('button, [role="menuitem"], div'))
      .find(el => el.textContent?.trim() === 'Info' && el.children.length <= 1);
    candidate?.click();
  });
  await win.waitForTimeout(700);
  await shot('app-info');
  // Back to list — info view has a back button (lucide-arrow-left or chevron-left).
  await win.evaluate(() => {
    const back = Array.from(document.querySelectorAll('button'))
      .find(b => b.querySelector('svg.lucide-arrow-left, svg.lucide-chevron-left'));
    back?.click();
  });
  await win.waitForTimeout(500);
}

// 3. Settings — click the gear (svg.lucide-settings).
console.log('[shots] opening settings');
const settingsClicked = await win.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.querySelector('svg.lucide-settings'));
  if (btn) { btn.click(); return true; }
  return false;
});
if (settingsClicked) {
  await win.waitForTimeout(700);
  await shot('settings');
}

await app.close();
console.log(`[shots] done — ${OUT_DIR}`);
