import { expect, test } from '@playwright/test';

test('opens, navigates, persists geometry and recovers unknown routes', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Simulador balistico 2D' })).toBeVisible();
  await expect(page.getByText('Motor fisico activo')).toBeVisible();
  await expect(page.getByLabel('Punto objetivo X')).toHaveValue('680');

  await page.getByLabel('Punto objetivo X').fill('712.5');
  await expect(page.getByLabel('Punto objetivo X')).toHaveValue('712.5');
  await page.waitForTimeout(150);
  await page.reload();
  await expect(page.getByLabel('Punto objetivo X')).toHaveValue('712.5');

  await page.getByRole('link', { name: 'Investigacion' }).click();
  await expect(page.getByRole('heading', { name: 'Investigacion de referencias' })).toBeVisible();
  await expect(page.getByText('5 repositorios revisados')).toBeVisible();

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes de interfaz' })).toBeVisible();
  await page.getByLabel('Tema visual').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.goto('/ruta-inexistente');
  await expect(page.getByRole('heading', { name: 'Este modulo no existe' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir al laboratorio' }).click();
  await expect(page.getByRole('heading', { name: 'Simulador balistico 2D' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('switches between four independent workspaces', async ({ page }) => {
  await page.goto('/');
  const selector = page.getByLabel('Espacio activo');
  await expect(selector.locator('option')).toHaveCount(4);

  await selector.selectOption('workspace-2');
  await page.getByLabel('Punto de lanzamiento X').fill('240');
  await expect(page.getByLabel('Punto de lanzamiento X')).toHaveValue('240');

  await selector.selectOption('workspace-1');
  await expect(page.getByLabel('Punto de lanzamiento X')).not.toHaveValue('240');

  await selector.selectOption('workspace-2');
  await expect(page.getByLabel('Punto de lanzamiento X')).toHaveValue('240');
});

test('recalculates trajectory controls and compares a second simulation', async ({ page }) => {
  await page.goto('/');
  const rangeMetric = page
    .getByRole('article')
    .filter({ hasText: 'ALCANCE HORIZONTAL' })
    .locator('strong');
  const initialRange = await rangeMetric.textContent();

  await page.getByLabel('Angulo de lanzamiento').fill('35');
  await page.getByLabel('Potencia', { exact: true }).fill('60');
  await page.getByLabel('Magnitud del viento').fill('1.5');
  await expect(rangeMetric).not.toHaveText(initialRange ?? '');

  await page.getByLabel('Comparar segunda simulacion').check();
  await expect(page.getByText('COMPARACION')).toBeVisible();
  await page.getByLabel('Angulo de comparacion').fill('70');
  await page.getByLabel('Potencia de comparacion').fill('50');

  await page.getByLabel('Modelo de viento').selectOption('linear-drag');
  await expect(page.getByLabel('Coeficiente de arrastre')).toBeVisible();
  await page.getByLabel('Coeficiente de arrastre').fill('0.08');

  await page.reload();
  await expect(page.getByLabel('Angulo de lanzamiento')).toHaveValue('35');
  await expect(page.getByLabel('Comparar segunda simulacion')).toBeChecked();
  await expect(page.getByLabel('Modelo de viento')).toHaveValue('linear-drag');
});
