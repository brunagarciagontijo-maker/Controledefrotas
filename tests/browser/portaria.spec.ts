import { test as base,expect,type Page,type BrowserContextOptions } from '@playwright/test';
import { mkdirSync } from 'node:fs';
// Isola o dispositivo sintetico do Chrome entre cenarios. A captura continua real via getUserMedia.
const test=base.extend({context:async({playwright,browserName,launchOptions,baseURL},provideContext,info)=>{
  const browser=await playwright[browserName].launch(launchOptions);
  const configured=info.project.use;
  const options:BrowserContextOptions={baseURL};
  for(const key of ['viewport','screen','isMobile','hasTouch','deviceScaleFactor','userAgent','colorScheme','locale','timezoneId'] as const){if(configured[key]!==undefined)Object.assign(options,{[key]:configured[key]});}
  const context=await browser.newContext(options);
  try{await provideContext(context);}finally{await context.close();await browser.close();}
}});
test.use({baseURL:'http://127.0.0.1:5274'});
let external:string[];
test.beforeEach(async({page,context})=>{
  external=[];await context.grantPermissions(['camera'],{origin:'http://127.0.0.1:5274'});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:5274'){external.push(url.origin);return route.abort();}return route.continue();});
  await page.goto('/');await page.getByRole('button',{name:'Simular porteiro',exact:true}).click();await expect(page.getByRole('heading',{name:'Portaria',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Registrar saída',exact:true}).first()).toBeEnabled();
});
test.afterEach(()=>expect(external).toEqual([]));
async function prepareDeparture(page:Page){await page.getByRole('button',{name:'Registrar saída',exact:true}).first().click();await page.getByLabel('Motorista da saída').selectOption({label:'Pessoa fictícia 1'});await page.getByLabel('Odômetro de saída').fill('100');const canvas=page.locator('canvas');await canvas.scrollIntoViewIfNeeded();const bounds=await canvas.boundingBox();if(!bounds)throw new Error('Canvas da assinatura ausente');await page.mouse.move(bounds.x+30,bounds.y+50);await page.mouse.down();await page.mouse.move(bounds.x+100,bounds.y+80,{steps:8});await page.mouse.move(bounds.x+160,bounds.y+40,{steps:8});await page.mouse.up();await expect(page.getByText('Assinatura capturada',{exact:true})).toBeVisible();}
test('saida associada dispensa fotos e retorno recoloca o veiculo no patio',async({page},info)=>{
  await prepareDeparture(page);await expect(page.getByRole('button',{name:'Confirmar saída',exact:true})).toBeDisabled();await page.getByLabel('Motorista associado',{exact:true}).check();await expect(page.getByRole('button',{name:'Abrir câmera'})).toHaveCount(0);await page.getByRole('button',{name:'Confirmar saída',exact:true}).click();await expect(page.getByRole('row',{name:'Ve\u00edculo TESTE-1',exact:true}).getByRole('button',{name:'Registrar entrada',exact:true})).toBeVisible();await page.getByRole('row',{name:'Ve\u00edculo TESTE-1',exact:true}).getByRole('button',{name:'Registrar entrada',exact:true}).click();await page.getByLabel('Odômetro de entrada').fill('120');for(const checkbox of await page.locator('[role="dialog"] input[type=checkbox]').all())await checkbox.check();
  // Modal historico nao usa role; localizar por titulo e seu botao de conclusao.
  if(await page.getByRole('button',{name:'Confirmar entrada',exact:true}).isDisabled())for(const checkbox of await page.locator('input[type=checkbox]').all())await checkbox.check();
  await page.getByRole('button',{name:'Confirmar entrada',exact:true}).click();await expect(page.getByRole('row',{name:'Ve\u00edculo TESTE-1',exact:true}).getByRole('button',{name:'Registrar entrada',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Registrar saída',exact:true})).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);mkdirSync('.cache/browser',{recursive:true});await page.screenshot({path:`.cache/browser/portaria-${info.project.name}.png`,fullPage:true});
});
test('sem Cobli exige motivo e captura dos seis itens antes de concluir',async({page})=>{
  await prepareDeparture(page);await page.getByLabel('Motorista não associado',{exact:true}).check();await page.getByLabel('Motivo informado pelo motorista').fill('Associação não disponível no teste fictício');const finish=page.getByRole('button',{name:'Confirmar saída',exact:true});await expect(finish).toBeDisabled();
  await page.getByRole('button',{name:'Abrir câmera',exact:true}).click();for(let index=0;index<6;index++){await expect(page.getByRole('button',{name:'Capturar foto',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Capturar foto',exact:true}).click();await expect(page.getByText('Fotos capturadas: '+(index+1)+'/6',{exact:true})).toBeVisible();if(index<5)await expect(finish).toBeDisabled();}
  await expect(finish).toBeEnabled();await finish.click();await expect(page.getByRole('row',{name:'Ve\u00edculo TESTE-1',exact:true}).getByRole('button',{name:'Registrar entrada',exact:true})).toBeVisible();
});
test('funcionario nao mostra motivo; visitante exige captura de documento',async({page})=>{
  await page.getByRole('button',{name:'Pessoas',exact:true}).click();await expect(page.getByLabel('Motivo da visita')).toHaveCount(0);await page.getByRole('button',{name:'Visitante',exact:true}).click();await expect(page.getByLabel('Motivo da visita')).toBeVisible();await expect(page.locator('input[type=file]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Abrir câmera',exact:true})).toBeVisible();await page.getByLabel('Nome da pessoa').fill('Visitante fictício');await page.getByLabel('Motivo da visita').fill('Visita fictícia');await page.locator('select').first().selectOption({label:'10001 - Pessoa fictícia 1'});await page.getByRole('button',{name:'Abrir câmera',exact:true}).click();await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);await page.getByRole('button',{name:'Capturar foto',exact:true}).click();await page.getByRole('button',{name:'Registrar entrada',exact:true}).click();await expect(page.getByText('Entrada registrada com sucesso',{exact:true})).toBeVisible();
});
test('conferencia com divergencia preserva disponibilidade e exige observacao',async({page})=>{
  await page.getByRole('button',{name:'Conferência diária',exact:true}).click();await page.getByRole('button',{name:'Iniciar conferência',exact:true}).click();
  const row=page.getByRole('article',{name:'Conferir TESTE-3',exact:true});await expect(row.getByRole('button',{name:'NOK',exact:true})).toBeEnabled();
  await row.getByLabel('Observação de TESTE-3').fill('Veículo não localizado no teste fictício');await row.getByRole('button',{name:'NOK',exact:true}).click();await expect(row.getByText('NOK',{exact:true})).toBeVisible();await expect(row.getByText('Simulação porteiro',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Veículos',exact:true}).first().click();await expect(page.getByRole('button',{name:'Registrar saída',exact:true})).toHaveCount(3);
});
