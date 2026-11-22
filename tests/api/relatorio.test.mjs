import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lerMetricas } from '../../api/data/metricas-site.mjs';
import { contexto } from '../../api/data/assinaturas.mjs';
import { obterFicha } from '../../api/data/clientes.mjs';
import { ambiente } from './ambiente.mjs';

// Relatório do mês para o anunciante (contrato 6.7, 6.14, 7.3 e 7.4, v0.11.0): o link da página do site e a mensagem pronta
// para o WhatsApp do cliente, o registro do envio no histórico e o modelo nas Configurações. Hoje é 20/10/2026: o
// relatório é o de setembro.
let t,s,cliente,semZap;
const CENTRO='clinica-vida-plena-centro',AUSTIN='clinica-vida-plena-austin',ORIGEM='https://site.exemplo.test';
const zero={whatsapp:0,telefone:0,rota:0,site:0};
const metricas=({de,ate})=>({de,ate,medidoDesde:{contatos:'2026-07-14',buscas:'2026-10-01'},site:{meses:[],buscasMaisFeitas:[],buscasSemResultado:[],bairros:[],categorias:[]},
  empresas:{itens:[{id:CENTRO,nome:'Clínica Vida Plena · Centro',meses:[{mes:'2026-09',visitas:312,contatos:{whatsapp:41,telefone:6,rota:14,site:4}}],ultimos30:{visitas:0,contatos:zero}}],total:1,pagina:1,paginas:1},banners:[]});
const textoDe=link=>decodeURIComponent(link.split('?text=')[1]);
const envio=(id,empresa,body,sessao=s)=>t.req(`/api/clientes/${id}/empresas/${empresa}/relatorios`,{method:'POST',s:sessao,body});
before(async()=>{
  t=await ambiente();s=await t.sessao('relatorio@exemplo.test',{nome:'Bruno'});
  cliente=(await t.req('/api/clientes',{method:'POST',s,body:{nome:'Clínica Vida Plena',responsavel:'Marina Souza',whatsapp:'21900000001'}})).json.id;
  for(const e of [CENTRO,AUSTIN])assert.equal((await t.req(`/api/clientes/${cliente}/empresas/${e}`,{method:'POST',body:{},s})).status,201);
  assert.equal((await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa:CENTRO,plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2026-01-01',venceEm:'2026-10-25'}})).status,201);
  semZap=(await t.req('/api/clientes',{method:'POST',s,body:{nome:'Padaria Pão Dourado'}})).json.id;
  assert.equal((await t.req(`/api/clientes/${semZap}/empresas/padaria-pao-dourado`,{method:'POST',body:{},s})).status,201);
  t.site.metricas=metricas;
  assert.equal((await lerMetricas(t.db,{site:t.integracao,now:t.agora})).erro,'');
});
after(async()=>{await t?.fim();});

test('ficha: o relatório de setembro de cada empresa, com o endereço no site e a mensagem pronta',async()=>{
  const f=(await t.req(`/api/clientes/${cliente}`,{s})).json,r=f.relatorio;
  assert.deepEqual([r.mes,r.rotulo],['2026-09','setembro de 2026']);
  assert.deepEqual(r.empresas.map(e=>e.id),f.empresas.map(e=>e.id),'na ordem das empresas da ficha');
  const centro=r.empresas.find(e=>e.id===CENTRO),austin=r.empresas.find(e=>e.id===AUSTIN);
  assert.deepEqual(Object.keys(centro),['id','url','linkWhatsapp','ultimoEnvio']);
  assert.deepEqual([centro.url,centro.ultimoEnvio],[`${ORIGEM}/painel/${CENTRO}/relatorio/2026-09`,null]);
  assert.match(centro.linkWhatsapp,/^https:\/\/wa\.me\/5521900000001\?text=/);
  assert.equal(textoDe(centro.linkWhatsapp),`Olá, Marina Souza! Aqui é do Nexus. Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro. O relatório de setembro de 2026 da Clínica Vida Plena · Centro está neste link: ${ORIGEM}/painel/${CENTRO}/relatorio/2026-09`);
  assert.equal(textoDe(austin.linkWhatsapp),`Olá, Marina Souza! Aqui é do Nexus. O relatório de setembro de 2026 da Clínica Vida Plena · Austin está neste link: ${ORIGEM}/painel/${AUSTIN}/relatorio/2026-09`,
    'a Austin não veio na cópia: a mensagem sai sem a frase e sem espaço sobrando');
});

test('sem a ação cobrar, sem WhatsApp do cliente ou sem a origem do site: sem o link do WhatsApp',async()=>{
  const leitura=await t.sessao('relatorio-leitura@exemplo.test',{papel:'leitura'});
  const r=(await t.req(`/api/clientes/${cliente}`,{s:leitura})).json.relatorio;
  assert.deepEqual(r.empresas.map(e=>[e.linkWhatsapp,e.url]),[[null,`${ORIGEM}/painel/${AUSTIN}/relatorio/2026-09`],[null,`${ORIGEM}/painel/${CENTRO}/relatorio/2026-09`]]);
  assert.deepEqual((await t.req(`/api/clientes/${semZap}`,{s})).json.relatorio.empresas.map(e=>e.linkWhatsapp),[null]);
  const semOrigem=(await obterFicha(t.db,cliente,await contexto(t.db,{now:t.agora,siteOrigin:''}),{podeCobrar:true})).relatorio;
  assert.deepEqual(semOrigem.empresas.map(e=>[e.url,e.linkWhatsapp]),[['',null],['',null]]);
  // A página da ficha recebe o mesmo link de quem pode cobrar.
  assert.equal((await t.pagina(`/clientes/${cliente}`,{s})).vm.dados.relatorio.empresas[1].linkWhatsapp,(await t.req(`/api/clientes/${cliente}`,{s})).json.relatorio.empresas[1].linkWhatsapp);
});

test('envio: vira um Contato, o último envio do mês, um item da linha do tempo e um registro da auditoria',async()=>{
  const r=await envio(cliente,CENTRO,{mes:'2026-09'});
  assert.equal(r.status,201);
  assert.deepEqual({...r.json,id:undefined},{id:undefined,assinaturaId:null,empresaId:CENTRO,canal:'whatsapp',tipo:'relatorio',etapa:null,venceEm:null,mes:'2026-09',em:t.agora.toISOString(),por:{id:s.id,nome:'Bruno'}});
  t.minutos(5);
  assert.equal((await envio(cliente,CENTRO,{mes:'2026-09'})).status,201,'pode mandar de novo');
  const f=(await t.req(`/api/clientes/${cliente}`,{s})).json;
  assert.deepEqual(f.relatorio.empresas.map(e=>e.ultimoEnvio&&e.ultimoEnvio.em),[null,t.agora.toISOString()]);
  assert.deepEqual(f.relatorio.empresas[1].ultimoEnvio.por,{id:s.id,nome:'Bruno'});
  const item=f.linhaDoTempo[0];
  assert.deepEqual([item.tipo,item.em,item.assinatura,item.empresa,item.contato.tipo,item.contato.mes],['relatorio',t.agora.toISOString(),null,{id:CENTRO,nome:'Clínica Vida Plena · Centro'},'relatorio','2026-09']);
  assert.equal(f.linhaDoTempo.filter(i=>i.tipo==='relatorio').length,2);
  assert.deepEqual((await t.auditoria('relatorio_enviado',cliente)).map(a=>a.after),[{empresa:CENTRO,mes:'2026-09'},{empresa:CENTRO,mes:'2026-09'}]);
  // O relatório não conta como cobrança da assinatura da mesma empresa.
  assert.equal((await t.req('/api/renovacoes?janela=7',{s})).json.itens.find(x=>x.empresa?.id===CENTRO).ultimoContato,null);
});

test('envio: empresa de outro cliente, mês fora dos 12 fechados, campo a mais, cliente sem WhatsApp e quem não cobra',async()=>{
  assert.equal((await envio(cliente,'padaria-pao-dourado',{mes:'2026-09'})).status,404);
  assert.equal((await envio(randomUUID(),CENTRO,{mes:'2026-09'})).status,404);
  for(const mes of ['2026-10','2025-09','2026-11','2026-9',202609,undefined]) {
    const r=await envio(cliente,CENTRO,{mes});
    assert.deepEqual([r.status,r.json.campo],[422,'mes'],String(mes));
  }
  assert.equal((await envio(cliente,CENTRO,{mes:'2025-10'})).status,201,'o 12º mês fechado ainda vale');
  assert.deepEqual([(await envio(cliente,CENTRO,{mes:'2026-09',extra:1})).json.campo],['extra']);
  const r=await envio(semZap,'padaria-pao-dourado',{mes:'2026-09'});
  assert.deepEqual([r.status,r.json.campo],[422,'whatsapp']);
  const leitura=await t.sessao('relatorio-leitura2@exemplo.test',{papel:'leitura'});
  assert.equal((await envio(cliente,CENTRO,{mes:'2026-09'},leitura)).status,403);
});

test('Configurações: o modelo do relatório, só com as variáveis dele e sempre com o {link}',async()=>{
  let c=(await t.req('/api/configuracoes',{s})).json;
  assert.equal(c.modeloRelatorio,'Olá, {responsavel}! Aqui é do Nexus. {desempenho} O relatório de {mes} da {empresa} está neste link: {link}');
  assert.deepEqual(c.variaveisRelatorio.map(v=>v.chave),['responsavel','cliente','empresa','mes','desempenho','link']);
  const patch=body=>t.req('/api/configuracoes',{method:'PATCH',s,body:{...body,version:c.version}});
  for(const [modelo,erro] of [['Relatório da {empresa} do plano {plano}: {link}',/\{plano\}/],['Olá, {responsavel}! O relatório de {mes} está pronto.',/\{link\}/],['{link}',/1\.000/]]) {
    const r=await patch({modeloRelatorio:modelo});
    assert.deepEqual([r.status,r.json.campo],[422,'modeloRelatorio'],modelo);assert.match(r.json.erro,erro);
  }
  assert.deepEqual([(await patch({modeloMensagem:'Olá, {responsavel}! Veja: {link}'})).json.campo],['modeloMensagem'],'o {link} não vale na cobrança');
  const r=await patch({modeloRelatorio:'Bom dia, {responsavel}! Relatório de {mes}: {link}'});
  assert.equal(r.status,200);c=r.json;
  assert.equal(c.modeloRelatorio,'Bom dia, {responsavel}! Relatório de {mes}: {link}');
  assert.deepEqual((await t.auditoria('configuracoes_editadas'))[0].after,{modeloRelatorio:'Bom dia, {responsavel}! Relatório de {mes}: {link}'});
  const centro=(await t.req(`/api/clientes/${cliente}`,{s})).json.relatorio.empresas[1];
  assert.equal(textoDe(centro.linkWhatsapp),`Bom dia, Marina Souza! Relatório de setembro de 2026: ${ORIGEM}/painel/${CENTRO}/relatorio/2026-09`);
});

test('banco: o relatório tem cliente, empresa e mês sem assinatura; a cobrança continua com assinatura e vencimento',async()=>{
  const sub=(await t.db.query('SELECT id FROM subscriptions LIMIT 1')).rows[0].id;
  const inserir=(campos,valores)=>t.db.query(`INSERT INTO contacts(id,canal,tipo,${campos}) VALUES('${randomUUID()}','whatsapp',${valores})`);
  await assert.rejects(inserir('client_id,business_id,mes,subscription_id',`'relatorio','${cliente}','${CENTRO}','2026-09','${sub}'`),'relatório com assinatura');
  await assert.rejects(inserir('client_id,business_id',`'relatorio','${cliente}','${CENTRO}'`),'relatório sem mês');
  await assert.rejects(inserir('client_id,business_id,mes',`'relatorio','${cliente}','${CENTRO}','2026-13'`),'mês inválido');
  await assert.rejects(inserir('subscription_id',`'cobranca','${sub}'`),'cobrança sem vencimento');
  await assert.rejects(inserir('subscription_id,vence_em,mes',`'lembrete','${sub}','2026-10-25','2026-09'`),'lembrete com mês');
});
