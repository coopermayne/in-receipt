import { test, expect } from '@playwright/test';
import { projects } from '../support/mock-api.mjs';

const gallery = '.main-gallery';
const leftCard = '.gallery-column--left .project-card';
const rightCard = '.gallery-column--right .project-card';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('mobile-only elements are hidden', async ({ page }) => {
  await expect(page.locator('.gallery-row-container').first()).toBeHidden();
  await expect(page.locator('.mobile-info-btn')).toBeHidden();
  await expect(page.locator('.site-title')).toBeVisible();
});

test('page does not scroll sideways', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('left project opens its panel with the right content', async ({ page }) => {
  const card = page.locator(leftCard).first();
  const id = await card.getAttribute('data-project-id');
  const project = projects.find((p) => p.id === id)!;
  await card.click();
  await expect(page.locator(gallery)).toHaveClass(/project-open-left/);
  const panel = page.locator('#project-page-left');
  await expect(panel.locator('[data-field="description"]')).toHaveText(project.fullDescription);
  await expect(panel.locator('[data-field="year"]')).toHaveText(project.year);
});

test('right project opens its panel', async ({ page }) => {
  await page.locator(rightCard).first().click();
  await expect(page.locator(gallery)).toHaveClass(/project-open-right/);
  await expect(page.locator('#project-page-right [data-field="description"]')).not.toBeEmpty();
});

test('clicking a column closes the open project', async ({ page }) => {
  await page.locator(leftCard).first().click();
  await expect(page.locator(gallery)).toHaveClass(/project-open-left/);
  // Let the slide finish so the click lands where the column ends up
  await page.waitForTimeout(800);
  await page.locator('.gallery-column-container--col4').click({ position: { x: 20, y: 20 } });
  await expect(page.locator(gallery)).not.toHaveClass(/project-open/);
});

test('Escape closes the open project', async ({ page }) => {
  await page.locator(rightCard).first().click();
  await expect(page.locator(gallery)).toHaveClass(/project-open-right/);
  await page.keyboard.press('Escape');
  await expect(page.locator(gallery)).not.toHaveClass(/project-open/);
});
