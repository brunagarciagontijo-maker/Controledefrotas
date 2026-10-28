import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.use({ baseURL: 'http://127.0.0.1:5274', reducedMotion: 'reduce' });
let external: string[], errors: string[];
test.beforeEach(async ({ page }) => {
  external = []; errors = [];
  await page.clock.setFixedTime(new Date('2026-10-27T13:00:00Z'));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { const origin = new URL(route.request().url()).origin; if (origin !== 'http://127.0.0.1:5274') { external.push(origin); return route.abort(); } return route.continue(); });
});
test.afterEach(() => { expect(external).toEqual([]); expect(errors).toEqual([]); });
async function enter(page: Page, role = 'administrador', url = '/') {
  await page.goto(url); await page.getByRole('button', { name: `Simular ${role}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Controle de Veículos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar lista', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
}
const navigate = async(page:Page,name:string)=>{const oldBank=name==='Banco',oldReports=name==='Relat\u00f3rios';await page.getByRole('navigation',{name:'Navega\u00e7\u00e3o principal'}).getByRole('button',{name:oldBank||oldReports?'Gest\u00e3o':name,exact:true}).click();if(oldBank||oldReports)await page.getByRole('navigation',{name:'Se\u00e7\u00f5es da gest\u00e3o'}).getByRole('button',{name:oldReports?'Indicadores':'Registros anteriores',exact:true}).click();};
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const nav = await page.getByRole('navigation', { name: 'Navegação principal' }).boundingBox(); expect(nav).not.toBeNull();
  expect(nav!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}
async function sign(page: Page) {
  const canvas=page.locator('canvas').last();await canvas.scrollIntoViewIfNeeded();const bounds=await canvas.boundingBox();if(!bounds)throw new Error('Assinatura indisponível');
  await page.mouse.move(bounds.x+20,bounds.y+30);await page.mouse.down();await page.mouse.move(bounds.x+70,bounds.y+60,{steps:8});await page.mouse.move(bounds.x+140,bounds.y+20,{steps:8});await page.mouse.up();
  await expect(page.getByText('Assinatura capturada',{exact:true}).last()).toBeVisible();
}

test('identidade original e quatro entradas com Registro integrado ao Patio', async ({ page }, info) => {
  test.setTimeout(90000); await enter(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('button')).toHaveCount(4);
  await expect(nav.getByRole('button',{name:'Registro',exact:true})).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Pátio', exact: true })).toHaveCSS('color', 'rgb(37, 99, 235)');
  expect(await page.locator('header').evaluate(element => getComputedStyle(element).backdropFilter)).toContain('blur');
  await expect(page.getByAltText('Logo Gontijo')).toHaveAttribute('src', '/gontijofundacoes_logo.jpg');
  await expect(page.locator('.decoration-sphere')).toHaveCount(6);
  mkdirSync('.cache/visual-audit', { recursive: true });
  for (const [label, file, heading] of [['Pátio', 'patio', 'Portaria'], ['Banco', 'gestao-registros', 'Gest\u00e3o'], ['Relat\u00f3rios', 'gestao-indicadores', 'Gest\u00e3o'], ['Veículos', 'veiculos', 'Gestao de Veiculos']]) {
    await navigate(page, label); await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0); await fits(page);
    await page.screenshot({ path: `.cache/visual-audit/${file}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
    await expect(page).toHaveScreenshot(`${file}.png`, { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.005 });
  }
  await navigate(page, 'Pátio');await page.getByRole('button',{name:'Registrar saída',exact:true}).first().click();
  await fits(page);await expect(page).toHaveScreenshot('saida-integrada.png',{fullPage:true,animations:'disabled',maxDiffPixelRatio:0.005});
  const image = await page.getByRole('button', { name: 'Confirmar saída', exact: true }).evaluate(element => getComputedStyle(element).backgroundImage);
  expect(image).toContain('rgb(220, 38, 38)'); expect(image).toContain('rgb(185, 28, 28)');
});

test('Banco preserva busca, filtros, detalhes, assinaturas e exportacoes', async ({ page }) => {
  await enter(page); await navigate(page, 'Banco');
  await expect(page.getByRole('button', { name: 'Exportar CSV', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Utilização Diária Excel', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir Relatório', exact: true })).toBeVisible();
  await page.getByPlaceholder('Buscar por placa/veículo ou nome...').fill('TESTE-2');
  await page.getByRole('button', { name: 'Ver detalhes', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Detalhes do Registro', exact: true });
  await expect(dialog).toBeVisible(); await expect(dialog.getByText('TESTE-2', { exact: true })).toBeVisible();
  await expect(dialog.locator('img')).toHaveCount(2);
  await expect.poll(()=>dialog.locator('img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await page.getByLabel('Status dos registros anteriores').selectOption('Em uso');
  await expect(page.getByRole('button', { name: 'Ver detalhes', exact: true })).toHaveCount(0);
  await page.getByLabel('Status dos registros anteriores').selectOption('Todos');
  await page.getByLabel('Registros desde',{exact:true}).fill('2026-10-28');await expect(page.getByRole('button',{name:'Ver detalhes',exact:true})).toHaveCount(0);await page.getByLabel('Registros desde',{exact:true}).fill('');await expect(page.getByRole('button',{name:'Ver detalhes',exact:true})).toHaveCount(1);
  const csv = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click(); expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
});

test('Pátio recupera funcionarios, motoristas, timeline e busca por codigo', async ({ page }) => {
  await enter(page);
  await page.getByLabel('Buscar veículo no pátio').fill('101');
  await expect(page.getByRole('button', { name: 'Registrar saída', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await page.getByRole('button', { name: 'Funcionários', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cadastro de pessoas', exact: true })).toBeVisible();
  await page.getByLabel('Nome completo', { exact: false }).fill('Funcionário fictício adicional');
  await page.getByRole('button', { name: 'Adicionar pessoa', exact: true }).click();
  await expect(page.getByText('Funcionário fictício adicional', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Fluxos da portaria' }).getByRole('button', { name: 'Motoristas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Controle de motoristas', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Fluxos da portaria' }).getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible(); await fits(page);
});

test('inspecoes preservam notificacao, checklist, modal e conclusao local', async ({ page }) => {
  await enter(page, 'porteiro'); await page.getByRole('button', { name: 'Inspeções de veículo', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar inspeção', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Concluir inspeção', exact: true });
  await expect(modal).toBeVisible(); await expect(modal.getByRole('button', { name: 'Concluir inspeção', exact: true })).toBeDisabled();
  for (const checkbox of await modal.getByRole('checkbox').all()) await checkbox.check();
  await modal.getByRole('button', { name: 'Concluir inspeção', exact: true }).click();
  await expect(page.getByText('Nenhuma inspeção pendente.', { exact: true })).toBeVisible();
});

test('porteiro conserva acesso operacional sem controles administrativos', async ({ page }) => {
  await enter(page, 'porteiro', '/?tab=patio&code=101');
  await expect(page.getByLabel('Buscar veículo no pátio')).toHaveValue('101');
  const flows = page.getByRole('navigation', { name: 'Fluxos da portaria' });
  await expect(flows.getByRole('button', { name: 'Funcionários', exact: true })).toHaveCount(0);
  await expect(flows.getByRole('button', { name: 'Motoristas', exact: true })).toHaveCount(0);
  await navigate(page, 'Sair'); await page.getByRole('button', { name: 'Continuar no sistema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Portaria', exact: true })).toBeVisible();
  await navigate(page, 'Sair'); await page.getByRole('button', { name: 'Confirmar saída da conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simular porteiro', exact: true })).toBeVisible();
});

test('assinatura obrigatoria permite limpar, assinar e consultar sem alterar Cobli',async({page})=>{
  await enter(page,'porteiro','/?tab=registro');
  await page.getByText('Motivo e autorização (informações complementares)',{exact:true}).click();await page.getByLabel('Motivo da utilização',{exact:true}).fill('Destino fictício');await page.getByLabel('Autorização informada',{exact:true}).fill('Autorização fictícia declarada');
  await page.getByLabel('Veículo da saída').selectOption({label:'101 · TESTE-1 · Veículo fictício 1'});
  await page.getByLabel('Motorista da saída').selectOption({label:'Pessoa fictícia 1'});await page.getByLabel('Odômetro de saída').fill('100');
  await page.getByLabel('Motorista associado',{exact:true}).check();
  const confirm=page.getByRole('button',{name:'Confirmar saída',exact:true});await expect(confirm).toBeDisabled();await sign(page);await expect(confirm).toBeEnabled();
  await page.getByRole('button',{name:'Limpar',exact:true}).click();await expect(confirm).toBeDisabled();await sign(page);
  await page.getByLabel('Motorista da saída').selectOption('');await page.getByLabel('Motorista da saída').selectOption({label:'Pessoa fictícia 1'});await expect(page.getByText('Assinatura capturada',{exact:true})).toHaveCount(0);await page.getByLabel('Motorista associado',{exact:true}).check();await expect(confirm).toBeDisabled();await sign(page);await confirm.click();
  await navigate(page,'Banco');await page.getByRole('button',{name:'Movimentações da Portaria',exact:true}).click();
  await page.getByLabel('Buscar movimentações').fill('TESTE-1');await page.getByRole('button',{name:'Detalhes da movimentação',exact:true}).click();
  const details=page.getByRole('dialog',{name:'Detalhes da movimentação',exact:true});await details.getByText('Assinatura do responsável pela saída',{exact:true}).click();
  await expect(details.getByText('Motivo da utilização: Destino fictício',{exact:true})).toBeVisible();await expect(details.getByText('Autorização informada: Autorização fictícia declarada',{exact:true})).toBeVisible();
  await expect(details.getByRole('img',{name:'Assinatura do responsável pela saída',exact:true})).toBeVisible();
  await expect(details.getByText('Associação Cobli confirmada manualmente · fotos dispensadas',{exact:true})).toBeVisible();
});

test('frota preserva cadastro, edicao, busca e geracao de QR local',async({page})=>{
  await enter(page);await navigate(page,'Veículos');
  await page.getByLabel('Placa',{exact:false}).fill('FICT-9');await page.getByLabel(/^Nome/).fill('Veículo fictício novo');await page.getByLabel('Responsável/Motorista',{exact:false}).fill('Responsável fictício');
  await page.getByRole('button',{name:'Cadastrar veiculo',exact:true}).click();await page.getByPlaceholder('Buscar por placa ou nome',{exact:true}).fill('FICT-9');
  await expect(page.getByRole('heading',{name:'FICT-9',exact:true})).toBeVisible();await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel(/^Nome/).fill('Veículo fictício editado');await page.getByRole('button',{name:'Salvar alteracoes',exact:true}).click();
  await expect(page.getByText('Veículo fictício editado',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Gerar QR',exact:true}).click();
  const qr=page.getByRole('dialog',{name:'QR Code do veiculo',exact:true});await expect(qr.getByAltText('QR Code do veiculo FICT-9',{exact:true})).toHaveAttribute('src',/^data:image\/png;base64,/);await fits(page);
});

test('devolucao legada preserva retirada e exige nome e nova assinatura',async({page})=>{
  await enter(page);await navigate(page,'Banco');await page.getByPlaceholder('Buscar por placa/veículo ou nome...').fill('HIST-4');
  await page.getByRole('button',{name:/Registrar devolução|Devol\./}).first().click();const dialog=page.getByRole('dialog',{name:'Registrar Devolucao',exact:true});
  await expect(dialog).toBeVisible();await dialog.locator('input[type=date]:enabled').fill('2026-10-27');await dialog.locator('input[type=time]:enabled').fill('10:15');await dialog.getByLabel(/^Nome/).and(dialog.locator('input:enabled')).fill('Responsável fictício pela devolução');
  await sign(page);await dialog.locator('button[type=submit]').click();await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Ver detalhes',exact:true}).first().click();const details=page.getByRole('dialog',{name:'Detalhes do Registro',exact:true});await expect(details.getByText('Responsável fictício pela devolução',{exact:true})).toBeVisible();await expect(details.locator('img')).toHaveCount(2);
});
