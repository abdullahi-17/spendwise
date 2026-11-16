const { test, expect } = require('@playwright/test');

function luminance(rgb) {
  const linear = rgb.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
async function colours(locator) {
  return locator.evaluate(element => {
    const parse = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const style = getComputedStyle(element);
    let background = style.backgroundColor;
    let parent = element.parentElement;
    while (background === 'rgba(0, 0, 0, 0)' && parent) {
      background = getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
    return { text: parse(style.color), background: parse(background), border: parse(style.borderTopColor) };
  });
}

test('rendered text and question control boundaries meet contrast targets', async ({ page }) => {
  await page.goto('/spendwise/demo.html');
  for (const selector of ['.demo-intro p', '#swd-progress', '.swd-h', '.swd-btn', '.swd-exit']) {
    const { text, background } = await colours(page.locator(selector).first());
    expect(contrast(text, background), selector).toBeGreaterThanOrEqual(4.5);
  }
  await page.getByRole('button', { name: 'Start reflection', exact: true }).click();
  await page.getByRole('button', { name: 'Skip camera', exact: true }).click();
  for (const selected of [false, true]) {
    if (selected) await page.getByRole('radio').first().check();
    const { text, background, border } = await colours(page.locator('.swd-opt').first());
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(border, background)).toBeGreaterThanOrEqual(3);
  }
  await page.getByRole('radio').first().focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const outline = await page.getByRole('radio').first().evaluate(el => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test('320px viewport with doubled text keeps controls within the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/spendwise/demo.html');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: 'Start reflection', exact: true }).click();
  await page.getByRole('button', { name: 'Skip camera', exact: true }).click();
  await page.getByRole('radio').first().check();
  const viewport = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(el => el.getBoundingClientRect().right > innerWidth + 1)
    .map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })).slice(0, 8));
  expect(viewport.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(viewport.width);
  for (const control of await page.locator('#swd-screen button, #swd-screen label').all()) {
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [1440, 375]) {
  test(`demo uses the same phone proportions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/spendwise/demo.html');
    const phone = page.locator('.swd-phone');
    const box = await phone.boundingBox();
    expect(box.width).toBeLessThanOrEqual(240);
    expect(box.height / box.width).toBeCloseTo(149.6 / 71.5, 2);
    await expect(phone.locator('.swd-phone-content')).toHaveAttribute('tabindex', '0');
    const button = page.getByRole('button', { name: 'Start reflection', exact: true });
    await phone.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport({ ratio: 1 });
    await button.click();
    await page.getByRole('button', { name: 'Skip camera', exact: true }).click();
    const nextBox = await phone.boundingBox();
    expect(nextBox.height).toBeCloseTo(box.height, 1);
  });
}
