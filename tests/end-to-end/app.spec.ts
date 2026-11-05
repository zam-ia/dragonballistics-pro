import { expect, test } from '@playwright/test';

test('opens, navigates, persists geometry and recovers unknown routes', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Laboratorio de geometria' })).toBeVisible();
  await expect(page.getByText('Geometria validada')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Laboratorio de geometria' })).toBeVisible();

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
