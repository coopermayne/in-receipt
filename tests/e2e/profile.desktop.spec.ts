import { test, expect } from '@playwright/test';
import { profile } from '../support/mock-api.mjs';

// hallieblack.com's root is rewritten to /hallie/ by Netlify (netlify.toml)
test.beforeEach(async ({ page }) => {
  await page.goto('/hallie/');
});

test('shows the profile saved in the admin', async ({ page }) => {
  await expect(page).toHaveTitle(profile.name);
  await expect(page.locator('.profile__name')).toHaveText(profile.name);
  await expect(page.locator('.profile__bio p')).toHaveCount(2);
  await expect(page.locator('.profile__contact a').first()).toHaveAttribute('href', `mailto:${profile.email}`);
  await expect(page.locator('.profile__contact a').nth(1)).toHaveAttribute('href', 'tel:+14245550100');
});

test('shows the built-in portrait beside the name', async ({ page }) => {
  const portrait = page.locator('.profile__portrait');
  await expect(portrait).toHaveAttribute('src', '/images/hallie-portrait-800.webp');
  await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const [photo, name] = await Promise.all([portrait.boundingBox(), page.locator('.profile__name').boundingBox()]);
  expect(photo!.x + photo!.width).toBeLessThan(name!.x);
});

test('renders CV sections and skips empty ones', async ({ page }) => {
  await expect(page.locator('.cv-section__heading')).toHaveText(['Practice', 'Education']);
  await expect(page.locator('.cv-entry')).toHaveCount(3);
  await expect(page.locator('.cv-entry').first()).toContainText('Founder, Test Studio');
});

test('features the chosen project and links to the studio', async ({ page }) => {
  const link = page.locator('.studio-link');
  await expect(link).toHaveAttribute('href', 'https://inreceiptstudio.com/');
  await expect(link.locator('img')).toHaveAttribute('src', /\/img\/img1\//);
  await expect(link).toBeInViewport({ ratio: 1 });
});

test('name runs down the sidebar column', async ({ page }) => {
  const title = page.locator('.profile__sidebar-title');
  await expect(title).toBeVisible();
  const [box, column] = await Promise.all([
    title.boundingBox(),
    page.locator('.profile__sidebar').boundingBox(),
  ]);
  expect(box!.x).toBeGreaterThanOrEqual(column!.x);
  expect(box!.x + box!.width).toBeLessThanOrEqual(column!.x + column!.width + 1);
  expect(box!.height).toBeGreaterThan(column!.height * 0.7);
  expect(box!.height).toBeLessThan(column!.height * 0.95);
});

test('page does not scroll sideways', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('studio link stays put while the CV scrolls', async ({ page }) => {
  const link = page.locator('.studio-link');
  const before = await link.boundingBox();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect((await link.boundingBox())!.y).toBeCloseTo(before!.y, 0);
});

test('uses its own icons, not the I/R set', async ({ page, request }) => {
  const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href')));
  expect(hrefs).toEqual(['/hallie-favicon.ico', '/hallie-favicon.svg', '/hallie-apple-touch-icon.png']);
  for (const href of hrefs) expect((await request.get(href!)).ok()).toBe(true);
});
