import{createHash}from'node:crypto';
import{readFileSync}from'node:fs';
import{ORIGINAL_MIGRATIONS}from'../src/config/originalRelease.ts';

export function originalSourceHashes():Record<string,string>{
  return Object.fromEntries(ORIGINAL_MIGRATIONS.map(name=>[name,createHash('sha256').update(readFileSync(new URL('../supabase/original/incremental/'+name,import.meta.url))).digest('hex')]));
}
export function currentOriginalSources(value:unknown):boolean{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const hashes=value as Record<string,unknown>,current=originalSourceHashes();
  return Object.keys(hashes).length===ORIGINAL_MIGRATIONS.length&&ORIGINAL_MIGRATIONS.every(name=>hashes[name]===current[name]);
}
