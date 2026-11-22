import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ambiente } from './ambiente.mjs';

// Páginas de clientes e assinaturas e os avisos da moldura (contrato 6.1 e 6.6 a 6.9).
let t,adm,leitura,cliente,assinatura;
before(async()=>{
  t=await ambiente();adm=await t.sessao('admin@exemplo.test',{nome:'Lucas'});leitura=await t.sessao('leitura@exemplo.test',{papel:'leitura'});
  cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Padaria Pão Dourado',whatsapp:'21900000002'},s:adm})).json.id;
  await t.req(`/api/clientes/${cliente}/empresas/padaria-pao-dourado`,{method:'POST',body:{},s:adm});
  assinatura=(await t.req('/api/assinaturas',{method:'POST',s:adm,body:{cliente,empresa:'padaria-pao-dourado',plano:'plano-avancado',valorCentavos:18000,ciclo:'trimestral',inicio:'2026-07-24',venceEm:'2026-10-24'}})).json;
});
after(async()=>{await t?.fim();});

test('clientes e ficha: para todo papel; criar e editar só com a ação clientes',async()=>{
  const lista=await t.pagina('/clientes?q=pada&page=1',{s:leitura});
  assert.equal(lista.view,'clientes');assert.deepEqual(lista.vm.filtros,{q:'pada',status:'',situacao:'',page:'1'});assert.equal(lista.vm.dados.total,1);
  const ficha=await t.pagina(`/clientes/${cliente}`,{s:leitura});
  assert.deepEqual([ficha.view,ficha.title,ficha.vm.dados.assinaturas[0].situacao],['cliente','Padaria Pão Dourado · Clientes | Gestão Nexus','a-vencer']);
  for(const caminho of ['/clientes/novo',`/clientes/${cliente}/editar`])assert.equal((await t.pagina(caminho,{s:leitura})).status,403,caminho);
  const editar=await t.pagina(`/clientes/${cliente}/editar`,{s:adm});
  assert.deepEqual([editar.view,editar.title,editar.vm.dados.cliente.id],['cliente-form','Editar Padaria Pão Dourado | Gestão Nexus',cliente]);
  assert.deepEqual((await t.pagina('/clientes/novo',{s:adm})).vm.dados,{cliente:null});
  const nada=await t.pagina('/clientes/00000000-0000-4000-8000-000000000000',{s:adm});assert.deepEqual([nada.status,nada.view],[404,'erro']);
  assert.equal((await t.pagina('/clientes/nao-e-uuid',{s:adm})).status,404);
});

test('assinatura: nova e edição, com os planos ativos, o atual mesmo pausado e o aviso site-fora',async()=>{
  const nova=await t.pagina(`/assinaturas/nova?cliente=${cliente}`,{s:adm});
  assert.equal(nova.view,'assinatura-form');assert.equal(nova.title,'Nova assinatura | Gestão Nexus');
  assert.deepEqual(nova.vm.dados.cliente,{id:cliente,nome:'Padaria Pão Dourado',empresas:[{id:'padaria-pao-dourado',nome:'Padaria Pão Dourado'}]});
  assert.deepEqual(nova.vm.dados.planos.map(p=>p.id),['plano-avancado','plano-premium','plano-presenca'],'sem o pausado');
  assert.deepEqual(nova.vm.dados.ciclos,['mensal','trimestral','semestral','anual']);
  assert.equal(nova.vm.avisos.some(a=>a.tipo==='site-fora'),false);
  t.site.planos.find(p=>p.id==='plano-avancado').status='pausado';
  const edita=await t.pagina(`/assinaturas/${assinatura.id}`,{s:adm});
  assert.equal(edita.title,'Assinatura · Padaria Pão Dourado | Gestão Nexus');
  assert.ok(edita.vm.dados.planos.some(p=>p.id==='plano-avancado'),'o plano atual continua na lista');
  t.site.fora=true;
  assert.deepEqual((await t.pagina(`/assinaturas/nova?cliente=${cliente}`,{s:adm})).vm.avisos.find(a=>a.tipo==='site-fora'),
    {tipo:'site-fora',texto:'O guia não respondeu. A lista de planos é a última cópia guardada.',href:''});
  await t.db.query('DELETE FROM site_plans');
  const semCopia=(await t.pagina(`/assinaturas/nova?cliente=${cliente}`,{s:adm})).vm;
  assert.deepEqual([semCopia.dados.planos,semCopia.avisos.find(a=>a.tipo==='site-fora')?.texto],[[],'O guia não respondeu, e não há cópia dos planos guardada. Tente de novo em instantes.']);
  t.site.fora=false;
  assert.equal((await t.pagina(`/assinaturas/nova?cliente=${cliente}`,{s:leitura})).status,403);
  assert.equal((await t.pagina('/assinaturas/nova?cliente=x',{s:adm})).status,404);
  assert.equal((await t.pagina('/assinaturas/nova?cliente=00000000-0000-4000-8000-000000000000',{s:adm})).status,404);
});

test('avisos: chave Pix para quem cobra; envio ao site falhando há mais de 1 hora para o admin',async()=>{
  const tipos=async s=>(await t.pagina('/clientes',{s})).vm.avisos.map(a=>a.tipo);
  assert.deepEqual(await tipos(adm),['chave-pix']);
  assert.deepEqual(await tipos(leitura),[],'quem não cobra não vê o aviso da chave');
  await t.db.query("UPDATE plan_sync SET ultimo_erro='o site recusou',criado_em=$1",[new Date(t.agora.getTime()-2*3600000).toISOString()]);
  await t.db.query("UPDATE settings SET chave_pix='pix@exemplo.test'");
  assert.deepEqual(await tipos(adm),['sincronizacao']);
  assert.deepEqual(await tipos(await t.sessao('financeiro@exemplo.test',{papel:'financeiro'})),[]);
});
