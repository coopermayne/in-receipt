// Runs the key mobile checks in real Mobile Safari in the Xcode iOS
// Simulator, through Apple's safaridriver. This catches iOS-only rendering
// bugs that Playwright's WebKit build can miss (such as the overlay being
// clipped to its scrolling row).
//
// Needs macOS with Xcode and an iOS Simulator runtime. One-time setup:
//   safaridriver --enable
// Run with: npm run test:ios   (IOS_DEVICE="iPhone 15" to pick a model)
import fs from 'node:fs';
import { Builder, By, until } from 'selenium-webdriver';
import { startSite, SITE_URL } from './support/site.mjs';

const capabilities = {
  browserName: 'safari',
  platformName: 'iOS',
  'safari:useSimulator': true,
  ...(process.env.IOS_DEVICE
    ? { 'safari:deviceName': process.env.IOS_DEVICE }
    : { 'safari:deviceType': 'iPhone' }),
};

const SHOTS = 'test-results/ios';
const TIMEOUT = 10000;

// Same check as tests/e2e/mobile.spec.ts: share of a grid of screen points
// whose topmost element is inside the selector
const coverageScript = `
  const sel = arguments[0];
  let hit = 0, total = 0;
  for (let x = 0.1; x < 1; x += 0.2) {
    for (let y = 0.05; y < 1; y += 0.1) {
      total++;
      const el = document.elementFromPoint(innerWidth * x, innerHeight * y);
      if (el && el.closest(sel)) hit++;
    }
  }
  return hit / total;
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitGone(driver, selector) {
  await driver.wait(async () => (await driver.findElements(By.css(selector))).length === 0, TIMEOUT, `${selector} still present`);
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

for (const [rowName, category] of [['top row', 'big'], ['bottom row', 'small']]) {
  const cardSelector = `.gallery-row-container[data-category="${category}"] .project-card`;

  check(`${rowName}: opened project covers the whole screen, close restores`, async (driver) => {
    await driver.findElement(By.css(cardSelector)).click();
    await driver.wait(until.elementLocated(By.css('.mobile-project-overlay')), TIMEOUT);
    await driver.sleep(300);
    const covered = await driver.executeScript(coverageScript, '.mobile-project-overlay');
    assert(covered === 1, `overlay covers ${Math.round(covered * 100)}% of the screen`);
    await driver.findElement(By.css('.mobile-project-overlay .project-card__close')).click();
    await waitGone(driver, '.mobile-project-overlay');
  });

  check(`${rowName}: back button closes the project`, async (driver) => {
    await driver.findElement(By.css(cardSelector)).click();
    await driver.wait(until.elementLocated(By.css('.mobile-project-overlay')), TIMEOUT);
    await driver.navigate().back();
    await waitGone(driver, '.mobile-project-overlay');
  });
}

check('contact popup covers the screen with the right links', async (driver) => {
  await driver.findElement(By.css('.mobile-info-btn')).click();
  await driver.sleep(800);
  const covered = await driver.executeScript(coverageScript, '.mobile-contact-popup');
  assert(covered === 1, `popup covers ${Math.round(covered * 100)}% of the screen`);
  await driver.findElement(By.css('.mobile-contact-popup a[href="mailto:inreceipt@gmail.com"]'));
  await driver.findElement(By.css('.mobile-contact-popup a[href="tel:+14242566076"]'));
});

check('page does not scroll sideways', async (driver) => {
  const overflow = await driver.executeScript('return document.documentElement.scrollWidth - innerWidth');
  assert(overflow <= 0, `page is ${overflow}px wider than the screen`);
});

const stopSite = await startSite();
let driver;
let failed = 0;
try {
  console.log('Starting iOS Simulator Safari (the first launch can take a minute)...');
  driver = await new Builder().withCapabilities(capabilities).build();
  fs.mkdirSync(SHOTS, { recursive: true });

  for (const { name, fn } of checks) {
    await driver.get(SITE_URL);
    await driver.wait(until.elementLocated(By.css('.gallery-row .project-card')), TIMEOUT);
    try {
      await fn(driver);
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      const file = `${SHOTS}/${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      fs.writeFileSync(file, await driver.takeScreenshot(), 'base64');
      console.log(`  ✘ ${name}\n      ${err.message}\n      screenshot: ${file}`);
    }
  }
  console.log(`\n${checks.length - failed} passed, ${failed} failed`);
} finally {
  await driver?.quit();
  stopSite();
}
process.exit(failed ? 1 : 0);
