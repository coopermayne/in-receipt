import { test, expect } from '@playwright/test';
import { profile } from '../support/mock-api.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/hallie/');
});

test('single column with the studio link before the CV', async ({ page }) => {
  await expect(page.locator('.profile__sidebar')).toBeHidden();
  await expect(page.locator('.profile__name')).toHaveText(profile.name);
  const [link, cv] = await Promise.all([
    page.locator('.studio-link').boundingBox(),
    page.locator('.profile__cv').boundingBox(),
  ]);
  expect(link!.y).toBeLessThan(cv!.y);
});

test('page does not scroll sideways', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('page scrolls vertically to the end of the CV', async ({ page }) => {
  const last = page.locator('.cv-entry').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});
