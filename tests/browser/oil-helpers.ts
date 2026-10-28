import type { Locator } from '@playwright/test';
export async function confirmYardOil(row: Locator, level = 'normal') {
  await row.getByRole('button', { name: 'OK', exact: true }).click();
  await row.getByRole('combobox', { name: /Nível atual do óleo/ }).selectOption(level);
  await row.getByRole('button', { name: 'Confirmar OK e óleo', exact: true }).click();
}
