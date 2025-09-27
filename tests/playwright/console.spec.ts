import { test, expect } from '@playwright/test';

test('collect console errors on load', async ({ page }) => {
  const messages: Array<{ type: string; text: string }> = [];

  page.on('console', (message) => {
    messages.push({ type: message.type(), text: message.text() });
  });

  page.on('pageerror', (error) => {
    messages.push({ type: 'pageerror', text: error.message });
  });

  await page.goto('/');
  await page.waitForTimeout(2000);

  const errors = messages.filter((entry) => entry.type === 'error' || entry.type === 'pageerror');

  if (errors.length > 0) {
    const formatted = errors.map((entry) => `[${entry.type}] ${entry.text}`).join('\n');
    console.log('Console errors captured:\n' + formatted);
  } else {
    console.log('No console errors captured.');
  }

  expect(errors, 'No console errors are expected on initial page load').toHaveLength(0);
});
