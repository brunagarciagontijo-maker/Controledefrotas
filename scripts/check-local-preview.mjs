// Verifica somente o Vite demo ja aberto em loopback. Nao inicia servidores.
import { chromium, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const origin='http://127.0.0.1:5173';
const executablePath=[join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].find(existsSync);
if(!executablePath)throw new Error('Navegador existente nao encontrado. Nenhum download sera feito.');
const browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
let external=0;
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external++;return route.abort();}return route.continue();});
  await page.routeWebSocket('**',socket=>{const url=new URL(socket.url());if(url.hostname==='127.0.0.1'&&url.port==='5173'){socket.connectToServer();}else{external++;socket.close();}});
  const response=await page.goto(origin,{waitUntil:'networkidle'});
  if(response?.status()!==200)throw new Error('O preview local nao respondeu corretamente.');
  await expect(page.getByText('SIMULAÇÃO LOCAL',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Simular administrador',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Portaria',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Registrar saída',exact:true})).toHaveCount(3);
  if(external)throw new Error('Conexao externa tentada; preview bloqueado para revisao.');
  mkdirSync('.cache/visual-audit',{recursive:true});
  await page.screenshot({path:'.cache/visual-audit/live-5173.png',fullPage:true,animations:'disabled'});
  console.log(JSON.stringify({origin,status:200,mode:'demo',menuEntries:4,externalRequests:external,readyForReview:true}));
}finally{await browser.close();}
