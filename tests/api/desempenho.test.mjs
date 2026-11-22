import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { lerMetricas } from '../../api/data/metricas-site.mjs';
import { frase, mesesAte } from '../../api/data/desempenho.mjs';
import { preencher } from '../../api/lib/mensagem.mjs';
import { ambiente } from './ambiente.mjs';

// Desempenho por anunciante (contrato 6.7 e 7.3, v0.10.0): os 6 meses de cada empresa vinculada na ficha, da cópia das
// métricas do site, com o mês sem medição em null, e a frase do {desempenho} do mês anterior na mensagem. Hoje é 20/10/2026.
let t,s,cliente,semEmpresa;
const canais=(whatsapp,telefone,rota,site)=>({whatsapp,telefone,rota,site});
const CENTRO=[
  {mes:'2026-05',visitas:null,contatos:null},
  {mes:'2026-06',visitas:null,contatos:null},
  {mes:'2026-07',visitas:180,contatos:canais(22,5,9,2)},
  {mes:'2026-08',visitas:0,contatos:canais(0,0,0,0)},
  {mes:'2026-09',visitas:1234,contatos:canais(41,6,14,4)},
  {mes:'2026-10',visitas:205,contatos:canais(27,3,8,1)}
];
// O site falso devolve só os meses pedidos (de a ate), como o de verdade; a Austin não vem (não publicada).
const metricas=({de,ate})=>({de,ate,medidoDesde:{contatos:'2026-07-14',buscas:'2026-10-01'},site:{meses:[],buscasMaisFeitas:[],buscasSemResultado:[],bairros:[],categorias:[]},
  empresas:{itens:[
    {id:'clinica-vida-plena-centro',nome:'Clínica Vida Plena · Centro',meses:CENTRO.filter(m=>m.mes>=de&&m.mes<=ate),ultimos30:{visitas:205,contatos:canais(27,3,8,1)}},
    {id:'padaria-pao-dourado',nome:'Padaria Pão Dourado',meses:[{mes:'2026-09',visitas:38,contatos:canais(2,0,0,0)}],ultimos30:{visitas:38,contatos:canais(2,0,0,0)}}],total:2,pagina:1,paginas:1},
  banners:[]});
const textoDe=link=>decodeURIComponent(link.split('?text=')[1]);
before(async()=>{
  t=await ambiente();s=await t.sessao('desempenho@exemplo.test');
  cliente=(await t.req('/api/clientes',{method:'POST',s,body:{nome:'Clínica Vida Plena',responsavel:'Marina Souza',whatsapp:'21900000001'}})).json.id;
  for(const [empresa,venceEm] of [['clinica-vida-plena-centro','2026-10-25'],['clinica-vida-plena-austin','2026-11-05']]) {
    assert.equal((await t.req(`/api/clientes/${cliente}/empresas/${empresa}`,{method:'POST',body:{},s})).status,201);
    assert.equal((await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa,plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2026-01-01',venceEm}})).status,201);
  }
  semEmpresa=(await t.req('/api/clientes',{method:'POST',s,body:{nome:'Cliente sem empresa'}})).json.id;
  const c=(await t.req('/api/configuracoes',{s})).json;
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',s,body:{modeloMensagem:'Olá, {responsavel}! {desempenho} A assinatura {prazo}.',version:c.version}})).status,200);
});
after(async()=>{await t?.fim();});

test('os meses do desempenho: os 6 até o atual, virando o ano',()=>{
  assert.deepEqual(mesesAte('2026-10-20',6),['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
  assert.deepEqual(mesesAte('2027-02-01',4),['2026-11','2026-12','2027-01','2027-02']);
});

test('ficha sem cópia das métricas: tudo null, só o mês atual parcial, e a mensagem sem a frase',async()=>{
  const d=(await t.req(`/api/clientes/${cliente}`,{s})).json.desempenho;
  assert.deepEqual([d.disponivel,d.lidaEm,d.medidoDesde,d.meses],[false,null,null,['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']]);
  assert.deepEqual(d.empresas.map(e=>[e.id,e.naCopia]),[['clinica-vida-plena-austin',false],['clinica-vida-plena-centro',false]]);
  assert.deepEqual(d.empresas[1].meses.map(m=>[m.visitas,m.contatos,m.contatosTotal,m.parcial]),[...Array(5).fill([null,null,null,false]),[null,null,null,true]]);
  const r=(await t.req('/api/renovacoes?janela=30',{s})).json.itens;
  assert.deepEqual(r.map(x=>textoDe(x.linkWhatsapp)),['Olá, Marina Souza! A assinatura vence em 25/10/2026.','Olá, Marina Souza! A assinatura vence em 05/11/2026.']);
});

test('ficha com a cópia: os meses da empresa, null sem medição, zero só quando mediu, e a empresa fora da cópia',async()=>{
  t.site.metricas=metricas;
  assert.equal((await lerMetricas(t.db,{site:t.integracao,now:t.agora})).erro,'');
  const f=(await t.req(`/api/clientes/${cliente}`,{s})).json,d=f.desempenho;
  assert.deepEqual([d.disponivel,d.lidaEm,d.medidoDesde],[true,t.agora.toISOString(),'2026-07-14']);
  assert.match(d.como,/aceitaram a medição/);
  assert.deepEqual(d.empresas.map(e=>e.id),f.empresas.map(e=>e.id),'na ordem das empresas da ficha');
  const [austin,centro]=d.empresas;
  assert.deepEqual([centro.nome,centro.naCopia,austin.naCopia],['Clínica Vida Plena · Centro',true,false]);
  assert.deepEqual(centro.meses.map(m=>[m.mes,m.visitas,m.contatosTotal,m.parcial]),
    [['2026-05',null,null,false],['2026-06',null,null,false],['2026-07',180,38,true],['2026-08',0,0,false],['2026-09',1234,65,false],['2026-10',205,39,true]],
    'julho é parcial porque a medição começou em 14/07');
  assert.deepEqual(centro.anterior,{mes:'2026-09',visitas:1234,contatos:canais(41,6,14,4),contatosTotal:65,parcial:false});
  assert.deepEqual(centro.atual,centro.meses[5]);
  assert.deepEqual(austin.meses.map(m=>m.visitas),Array(6).fill(null),'fora da cópia: sem medição, não zero');
  const vazio=(await t.req(`/api/clientes/${semEmpresa}`,{s})).json.desempenho;
  assert.deepEqual([vazio.disponivel,vazio.empresas],[true,[]]);
  // Só totais: as chaves são exatamente as do contrato, sem nada de quem visitou.
  assert.deepEqual(Object.keys(d),['como','disponivel','lidaEm','medidoDesde','meses','empresas']);
  assert.deepEqual(Object.keys(centro),['id','nome','naCopia','atual','anterior','meses']);
  assert.deepEqual(Object.keys(centro.anterior),['mes','visitas','contatos','contatosTotal','parcial']);
  assert.deepEqual(Object.keys(centro.anterior.contatos).sort(),['rota','site','telefone','whatsapp']);
});

test('mensagem: a frase do mês anterior nas Renovações e no Resumo; sem medição, ela sai sem deixar dois espaços',async()=>{
  const r=(await t.req('/api/renovacoes?janela=30',{s})).json.itens;
  assert.deepEqual(r.map(x=>textoDe(x.linkWhatsapp)),[
    'Olá, Marina Souza! Seu anúncio teve 1.234 visitas e 41 contatos pelo WhatsApp em setembro. A assinatura vence em 25/10/2026.',
    'Olá, Marina Souza! A assinatura vence em 05/11/2026.']);
  const resumo=(await t.req('/api/resumo',{s})).json;
  assert.equal(textoDe(resumo.cobrarHoje[0].linkWhatsapp),r.map(x=>textoDe(x.linkWhatsapp))[0]);
  // Sem cobrar, não há link nem leitura da cópia.
  const leitura=await t.sessao('desempenho-leitura@exemplo.test',{papel:'leitura'});
  assert.deepEqual((await t.req('/api/renovacoes?janela=30',{s:leitura})).json.itens.map(x=>x.linkWhatsapp),[null,null]);
});

test('cópia de antes de setembro acabar: setembro parcial, outubro sem medição e a mensagem sem a frase',async()=>{
  assert.equal((await lerMetricas(t.db,{site:t.integracao,now:new Date('2026-09-30T15:00:00Z')})).erro,'');
  const centro=(await t.req(`/api/clientes/${cliente}`,{s})).json.desempenho.empresas[1];
  assert.deepEqual([centro.anterior.visitas,centro.anterior.parcial],[1234,true]);
  assert.deepEqual([centro.atual.visitas,centro.atual.contatos,centro.atual.parcial],[null,null,true]);
  const r=(await t.req('/api/renovacoes?janela=7',{s})).json.itens;
  assert.equal(textoDe(r[0].linkWhatsapp),'Olá, Marina Souza! A assinatura vence em 25/10/2026.');
  assert.equal((await lerMetricas(t.db,{site:t.integracao,now:t.agora})).erro,'');
});

test('medição que começou no meio de setembro: setembro parcial e a mensagem sem a frase; começando no dia 1º, mês inteiro',async()=>{
  const ler=async medidoDesde=>{
    t.site.metricas=q=>({...metricas(q),medidoDesde:{contatos:medidoDesde,buscas:medidoDesde}});
    assert.equal((await lerMetricas(t.db,{site:t.integracao,now:t.agora})).erro,'');
    const centro=(await t.req(`/api/clientes/${cliente}`,{s})).json.desempenho.empresas[1];
    return [centro.anterior.parcial,textoDe((await t.req('/api/renovacoes?janela=7',{s})).json.itens[0].linkWhatsapp)];
  };
  assert.deepEqual(await ler('2026-09-24'),[true,'Olá, Marina Souza! A assinatura vence em 25/10/2026.']);
  assert.deepEqual(await ler('2026-09-01'),[false,'Olá, Marina Souza! Seu anúncio teve 1.234 visitas e 41 contatos pelo WhatsApp em setembro. A assinatura vence em 25/10/2026.']);
  t.site.metricas=metricas;
  assert.equal((await lerMetricas(t.db,{site:t.integracao,now:t.agora})).erro,'');
});

test('a frase do {desempenho}: singular, milhares, sem WhatsApp, e vazia sem medição, sem visitas ou com o mês aberto',()=>{
  const m=(visitas,whatsapp,{mes='2026-09',parcial=false}={})=>({mes,visitas,contatos:whatsapp===null?null:canais(whatsapp,3,2,1),parcial});
  assert.equal(frase(m(312,41)),'Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro.');
  assert.equal(frase(m(1,1,{mes:'2026-12'})),'Seu anúncio teve 1 visita e 1 contato pelo WhatsApp em dezembro.');
  assert.equal(frase(m(1234567,1000,{mes:'2027-01'})),'Seu anúncio teve 1.234.567 visitas e 1.000 contatos pelo WhatsApp em janeiro.');
  assert.equal(frase(m(312,0)),'Seu anúncio teve 312 visitas em setembro.','sem contato pelo WhatsApp, só as visitas');
  assert.equal(frase(m(312,null)),'Seu anúncio teve 312 visitas em setembro.');
  for(const vazio of [m(0,0),m(null,null),m(312,41,{parcial:true}),null])assert.equal(frase(vazio),'');
});

test('{desempenho} vazio sai com o espaço vizinho; os outros textos entre chaves ficam como estão',()=>{
  const v=desempenho=>({responsavel:'Ana',desempenho});
  assert.equal(preencher('Olá, {responsavel}! {desempenho} Até.',v('')),'Olá, Ana! Até.');
  assert.equal(preencher('{desempenho} Olá.',v('')),'Olá.');
  assert.equal(preencher('Olá. {desempenho}',v('')),'Olá.');
  assert.equal(preencher('Olá.\n{desempenho}\nAté.',v('')),'Olá.\n\nAté.');
  assert.equal(preencher('Olá. {desempenho} Até {outra}.',v('Frase.')),'Olá. Frase. Até {outra}.');
});

test('Configurações: a variável desempenho na lista, com o exemplo da pré-visualização',async()=>{
  const v=(await t.req('/api/configuracoes',{s})).json.variaveis.find(x=>x.chave==='desempenho');
  assert.equal(v.exemplo,'Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro.');
});
