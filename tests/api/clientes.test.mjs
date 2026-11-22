import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappDe } from '../../api/data/clientes.mjs';
import { ETAPAS } from '../../api/lib/regua.mjs';
import { ambiente } from './ambiente.mjs';

// Clientes e vínculos com as empresas do guia (contrato 6.6 a 6.8 e 7.5).
let t,s;
before(async()=>{t=await ambiente();s=await t.sessao('comercial@exemplo.test',{papel:'comercial'});});
after(async()=>{await t?.fim();});
const criar=body=>t.req('/api/clientes',{method:'POST',body,s});
const vincular=(id,empresa,sessao=s)=>t.req(`/api/clientes/${id}/empresas/${empresa}`,{method:'POST',body:{},s:sessao});

test('WhatsApp com máscara ou sem; DDD e número ganham o 55',()=>{
  for(const [v,d] of [['(21) 98765-4321','5521987654321'],['21 3765-4321','552137654321'],['+55 21 98765-4321','5521987654321'],['','']])assert.equal(whatsappDe(v),d,v);
  for(const v of ['98765-4321','+1 212 555 0100','55 21 9876',42])assert.throws(()=>whatsappDe(v),e=>e.campo==='whatsapp',String(v));
});

test('criar e editar o cliente, com versão, validação e auditoria',async()=>{
  for(const [body,campo] of [[{nome:'A'},'nome'],[{nome:'Ok',email:'x'},'email'],[{nome:'Ok',whatsapp:'123'},'whatsapp'],[{nome:'Ok',notas:'x'.repeat(2001)},'notas'],[{nome:'Ok',cpf:'1'},'cpf']])
    assert.equal((await criar(body)).json.campo,campo,campo);
  const r=await criar({nome:'  Clínica   Vida Plena ',responsavel:'Marina Souza',whatsapp:'(21) 90000-0001',email:'Marina@Exemplo.test',notas:'Prefere depois das 14h.'});
  assert.equal(r.status,201);
  assert.deepEqual({...r.json,id:undefined,criadoEm:undefined,desempenho:undefined},{id:undefined,nome:'Clínica Vida Plena',responsavel:'Marina Souza',whatsapp:'5521900000001',email:'marina@exemplo.test',
    notas:'Prefere depois das 14h.',status:'ativo',criadoEm:undefined,version:1,empresas:[],assinaturas:[],desempenho:undefined,relatorio:{mes:'2026-09',rotulo:'setembro de 2026',empresas:[]},linhaDoTempo:[],etapas:ETAPAS});
  // v0.10.0: sem empresa vinculada e sem cópia das métricas, o desempenho vem vazio (6.7). v0.11.0: o relatório, sem empresas.
  assert.deepEqual([r.json.desempenho.disponivel,r.json.desempenho.lidaEm,r.json.desempenho.empresas],[false,null,[]]);
  t.vida=r.json.id;
  assert.equal((await t.req(`/api/clientes/${t.vida}`,{method:'PATCH',body:{responsavel:'Marina',version:2},s})).status,409);
  let e=await t.req(`/api/clientes/${t.vida}`,{method:'PATCH',body:{responsavel:'Marina',version:1},s});
  assert.equal(e.json.responsavel,'Marina');assert.equal(e.json.version,2);
  e=await t.req(`/api/clientes/${t.vida}`,{method:'PATCH',body:{responsavel:'Marina',version:2},s});
  assert.equal(e.json.version,2,'sem mudança, sem versão nova');
  assert.deepEqual((await t.auditoria('cliente_editado',t.vida)).map(a=>[a.before,a.after]),[[{responsavel:'Marina Souza'},{responsavel:'Marina'}]]);
  assert.equal((await t.req('/api/clientes/00000000-0000-4000-8000-000000000000',{s})).status,404);
});

test('vincular confere a empresa no site; outra conta ou o site fora do ar não vinculam',async()=>{
  const r=await vincular(t.vida,'clinica-vida-plena-centro');
  assert.equal(r.status,201);
  assert.deepEqual(r.json.empresas,[{id:'clinica-vida-plena-centro',nome:'Clínica Vida Plena · Centro',miniatura:'https://site.exemplo.test/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp',
    url:'https://site.exemplo.test/comercio/clinica-vida-plena-centro',slug:'clinica-vida-plena-centro',bairro:'Centro',vinculadaEm:t.agora.toISOString(),
    acessosUrl:'https://site.exemplo.test/admin/acessos?empresa=clinica-vida-plena-centro'}]);
  await vincular(t.vida,'clinica-vida-plena-austin');
  assert.equal((await vincular(t.vida,'clinica-vida-plena-centro')).json.erro,'Esta empresa já está vinculada a este cliente.');
  const outro=(await criar({nome:'Outro Cliente'})).json.id;
  const dupla=await vincular(outro,'clinica-vida-plena-centro');
  assert.deepEqual([dupla.status,dupla.json.erro],[409,'Esta empresa já é do cliente Clínica Vida Plena.']);
  assert.equal((await vincular(outro,'nao-existe-no-guia')).status,404);
  assert.equal((await vincular(outro,'Maiuscula')).status,404,'id fora do formato');
  t.site.fora=true;assert.equal((await vincular(outro,'padaria-pao-dourado')).status,503);t.site.fora=false;
  const studio=await vincular(outro,'studio-bella');
  assert.equal(studio.json.empresas[0].miniatura,'','foto fora do formato não entra');
  assert.equal((await t.auditoria('empresa_vinculada',t.vida)).length,2);
  t.outro=outro;
});

test('busca das empresas do guia, com o cliente que já tem cada uma',async()=>{
  const r=await t.req('/api/empresas-site?q=vida',{s});
  assert.deepEqual(r.json.itens.map(e=>[e.id,e.cliente?.nome??null]),[['clinica-vida-plena-austin','Clínica Vida Plena'],['clinica-vida-plena-centro','Clínica Vida Plena']]);
  assert.deepEqual(Object.keys(r.json.itens[0]).sort(),['bairro','cliente','id','miniatura','nome','plano','slug','status','url']);
  assert.deepEqual([r.json.total,r.json.pagina,r.json.paginas],[2,1,1]);
  assert.equal(r.json.itens[0].plano,null);
  // O plano vem com o nome da lista do site; o que a lista não tem, com o id no lugar do nome.
  t.site.empresas.find(e=>e.id==='clinica-vida-plena-austin').plano='plano-premium';t.site.empresas.find(e=>e.id==='clinica-vida-plena-centro').plano='plano-sumido';
  const comPlano=(await t.req('/api/empresas-site?q=vida',{s})).json.itens;
  assert.deepEqual(comPlano.map(e=>e.plano),[{id:'plano-premium',nome:'Premium'},{id:'plano-sumido',nome:'plano-sumido'}]);
  for(const e of t.site.empresas)if(e.id.startsWith('clinica-vida-plena'))e.plano=null;
  t.site.fora=true;assert.equal((await t.req('/api/empresas-site?q=vida',{s})).json.erro,'O guia não respondeu. Tente de novo em instantes.');t.site.fora=false;
});

test('lista: busca por nome, empresa, e-mail e dígitos do WhatsApp; filtros de situação',async()=>{
  const busca=async q=>(await t.req(`/api/clientes?q=${encodeURIComponent(q)}`,{s})).json.itens.map(c=>c.nome);
  assert.deepEqual(await busca('austin'),['Clínica Vida Plena']);
  assert.deepEqual(await busca('CLINICA'),['Clínica Vida Plena']);
  assert.deepEqual(await busca('0001'),['Clínica Vida Plena']);
  assert.deepEqual(await busca('marina@'),['Clínica Vida Plena']);
  assert.deepEqual(await busca('001'),[],'menos de 4 dígitos não procura no WhatsApp');
  const todos=(await t.req('/api/clientes',{s})).json;
  assert.deepEqual(todos.itens.map(c=>c.nome),['Clínica Vida Plena','Outro Cliente']);
  assert.deepEqual(todos.itens[0],{id:t.vida,nome:'Clínica Vida Plena',responsavel:'Marina',whatsapp:'5521900000001',empresas:2,planoPrincipal:null,situacao:null,status:'ativo'});
  assert.equal((await t.req('/api/clientes?situacao=sem-assinatura',{s})).json.total,2);
});

test('desvincular põe o plano null com gerida false na fila; encerrar e reabrir o cliente',async()=>{
  const r=await t.req(`/api/clientes/${t.outro}/empresas/studio-bella`,{method:'DELETE',s});
  assert.deepEqual(r.json.empresas,[]);
  const fila=(await t.db.query("SELECT * FROM plan_sync WHERE business_id='studio-bella'")).rows;
  assert.deepEqual(fila.map(f=>[f.plano,f.gerida,f.motivo]),[[null,false,'desvinculo']]);
  assert.equal((await t.req(`/api/clientes/${t.outro}/empresas/studio-bella`,{method:'DELETE',s})).status,404);
  const v=async()=>(await t.req(`/api/clientes/${t.outro}`,{s})).json.version;
  assert.equal((await t.req(`/api/clientes/${t.outro}`,{method:'PATCH',body:{status:'encerrado',version:await v()},s})).json.status,'encerrado');
  assert.equal((await t.req(`/api/clientes/${t.outro}`,{method:'PATCH',body:{status:'ativo',version:await v()},s})).json.status,'ativo');
  assert.equal((await t.req(`/api/clientes/${t.outro}`,{method:'PATCH',body:{status:'sumido',version:await v()},s})).json.campo,'status');
});
