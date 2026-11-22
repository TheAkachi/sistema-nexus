import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ambiente } from './ambiente.mjs';

// Assinaturas (contrato 5.3, 5.4, 6.7, 6.9, 7.5 e 9.3): criar, editar, suspender, reativar e cancelar, a situação
// calculada e a fila do plano no site. Hoje é 20/10/2026 em São Paulo e a tolerância é de 10 dias.
let t,s,cliente;
before(async()=>{
  t=await ambiente();s=await t.sessao('financeiro@exemplo.test',{papel:'financeiro'});
  const adm=await t.sessao('admin@exemplo.test');
  cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Vida Plena',responsavel:'Marina Souza',whatsapp:'21900000001'},s:adm})).json.id;
  for(const e of ['clinica-vida-plena-centro','clinica-vida-plena-austin'])await t.req(`/api/clientes/${cliente}/empresas/${e}`,{method:'POST',body:{},s:adm});
});
after(async()=>{await t?.fim();});
const NOVA={plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2025-03-15',venceEm:'2026-10-15'};
const criar=body=>t.req('/api/assinaturas',{method:'POST',body:{cliente,...body},s});
const fila=async empresa=>(await t.db.query('SELECT plano,gerida,motivo FROM plan_sync WHERE business_id=$1 ORDER BY seq',[empresa])).rows.map(f=>[f.plano,f.motivo]);
const versao=async id=>(await t.req(`/api/assinaturas/${id}`,{s})).json.version;

test('criar: plano do site, valores conferidos, situação calculada e o plano na fila',async()=>{
  for(const [body,campo] of [[{...NOVA,plano:'plano-antigo'},'plano'],[{...NOVA,plano:'nao-existe'},'plano'],[{...NOVA,plano:undefined},'plano'],[{...NOVA,valorCentavos:-1},'valorCentavos'],
    [{...NOVA,valorCentavos:9.9},'valorCentavos'],[{...NOVA,ciclo:'semanal'},'ciclo'],[{...NOVA,inicio:'2026-02-30'},'inicio'],[{...NOVA,venceEm:'2025-01-01'},'venceEm'],
    [{...NOVA,empresa:'padaria-pao-dourado'},'empresa'],[{...NOVA,status:'ativa'},'status']])
    assert.equal((await criar(body)).json.campo,campo,JSON.stringify(body));
  assert.equal((await t.req('/api/assinaturas',{method:'POST',body:{...NOVA,cliente:'00000000-0000-4000-8000-000000000000'},s})).json.campo,'cliente');
  const r=await criar({...NOVA,empresa:'clinica-vida-plena-centro',notas:'Bônus CONECTA: indicou a padaria.'});
  assert.equal(r.status,201);
  const a=r.json;
  assert.deepEqual({...a,id:undefined,criadaEm:undefined,atualizadaEm:undefined},{id:undefined,cliente:{id:cliente,nome:'Clínica Vida Plena'},
    empresa:{id:'clinica-vida-plena-centro',nome:'Clínica Vida Plena · Centro',miniatura:'https://site.exemplo.test/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp',url:'https://site.exemplo.test/comercio/clinica-vida-plena-centro'},
    plano:{id:'plano-premium',nome:'Premium'},valorCentavos:9900,ciclo:'mensal',inicio:'2025-03-15',venceEm:'2026-10-15',diaBase:15,dias:-5,situacao:'vencida',status:'ativa',
    suspensaEm:null,canceladaEm:null,motivo:'',origem:'manual',notas:'Bônus CONECTA: indicou a padaria.',gerida:true,sincronizacao:{estado:'pendente',em:null,erro:''},
    criadaEm:undefined,atualizadaEm:undefined,version:1});
  assert.deepEqual(await fila('clinica-vida-plena-centro'),[['plano-premium','ativacao']]);
  assert.equal((await criar({...NOVA,empresa:'clinica-vida-plena-centro'})).status,409,'a empresa já tem assinatura');
  const sem=(await criar({...NOVA,plano:'plano-avancado',valorCentavos:6700,venceEm:'2026-11-15'})).json;
  assert.deepEqual([sem.empresa,sem.situacao,sem.sincronizacao.estado],[null,'a-vencer','sem-empresa']);
  const velha=(await criar({...NOVA,empresa:'clinica-vida-plena-austin',venceEm:'2026-10-01'})).json;
  assert.equal(velha.situacao,'inadimplente');
  assert.deepEqual(await fila('clinica-vida-plena-austin'),[[null,'ativacao']],'já nasce inadimplente: sem plano pago no site');
  assert.equal((await t.auditoria('assinatura_criada',a.id))[0].after.plano,'plano-premium');
  t.centro=a.id;t.semEmpresa=sem.id;t.austin=velha.id;
});

test('os planos vêm da cópia quando o site não responde; sem cópia nenhuma, 503',async()=>{
  const r=await t.req('/api/planos-site',{s});
  assert.equal(r.json.copia,false);assert.deepEqual(r.json.itens.map(p=>p.nome),['Antigo','Avançado','Premium','Presença']);
  t.site.fora=true;
  const c=await t.req('/api/planos-site',{s});assert.equal(c.json.copia,true);assert.equal(c.json.itens.length,4);
  assert.equal((await criar({...NOVA,plano:'plano-avancado'})).status,201,'cria com a cópia');
  await t.db.query('DELETE FROM site_plans');
  assert.equal((await criar({...NOVA,plano:'plano-avancado'})).status,503);
  t.site.fora=false;
});

test('editar: o dia base acompanha o vencimento; PATCH sem mudança não cria versão; a fila recebe a mudança de empresa',async()=>{
  let r=await t.req(`/api/assinaturas/${t.semEmpresa}`,{method:'PATCH',body:{venceEm:'2026-11-30',version:await versao(t.semEmpresa)},s});
  assert.deepEqual([r.json.venceEm,r.json.diaBase,r.json.version],['2026-11-30',30,2]);
  r=await t.req(`/api/assinaturas/${t.semEmpresa}`,{method:'PATCH',body:{venceEm:'2026-11-30',version:2},s});
  assert.equal(r.json.version,2);
  assert.equal((await t.req(`/api/assinaturas/${t.semEmpresa}`,{method:'PATCH',body:{notas:'x',version:1},s})).status,409);
  // Troca de empresa: a antiga fica sem plano, a nova recebe o da assinatura.
  await t.req(`/api/assinaturas/${t.austin}/cancelar`,{method:'POST',body:{motivo:'Fechou a unidade',version:await versao(t.austin)},s});
  r=await t.req(`/api/assinaturas/${t.centro}`,{method:'PATCH',body:{empresa:'clinica-vida-plena-austin',plano:'plano-avancado',valorCentavos:6700,venceEm:'2026-11-15',version:await versao(t.centro)},s});
  assert.equal(r.status,200,r.text);
  assert.deepEqual(await fila('clinica-vida-plena-centro'),[['plano-premium','ativacao'],[null,'edicao']]);
  assert.deepEqual((await fila('clinica-vida-plena-austin')).at(-1),['plano-avancado','edicao']);
  const aud=(await t.auditoria('assinatura_editada',t.centro))[0];
  assert.deepEqual(aud.before,{empresa:'clinica-vida-plena-centro',plano:'plano-premium',valorCentavos:9900,venceEm:'2026-10-15'});
  assert.equal((await t.req(`/api/assinaturas/${t.centro}`,{method:'PATCH',body:{empresa:'padaria-pao-dourado',version:await versao(t.centro)},s})).json.campo,'empresa');
});

test('suspender, reativar e cancelar: as transições valem só a partir do status certo',async()=>{
  const id=t.centro;
  assert.equal((await t.req(`/api/assinaturas/${id}/reativar`,{method:'POST',body:{version:await versao(id)},s})).json.erro,'Só a assinatura suspensa pode ser reativada.');
  let r=await t.req(`/api/assinaturas/${id}/suspender`,{method:'POST',body:{motivo:'Pediu uma pausa',version:await versao(id)},s});
  assert.deepEqual([r.json.status,r.json.situacao,r.json.suspensaEm,r.json.motivo],['suspensa','suspensa','2026-10-20','Pediu uma pausa']);
  assert.deepEqual((await fila('clinica-vida-plena-austin')).at(-1),[null,'suspensao']);
  r=await t.req(`/api/assinaturas/${id}/reativar`,{method:'POST',body:{version:await versao(id)},s});
  assert.deepEqual([r.json.status,r.json.suspensaEm,r.json.motivo],['ativa',null,'']);
  assert.deepEqual((await fila('clinica-vida-plena-austin')).at(-1),['plano-avancado','reativacao']);
  for(const [body,campo] of [[{},'motivo'],[{motivo:'ok'},'motivo'],[{motivo:'Mudou de cidade',canceladaEm:'2026-10-21'},'canceladaEm'],[{motivo:'Mudou de cidade',canceladaEm:'2025-03-14'},'canceladaEm']])
    assert.equal((await t.req(`/api/assinaturas/${id}/cancelar`,{method:'POST',body:{...body,version:await versao(id)},s})).json.campo,campo,JSON.stringify(body));
  r=await t.req(`/api/assinaturas/${id}/cancelar`,{method:'POST',body:{motivo:'Mudou de cidade',canceladaEm:'2026-10-18',version:await versao(id)},s});
  assert.deepEqual([r.json.status,r.json.canceladaEm,r.json.motivo],['cancelada','2026-10-18','Mudou de cidade']);
  assert.deepEqual((await fila('clinica-vida-plena-austin')).at(-1),[null,'cancelamento']);
  assert.equal((await t.req(`/api/assinaturas/${id}/cancelar`,{method:'POST',body:{motivo:'De novo',version:await versao(id)},s})).json.erro,'Esta assinatura já está cancelada.');
  assert.equal((await t.req(`/api/assinaturas/${id}`,{method:'PATCH',body:{valorCentavos:1,version:await versao(id)},s})).json.erro,'A assinatura cancelada só aceita mudança nas notas.');
  assert.equal((await t.req(`/api/assinaturas/${id}`,{method:'PATCH',body:{notas:'Pode voltar em 2027.',version:await versao(id)},s})).status,200);
  assert.deepEqual((await t.auditoria('assinatura_cancelada',id))[0].after,{status:'cancelada',motivo:'Mudou de cidade',canceladaEm:'2026-10-18'});
  // Depois do cancelamento, a empresa pode ter assinatura nova, e o cliente pode encerrar quando todas estiverem canceladas.
  assert.equal((await criar({...NOVA,empresa:'clinica-vida-plena-austin'})).status,201);
});

test('sincronização: ok quando enviado; falhou depois de 1 hora de erro; lista com filtros',async()=>{
  const id=(await t.req(`/api/assinaturas?cliente=${cliente}&status=ativa&q=austin`,{s})).json.itens[0].id;
  await t.db.query("UPDATE plan_sync SET ultimo_erro='timeout' WHERE business_id='clinica-vida-plena-austin'");
  assert.equal((await t.req(`/api/assinaturas/${id}`,{s})).json.sincronizacao.estado,'pendente','erro há menos de 1 hora');
  t.minutos(61);s=await t.sessao('financeiro-2@exemplo.test',{papel:'financeiro'});
  assert.deepEqual((await t.req(`/api/assinaturas/${id}`,{s})).json.sincronizacao,{estado:'falhou',em:null,erro:'timeout'});
  await t.db.query("UPDATE plan_sync SET enviado_em=$1 WHERE business_id='clinica-vida-plena-austin'",[t.agora.toISOString()]);
  assert.deepEqual((await t.req(`/api/assinaturas/${id}`,{s})).json.sincronizacao,{estado:'ok',em:t.agora.toISOString(),erro:''});
  const sit=async q=>(await t.req(`/api/assinaturas?${q}`,{s})).json.itens.map(a=>a.situacao);
  assert.ok((await sit('situacao=vencida')).every(x=>x==='vencida'));
  assert.deepEqual(await sit('status=cancelada'),['cancelada','cancelada']);
  const ficha=(await t.req(`/api/clientes/${cliente}`,{s})).json;
  assert.deepEqual(ficha.assinaturas.map(a=>a.status),['ativa','ativa','ativa','cancelada','cancelada'],'as não canceladas primeiro');
  const linha=(await t.req('/api/clientes',{s})).json.itens.find(c=>c.id===cliente);
  // Duas de R$ 99,00 por mês com o mesmo início: vale a criada primeiro (a do Avançado, feita com a cópia dos planos).
  assert.deepEqual([linha.situacao,linha.planoPrincipal],['vencida',{id:'plano-avancado',nome:'Avançado'}]);
});
