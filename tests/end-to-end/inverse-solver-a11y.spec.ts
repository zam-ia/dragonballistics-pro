import { expect, test } from '@playwright/test';

test('keyboard workflow, live status and no browser console failures', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  const panel = page.locator('.solver-panel');
  const angleMin = panel.getByLabel('Ángulo mínimo (°)');
  const angleMax = panel.getByLabel('Ángulo máximo (°)');
  await angleMin.focus();
  await page.keyboard.press('Tab');
  await expect(angleMax).toBeFocused();
  const start = panel.getByRole('button', { name: 'Buscar soluciones' });
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('[aria-live=polite]')).toBeVisible();
  await expect(panel.locator('.solver-progress-grid')).toBeVisible({ timeout: 30000 });
  await expect(panel.locator('.solver-state')).not.toContainText('Error');
  expect(errors).toEqual([]);
});
