import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
// Confere a sintaxe de todo .mjs/.js de api/, scripts/, tests/ e p2/, incluindo subpastas (cópia do site).
const root=new URL('../',import.meta.url);
for(const dir of ['api','scripts','tests','p2']) for(const entry of await readdir(new URL(`${dir}/`,root),{recursive:true,withFileTypes:true})) {
  if(!entry.isFile()||!/\.(mjs|js)$/.test(entry.name)) continue;
  const file=`${entry.parentPath||entry.path}/${entry.name}`;
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0) { console.error(result.stderr); process.exit(1); }
}
console.log('Sintaxe dos módulos validada.');
