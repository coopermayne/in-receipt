import { test, expect, type Page } from '@playwright/test';

// Fraction of a grid of viewport points whose topmost element is inside
// `selector`. 1 means the element visibly covers the whole screen.
async function coverage(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    let hit = 0;
    let total = 0;
    for (let x = 0.1; x < 1; x += 0.2) {
      for (let y = 0.05; y < 1; y += 0.1) {
        total++;
        const el = document.elementFromPoint(innerWidth * x, innerHeight * y);
        if (el?.closest(sel)) hit++;
      }
    }
    return hit / total;
  }, selector);
}

const ROWS = [
  { name: 'top row', category: 'big' },
  { name: 'bottom row', category: 'small' },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('page does not scroll sideways', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('both rows fill the screen between them', async ({ page }) => {
  const big = await page.locator('.gallery-row-container[data-category="big"]').boundingBox();
  const small = await page.locator('.gallery-row-container[data-category="small"]').boundingBox();
  const viewport = page.viewportSize()!;
  expect(big!.y).toBeCloseTo(0, 0);
  expect(small!.y + small!.height).toBeCloseTo(viewport.height, 0);
});

for (const row of ROWS) {
  test.describe(row.name, () => {
    const card = (page: Page, n = 0) =>
      page.locator(`.gallery-row-container[data-category="${row.category}"] .project-card`).nth(n);

    test('opened project covers the whole screen', async ({ page }) => {
      await card(page).tap();
      const overlay = page.locator('.mobile-project-overlay');
      await expect(overlay).toBeVisible();
      expect(await coverage(page, '.mobile-project-overlay')).toBe(1);
      await expect(overlay.locator('.project-card__title')).toBeVisible();
      await expect(overlay.locator('.project-card__expanded-description')).toBeVisible();
    });

    test('close button restores the gallery', async ({ page }) => {
      const title = await card(page).locator('.project-card__title').textContent();
      await card(page).tap();
      await page.locator('.mobile-project-overlay .project-card__close').tap();
      await expect(page.locator('.mobile-project-overlay')).toHaveCount(0);
      // Title and overlay are back inside the card, unpinned
      await expect(card(page).locator('.project-card__title')).toHaveText(title!);
      await expect(card(page).locator('.project-card__content')).not.toHaveAttribute('style', /fixed/);
      await expect(card(page).locator('.project-card__expanded')).toHaveCount(1);
      await expect(page.locator('.mobile-info-btn')).toBeVisible();
      // Gallery is tappable again
      await card(page).tap();
      await expect(page.locator('.mobile-project-overlay')).toBeVisible();
    });

    test('back button closes the project', async ({ page }) => {
      await card(page).tap();
      await expect(page.locator('.mobile-project-overlay')).toBeVisible();
      await page.goBack();
      await expect(page.locator('.mobile-project-overlay')).toHaveCount(0);
    });

    test('opens the card that was swiped to', async ({ page }) => {
      await page
        .locator(`.gallery-row[data-gallery-id="${row.category}"]`)
        .evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: 'instant' }));
      await page.waitForTimeout(200);
      const expected = await card(page, 1).locator('.project-card__title').textContent();
      await card(page, 1).tap();
      await expect(page.locator('.mobile-project-overlay .project-card__title')).toHaveText(expected!);
    });

    test('page behind an open project does not scroll', async ({ page }) => {
      await card(page).tap();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    });
  });
}

test.describe('contact popup', () => {
  test('opens full screen with working links', async ({ page }) => {
    await page.locator('.mobile-info-btn').tap();
    const popup = page.locator('.mobile-contact-popup');
    await expect(popup).toHaveClass(/open/);
    // Wait out the circle-expand animation
    await page.waitForTimeout(700);
    expect(await coverage(page, '.mobile-contact-popup')).toBe(1);
    await expect(popup.locator('a[href="mailto:inreceipt@gmail.com"]')).toBeVisible();
    await expect(popup.locator('a[href="tel:+14242566076"]')).toBeVisible();
  });

  test('closes with the X', async ({ page }) => {
    await page.locator('.mobile-info-btn').tap();
    await page.waitForTimeout(700);
    await page.locator('.mobile-contact-popup__close').tap();
    await expect(page.locator('.mobile-contact-popup')).not.toHaveClass(/open/);
    await card0(page).tap();
    await expect(page.locator('.mobile-project-overlay')).toBeVisible();
  });
});

function card0(page: Page) {
  return page.locator('.gallery-row .project-card').first();
}
