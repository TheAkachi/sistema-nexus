import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { processarFila, esperaDe } from '../../api/data/fila.mjs';
import { ambiente } from './ambiente.mjs';

// Envio da fila do plano ao site (contrato 9.3): depois de cada escrita, só o pedido mais novo de cada empresa, espera
// crescente nas falhas e a auditoria de cada envio. O site falso guarda os PUTs recebidos em t.site.puts.
let t,s,cliente;
before(async()=>{
  t=await ambiente({comFila:true});s=await t.sessao('admin@exemplo.test');
  cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Vida Plena',whatsapp:'21900000001'},s})).json.id;
  for(const e of ['clinica-vida-plena-centro','clinica-vida-plena-austin'])await t.req(`/api/clientes/${cliente}/empresas/${e}`,{method:'POST',body:{},s});
});
after(async()=>{await t?.fim();});
// A escrita agenda a fila (setImmediate); rodar() espera a rodada terminar.
const fila=async()=>{await new Promise(r=>setImmediate(r));await t.fila.rodar();};
const empresa=id=>t.site.empresas.find(e=>e.id===id);
const versao=async id=>(await t.req(`/api/assinaturas/${id}`,{s})).json.version;

test('a escrita manda o plano ao site logo depois, e a assinatura fica sincronizada',async()=>{
  const a=(await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa:'clinica-vida-plena-centro',plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2026-01-15',venceEm:'2026-11-15'}})).json;
  await fila();
  assert.deepEqual(t.site.puts,[{id:'clinica-vida-plena-centro',plano:'plano-premium',gerida:true,assinatura:a.id,motivo:'ativacao',minhaAssinatura:{plano:{id:'plano-premium',nome:'Premium'},
    valorCentavos:9900,ciclo:'mensal',venceEm:'2026-11-15',status:'ativa',ultimosPagamentos:[],comoPagar:{chavePix:'',whatsapp:''}}}]);
  assert.deepEqual([empresa('clinica-vida-plena-centro').plano,empresa('clinica-vida-plena-centro').gerida],['plano-premium',true]);
  const sync=(await t.req(`/api/assinaturas/${a.id}`,{s})).json.sincronizacao;
  assert.deepEqual(sync,{estado:'ok',em:t.agora.toISOString(),erro:''});
  assert.deepEqual((await t.auditoria('plano_enviado','clinica-vida-plena-centro'))[0].after,{plano:'plano-premium',gerida:true,motivo:'ativacao',alterado:true});
  t.a=a.id;
});

test('só o pedido mais novo de cada empresa vai; os mais antigos saem junto',async()=>{
  t.site.puts.length=0;t.site.fora=true;
  await t.req(`/api/assinaturas/${t.a}/suspender`,{method:'POST',body:{version:await versao(t.a)},s});await fila();
  await t.req(`/api/assinaturas/${t.a}/reativar`,{method:'POST',body:{version:await versao(t.a)},s});await fila();
  t.site.fora=false;
  t.minutos(1);
  await processarFila(t.db,{site:t.integracao,now:t.agora});
  assert.deepEqual(t.site.puts.map(p=>[p.plano,p.motivo]),[['plano-premium','reativacao']],'a suspensão não chega a ir: a reativação já vale');
  assert.equal((await t.db.query("SELECT count(*)::int AS n FROM plan_sync WHERE business_id='clinica-vida-plena-centro' AND enviado_em IS NULL")).rows[0].n,0);
});

test('falha: 1, 5, 15 e 60 minutos de espera, com o erro guardado; depois chega',async()=>{
  assert.deepEqual([1,2,3,4,5,9].map(n=>esperaDe(n)/60000),[1,5,15,60,60,60]);
  t.site.puts.length=0;t.site.fora=true;
  await t.req(`/api/assinaturas/${t.a}/cancelar`,{method:'POST',body:{motivo:'Fechou a unidade',version:await versao(t.a)},s});await fila();
  const linha=async()=>(await t.db.query("SELECT tentativas,ultimo_erro,proxima_em FROM plan_sync WHERE business_id='clinica-vida-plena-centro' ORDER BY seq DESC LIMIT 1")).rows[0];
  let l=await linha();
  assert.deepEqual([l.tentativas,l.ultimo_erro,new Date(l.proxima_em)-t.agora],[1,'O guia não respondeu.',60000]);
  assert.deepEqual(await processarFila(t.db,{site:t.integracao,now:t.agora}),{enviados:0,falhas:0},'antes da hora, não tenta');
  t.minutos(1);await processarFila(t.db,{site:t.integracao,now:t.agora});
  l=await linha();assert.deepEqual([l.tentativas,new Date(l.proxima_em)-t.agora],[2,5*60000]);
  t.site.fora=false;t.minutos(5);
  assert.deepEqual(await processarFila(t.db,{site:t.integracao,now:t.agora}),{enviados:1,falhas:0});
  assert.deepEqual(t.site.puts.map(p=>[p.plano,p.gerida,p.motivo]),[[null,true,'cancelamento']]);
  assert.equal((await linha()).ultimo_erro,'');
});

test('empresa que o site não conhece fica com o erro; desvincular devolve o plano ao admin do site',async()=>{
  t.site.empresas=t.site.empresas.filter(e=>e.id!=='clinica-vida-plena-austin');
  await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa:'clinica-vida-plena-austin',plano:'plano-avancado',valorCentavos:6700,ciclo:'mensal',inicio:'2026-01-15',venceEm:'2026-11-15'}});
  await fila();
  assert.equal((await t.db.query("SELECT ultimo_erro FROM plan_sync WHERE business_id='clinica-vida-plena-austin' ORDER BY seq DESC LIMIT 1")).rows[0].ultimo_erro,'Empresa não encontrada no guia.');
  t.site.puts.length=0;
  assert.equal((await t.req(`/api/clientes/${cliente}/empresas/clinica-vida-plena-centro`,{method:'DELETE',s})).status,200);
  await fila();
  assert.deepEqual(t.site.puts,[{id:'clinica-vida-plena-centro',plano:null,gerida:false,assinatura:null,motivo:'desvinculo',minhaAssinatura:null}],'desvinculada: o site apaga a Minha assinatura');
  assert.equal(empresa('clinica-vida-plena-centro').gerida,false);
});

test('Minha assinatura: os 3 últimos pagamentos não estornados, como pagar das Configurações e nada do cliente nem da equipe',async()=>{
  const s2=await t.sessao('admin-2@exemplo.test',{nome:'Ana da Equipe'});
  const c=(await t.req('/api/clientes',{method:'POST',body:{nome:'Padaria Pão Dourado',responsavel:'Carlos Lima',whatsapp:'21900000002',email:'carlos@exemplo.test',notas:'Paga sempre no dia 5'},s:s2})).json.id;
  await t.req(`/api/clientes/${c}/empresas/padaria-pao-dourado`,{method:'POST',body:{},s:s2});
  const a=(await t.req('/api/assinaturas',{method:'POST',s:s2,body:{cliente:c,empresa:'padaria-pao-dourado',plano:'plano-avancado',valorCentavos:18000,ciclo:'trimestral',inicio:'2026-07-24',venceEm:'2026-10-24'}})).json;
  const pagos=[];
  for(const dia of ['2026-10-17','2026-10-18','2026-10-19','2026-10-20'])
    pagos.push((await t.req(`/api/assinaturas/${a.id}/pagamentos`,{method:'POST',s:s2,body:{valorCentavos:18000,pagoEm:dia,forma:'pix',obs:'Comprovante no WhatsApp',version:await versao(a.id)}})).json.pagamento);
  assert.equal((await t.req(`/api/pagamentos/${pagos[3].id}/estornar`,{method:'POST',s:s2,body:{motivo:'Pix duplicado'}})).status,200);
  await fila();
  // Mudar como pagar põe na fila todas as empresas com assinatura não cancelada.
  const conf=(await t.req('/api/configuracoes',{s:s2})).json;
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',s:s2,body:{whatsappAtendimento:'123',version:conf.version}})).json.campo,'whatsappAtendimento');
  const r=await t.req('/api/configuracoes',{method:'PATCH',s:s2,body:{chavePix:'pix@exemplo.test',whatsappAtendimento:'(21) 90000-0000',version:conf.version}});
  assert.deepEqual([r.status,r.json.chavePix,r.json.whatsappAtendimento],[200,'pix@exemplo.test','5521900000000']);
  t.site.puts.length=0;await fila();
  const put=t.site.puts.find(p=>p.id==='padaria-pao-dourado'),atual=(await t.req(`/api/assinaturas/${a.id}`,{s:s2})).json;
  assert.equal(put.motivo,'configuracao');
  assert.deepEqual({...put.minhaAssinatura,ultimosPagamentos:put.minhaAssinatura.ultimosPagamentos.map(p=>p.pagoEm)},{plano:{id:'plano-avancado',nome:'Avançado'},valorCentavos:18000,ciclo:'trimestral',
    venceEm:atual.venceEm,status:'ativa',ultimosPagamentos:['2026-10-19','2026-10-18','2026-10-17'],comoPagar:{chavePix:'pix@exemplo.test',whatsapp:'5521900000000'}},'sem o estornado, do mais novo ao mais velho');
  assert.deepEqual(Object.keys(put.minhaAssinatura.ultimosPagamentos[0]).sort(),['forma','pagoEm','referencia','valorCentavos']);
  const enviado=JSON.stringify(t.site.puts);
  for(const fora of ['Carlos','carlos@exemplo.test','5521900000002','Paga sempre','Comprovante','Pix duplicado','Ana da Equipe','Padaria Pão Dourado'])assert.equal(enviado.includes(fora),false,fora);
  // O valor e o ciclo também vão, mesmo sem mudar o plano.
  t.site.puts.length=0;
  await t.req(`/api/assinaturas/${a.id}`,{method:'PATCH',s:s2,body:{valorCentavos:19000,version:atual.version}});await fila();
  assert.deepEqual(t.site.puts.map(p=>[p.id,p.motivo,p.minhaAssinatura.valorCentavos]),[['padaria-pao-dourado','edicao',19000]]);
});
