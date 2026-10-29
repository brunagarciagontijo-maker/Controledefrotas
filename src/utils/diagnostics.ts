const SAFE_CODES=new Set(['42501','23505','23514','23503','23502','22P02','P0001','57014','08006']);

// Nao registrar message/details/stack do SDK: podem conter documentos ou valores de linhas.
export function reportError(event:string,error:unknown):void {
  const candidate=error&&typeof error==='object'&&'code'in error?(error as {code:unknown}).code:undefined;
  const code=typeof candidate==='string'&&(SAFE_CODES.has(candidate)||/^PGRST\d{3}$/.test(candidate))?candidate:'UNCLASSIFIED';
  console.error('[Portaria]',event,code);
}
