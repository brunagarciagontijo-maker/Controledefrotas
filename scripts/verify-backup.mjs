import { createReadStream,existsSync,mkdirSync,writeFileSync,realpathSync,statSync } from 'node:fs';
import { resolve,relative,isAbsolute,sep } from 'node:path';
import { createHash } from 'node:crypto';

const position=process.argv.indexOf('--file');
if(position<0||!process.argv[position+1])throw new Error('Informe --file com um backup privado local FORA do repositorio. Nenhuma copia ou conexao sera feita.');
const input=resolve(process.argv[position+1]);
if(!existsSync(input)||!statSync(input).isFile())throw new Error('Arquivo de backup ausente.');
const path=realpathSync(input),child=relative(realpathSync('.'),path);
if(!isAbsolute(child)&&child!=='..'&&!child.startsWith('..'+sep))throw new Error('Mantenha o backup real fora do repositorio e de pastas sincronizadas.');
const hash=createHash('sha256');let bytes=0;
for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}
if(bytes===0)throw new Error('Backup vazio.');
const receipt={sha256:hash.digest('hex'),bytes,checkedAt:new Date().toISOString(),scope:'checksum_only',restoreVerified:false,storageBackupVerified:false};
mkdirSync('.secrets/backup-receipts',{recursive:true});writeFileSync('.secrets/backup-receipts/database.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log('Checksum e tamanho registrados em recibo privado. Nenhum conteudo foi exibido.');
console.log('Isso NAO valida restauracao, consistencia, abrangencia do Auth ou arquivos do Storage. Esses itens permanecem pendentes.');
