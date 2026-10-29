import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportError } from '../src/utils/diagnostics.ts';

test('diagnostico nao reproduz mensagem, detalhes, stack ou codigo nao reconhecido',()=>{
  const calls:unknown[][]=[];const original=console.error;console.error=(...args:unknown[])=>{calls.push(args);};
  try{reportError('teste-local',{code:'23505',message:'FICTIONAL_PRIVATE_CANARY',details:'FICTIONAL_PRIVATE_CANARY',stack:'FICTIONAL_PRIVATE_CANARY'});reportError('teste-local',{code:'FICTIONAL_PRIVATE_CANARY'});}finally{console.error=original;}
  assert.ok(!JSON.stringify(calls).includes('FICTIONAL_PRIVATE_CANARY'));assert.equal(calls[0][2],'23505');assert.equal(calls[1][2],'UNCLASSIFIED');
});
