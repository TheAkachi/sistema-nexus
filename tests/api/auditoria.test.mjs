import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { audit } from '../../api/lib/auditoria.mjs';
import { ambiente } from './ambiente.mjs';

// Leitura da auditoria (contrato 6.15): filtros por ação, pessoa ou sistema, recurso, dias em São Paulo e busca.
let t,adm,cliente;
before(async()=>{
  t=await ambiente();adm=await t.sessao('lucas@exemplo.test',{nome:'Lucas'});
  cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Padaria Pão Dourado'},s:adm})).json.id;
  await t.req(`/api/clientes/${cliente}`,{method:'PATCH',body:{responsavel:'Carlos',version:1},s:adm});
  await audit(t.db,{action:'admin_cli',type:'usuario',resource:'cli-1',after:{email:'novo@exemplo.test'},ip:'cli'});
  // Duas ações em horários conhecidos: 23h30 de 19/10 e 00h30 de 20/10, em São Paulo.
  for(const [id,em] of [['virada-1','2026-10-20T02:30:00Z'],['virada-2','2026-10-20T03:30:00Z']])
    await t.db.query("INSERT INTO audit_log(id,action,resource_type,resource_id,created_at) VALUES($1,'teste_virada','teste',$1,$2)",[id,em]);
});
after(async()=>{await t?.fim();});
const ler=async q=>(await t.req(`/api/auditoria${q}`,{s:adm})).json;

test('lista da mais nova para a mais antiga, com quem fez, o antes e o depois',async()=>{
  const r=await ler('?recurso='+cliente);
  assert.deepEqual(r.itens.map(a=>a.acao),['cliente_editado','cliente_criado']);
  const [ed]=r.itens;
  assert.deepEqual({...ed,id:undefined,em:undefined},{id:undefined,em:undefined,acao:'cliente_editado',recurso:{tipo:'cliente',id:cliente},
    por:{id:adm.id,nome:'Lucas',email:'lucas@exemplo.test'},antes:{responsavel:''},depois:{responsavel:'Carlos'},ip:'127.0.0.1'});
  assert.deepEqual([r.total,r.pagina,r.paginas],[2,1,1]);
});

test('filtros: ação, pessoa, sistema, busca e as opções',async()=>{
  assert.deepEqual((await ler('?acao=cliente_criado')).itens.map(a=>a.recurso.id),[cliente]);
  assert.ok((await ler(`?usuario=${adm.id}`)).itens.every(a=>a.por?.id===adm.id));
  assert.deepEqual((await ler('?usuario=sistema')).itens.map(a=>a.acao).sort(),['admin_cli','teste_virada','teste_virada']);
  assert.deepEqual((await ler('?q=ADMIN_')).itens.map(a=>a.acao),['admin_cli'],'busca no nome da ação, sem caixa');
  assert.deepEqual((await ler('?q=cli')).itens.map(a=>a.acao),['admin_cli','cliente_editado','cliente_criado'],'"cli" acha também "cliente_…"');
  assert.deepEqual((await ler(`?q=${cliente.slice(0,8)}`)).itens.map(a=>a.acao),['cliente_editado','cliente_criado'],'e no id do recurso');
  assert.deepEqual((await ler('?q=%25')).itens,[],'o % é texto, não curinga');
  const {opcoes}=await ler('');
  assert.deepEqual(opcoes.acoes,['admin_cli','cliente_criado','cliente_editado','teste_virada']);
  assert.deepEqual(opcoes.pessoas,[{id:adm.id,nome:'Lucas'}]);
});

test('dias em São Paulo: a ação das 00h30 é do dia 20, a das 23h30 do dia 19',async()=>{
  assert.deepEqual((await ler('?acao=teste_virada&de=2026-10-20&ate=2026-10-20')).itens.map(a=>a.id),['virada-2']);
  assert.deepEqual((await ler('?acao=teste_virada&de=2026-10-19&ate=2026-10-19')).itens.map(a=>a.id),['virada-1']);
  assert.deepEqual((await ler('?acao=teste_virada&ate=2026-10-18')).itens,[]);
  for(const campo of ['de','ate'])assert.equal((await t.req(`/api/auditoria?${campo}=20/10/2026`,{s:adm})).json.campo,campo);
});

test('paginação de 20 e a página só para o admin',async()=>{
  for(let i=0;i<25;i++)await audit(t.db,{action:'teste_lote',type:'teste',resource:randomUUID()});
  const p1=await ler('?acao=teste_lote'),p2=await ler('?acao=teste_lote&page=2');
  assert.deepEqual([p1.itens.length,p2.itens.length,p1.total,p1.paginas],[20,5,25,2]);
  assert.equal(new Set([...p1.itens,...p2.itens].map(a=>a.id)).size,25);
  const pagina=await t.pagina('/auditoria?acao=teste_lote&page=2',{s:adm});
  assert.deepEqual([pagina.view,pagina.title,pagina.vm.filtros],['auditoria','Auditoria | Gestão Nexus',{acao:'teste_lote',usuario:'',recurso:'',de:'',ate:'',q:'',page:'2'}]);
  assert.equal(pagina.vm.dados.itens.length,5);
  assert.equal((await t.pagina('/auditoria?de=ontem',{s:adm})).status,422);
  assert.equal((await t.pagina('/auditoria',{s:await t.sessao('ana@exemplo.test',{papel:'financeiro'})})).status,403);
});
