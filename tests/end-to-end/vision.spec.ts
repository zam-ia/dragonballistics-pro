import { expect, test } from '@playwright/test';

test('vision module loads without requesting capture permission', async ({ page }) => {
  await page.goto('/vision');
  await expect(page.getByRole('heading', { name: 'DragonBallistics Vision' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compartir pestaña' })).toBeVisible();
  await expect(page.getByText('SIN FUENTE')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar región' })).toBeDisabled();
  await expect(page.getByText('Lectura física: pendiente de calibración')).toHaveCount(0);
});

test('vision imports a local PNG and processes a marked region', async ({ page }) => {
  await page.goto('/vision');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y6JP2gAAAAASUVORK5CYII=',
    'base64',
  );
  await page.locator('.vision-toolbar input[type=file]').setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByText('ARCHIVO LOCAL')).toBeVisible();
  await expect(page.getByText('1 × 1 px')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar región' }).click();
  const overlay = page.locator('.vision-overlay');
  const rectangle = await overlay.boundingBox();
  if (!rectangle) throw new Error('Missing vision overlay');
  await page.mouse.move(rectangle.x + rectangle.width * 0.2, rectangle.y + rectangle.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(rectangle.x + rectangle.width * 0.7, rectangle.y + rectangle.height * 0.7);
  await page.mouse.up();
  await expect(page.locator('.vision-region-card')).toHaveCount(1);
  await expect(page.locator('.vision-region-card .vision-metrics b').first()).not.toHaveText('—');
});
