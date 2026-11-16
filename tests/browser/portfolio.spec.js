const { test, expect } = require('@playwright/test');
const pages = ['index.html', 'design-research.html', 'user-experience.html', 'app-configuration.html'];

for (const width of [1440, 375, 320]) {
  for (const name of pages) {
    test(`${name} at ${width}px has usable navigation and no page errors`, async ({ page }) => {
      const errors = [];
      const failedAssets = [];
      page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:8765/') && response.status() >= 400) failedAssets.push(response.url()); });
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/spendwise/' + name);
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('.sidebar-pages a[aria-current="page"]')).toHaveCount(1);
      const menu = page.locator('#project-navigation');
      await expect(menu).toBeVisible();
      await expect(menu.locator('summary')).toHaveCount(0);
      await expect(menu.getByRole('link', { name: 'Test the demo' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
      expect(failedAssets).toEqual([]);
    });
  }
}

test('portfolio labels evidence and current implementation accurately', async ({ page }) => {
  await page.goto('/spendwise/index.html');
  await expect(page.locator('main')).toContainText('Browser demo');
  await expect(page.locator('main')).toContainText('Mobile concept');
  await expect(page.locator('main')).not.toContainText('$816B');
  await expect(page.locator('main')).not.toContainText('84%');
  await page.goto('/spendwise/design-research.html');
  await expect(page.locator('main')).toContainText('Research evidence');
  await expect(page.locator('main')).toContainText('Illustrative personas');
  await expect(page.locator('main')).not.toContainText('67%');
  await page.goto('/spendwise/user-experience.html');
  await expect(page.locator('main')).toContainText('Browser demo flow');
  await expect(page.locator('main')).not.toContainText('Short delay before the score appears');
  await expect(page.locator('main')).not.toContainText('"Buy anyway" is the quietest option');
  await page.goto('/spendwise/app-configuration.html');
  await expect(page.locator('main')).toContainText('/js/*');
  await expect(page.locator('main')).toContainText('Historical evidence');
});

test('all portfolio local links, fragments and heading levels resolve', async ({ page, request }) => {
  for (const name of pages) {
    await page.goto('/spendwise/' + name);
    const headings = await page.locator('main :is(h1,h2,h3,h4,h5,h6)').evaluateAll(nodes => nodes.map(node => Number(node.tagName.slice(1))));
    for (let i = 1; i < headings.length; i++) expect(headings[i], `${name}: skipped heading`).toBeLessThanOrEqual(headings[i - 1] + 1);
    const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.href));
    for (const href of new Set(links)) {
      const url = new URL(href);
      if (url.origin !== 'http://127.0.0.1:8765') continue;
      const response = await request.get(url.pathname);
      expect(response.status(), href).toBe(200);
      if (url.hash) {
        const html = await response.text();
        const found = await page.evaluate(({ html, hash }) => !!new DOMParser().parseFromString(html, 'text/html').getElementById(decodeURIComponent(hash.slice(1))), { html, hash: url.hash });
        expect(found, href).toBe(true);
      }
    }
  }
});

test('short phone screens keep enlarged content keyboard-scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/spendwise/user-experience.html');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  for (const screen of await page.locator('.app-screen-content, .wireframe-screen-content').all()) {
    await expect(screen).toHaveAttribute('tabindex', '0');
    await expect(screen).toHaveAttribute('role', 'region');
    await expect(screen).toHaveAttribute('aria-label', /.+/);
    const reachable = await screen.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      return getComputedStyle(el).overflowY === 'auto' && el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    });
    expect(reachable).toBe(true);
  }
});

test('legacy case-study URL reaches the research page', async ({ page }) => {
  await page.goto('/spendwise/case-study.html');
  await expect(page).toHaveURL(/design-research\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design Research & Testing');
});


test('mobile section link keeps navigation visible and focuses its destination', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/spendwise/design-research.html');
  const link = page.locator('.sidebar-sections a[href="#instruments"]');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#instruments$/);
  await expect(page.locator('#project-navigation')).toBeVisible();
  await expect(page.locator('.sidebar-pages')).toBeVisible();
  await expect(page.locator('#instruments')).toBeFocused();
  await expect(page.locator('#instruments')).toBeInViewport();
});

for (const width of [1440, 375]) {
  test(`UX phone frames have matching dimensions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/spendwise/user-experience.html');
    for (const selector of ['.app-device', '.wireframe-device']) {
      const sizes = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      for (const size of sizes) expect(size.height / size.width).toBeCloseTo(149.6 / 71.5, 2);
      expect(Math.max(...sizes.map(s => s.width)) - Math.min(...sizes.map(s => s.width))).toBeLessThanOrEqual(1);
      expect(Math.max(...sizes.map(s => s.height)) - Math.min(...sizes.map(s => s.height))).toBeLessThanOrEqual(1);
    }
  });
}
