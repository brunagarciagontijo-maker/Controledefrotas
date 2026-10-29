import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('sem projeto: tela de preparo, zero conexoes externas e nenhum service worker', async ({ page }, testInfo) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5273') { external.push(url.origin); return route.abort(); }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Preparar ambiente autorizado' })).toBeVisible();
  await expect(page.getByText('A aplicacao esta bloqueada para conexoes remotas.', { exact: false })).toBeVisible();
  await expect(page.locator('input[type=email]')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(external).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(async () => 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  mkdirSync('.cache/browser', { recursive: true });
  await page.screenshot({ path: `.cache/browser/setup-${testInfo.project.name}.png`, fullPage: true });
});

test('flags antigas no localStorage e QR nao permitem contornar o bloqueio', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('isAuthenticated','true'); localStorage.setItem('userRole','admin'); });
  await page.goto('/?tab=patio&veiculo=101');
  await expect(page.getByRole('heading', { name: 'Preparar ambiente autorizado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toHaveCount(0);
});

test('remove worker antigo deste app e preserva cache de outro sistema', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Preparar ambiente autorizado' })).toBeVisible();
  await page.evaluate(async () => {
    await caches.open('outro-sistema-preservar');
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Preparar ambiente autorizado' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(false);
  expect(await page.evaluate(async () => (await caches.keys()).includes('outro-sistema-preservar'))).toBe(true);
});
