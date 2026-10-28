import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('as 21 migrations historicas correspondem ao manifesto de origem', () => {
  const manifest = JSON.parse(readFileSync(new URL('../supabase/dev/history-manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.files.length,21);
  assert.equal(readdirSync(new URL('../supabase/migrations',import.meta.url)).filter(f=>f.endsWith('.sql')).length,21);
  for (const file of manifest.files) {
    const contents=readFileSync(new URL('../supabase/migrations/'+file.name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
    assert.equal(createHash('sha256').update(contents).digest('hex'),file.sha256,file.name);
  }
});
test('arquivos demonstrativos sao PNG e PDF pequenos e sem validade', () => {
  const png=readFileSync(new URL('../supabase/dev/assets/foto-teste.png',import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.ok(png.includes(Buffer.from('DADO FICTICIO - SEM VALIDADE')));
  const pdf=readFileSync(new URL('../supabase/dev/assets/documento-teste.pdf',import.meta.url),'utf8');
  assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.includes('SEM VALIDADE'));
});
