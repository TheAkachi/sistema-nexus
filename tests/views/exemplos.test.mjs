import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as exemplos from './exemplos.mjs';

// Os exemplos copiados para cá precisam continuar iguais aos do docs/CONTRATO.md: se o back mudar um exemplo, este teste
// avisa o front antes de a tela divergir do vm.
const contrato=(await readFile(new URL('../../docs/CONTRATO.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const secao=t=>{const i=contrato.indexOf(`\n### ${t}`);assert.ok(i>=0,t);const f=contrato.indexOf('\n### ',i+1);return contrato.slice(i,f<0?undefined:f);};

test('os vms de exemplo são os da seção 6 do contrato',()=>{
  for(const [titulo,nomes] of Object.entries(exemplos.SECOES)) {
    const blocos=[...secao(titulo).matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));
    assert.equal(blocos.length,nomes.length,titulo);
    nomes.forEach((n,i)=>assert.deepEqual(exemplos[n],blocos[i],`${titulo}: ${n}`));
  }
});
