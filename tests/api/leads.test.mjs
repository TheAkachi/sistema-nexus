import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ambiente } from './ambiente.mjs';

// Interessados, os leads (contrato 14, v0.13.0), só com dados de teste: a chave desligada (o padrão) e ligada, a leitura
// dos pedidos do site falso, a lista, a edição, o "Virar cliente", o funil e o comando leads. "Hoje" é 20/10/2026.
const pedido=(codigo,criadoEm,extra={})=>({codigo,texto:`Olá, Lucas! Quero anunciar.\nPedido ${codigo}`,respostas:{ramo:'alimentacao',local:'nova-iguacu'},origem:'',criadoEm,...extra});
const LINHA=['id','codigo','nome','whatsapp','situacao','pedidoEm','proximaAcao','proximaEm'];
const LEAD=['id','codigo','texto','respostas','origem','pedidoEm','recebidoEm','nome','whatsapp','situacao','motivoPerda','perdidoEm','proximaAcao','proximaEm','notas','cliente','virouClienteEm','atualizadoEm','version'];

test('chave desligada (o padrão): as rotas e as páginas não existem, a moldura esconde o módulo, o funil vem null e nada é lido',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('admin-off@exemplo.test'),id=randomUUID();
    for(const [caminho,method] of [['/api/leads','GET'],['/api/leads/buscar','POST'],[`/api/leads/${id}`,'GET'],[`/api/leads/${id}`,'PATCH'],[`/api/leads/${id}/cliente`,'POST']])
      for(const sessao of [null,s]) {
        const r=await t.req(caminho,{method,s:sessao,...(method==='GET'?{}:{body:{}})});
        assert.deepEqual([r.status,r.json],[404,{erro:'Endpoint não encontrado.'}],`${method} ${caminho} ${sessao?'com':'sem'} sessão`);
      }
    for(const caminho of ['/interessados',`/interessados/${id}`]) {
      const p=await t.pagina(caminho,{s});
      assert.deepEqual([p.status,p.view,p.vm.dados.status],[404,'erro',404],caminho);
    }
    assert.deepEqual((await t.pagina('/',{s})).vm.modulos,{interessados:false});
    assert.equal((await t.req('/api/indicadores',{s})).json.funil,null);
    t.site.cadastros.push(pedido('A7K3','2026-10-19T14:00:00.000Z'));
    assert.ok(!t.site.pedidos.some(x=>x.url.startsWith('/api/integracao/v1/pedidos')),'nada foi pedido ao site');
    assert.equal((await t.db.query('SELECT count(*)::int AS n FROM leads')).rows[0].n,0);
  } finally { await t.fim(); }
});

test('chave ligada, papéis: admin e comercial veem e mexem; financeiro e leitura só veem o funil',async()=>{
  const t=await ambiente({leads:true});
  try {
    const s={};for(const papel of ['admin','comercial','financeiro','leitura'])s[papel]=await t.sessao(`${papel}-leads@exemplo.test`,{papel});
    for(const papel of ['admin','comercial']) {
      assert.deepEqual((await t.pagina('/',{s:s[papel]})).vm.modulos,{interessados:true},papel);
      const p=await t.pagina('/interessados',{s:s[papel]});
      assert.deepEqual([p.status,p.view,p.title],[200,'interessados','Interessados | Gestão Nexus'],papel);
    }
    for(const papel of ['financeiro','leitura']) {
      assert.deepEqual((await t.pagina('/',{s:s[papel]})).vm.modulos,{interessados:false},papel);
      assert.equal((await t.pagina('/interessados',{s:s[papel]})).status,403,papel);
      assert.equal((await t.req('/api/leads',{s:s[papel]})).status,403,papel);
      assert.ok((await t.req('/api/indicadores',{s:s[papel]})).json.funil,`${papel} vê o funil`);
    }
  } finally { await t.fim(); }
});

test('"Buscar agora": os pedidos desde 31 dias atrás, sem repetir, com o cursor e a auditoria; a falha guarda o erro e não mexe no cursor',async()=>{
  const t=await ambiente({leads:true});
  try {
    const s=await t.sessao('comercial-busca@exemplo.test',{papel:'comercial'});
    const buscar=()=>t.req('/api/leads/buscar',{method:'POST',body:{},s});
    t.site.cadastros.push(pedido('DDDD','2026-09-10T12:00:00.000Z'),pedido('A7K3','2026-10-19T14:00:00.000Z',{origem:'plano-premium'}),pedido('C4MN','2026-10-20T09:30:00.000Z'));
    assert.deepEqual((await buscar()).json,{novos:2,erro:''});
    assert.equal(new URL(t.site.pedidos.at(-1).url,'http://x').searchParams.get('desde'),'2026-09-19T12:00:00.000Z','a primeira leitura vai 31 dias atrás');
    const leads=(await t.db.query('SELECT codigo,texto,respostas,origem,situacao,recebido_em FROM leads ORDER BY pedido_em')).rows;
    assert.deepEqual(leads.map(l=>[l.codigo,l.origem,l.situacao]),[['A7K3','plano-premium','novo'],['C4MN','','novo']]);
    assert.deepEqual(leads[0].respostas,{ramo:'alimentacao',local:'nova-iguacu'});
    assert.match(leads[0].texto,/\nPedido A7K3$/);
    let [leitura]=(await t.db.query('SELECT * FROM lead_leituras')).rows;
    assert.deepEqual([new Date(leitura.cursor).toISOString(),leitura.erro],['2026-10-20T09:30:00.000Z','']);
    const [aud]=await t.auditoria('leads_lidos');
    assert.deepEqual([aud.actor_id,aud.after],[s.id,{novos:2}]);
    // De novo: o mesmo pedido (desde inclusive) não vira outro lead.
    assert.deepEqual((await buscar()).json,{novos:0,erro:''});
    assert.equal(new URL(t.site.pedidos.at(-1).url,'http://x').searchParams.get('desde'),'2026-10-20T09:30:00.000Z');
    // O site sorteia de novo um código que ele já apagou: com outra hora, é outro pedido.
    t.site.cadastros.push(pedido('A7K3','2026-10-20T11:00:00.000Z'));
    assert.deepEqual((await buscar()).json,{novos:1,erro:''});
    assert.equal((await t.db.query("SELECT count(*)::int AS n FROM leads WHERE codigo='A7K3'")).rows[0].n,2);
    // Fora do ar e com a chave desligada no site: o erro fica guardado e o cursor não anda.
    t.site.cadastros.push(pedido('XY39','2026-10-20T11:30:00.000Z'));t.site.fora=true;
    assert.deepEqual((await buscar()).json,{novos:0,erro:'O guia não respondeu.'});
    t.site.fora=false;t.site.leadsLigados=false;
    assert.deepEqual((await buscar()).json,{novos:0,erro:'Os pedidos estão desligados no guia.'});
    [leitura]=(await t.db.query('SELECT * FROM lead_leituras')).rows;
    assert.deepEqual([new Date(leitura.cursor).toISOString(),leitura.erro],['2026-10-20T11:00:00.000Z','Os pedidos estão desligados no guia.']);
    assert.deepEqual((await t.req('/api/leads',{s})).json.leitura,{lidoEm:new Date(leitura.lido_em).toISOString(),erro:'Os pedidos estão desligados no guia.',tentadoEm:t.agora.toISOString()});
    t.site.leadsLigados=true;
    assert.deepEqual((await buscar()).json,{novos:1,erro:''},'a próxima leitura começa do mesmo ponto');
    assert.deepEqual((await t.auditoria('leads_lidos')).map(a=>a.after.erro||a.after.novos),[1,'Os pedidos estão desligados no guia.','O guia não respondeu.',1,0,2]);
  } finally { await t.fim(); }
});

test('leitura de mais de uma página: cada volta pede desde o último lido, e nenhum fica para trás',async()=>{
  const t=await ambiente({leads:true});
  try {
    const s=await t.sessao('admin-paginas@exemplo.test');
    const A='ACDEFHJKMNPRTUVWXY3479',base=Date.parse('2026-10-18T00:00:00.000Z');
    for(let i=0;i<230;i++)t.site.cadastros.push(pedido(`${A[i%22]}${A[Math.floor(i/22)]}KK`,new Date(base+i*60000).toISOString()));
    assert.deepEqual((await t.req('/api/leads/buscar',{method:'POST',body:{},s})).json,{novos:230,erro:''});
    assert.equal(t.site.pedidos.filter(x=>x.url.startsWith('/api/integracao/v1/pedidos')).length,3);
    assert.equal((await t.req('/api/leads?page=12',{s})).json.total,230);
  } finally { await t.fim(); }
});

test('lista, busca e edição: pelo código, pelo nome e pelo WhatsApp; a situação, o motivo da perda, a próxima ação e as notas',async()=>{
  const t=await ambiente({leads:true});
  try {
    const s=await t.sessao('comercial-edita@exemplo.test',{papel:'comercial'});
    t.site.cadastros.push(pedido('A7K3','2026-10-19T14:00:00.000Z'),pedido('C4MN','2026-10-20T09:30:00.000Z'));
    await t.req('/api/leads/buscar',{method:'POST',body:{},s});
    let lista=(await t.req('/api/leads',{s})).json;
    assert.deepEqual(lista.itens.map(l=>l.codigo),['C4MN','A7K3'],'do mais novo para o mais velho');
    assert.deepEqual(Object.keys(lista.itens[0]),LINHA);
    assert.deepEqual([lista.total,lista.pagina,lista.paginas],[2,1,1]);
    const id=lista.itens[1].id,lead=(await t.req(`/api/leads/${id}`,{s})).json;
    assert.deepEqual(Object.keys(lead),LEAD);
    assert.deepEqual([lead.situacao,lead.nome,lead.cliente,lead.version],['novo','',null,1]);
    const editar=body=>t.req(`/api/leads/${id}`,{method:'PATCH',body,s});
    let r=await editar({nome:'  Marta   Souza ',whatsapp:'(21) 98765-4321',proximaAcao:'Mandar a tabela de planos',proximaEm:'2026-10-22',notas:'Padaria em Austin.',situacao:'em-conversa',version:1});
    assert.deepEqual([r.status,r.json.nome,r.json.whatsapp,r.json.situacao,r.json.proximaEm,r.json.version],[200,'Marta Souza','5521987654321','em-conversa','2026-10-22',2]);
    for(const q of ['a7','Pedido A7K3','marta','8765'])assert.deepEqual((await t.req(`/api/leads?q=${encodeURIComponent(q)}`,{s})).json.itens.map(l=>l.codigo),['A7K3'],q);
    assert.deepEqual((await t.req('/api/leads?situacao=novo',{s})).json.itens.map(l=>l.codigo),['C4MN']);
    // As regras de 14.4.
    for(const [body,campo] of [[{situacao:'perdido',version:2},'motivoPerda'],[{situacao:'cliente',version:2},'situacao'],[{motivoPerda:'Preço alto',version:2},'motivoPerda'],
      [{proximaEm:'2026-02-30',version:2},'proximaEm'],[{nome:'M',version:2},'nome'],[{whatsapp:'123',version:2},'whatsapp'],[{codigo:'CCCC',version:2},'codigo']])
      assert.deepEqual([(r=await editar(body)).status,r.json.campo],[422,campo],JSON.stringify(body));
    assert.equal((await editar({notas:'outra',version:1})).status,409);
    r=await editar({situacao:'perdido',motivoPerda:'Preço alto',version:2});
    assert.deepEqual([r.json.situacao,r.json.motivoPerda,r.json.perdidoEm],['perdido','Preço alto',t.agora.toISOString()]);
    r=await editar({situacao:'proposta',version:3});
    assert.deepEqual([r.json.situacao,r.json.motivoPerda,r.json.perdidoEm],['proposta','',null],'sair do perdido apaga o motivo e a data');
    assert.equal((await editar({situacao:'proposta',version:4})).json.version,4,'sem mudança, sem versão nova');
    const [aud]=await t.auditoria('lead_editado',id);
    assert.deepEqual([aud.actor_id,aud.before,aud.after],[s.id,{situacao:'perdido',motivoPerda:'Preço alto'},{situacao:'proposta',motivoPerda:''}]);
    // A página do pedido traz o Lead.
    const p=await t.pagina(`/interessados/${id}`,{s});
    assert.deepEqual([p.view,p.title,p.vm.dados],['interessado','Pedido A7K3 · Interessados | Gestão Nexus',r.json]);
    assert.equal((await t.pagina(`/interessados/${randomUUID()}`,{s})).status,404);
  } finally { await t.fim(); }
});

test('"Virar cliente": pede o nome, cria o cliente com o nome e o WhatsApp, liga o lead e não converte duas vezes',async()=>{
  const t=await ambiente({leads:true});
  try {
    const s=await t.sessao('admin-converte@exemplo.test');
    t.site.cadastros.push(pedido('A7K3','2026-10-19T14:00:00.000Z'));
    await t.req('/api/leads/buscar',{method:'POST',body:{},s});
    const [{id}]=(await t.req('/api/leads',{s})).json.itens,virar=version=>t.req(`/api/leads/${id}/cliente`,{method:'POST',body:{version},s});
    let r=await virar(1);
    assert.deepEqual([r.status,r.json],[422,{erro:'Complete o nome antes de virar cliente.',campo:'nome'}]);
    await t.req(`/api/leads/${id}`,{method:'PATCH',body:{nome:'Marta Souza',whatsapp:'21987654321',situacao:'perdido',motivoPerda:'Achou caro',version:1},s});
    t.minutos(10);
    r=await virar(2);
    assert.equal(r.status,201);
    const cliente=(await t.db.query('SELECT * FROM clients WHERE id=$1',[r.json.cliente.id])).rows[0];
    assert.deepEqual([cliente.nome,cliente.whatsapp,cliente.status],['Marta Souza','5521987654321','ativo']);
    assert.deepEqual(r.json.cliente,{id:cliente.id,nome:'Marta Souza'});
    assert.deepEqual([r.json.lead.situacao,r.json.lead.cliente,r.json.lead.virouClienteEm,r.json.lead.motivoPerda,r.json.lead.perdidoEm],['cliente',{id:cliente.id,nome:'Marta Souza'},t.agora.toISOString(),'',null]);
    assert.equal((await t.auditoria('cliente_criado',cliente.id)).length,1);
    assert.deepEqual((await t.auditoria('lead_convertido',id))[0].after,{situacao:'cliente',cliente:cliente.id});
    assert.deepEqual([(r=await virar(3)).status,r.json.campo],[422,'situacao']);
    assert.deepEqual([(r=await t.req(`/api/leads/${id}`,{method:'PATCH',body:{situacao:'novo',version:3},s})).status,r.json.campo],[422,'situacao']);
    assert.equal((await t.req(`/api/leads/${id}`,{method:'PATCH',body:{notas:'Assinou o Premium.',version:3},s})).json.notas,'Assinou o Premium.');
  } finally { await t.fim(); }
});

test('funil nos Indicadores: novos, convertidos e perdidos por mês, os motivos juntos e a mediana até virar cliente',async()=>{
  const t=await ambiente({leads:true});
  try {
    const s=await t.sessao('leitura-funil@exemplo.test',{papel:'leitura'}),cid=randomUUID();
    await t.db.query("INSERT INTO clients(id,nome,criado_em,atualizado_em) VALUES($1,'Cliente do funil',now(),now())",[cid]);
    const lead=(codigo,pedidoEm,{situacao='novo',motivo='',perdidoEm=null,virouEm=null}={})=>t.db.query(`INSERT INTO leads(id,codigo,pedido_em,recebido_em,situacao,motivo_perda,perdido_em,client_id,virou_cliente_em,atualizado_em)
      VALUES($1,$2,$3,$3,$4,$5,$6,$7,$8,$3)`,[randomUUID(),codigo,pedidoEm,situacao,motivo,perdidoEm,virouEm?cid:null,virouEm]);
    await lead('AAAA','2026-08-10T12:00:00Z',{situacao:'cliente',virouEm:'2026-08-20T12:00:00Z'});
    await lead('CCCC','2026-09-01T12:00:00Z',{situacao:'cliente',virouEm:'2026-09-05T12:00:00Z'});
    await lead('DDDD','2026-10-01T12:00:00Z',{situacao:'perdido',motivo:'preco alto.',perdidoEm:'2026-10-03T12:00:00Z'});
    await lead('EEEE','2026-10-02T12:00:00Z',{situacao:'perdido',motivo:'Preço alto',perdidoEm:'2026-10-05T12:00:00Z'});
    await lead('FFFF','2026-10-03T12:00:00Z',{situacao:'perdido',motivo:'Sem resposta',perdidoEm:'2026-10-04T12:00:00Z'});
    await lead('HHHH','2026-10-15T12:00:00Z');
    await lead('JJJJ','2025-09-01T12:00:00Z',{situacao:'perdido',motivo:'Antigo',perdidoEm:'2025-09-10T12:00:00Z'});
    const f=(await t.req('/api/indicadores',{s})).json.funil;
    assert.deepEqual(Object.keys(f),['como','meses','motivosPerda','tempoAteCliente']);
    assert.equal(f.meses.length,12);
    const m=Object.fromEntries(f.meses.map(x=>[x.mes,[x.novos,x.convertidos,x.perdidos,x.parcial]]));
    assert.deepEqual([m['2025-11'],m['2026-08'],m['2026-09'],m['2026-10']],[[0,0,0,false],[1,1,0,false],[1,1,0,false],[4,0,3,true]]);
    assert.deepEqual(f.motivosPerda,[{motivo:'Preço alto',qtd:2},{motivo:'Sem resposta',qtd:1}],'o de 2025 fica de fora; vale a escrita mais recente');
    assert.deepEqual(f.tempoAteCliente,{convertidos:2,medianaDias:7});
    assert.equal(JSON.stringify(f).includes('Cliente do funil'),false,'só números');
  } finally { await t.fim(); }
});

test('comando leads: desligado, só avisa; ligado sem a integração, para com erro',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'gestao-leads-'));
  try {
    const cli=env=>spawnSync(process.execPath,[fileURLToPath(new URL('../../api/cli.mjs',import.meta.url)),'leads'],
      {encoding:'utf8',env:{...process.env,DATABASE_URL:'',DB_DIR:dir,NODE_ENV:'test',SITE_API_URL:'',INTEGRACAO_CHAVE_ID:'',INTEGRACAO_CHAVE:'',...env}});
    let r=cli({LEADS_LIGADOS:''});
    assert.deepEqual([r.status,r.stdout],[0,'Os interessados estão desligados (LEADS_LIGADOS).\n'],r.stderr);
    r=cli({LEADS_LIGADOS:'1'});
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/Integração não configurada/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
