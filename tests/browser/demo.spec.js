const { test, expect } = require('@playwright/test');

async function questions(page, urgent = false) {
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  for (let i = 0; i < 3; i++) {
    const field = page.locator('fieldset');
    const name = await field.locator('legend').textContent();
    const answer = name.includes('feeling') ? 'Good' : name.includes('before today') ? 'Been planning it' : urgent ? 'I need it now' : 'Yes, easy';
    await page.getByRole('radio', { name: answer, exact: true }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  if (urgent) await page.getByRole('button', { name: 'Skip pause' }).click();
  await page.getByRole('button', { name: "Skip. I'd rather not say" }).click();
}

test('demo starts and can be skipped without a purchase claim', async ({ page }) => {
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: 'Exit reflection' }).click();
  await expect(page.getByRole('heading', { name: 'Reflection skipped' })).toBeVisible();
  await expect(page.locator('#demo-mount')).not.toContainText('Confidence score');
});
for (const [action, outcome] of [['Consider later', 'Consider it later'], ['Dismiss sample item', 'Sample item dismissed'], ['Continue shopping', 'Continue shopping']]) {
  test(`complete reflection: ${action}`, async ({ page }) => {
    await page.goto('/spendwise/demo.html');
    await questions(page, true);
    await expect(page.locator('#swd-insight')).toContainText('This was on your mind');
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.getByRole('heading', { name: outcome, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start another reflection' }).click();
    await expect(page.getByRole('button', { name: "Start reflection" })).toBeVisible();
    expect(await page.evaluate(() => window.SpendWise.state.answers)).toEqual({});
  });
}
test('mobile layout and native keyboard radio selection', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  const radio = page.getByRole('radio').first();
  await radio.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('camera granted after exit is stopped', async ({ page }) => {
  await page.addInitScript(() => {
    window.trackStopped = false;
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => new Promise(resolve => { window.resolveCamera = () => resolve({ getTracks: () => [{ stop: () => { window.trackStopped = true; } }] }); }) } });
  });
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Use camera' }).click();
  await page.getByRole('button', { name: 'Exit reflection' }).click();
  await page.evaluate(() => window.resolveCamera());
  await expect.poll(() => page.evaluate(() => window.trackStopped)).toBe(true);
});
test('invalid API response falls back to local rules', async ({ page }) => {
  await page.addInitScript(() => { window.SPENDWISE_CONFIG = { nudgeApiEndpoint: 'https://example.test/insight' }; });
  await page.route('https://example.test/insight', route => route.fulfill({ json: { insight: null } }));
  await page.goto('/spendwise/demo.html');
  await questions(page);
  await expect(page.locator('#swd-insight')).toContainText('You planned this one');
  await expect(page.locator('#swd-meta')).toContainText('Local fallback');
});

test('denied camera stays optional', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new Error('denied'); } } }));
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Use camera' }).click();
  await expect(page.locator('#swd-scan-msg')).toContainText('Camera is not available');
  await page.getByRole('button', { name: 'Skip camera' }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
});

for (const failure of ['http', 'timeout']) {
  test(`API ${failure} falls back and sends only selected answers`, async ({ page }) => {
    await page.addInitScript(() => { window.SPENDWISE_CONFIG = { nudgeApiEndpoint: 'https://example.test/insight' }; });
    let sent;
    await page.route('https://example.test/insight', async route => {
      sent = route.request().postDataJSON();
      if (failure === 'http') await route.fulfill({ status: 503, body: '{}' });
      // An unresolved route exercises the four-second AbortController timeout.
    });
    await page.goto('/spendwise/demo.html');
    await questions(page);
    await expect(page.locator('#swd-insight')).toContainText('You planned this one', { timeout: 6000 });
    expect(sent).toEqual({ feeling: 'Good', planned: 'Been planning it', wait: 'Yes, easy' });
  });
}

test('reason is cleared on restart and never interpreted as markup', async ({ page }) => {
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.getByRole('textbox', { name: 'Your reason' }).fill('</textarea><img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue shopping', exact: true }).click();
  await page.getByRole('button', { name: 'Start another reflection' }).click();
  expect(await page.evaluate(() => window.SpendWise.state.reason)).toBe('');
});

test('valid API insight is displayed as plain text', async ({ page }) => {
  await page.addInitScript(() => { window.SPENDWISE_CONFIG = { nudgeApiEndpoint: 'https://example.test/insight' }; });
  await page.route('https://example.test/insight', route => route.fulfill({ json: { insight: '<strong>Take your time.</strong>' } }));
  await page.goto('/spendwise/demo.html');
  await questions(page);
  await expect(page.locator('#swd-insight')).toHaveText('<strong>Take your time.</strong>');
  await expect(page.locator('#swd-insight strong')).toHaveCount(0);
  await expect(page.locator('#swd-meta')).toContainText('AWS Lambda');
});

test('grounding timer enables continue and exit clears pending timer', async ({ page }) => {
  await page.clock.install();
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  for (let i = 0; i < 3; i++) {
    const urgent = page.getByRole('radio', { name: 'I need it now', exact: true });
    await (await urgent.count() ? urgent : page.getByRole('radio').first()).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await page.clock.runFor(10000);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Pause complete');
  await page.getByRole('button', { name: 'Exit reflection' }).click();
  await page.getByRole('button', { name: 'Start another reflection' }).click();
  await page.clock.runFor(10000);
  await expect(page.getByRole('button', { name: "Start reflection" })).toBeVisible();
  await expect(page.getByRole('status')).toBeEmpty();
});

async function tabToButton(page, name) {
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(label => document.activeElement?.tagName === 'BUTTON' && document.activeElement.textContent.trim() === label, name)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard could not reach ${name}`);
}

test('complete and restart using only Tab, Space, arrows, and Enter', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/spendwise/demo.html');
  await tabToButton(page, "Start reflection");
  await page.keyboard.press('Enter');
  await tabToButton(page, 'Skip camera');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio').first()).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio').nth(1)).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await tabToButton(page, "Skip. I'd rather not say");
  await page.keyboard.press('Enter');
  await expect(page.locator('#swd-insight')).not.toHaveText('Preparing your reflection…');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Consider later', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Consider it later', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Start another reflection' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Quick check before this one' })).toBeFocused();
  expect(await page.evaluate(() => window.SpendWise.state.answers)).toEqual({});
  expect(errors).toEqual([]);
});

test('reduced-motion demo completes with no animation or hidden outcome', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/spendwise/demo.html');
  await questions(page);
  await page.getByRole('button', { name: 'Dismiss sample item', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Sample item dismissed', exact: true });
  await expect(heading).toBeVisible();
  expect(await page.locator('#demo-mount button').first().evaluate(button => ({ animation: getComputedStyle(button).animationName, transition: getComputedStyle(button).transitionDuration }))).toEqual({ animation: 'none', transition: '0s' });
  await page.getByRole('button', { name: 'Start another reflection' }).click();
  await expect(page.getByRole('button', { name: "Start reflection" })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Back preserves answers and written reason', async ({ page }) => {
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: "Start reflection" }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  const firstAnswer = await page.getByRole('radio').first().getAttribute('value');
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('radio', { name: firstAnswer, exact: true })).toBeChecked();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.getByRole('textbox', { name: 'Your reason', exact: true }).fill('A replacement for my old sweater');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your reason', exact: true })).toHaveValue('A replacement for my old sweater');
});

test('changing urgency with Back adds and removes the optional pause', async ({ page }) => {
  // Keep the urgency question last so this exercises both queue directions.
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: 'Start reflection' }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.getByRole('radio', { name: 'I need it now', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#swd-progress')).toHaveText('Optional pause');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'I need it now', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Yes, easy', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your reason', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('radio', { name: 'I need it now', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip pause' }).click();
  await page.getByRole('textbox', { name: 'Your reason', exact: true }).fill('I will reconsider later');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your reason', exact: true })).toHaveValue('I will reconsider later');
});

test('320px enlarged text keeps choices reachable and explanations collapsible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/spendwise/demo.html');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.locator('#swd-explanation')).not.toHaveAttribute('open', '');
  await expect(page.locator('#demo-project-nav .sidebar-pages')).toBeVisible();
  await questions(page);
  const choices = page.locator('.swd-choice');
  await expect(choices).toHaveCount(3);
  const presentation = await choices.evaluateAll(buttons => buttons.map(button => {
    const css = getComputedStyle(button);
    return { color: css.color, background: css.backgroundColor, fontSize: css.fontSize, fontWeight: css.fontWeight, padding: css.padding, border: css.border, width: button.getBoundingClientRect().width };
  }));
  expect(presentation[0]).toEqual(presentation[1]);
  expect(presentation[1]).toEqual(presentation[2]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Continue shopping', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Continue shopping', exact: true })).toBeVisible();
  await page.getByText('About this step', { exact: true }).click();
  await expect(page.locator('#swd-explanation')).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#demo-project-nav .sidebar-pages')).toBeVisible();
  await expect(page.locator('#swd-explanation')).toHaveAttribute('open', '');
});

test('denied camera is not requested again when returning with Back', async ({ page }) => {
  await page.addInitScript(() => {
    window.cameraRequests = 0;
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { window.cameraRequests++; throw new Error('denied'); } } });
  });
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: 'Start reflection' }).click();
  await page.getByRole('button', { name: 'Use camera' }).click();
  await expect(page.locator('#swd-scan-msg')).toContainText('Camera is not available');
  await page.getByRole('button', { name: 'Skip camera' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use camera' })).toHaveCount(0);
  expect(await page.evaluate(() => window.cameraRequests)).toBe(1);
});

test('Skip written reflection clears its text when returning with Back', async ({ page }) => {
  await page.goto('/spendwise/demo.html');
  await page.getByRole('button', { name: 'Start reflection' }).click();
  await page.getByRole('button', { name: 'Skip camera' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.getByRole('textbox', { name: 'Your reason', exact: true }).fill('Discard this reflection');
  await page.getByRole('button', { name: "Skip. I'd rather not say" }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your reason', exact: true })).toHaveValue('');
});

test('keyboard camera denial moves focus to Skip camera', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new Error('denied'); } } }));
  await page.goto('/spendwise/demo.html');
  await tabToButton(page, 'Start reflection');
  await page.keyboard.press('Enter');
  await tabToButton(page, 'Use camera');
  await page.keyboard.press('Enter');
  await expect(page.locator('#swd-scan-msg')).toContainText('Camera is not available');
  await expect(page.getByRole('button', { name: 'Skip camera' })).toBeFocused();
  await expect(page.locator('#swd-scan-msg')).toHaveAttribute('aria-live', 'polite');
  await page.keyboard.press('Enter');
  await expect(page.locator('fieldset legend')).toBeFocused();
});
