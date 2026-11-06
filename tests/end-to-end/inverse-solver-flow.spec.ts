import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/');
  await page.getByLabel('Punto de lanzamiento X').fill('0');
  await page.getByLabel('Punto de lanzamiento Y').fill('0');
  await page.getByLabel('Punto objetivo X').fill('140');
  await page.getByLabel('Punto objetivo Y').fill('1');
  const panel = page.locator('.solver-panel');
  await panel.getByLabel('Ángulo mínimo (°)').fill('10');
  await panel.getByLabel('Ángulo máximo (°)').fill('80');
  await panel.getByLabel('Potencia mínima (u)').fill('40');
  await panel.getByLabel('Potencia máxima (u)').fill('40');
  return panel;
}

test('searches, compares verified arcs, visualizes and applies on explicit action', async ({page}) => {
  const panel = await setup(page);
  const previousAngle = await page.getByLabel('Angulo de lanzamiento').inputValue();
  await panel.getByRole('button',{name:'Buscar soluciones'}).click();
  await expect(panel.locator('.solver-hit').first()).toBeVisible({timeout:30000});
  await expect(panel.getByText('Arco bajo',{exact:true}).first()).toBeVisible();
  await expect(panel.getByText('Arco alto',{exact:true}).first()).toBeVisible();
  await expect(page.getByLabel('Angulo de lanzamiento')).toHaveValue(previousAngle);
  await panel.locator('.solver-result').filter({hasText:'Impacto verificado'}).first().click();
  await expect(page.locator('canvas[data-inverse-overlay=visible]')).toBeVisible();
  await panel.getByRole('button',{name:'Comparar arco bajo y alto'}).click();
  await expect(page.locator('canvas[data-inverse-comparison=visible]')).toBeVisible();
  await panel.getByRole('button',{name:'Ocultar trayectoria inversa'}).click();
  await expect(page.locator('canvas[data-inverse-overlay=hidden]')).toBeVisible();
  await panel.getByRole('button',{name:'Mostrar trayectoria inversa'}).click();
  await panel.getByRole('button',{name:'Aplicar esta solución'}).click();
  await expect(page.getByLabel('Potencia')).toHaveValue('40');
  await expect(page.getByLabel('Angulo de lanzamiento')).not.toHaveValue(previousAngle);
});

test('switching workspace or changing target invalidates ongoing searches', async ({page}) => {
  const panel = await setup(page);
  await page.getByLabel('Paso temporal').fill('0.001');
  await panel.getByRole('button',{name:'Buscar soluciones'}).click();
  await page.getByLabel('Espacio activo').selectOption('workspace-2');
  await expect(page.locator('.solver-results li')).toHaveCount(0);
  await page.getByLabel('Espacio activo').selectOption('workspace-1');
  await expect(page.locator('.solver-results li')).toHaveCount(0);
  await page.locator('.solver-panel').getByRole('button',{name:'Buscar soluciones'}).click();
  await page.getByLabel('Punto objetivo X').fill('141');
  await expect(page.locator('.solver-results li')).toHaveCount(0);
  await expect(page.locator('canvas[data-inverse-overlay=hidden]')).toBeVisible();
});
