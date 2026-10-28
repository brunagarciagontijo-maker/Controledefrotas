import{test}from'node:test';
import assert from'node:assert/strict';
import{originalSourceHashes,currentOriginalSources}from'../scripts/original-sources.ts';
test('liberacao exige exatamente sete templates atuais; recibo anterior ou fonte alterada falha',()=>{
  const files=originalSourceHashes();assert.equal(Object.keys(files).length,7);assert.equal(currentOriginalSources(files),true);assert.equal(currentOriginalSources({...files,'003_operations.sql':'0'.repeat(64)}),false);const prior={...files};delete prior['007_oil_checks.sql'];assert.equal(currentOriginalSources(prior),false);assert.equal(currentOriginalSources(undefined),false);
});
