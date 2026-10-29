// Somente hashes de templates locais. Nao configura destino ou libera operacoes.
import{mkdirSync,writeFileSync}from'node:fs';
import{originalSourceHashes}from'./original-sources.ts';
import{ORIGINAL_SCHEMA_VERSION}from'../src/config/originalRelease.ts';
const files=originalSourceHashes();mkdirSync('.cache/original-review',{recursive:true});
writeFileSync('.cache/original-review/candidate-hashes.json',JSON.stringify({status:'templates_only_not_approved_not_applied',schemaVersion:ORIGINAL_SCHEMA_VERSION,files},null,2)+'\n');
console.log('Hashes locais recalculados para sete candidatos. Sem aprovacao, renderizacao de destino ou acesso remoto.');
