import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const browser = [
  join(process.env.ProgramFiles || 'C:/Program Files','Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);

if (!browser) throw new Error('Chrome ou Edge nao localizado. Nenhum navegador sera baixado automaticamente.');

export default defineConfig({
  testDir: './tests/browser', outputDir: '.cache/browser-results', workers: 1,
  snapshotPathTemplate: '.cache/visual-baselines/{projectName}/{testFilePath}/{arg}{ext}',
  reporter: [['list']], timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5273', headless: true,
    launchOptions: { executablePath: browser, args: ['--disable-background-networking','--disable-component-update','--disable-sync','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  globalSetup: './tests/browser/global-setup.ts',
});
