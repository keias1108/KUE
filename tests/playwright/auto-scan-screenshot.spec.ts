import { test, expect } from '@playwright/test';

test('auto scan surfaces seeds and replay reveals canvas', async ({ page }, testInfo) => {
  await page.goto('/');

  const scanButton = page.getByRole('button', { name: 'Scan 6 Seeds' });
  await scanButton.click();

  const results = page.getByTestId('auto-scan-results');
  await expect(results).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId('auto-scan-result').first()).toBeVisible();

  const scanScreenshot = testInfo.outputPath('auto-scan-overview.png');
  await page.screenshot({ path: scanScreenshot, fullPage: true });
  testInfo.attach('auto-scan-overview', { path: scanScreenshot, contentType: 'image/png' });

  await page.getByTestId('auto-scan-replay').first().click();

  const canvas = page.locator('canvas');
  await expect(canvas.first()).toBeVisible();
  await expect(canvas.first()).toBeInViewport();

  const replayScreenshot = testInfo.outputPath('auto-scan-replay.png');
  await page.screenshot({ path: replayScreenshot, fullPage: true });
  testInfo.attach('auto-scan-replay', { path: replayScreenshot, contentType: 'image/png' });
});
