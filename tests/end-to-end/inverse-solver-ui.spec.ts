import { expect, test } from '@playwright/test';

test('solver panel validation and responsive layouts', async ({ page }) => {
  for (const view of [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 390, height: 844, name: 'mobile' },
  ]) {
    await page.setViewportSize(view);
    await page.goto('/');
    const panel = page.locator('.solver-panel');
    await expect(panel.getByRole('heading', { name: 'SOLUCIONADOR INVERSO' })).toBeVisible();
    await expect(panel.getByLabel('Objetivo del solucionador')).toHaveValue('workspace-target');
    await expect(panel.getByText('10.00 u')).toBeVisible();
    if (view.name === 'mobile') {
      const searchButton = await panel
        .getByRole('button', { name: 'Buscar soluciones' })
        .boundingBox();
      const cancelButton = await panel
        .getByRole('button', { name: 'Cancelar búsqueda' })
        .boundingBox();
      expect(searchButton).not.toBeNull();
      expect(cancelButton).not.toBeNull();
      expect(cancelButton!.y).toBeGreaterThanOrEqual(searchButton!.y + searchButton!.height);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: 'test-results/visuals/solver-' + view.name + '.png',
      fullPage: true,
      animations: 'disabled',
    });
  }
  const panel = page.locator('.solver-panel');
  await panel.getByLabel('Ángulo mínimo (°)').fill('95');
  await panel.getByRole('button', { name: 'Buscar soluciones' }).click();
  await expect(panel.getByRole('alert')).toContainText('Rango angular inválido');
});
