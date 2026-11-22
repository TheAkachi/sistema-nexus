import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reais, dataBR, prazo, preencher, desconhecidas } from '../../api/lib/mensagem.mjs';
import { ETAPAS } from '../../api/lib/regua.mjs';
import { ambiente, SENHA } from './ambiente.mjs';

// Cobrança (contrato 6.4, 6.5, 6.7, 6.10, 6.14 e 7.2 a 7.5). Hoje é 20/10/2026 em São Paulo e a tolerância é de 10 dias.
let t,adm,fin,leitura;const A={};
before(async()=>{
  t=await ambiente();adm=await t.sessao('admin@exemplo.test',{nome:'Lucas'});fin=await t.sessao('ana@exemplo.test',{papel:'financeiro',nome:'Ana'});
  leitura=await t.sessao('julia@exemplo.test',{papel:'leitura'});
  const cliente=async(nome,responsavel,whatsapp,empresa)=>{
    const id=(await t.req('/api/clientes',{method:'POST',body:{nome,responsavel,whatsapp},s:adm})).json.id;
    if(empresa)await t.req(`/api/clientes/${id}/empresas/${empresa}`,{method:'POST',body:{},s:adm});
    return id;
  };
  const assinatura=async(cli,empresa,plano,valorCentavos,ciclo,venceEm)=>(await t.req('/api/assinaturas',{method:'POST',s:adm,
    body:{cliente:cli,empresa,plano,valorCentavos,ciclo,inicio:'2025-03-15',venceEm}})).json.id;
  const auto=await cliente('Auto Peças Iguaçu','Rita Alves','5521900000003','auto-pecas-iguacu');
  const vida=await cliente('Clínica Vida Plena','Marina Souza','5521900000001','clinica-vida-plena-centro');
  await t.req(`/api/clientes/${vida}/empresas/clinica-vida-plena-austin`,{method:'POST',body:{},s:adm});
  const padaria=await cliente('Padaria Pão Dourado','Carlos Lima','5521900000002','padaria-pao-dourado');
  const studio=await cliente('Studio Bella','','','studio-bella');
  A.auto=await assinatura(auto,'auto-pecas-iguacu','plano-premium',9900,'mensal','2026-10-02');
  A.centro=await assinatura(vida,'clinica-vida-plena-centro','plano-premium',9900,'mensal','2026-10-15');
  A.padaria=await assinatura(padaria,'padaria-pao-dourado','plano-avancado',18000,'trimestral','2026-10-24');
  A.austin=await assinatura(vida,'clinica-vida-plena-austin','plano-avancado',6700,'mensal','2026-11-15');
  A.studio=await assinatura(studio,'studio-bella','plano-avancado',60000,'anual','2027-03-01');
  A.pausa=await assinatura(vida,null,'plano-avancado',6700,'mensal','2026-10-01');
  await t.req(`/api/assinaturas/${A.pausa}/suspender`,{method:'POST',body:{version:1},s:adm});
  t.vida=vida;
});
after(async()=>{await t?.fim();});
const versao=async id=>(await t.req(`/api/assinaturas/${id}`,{s:adm})).json.version;
const fila=async id=>(await t.db.query('SELECT plano,motivo FROM plan_sync WHERE subscription_id=$1 ORDER BY seq',[id])).rows.map(f=>[f.plano,f.motivo]);
const confirmar=s=>t.req('/api/auth/confirmar',{method:'POST',body:{senha:SENHA},s});

test('mensagem: valor em pt-BR com milhares, datas, prazo e variáveis desconhecidas mantidas',()=>{
  for(const [c,v] of [[9900,'R$ 99,00'],[125000,'R$ 1.250,00'],[0,'R$ 0,00'],[100000000,'R$ 1.000.000,00'],[5,'R$ 0,05']])assert.equal(reais(c),v);
  assert.equal(dataBR('2026-10-02'),'02/10/2026');
  assert.deepEqual([prazo('2026-10-24',4),prazo('2026-10-20',0),prazo('2026-10-15',-5)],['vence em 24/10/2026','vence hoje','venceu em 15/10/2026']);
  assert.equal(preencher('Oi {responsavel}, {nada} e {valor}!',{responsavel:'Rita',valor:'R$ 1,00'}),'Oi Rita, {nada} e R$ 1,00!');
  assert.deepEqual(desconhecidas('{plano} {Plano} {x} {x} { y }'),['Plano','x']);
});

test('renovações: janelas, ordem, contagem e o link do WhatsApp igual ao exemplo do contrato',async()=>{
  await t.db.query("UPDATE settings SET chave_pix='pix@exemplo.test'");
  const r=(await t.req('/api/renovacoes',{s:fin})).json;
  assert.equal(r.janela,'vencidas');assert.deepEqual(r.contagem,{vencidas:2,ate7:1,ate15:1,ate30:2,lembrar:2});
  assert.deepEqual(r.itens.map(i=>[i.id,i.situacao,i.dias]),[[A.auto,'inadimplente',-18],[A.centro,'vencida',-5]]);
  const contrato=await readFile(new URL('../../docs/CONTRATO.md',import.meta.url),'utf8');
  const esperado=/"linkWhatsapp": "(https:\/\/wa\.me\/5521900000003\?text=[^"]+)"/.exec(contrato)[1];
  assert.equal(r.itens[0].linkWhatsapp,esperado,'mesmo texto e mesma codificação do exemplo de 6.5');
  assert.deepEqual((await t.req('/api/renovacoes?janela=30',{s:fin})).json.itens.map(i=>i.id),[A.padaria,A.austin]);
  assert.deepEqual((await t.req('/api/renovacoes?janela=7',{s:fin})).json.itens.map(i=>i.id),[A.padaria]);
  assert.equal((await t.req('/api/renovacoes?janela=99',{s:fin})).json.janela,'vencidas');
  assert.ok((await t.req('/api/renovacoes',{s:leitura})).json.itens.every(i=>i.linkWhatsapp===null),'sem cobrar, sem link');
  const r2=(await t.req('/api/renovacoes?janela=30',{s:adm})).json.itens.find(i=>i.id===A.padaria);
  assert.match(decodeURIComponent(r2.linkWhatsapp),/Padaria Pão Dourado vence em 24\/10\/2026, no valor de R\$ 180,00/);
});

test('resumo: MRR sem as inadimplentes, a renovar em 30 dias, inadimplentes e cobrar hoje',async()=>{
  const r=(await t.req('/api/resumo',{s:leitura})).json;
  // Centro 99 + Padaria 180/3 + Austin 67 + Studio 600/12 = R$ 276,00; a Auto Peças está inadimplente.
  assert.deepEqual({...r,cobrarHoje:r.cobrarHoje.map(i=>i.id)},{hoje:'2026-10-20',mrr:27600,recebidoMes:0,aRenovar30:{qtd:2,valor:24700},inadimplentes:{qtd:1,valor:9900},
    ativas:5,lembrarHoje:2,cobrarHoje:[A.auto,A.centro,A.padaria],cobrarHojeTotal:3,etapas:ETAPAS});
});

test('cobrar no WhatsApp: cobrança ou lembrete, só ativa e com WhatsApp; vira o último contato',async()=>{
  let r=await t.req(`/api/assinaturas/${A.centro}/contatos`,{method:'POST',body:{},s:fin});
  assert.equal(r.status,201);
  assert.deepEqual({...r.json,id:undefined},{id:undefined,assinaturaId:A.centro,empresaId:null,canal:'whatsapp',tipo:'cobranca',etapa:null,venceEm:'2026-10-15',mes:null,em:t.agora.toISOString(),por:{id:fin.id,nome:'Ana'}});
  assert.equal((await t.req(`/api/assinaturas/${A.padaria}/contatos`,{method:'POST',body:{},s:fin})).json.tipo,'lembrete');
  assert.deepEqual((await t.req(`/api/assinaturas/${A.studio}/contatos`,{method:'POST',body:{},s:fin})).json,{erro:'O cliente não tem WhatsApp.',campo:'whatsapp'});
  assert.equal((await t.req(`/api/assinaturas/${A.pausa}/contatos`,{method:'POST',body:{},s:fin})).json.erro,'Só a assinatura ativa pode ser cobrada.');
  const item=(await t.req('/api/renovacoes',{s:fin})).json.itens.find(i=>i.id===A.centro);
  assert.deepEqual(item.ultimoContato,{em:t.agora.toISOString(),por:{id:fin.id,nome:'Ana'},tipo:'cobranca',etapa:null});
  assert.equal((await t.auditoria('cobranca_registrada',A.centro)).length,1);
});

test('pagamento: avança um ciclo a partir do vencimento, uma vez só por versão, e o plano volta ao site',async()=>{
  const pagar=(id,body)=>t.req(`/api/assinaturas/${id}/pagamentos`,{method:'POST',body,s:fin});
  const v=await versao(A.centro),base={valorCentavos:9900,pagoEm:'2026-10-20',forma:'pix',version:v};
  for(const [body,campo] of [[{...base,valorCentavos:0},'valorCentavos'],[{...base,pagoEm:'2026-10-21'},'pagoEm'],[{...base,pagoEm:'20/10/2026'},'pagoEm'],
    [{...base,forma:'cheque'},'forma'],[{...base,obs:'x'.repeat(301)},'obs'],[{...base,desconto:1},'desconto']])
    assert.equal((await pagar(A.centro,body)).json.campo,campo,campo);
  const r=await pagar(A.centro,{...base,obs:'Comprovante no WhatsApp'});
  assert.equal(r.status,201);
  assert.deepEqual({...r.json.pagamento,id:undefined},{id:undefined,assinaturaId:A.centro,valorCentavos:9900,pagoEm:'2026-10-20',forma:'pix',referencia:{de:'2026-10-15',ate:'2026-11-14'},
    venceAntes:'2026-10-15',venceDepois:'2026-11-15',obs:'Comprovante no WhatsApp',registradoPor:{id:fin.id,nome:'Ana'},registradoEm:t.agora.toISOString(),estorno:null});
  assert.deepEqual([r.json.assinatura.venceEm,r.json.assinatura.situacao,r.json.assinatura.version],['2026-11-15','a-vencer',v+1]);
  assert.equal((await pagar(A.centro,base)).status,409,'o segundo toque com a mesma versão não paga de novo');
  assert.equal((await t.req('/api/renovacoes?janela=30',{s:fin})).json.itens.find(i=>i.id===A.centro).ultimoContato,null,'o vencimento novo ainda não foi cobrado');
  assert.deepEqual((await fila(A.centro)).at(-1),['plano-premium','pagamento']);
  // A inadimplente volta a ter o plano pago no site.
  assert.deepEqual(await fila(A.auto),[[null,'ativacao']]);
  await pagar(A.auto,{valorCentavos:9900,pagoEm:'2026-09-30',forma:'dinheiro',version:await versao(A.auto)});
  assert.deepEqual((await fila(A.auto)).at(-1),['plano-premium','pagamento']);
  assert.equal((await pagar(A.pausa,{...base,version:await versao(A.pausa)})).json.erro,'Reative a assinatura antes de registrar o pagamento.');
  assert.equal((await t.req('/api/resumo',{s:fin})).json.recebidoMes,9900,'o de 30/09 não entra no mês');
  assert.deepEqual((await t.auditoria('pagamento_registrado',A.centro))[0].before,{venceEm:'2026-10-15'});
});

test('fim do mês: o dia 31 volta depois de um mês curto',async()=>{
  const cli=(await t.req('/api/clientes',{method:'POST',body:{nome:'Fim de Mês'},s:adm})).json.id;
  const id=(await t.req('/api/assinaturas',{method:'POST',s:adm,body:{cliente:cli,plano:'plano-avancado',valorCentavos:100,ciclo:'mensal',inicio:'2026-10-01',venceEm:'2026-10-31'}})).json.id;
  const vences=[];
  for(let i=0;i<3;i++)vences.push((await t.req(`/api/assinaturas/${id}/pagamentos`,{method:'POST',body:{valorCentavos:100,pagoEm:'2026-10-20',forma:'pix',version:await versao(id)},s:fin})).json.assinatura.venceEm);
  assert.deepEqual(vences,['2026-11-30','2026-12-31','2027-01-31']);
});

test('estorno: com reautenticação; recua o vencimento, uma vez só, e aparece na linha do tempo',async()=>{
  const pg=(await t.db.query("SELECT id FROM payments WHERE subscription_id=$1",[A.centro])).rows[0].id;
  t.minutos(6);fin=await t.sessao('ana-2@exemplo.test',{papel:'financeiro',nome:'Ana'});t.minutos(6);
  let r=await t.req(`/api/pagamentos/${pg}/estornar`,{method:'POST',body:{motivo:'Pix duplicado'},s:fin});
  assert.deepEqual([r.status,r.json.reautenticar],[403,true]);
  await confirmar(fin);
  assert.equal((await t.req(`/api/pagamentos/${pg}/estornar`,{method:'POST',body:{motivo:'x'},s:fin})).json.campo,'motivo');
  r=await t.req(`/api/pagamentos/${pg}/estornar`,{method:'POST',body:{motivo:'Pix duplicado'},s:fin});
  assert.equal(r.status,200);
  assert.deepEqual(r.json.pagamento.estorno,{em:t.agora.toISOString(),por:{id:fin.id,nome:'Ana'},motivo:'Pix duplicado'});
  assert.deepEqual([r.json.assinatura.venceEm,r.json.assinatura.situacao],['2026-10-15','vencida']);
  assert.equal((await t.req('/api/renovacoes',{s:fin})).json.itens.find(i=>i.id===A.centro).ultimoContato?.tipo,'cobranca','o estorno traz de volta o contato do vencimento que voltou');
  assert.equal((await t.req(`/api/pagamentos/${pg}/estornar`,{method:'POST',body:{motivo:'Pix duplicado'},s:fin})).json.erro,'Este pagamento já foi estornado.');
  assert.equal((await t.req('/api/pagamentos/00000000-0000-4000-8000-000000000000/estornar',{method:'POST',body:{motivo:'Pix duplicado'},s:fin})).status,404);
  assert.deepEqual((await fila(A.centro)).at(-1),['plano-premium','estorno'],'vencida ainda está na tolerância');
  assert.equal((await t.req('/api/resumo',{s:fin})).json.recebidoMes,300,'o estornado sai do recebido; ficam os 3 de R$ 1,00 do teste do fim do mês');
  const tempo=(await t.req(`/api/clientes/${t.vida}`,{s:fin})).json.linhaDoTempo;
  assert.deepEqual(tempo.map(i=>i.tipo),['estorno','pagamento','contato']);
  assert.deepEqual(tempo[0].assinatura,{id:A.centro,empresa:'Clínica Vida Plena · Centro',plano:'Premium'});
  assert.equal(tempo[2].contato.tipo,'cobranca');
  assert.deepEqual((await t.auditoria('pagamento_estornado',A.centro))[0].after,{venceEm:'2026-10-15',pagamento:pg,motivo:'Pix duplicado'});
});

test('configurações: tolerância sem reautenticação, chave Pix com ela; o modelo só com as variáveis da lista',async()=>{
  let c=(await t.req('/api/configuracoes',{s:adm})).json;
  assert.deepEqual([c.chavePix,c.toleranciaDias,c.atualizadoPor,c.variaveis.length,c.version],['pix@exemplo.test',10,null,9,1]);
  adm=await t.sessao('admin-2@exemplo.test',{nome:'Lucas'});t.minutos(6);
  for(const [body,campo] of [[{toleranciaDias:61},'toleranciaDias'],[{toleranciaDias:1.5},'toleranciaDias'],[{modeloMensagem:'curto'},'modeloMensagem'],[{modeloMensagem:'Olá {responsavel}, pague o {boleto} hoje.'},'modeloMensagem']])
    assert.equal((await t.req('/api/configuracoes',{method:'PATCH',body:{...body,version:1},s:adm})).json.campo,campo,JSON.stringify(body));
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',body:{modeloMensagem:'Olá {responsavel}, pague o {boleto} hoje.',version:1},s:adm})).json.erro,'Variável desconhecida: {boleto}.');
  c=(await t.req('/api/configuracoes',{method:'PATCH',body:{toleranciaDias:30,version:1},s:adm})).json;
  assert.deepEqual([c.toleranciaDias,c.version,c.atualizadoPor.nome],[30,2,'Lucas']);
  assert.equal((await t.req(`/api/assinaturas/${A.auto}`,{s:adm})).json.situacao!=='inadimplente',true,'a tolerância maior muda a situação na hora');
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',body:{chavePix:'outra@exemplo.test',version:2},s:adm})).json.reautenticar,true);
  await confirmar(adm);
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',body:{chavePix:'linha\nquebrada',version:2},s:adm})).json.campo,'chavePix');
  c=(await t.req('/api/configuracoes',{method:'PATCH',body:{chavePix:'  outra@exemplo.test ',version:2},s:adm})).json;
  assert.deepEqual([c.chavePix,c.version],['outra@exemplo.test',3]);
  assert.equal((await t.req('/api/configuracoes',{method:'PATCH',body:{toleranciaDias:30,version:3},s:adm})).json.version,3,'sem mudança, sem versão nova');
  assert.deepEqual((await t.auditoria('configuracoes_editadas','1')).map(a=>a.after),[{chavePix:'outra@exemplo.test'},{toleranciaDias:30}]);
});

test('páginas: resumo para todos, renovações com a janela, pagamento e configurações com a ação certa',async()=>{
  const r=await t.pagina('/',{s:leitura});assert.deepEqual([r.view,r.title,r.vm.filtros],['resumo','Resumo | Gestão Nexus',{}]);
  assert.deepEqual((await t.pagina('/renovacoes?janela=15&page=1',{s:leitura})).vm.filtros,{janela:'15',page:'1'});
  const p=await t.pagina(`/assinaturas/${A.padaria}/pagamento`,{s:fin});
  assert.equal(p.title,'Registrar pagamento · Padaria Pão Dourado | Gestão Nexus');
  assert.deepEqual(p.vm.dados.sugestao,{valorCentavos:18000,pagoEm:'2026-10-20',forma:'pix',venceDepois:'2027-01-24'});
  assert.deepEqual(p.vm.dados.formas,['pix','dinheiro','cartao','boleto','transferencia','mercado-pago']);
  const s=await t.pagina(`/assinaturas/${A.pausa}/pagamento`,{s:fin});assert.deepEqual([s.status,s.view],[422,'erro']);
  assert.equal((await t.pagina(`/assinaturas/${A.padaria}/pagamento`,{s:await t.sessao('bruno@exemplo.test',{papel:'comercial'})})).status,403);
  assert.equal((await t.pagina('/configuracoes',{s:fin})).status,403);
  assert.equal((await t.pagina('/configuracoes',{s:adm})).vm.dados.chavePix,'outra@exemplo.test');
});
