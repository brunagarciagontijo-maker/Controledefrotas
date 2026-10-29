import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, parseProfile, type AppProfile, type Capability } from '../src/auth/authorization.ts';
import { escapeHtml, csvCell } from '../src/utils/html.ts';
import { safeSignatureSource } from '../src/utils/signature.ts';

const profile: AppProfile = { user_id: '00000000-0000-4000-8000-000000000001', display_name: 'Conta ficticia', role: 'porteiro', is_active: true };
test('perfil invalido ou sem permissao nao e promovido a administrador', () => {
  for (const candidate of [null, {}, { ...profile, role: 'owner' }, { ...profile, is_active: 'true' }, { ...profile, user_id: 'invalid' }]) assert.equal(parseProfile(candidate), null);
});
test('inativo e usuario sem perfil nao possuem capacidades', () => {
  for (const capability of ['view','operate','manage_catalog','delete_records','request_inspection','complete_inspection'] as Capability[]) {
    assert.equal(can(null, capability), false);
    assert.equal(can({ ...profile, is_active: false }, capability), false);
  }
});
test('porteiro opera e conclui; gestao e exclusao exigem administrador', () => {
  for (const capability of ['view','operate','complete_inspection'] as Capability[]) assert.equal(can(profile, capability), true);
  for (const capability of ['manage_catalog','manage_people','delete_records','request_inspection'] as Capability[]) {
    assert.equal(can(profile, capability), false);
    assert.equal(can({ ...profile, role: 'admin' }, capability), true);
  }
});
test('impressao escapa HTML e CSV trata aspas e formulas', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(csvCell('texto "citado"'), '"texto ""citado"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
});
test('assinatura nao pode carregar imagens remotas ou SVG', () => {
  assert.equal(safeSignatureSource('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  for (const value of ['https://other.example.invalid/signature.png','data:image/svg+xml;base64,AAAA','javascript:alert(1)']) assert.equal(safeSignatureSource(value),'');
});
