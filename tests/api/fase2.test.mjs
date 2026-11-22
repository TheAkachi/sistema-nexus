import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { lerMetricas, mesesIndicadores } from '../../api/data/metricas-site.mjs';
import { ambiente } from './ambiente.mjs';

// Fase 2 sem leads (contrato 9.5 e 6.17): o WhatsApp do atendimento com reautenticação, a leitura das métricas do site
// (com a cópia anterior quando falha) e os blocos Audiência do Guia e Anunciantes dos Indicadores. Hoje é 20/10/2026.
let t,s;
const zero={whatsapp:0,telefone:0,rota:0,site:0};
const metricas=()=>({de:'2025-11',ate:'2026-10',medidoDesde:{contatos:'2026-09-10',buscas:'2026-10-01'},
  site:{meses:[{mes:'2026-08',visitas:null,contatos:null,buscas:null,buscasSemResultado:null},{mes:'2026-09',visitas:300,contatos:{whatsapp:20,telefone:4,rota:5,site:1},buscas:null,buscasSemResultado:null},
    {mes:'2026-10',visitas:410,contatos:{whatsapp:31,telefone:6,rota:7,site:2},buscas:120,buscasSemResultado:9}],
    buscasMaisFeitas:[{termo:'padaria',vezes:12}],buscasSemResultado:[{termo:'chaveiro 24 horas',vezes:4}],bairros:[{bairro:'Centro',vezes:30}],
    categorias:[{categoria:'alimentacao',nome:'  Alimentação ',vezes:22},{categoria:'loja-de-tintas',vezes:5},{nome:'Sem identificador',vezes:4}]},
  empresas:{itens:[
    {id:'clinica-vida-plena-centro',nome:'Clínica Vida Plena · Centro',meses:[],ultimos30:{visitas:210,contatos:{whatsapp:30,telefone:6,rota:4,site:1}}},
    {id:'padaria-pao-dourado',nome:'Padaria Pão Dourado',meses:[],ultimos30:{visitas:38,contatos:{whatsapp:2,telefone:0,rota:0,site:0}}},
    {id:'auto-pecas-iguacu',nome:'Auto Peças Iguaçu',meses:[],ultimos30:{visitas:90,contatos:{whatsapp:9,telefone:0,rota:0,site:0}},extra:'<script>'}],total:3,pagina:1,paginas:1},
  banners:[{id:'padaria-pao-de-queijo',titulo:'Pão de queijo em dobro',empresa:{id:'padaria-pao-dourado',nome:'Padaria Pão Dourado'},impressoes:4210,cliques:63}]});
before(async()=>{
  t=await ambiente();s=await t.sessao('fase2@exemplo.test');
  const cliente=async(nome,empresa,plano,valorCentavos,venceEm)=>{
    const id=(await t.req('/api/clientes',{method:'POST',body:{nome},s})).json.id;
    await t.req(`/api/clientes/${id}/empresas/${empresa}`,{method:'POST',body:{},s});
    await t.req('/api/assinaturas',{method:'POST',s,body:{cliente:id,empresa,plano,valorCentavos,ciclo:'mensal',inicio:'2026-01-01',venceEm}});
  };
  await cliente('Clínica Vida Plena','clinica-vida-plena-centro','plano-premium',9900,'2026-11-15');
  await cliente('Padaria Pão Dourado','padaria-pao-dourado','plano-avancado',6700,'2026-10-24');
  await cliente('Auto Peças Iguaçu','auto-pecas-iguacu','plano-avancado',6700,'2026-12-20');
  await cliente('Studio Bella','studio-bella','plano-avancado',6700,'2026-10-30');
});
after(async()=>{await t?.fim();});

test('WhatsApp do atendimento: no formato do WhatsApp, com reautenticação como a chave Pix',async()=>{
  const v=(await t.req('/api/configuracoes',{s})).json.version;
  t.minutos(6);const velho=await t.req('/api/configuracoes',{method:'PATCH',s,body:{whatsappAtendimento:'21900000000',version:v}});
  assert.deepEqual([velho.status,velho.json.reautenticar],[403,true]);
  s=await t.sessao('fase2-b@exemplo.test');
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',s,body:{toleranciaDias:10,version:v}})).status,200,'a tolerância continua sem reautenticação');
  const r=await t.req('/api/configuracoes',{method:'PATCH',s,body:{whatsappAtendimento:'21900000000',version:v}});
  assert.deepEqual([r.status,r.json.whatsappAtendimento],[200,'5521900000000']);
  assert.deepEqual((await t.auditoria('configuracoes_editadas'))[0].after,{whatsappAtendimento:'5521900000000'});
  assert.equal((await t.db.query("SELECT count(*)::int AS n FROM plan_sync WHERE motivo='configuracao'")).rows[0].n,4,'as 4 empresas com assinatura');
});

test('métricas: lê as páginas, guarda a cópia limpa e, quando falha, a cópia anterior continua',async()=>{
  assert.deepEqual([mesesIndicadores(t.agora)[0],mesesIndicadores(t.agora)[11]],['2025-11','2026-10']);
  const semCopia=(await t.req('/api/indicadores',{s})).json;
  assert.deepEqual([semCopia.audiencia.disponivel,semCopia.audiencia.meses.every(m=>m.visitas===null),semCopia.anunciantes.disponivel,semCopia.anunciantes.maisContatos,semCopia.anunciantes.semMedicao],[false,true,false,[],[]]);
  // Duas páginas: a segunda traz a Studio Bella.
  t.site.metricas=({page})=>page===1?{...metricas(),empresas:{...metricas().empresas,paginas:2}}
    :{...metricas(),empresas:{itens:[{id:'studio-bella',nome:'Studio Bella',meses:[],ultimos30:{visitas:4,contatos:{...zero,whatsapp:1}}}],total:4,pagina:2,paginas:2}};
  assert.deepEqual(await lerMetricas(t.db,{site:t.integracao,now:t.agora}),{de:'2025-11',ate:'2026-10',empresas:4,erro:''});
  const pedido=t.site.pedidos.filter(p=>p.url.startsWith('/api/integracao/v1/metricas')).map(p=>p.url);
  assert.deepEqual(pedido,['/api/integracao/v1/metricas?de=2025-11&ate=2026-10&page=1','/api/integracao/v1/metricas?de=2025-11&ate=2026-10&page=2']);
  const copia=(await t.db.query('SELECT dados,lido_em,erro FROM site_metrics')).rows[0];
  assert.equal(JSON.stringify(copia.dados).includes('<script>'),false,'só o que o contrato prevê é guardado');
  assert.deepEqual([copia.dados.empresas.length,copia.erro],[4,'']);
  t.site.fora=true;t.minutos(60);
  assert.deepEqual(await lerMetricas(t.db,{site:t.integracao,now:t.agora}),{de:'2025-11',ate:'2026-10',empresas:0,erro:'O guia não respondeu.'});
  t.site.fora=false;
  const depois=(await t.db.query('SELECT dados,lido_em,erro FROM site_metrics')).rows[0];
  assert.deepEqual([depois.dados.empresas.length,new Date(depois.lido_em).getTime(),depois.erro],[4,new Date(copia.lido_em).getTime(),'O guia não respondeu.']);
  assert.deepEqual((await t.auditoria('metricas_lidas')).map(a=>a.after.erro??''),['O guia não respondeu.','']);
});

test('Indicadores: Audiência do Guia e Anunciantes da cópia, com os meses sem medição em branco',async()=>{
  s=await t.sessao('fase2-c@exemplo.test');
  const r=(await t.req('/api/indicadores',{s})).json,a=r.audiencia,n=r.anunciantes;
  assert.deepEqual([a.disponivel,a.medidoDesde,a.meses.length],[true,{contatos:'2026-09-10',buscas:'2026-10-01'},12]);
  assert.deepEqual(a.meses.slice(-3).map(m=>[m.mes,m.visitas,m.contatosTotal,m.buscas,m.parcial]),[['2026-08',null,null,null,false],['2026-09',300,30,null,false],['2026-10',410,46,120,true]]);
  assert.deepEqual(a.meses[0],{mes:'2025-11',visitas:null,contatos:null,contatosTotal:null,buscas:null,buscasSemResultado:null,parcial:false},'mês que o site não mandou');
  assert.deepEqual([a.buscasMaisFeitas,a.bairros],[[{termo:'padaria',vezes:12}],[{bairro:'Centro',vezes:30}]]);
  // v0.9.2: o nome que o guia mostra; sem ele (site antes da v0.19.1), o identificador; sem identificador, fica de fora.
  assert.deepEqual(a.categorias,[{categoria:'alimentacao',nome:'Alimentação',vezes:22},{categoria:'loja-de-tintas',nome:'loja-de-tintas',vezes:5}]);
  assert.deepEqual([n.base,n.semMedicao],[4,[]]);
  assert.deepEqual(n.maisContatos.map(x=>[x.empresa.id,x.contatos30]),[['clinica-vida-plena-centro',41],['auto-pecas-iguacu',9],['padaria-pao-dourado',2],['studio-bella',1]]);
  assert.deepEqual(n.menosContatos,[],'com 4 anunciantes, todos já estão em maisContatos');
  assert.deepEqual(n.emRisco.map(x=>[x.empresa.id,x.assinatura.venceEm,x.contatos30]),[['padaria-pao-dourado','2026-10-24',2],['studio-bella','2026-10-30',1]]);
  assert.deepEqual(n.maisContatos[0].cliente.nome,'Clínica Vida Plena');
  assert.deepEqual(n.banners,[{id:'padaria-pao-de-queijo',titulo:'Pão de queijo em dobro',empresa:{id:'padaria-pao-dourado',nome:'Padaria Pão Dourado'},impressoes:4210,cliques:63,ctr:0.015}]);
  assert.ok(n.atualizadaEm&&a.atualizadaEm);
});

test('Indicadores: a empresa que o site não mede fica em semMedicao, sem número, e o zero medido continua zero (v0.14.1)',async()=>{
  const id=(await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Austin'},s})).json.id,AUSTIN='clinica-vida-plena-austin';
  await t.req(`/api/clientes/${id}/empresas/${AUSTIN}`,{method:'POST',body:{},s});
  await t.req('/api/assinaturas',{method:'POST',s,body:{cliente:id,empresa:AUSTIN,plano:'plano-avancado',valorCentavos:6700,ciclo:'mensal',inicio:'2026-01-01',venceEm:'2026-10-25'}});
  const n=(await t.req('/api/indicadores',{s})).json.anunciantes;
  assert.equal(n.base,5,'a base continua contando a assinatura ativa');
  assert.deepEqual(n.semMedicao.map(x=>[x.empresa.id,x.cliente.nome,x.assinatura.venceEm]),[[AUSTIN,'Clínica Austin','2026-10-25']]);
  assert.deepEqual(Object.keys(n.semMedicao[0]).sort(),['assinatura','cliente','empresa'],'sem número nenhum');
  assert.ok(![...n.maisContatos,...n.menosContatos,...n.emRisco].some(x=>x.empresa.id===AUSTIN),'fora das listas e do risco');
  assert.deepEqual(n.emRisco.map(x=>x.empresa.id),['padaria-pao-dourado','studio-bella']);
  // O site passa a medir a empresa, e ninguém visitou: agora o zero é um número de verdade.
  t.site.metricas=()=>({...metricas(),empresas:{...metricas().empresas,itens:[...metricas().empresas.itens,{id:'studio-bella',nome:'Studio Bella',meses:[],ultimos30:{visitas:4,contatos:{...zero,whatsapp:1}}},{id:AUSTIN,nome:'Clínica Vida Plena · Austin',meses:[],ultimos30:{visitas:0,contatos:zero}}]}});
  await lerMetricas(t.db,{site:t.integracao,now:t.agora});
  const m=(await t.req('/api/indicadores',{s})).json.anunciantes,austin=m.emRisco.find(x=>x.empresa.id===AUSTIN);
  assert.deepEqual([m.semMedicao,austin?.visitas30,austin?.contatos30,austin?.contatos30Canais],[[],0,0,zero]);
});
