import { expect, test } from '@playwright/test';

test('real high resolution job cancels and restarts without stale results', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Paso temporal').fill('0.001');
  const panel=page.locator('.solver-panel');
  await panel.getByRole('button',{name:'Buscar soluciones'}).click();
  await expect(panel.getByRole('button',{name:'Cancelar búsqueda'})).toBeEnabled();
  await panel.getByRole('button',{name:'Cancelar búsqueda'}).click();
  await expect(panel.locator('.solver-state')).toContainText('Búsqueda cancelada');
  await panel.getByRole('button',{name:'Buscar soluciones'}).click();
  await expect(panel.locator('.solver-state')).not.toContainText('Búsqueda cancelada');
  await expect(panel.locator('.solver-progress-grid')).toBeVisible({timeout:30000});
});

test('Worker creation failure is surfaced and the next search recovers', async ({page}) => {
  await page.addInitScript(() => {
    const NativeWorker=window.Worker;
    let fail=true;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (fail) { fail=false; throw new Error('Fallo de prueba al crear Worker'); }
        super(url,options);
      }
    };
  });
  await page.goto('/');
  const panel=page.locator('.solver-panel');
  await panel.getByRole('button',{name:'Buscar soluciones'}).click();
  await expect(panel.getByRole('alert')).toContainText('Fallo de prueba al crear Worker');
  await panel.getByRole('button',{name:'Buscar soluciones'}).click();
  await expect(panel.locator('.solver-progress-grid')).toBeVisible({timeout:30000});
});
