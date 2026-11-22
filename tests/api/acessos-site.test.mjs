import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { contexto } from '../../api/data/assinaturas.mjs';
import { obterFicha } from '../../api/data/clientes.mjs';
import { ambiente } from './ambiente.mjs';

// O endereço dos acessos ao painel do site em cada empresa da ficha (contrato 6.7, v0.12.0): só a URL da lista do admin do
// site já na empresa. A gestão não convida, não vê convites, e a integração continua só lendo empresas e planos.
let t,s,cliente;
const ORIGEM='https://site.exemplo.test',CENTRO='clinica-vida-plena-centro';
before(async()=>{
  t=await ambiente();s=await t.sessao('acessos@exemplo.test');
  cliente=(await t.req('/api/clientes',{method:'POST',s,body:{nome:'Clínica Vida Plena'}})).json.id;
});
after(async()=>{await t?.fim();});

test('ficha e vínculo: cada empresa com o endereço da lista de acessos do admin do site, já na empresa',async()=>{
  const v=await t.req(`/api/clientes/${cliente}/empresas/${CENTRO}`,{method:'POST',body:{},s});
  assert.equal(v.status,201);
  assert.equal(v.json.empresas[0].acessosUrl,`${ORIGEM}/admin/acessos?empresa=${CENTRO}`);
  const f=(await t.req(`/api/clientes/${cliente}`,{s})).json;
  assert.deepEqual(f.empresas.map(e=>[e.id,e.acessosUrl]),[[CENTRO,`${ORIGEM}/admin/acessos?empresa=${CENTRO}`]]);
  const semOrigem=await obterFicha(t.db,cliente,await contexto(t.db,{now:t.agora,siteOrigin:''}));
  assert.deepEqual(semOrigem.empresas.map(e=>e.acessosUrl),['']);
});

test('a integração não muda: nenhum pedido ao site além das rotas de empresas e planos',async()=>{
  assert.ok(t.site.pedidos.length>0);
  for(const p of t.site.pedidos)assert.match(p.url,/^\/api\/integracao\/v1\/(empresas|planos)(\?|\/|$)/,p.url);
  assert.ok(!t.site.pedidos.some(p=>/acessos|convite|usuarios/.test(p.url)));
});
