import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ETAPAS, etapaDe } from '../../api/lib/regua.mjs';
import { ambiente, SENHA } from './ambiente.mjs';

// Régua de lembretes (contrato 15). Hoje é 20/10/2026 em São Paulo. Cada teste monta o próprio ambiente, porque alguns
// andam com o relógio.
const DIA=24*60;
async function montar() {
  const t=await ambiente(),adm=await t.sessao('admin@exemplo.test',{nome:'Lucas'}),fin=await t.sessao('ana@exemplo.test',{papel:'financeiro',nome:'Ana'});
  const leitura=await t.sessao('julia@exemplo.test',{papel:'leitura'});
  await t.db.query("UPDATE settings SET chave_pix='pix@exemplo.test'");
  const cliente=async(nome,responsavel,whatsapp,empresa)=>{
    const id=(await t.req('/api/clientes',{method:'POST',body:{nome,responsavel,whatsapp},s:adm})).json.id;
    if(empresa)await t.req(`/api/clientes/${id}/empresas/${empresa}`,{method:'POST',body:{},s:adm});
    return id;
  };
  const assinatura=async(cli,empresa,valorCentavos,ciclo,venceEm)=>(await t.req('/api/assinaturas',{method:'POST',s:adm,
    body:{cliente:cli,empresa,plano:'plano-avancado',valorCentavos,ciclo,inicio:'2025-03-15',venceEm}})).json.id;
  const A={},C={};
  C.padaria=await cliente('Padaria Pão Dourado','Carlos Lima','5521900000002','padaria-pao-dourado');
  C.vida=await cliente('Clínica Vida Plena','Marina Souza','5521900000001','clinica-vida-plena-austin');
  await t.req(`/api/clientes/${C.vida}/empresas/clinica-vida-plena-centro`,{method:'POST',body:{},s:adm});
  C.auto=await cliente('Auto Peças Iguaçu','Rita Alves','5521900000003','auto-pecas-iguacu');
  C.studio=await cliente('Studio Bella','','','studio-bella');
  C.bar=await cliente('Bar do Zé','Zé','5521900000004',null);
  A.padaria=await assinatura(C.padaria,'padaria-pao-dourado',18000,'trimestral','2026-10-25');
  A.austin=await assinatura(C.vida,'clinica-vida-plena-austin',6700,'mensal','2026-11-15');
  A.centro=await assinatura(C.vida,'clinica-vida-plena-centro',9900,'mensal','2026-11-30');
  A.auto=await assinatura(C.auto,'auto-pecas-iguacu',9900,'mensal','2026-10-15');
  A.studio=await assinatura(C.studio,'studio-bella',60000,'anual','2026-10-20');
  A.bar=await assinatura(C.bar,null,5000,'mensal','2026-10-21');
  A.pausa=await assinatura(C.bar,null,5000,'mensal','2026-10-22');
  await t.req(`/api/assinaturas/${A.pausa}/suspender`,{method:'POST',body:{version:1},s:adm});
  const lembrar=async(s=fin)=>(await t.req('/api/renovacoes?janela=lembrar',{s})).json;
  const versao=async id=>(await t.req(`/api/assinaturas/${id}`,{s:adm})).json.version;
  // Os dias passam com as sessões renovadas, como se a pessoa tivesse acabado de entrar.
  const passar=async n=>{t.minutos(n*DIA);await t.db.query("UPDATE sessions SET last_seen_at=$1,expires_at=$1::timestamptz+interval '8 hours'",[t.agora.toISOString()]);};
  const lembrete=id=>t.req(`/api/assinaturas/${id}/contatos`,{method:'POST',body:{},s:fin});
  return {t,adm,fin,leitura,A,C,lembrar,versao,lembrete,passar};
}

test('etapas: a mais próxima do vencimento entre as que já começaram, de 30 dias até o dia',()=>{
  assert.deepEqual(ETAPAS.map(e=>e.dias),[30,15,7,1,0]);
  const casos=[[31,null],[30,30],[20,30],[16,30],[15,15],[8,15],[7,7],[5,7],[2,7],[1,1],[0,0],[-1,null],[-30,null]];
  for(const [d,e] of casos)assert.equal(etapaDe(d),e,`${d} dias`);
});

test('"Lembrar hoje": as ativas numa etapa, sem acumular as puladas, na ordem do vencimento, com a contagem e o Resumo',async()=>{
  const {t,adm,leitura,A,lembrar}=await montar();
  try {
    const r=await lembrar();
    assert.equal(r.janela,'lembrar');
    assert.deepEqual(r.etapas,ETAPAS);
    assert.deepEqual(r.itens.map(i=>[i.id,i.dias,i.etapa]),[[A.studio,0,0],[A.bar,1,1],[A.padaria,5,7],[A.austin,26,30]],
      'a 41 dias, vencida e suspensa ficam de fora; a padaria pulou a de 30 e a de 15 e aparece só na de 7');
    assert.deepEqual(r.contagem,{vencidas:1,ate7:3,ate15:3,ate30:4,lembrar:4});
    assert.equal(r.itens[0].linkWhatsapp,null,'sem WhatsApp, entra sem link');
    assert.equal(r.itens[1].empresa,null);
    assert.match(decodeURIComponent(r.itens[2].linkWhatsapp),/Padaria Pão Dourado vence em 25\/10\/2026, no valor de R\$ 180,00/,'sem modelo próprio, o de cobrança');
    assert.ok((await lembrar(leitura)).itens.every(i=>i.linkWhatsapp===null),'sem cobrar, sem link');
    const resumo=(await t.req('/api/resumo',{s:adm})).json;
    assert.equal(resumo.lembrarHoje,4);
    assert.deepEqual(resumo.etapas,ETAPAS);
    assert.deepEqual(resumo.cobrarHoje.map(i=>[i.id,i.etapa]),[[A.auto,null],[A.studio,0],[A.bar,1],[A.padaria,7]]);
    const v=(await t.req('/api/renovacoes',{s:adm})).json;
    assert.deepEqual([v.janela,v.itens.map(i=>i.etapa)],['vencidas',[null]]);
    assert.deepEqual((await t.req('/api/renovacoes?janela=30',{s:adm})).json.itens.map(i=>i.etapa),[0,1,7,30]);
    const pagina=await t.pagina('/renovacoes?janela=lembrar',{s:adm});
    assert.deepEqual([pagina.vm.tela,pagina.vm.filtros,pagina.vm.dados.total],['renovacoes',{janela:'lembrar',page:'1'},4]);
  } finally {await t.fim();}
});

test('o registro guarda a etapa, a etapa registrada sai da lista e a próxima etapa volta com o último contato',async()=>{
  const {t,adm,C,A,lembrar,lembrete,passar}=await montar();
  try {
    let r=await lembrete(A.padaria);
    assert.equal(r.status,201);
    assert.deepEqual([r.json.tipo,r.json.etapa,r.json.venceEm],['lembrete',7,'2026-10-25']);
    assert.deepEqual((await t.auditoria('cobranca_registrada',A.padaria))[0].after,{tipo:'lembrete',venceEm:'2026-10-25',etapa:7});
    assert.deepEqual((await lembrar()).itens.map(i=>i.id),[A.studio,A.bar,A.austin]);
    assert.equal((await t.req('/api/resumo',{s:adm})).json.lembrarHoje,3);
    assert.equal((await lembrete(A.padaria)).status,201,'registrar de novo continua permitido');
    assert.equal((await lembrar()).contagem.lembrar,3);
    // A cobrança da vencida e o lembrete fora da régua ficam sem etapa.
    r=await lembrete(A.auto);
    assert.deepEqual([r.json.tipo,r.json.etapa],['cobranca',null]);
    assert.deepEqual((await t.auditoria('cobranca_registrada',A.auto))[0].after,{tipo:'cobranca',venceEm:'2026-10-15'});
    assert.deepEqual([(await lembrete(A.centro)).json.tipo,(await lembrete(A.centro)).json.etapa],['lembrete',null]);
    // A ficha mostra a etapa na linha do tempo.
    const ficha=(await t.req(`/api/clientes/${C.padaria}`,{s:adm})).json;
    assert.deepEqual(ficha.linhaDoTempo.filter(i=>i.tipo==='contato').map(i=>i.contato.etapa),[7,7]);
    assert.deepEqual(ficha.etapas,ETAPAS);
    // Quatro dias depois, a padaria está a 1 dia: a etapa de 1 é nova, e o último contato é o lembrete de 7.
    await passar(4);
    const item=(await lembrar()).itens.find(i=>i.id===A.padaria);
    assert.deepEqual([item.dias,item.etapa,item.ultimoContato.tipo,item.ultimoContato.etapa],[1,1,'lembrete',7]);
    // No dia do vencimento, a etapa do dia.
    await lembrete(A.padaria);await passar(1);
    assert.deepEqual((await lembrar()).itens.filter(i=>i.id===A.padaria).map(i=>i.etapa),[0]);
    // Depois de vencida, sai da régua e vai para a cobrança.
    await passar(1);
    assert.equal((await lembrar()).itens.some(i=>i.id===A.padaria),false);
    assert.equal((await t.req('/api/renovacoes?janela=vencidas',{s:adm})).json.itens.find(i=>i.id===A.padaria).etapa,null);
  } finally {await t.fim();}
});

test('pagar ou mudar o vencimento recomeça a régua; o estorno traz de volta os lembretes do vencimento anterior',async()=>{
  const {t,adm,fin,A,lembrar,versao,lembrete,passar}=await montar();
  try {
    await lembrete(A.padaria);
    assert.equal((await lembrar()).itens.some(i=>i.id===A.padaria),false);
    // Mudar o vencimento: o lembrete do vencimento antigo não conta.
    await t.req(`/api/assinaturas/${A.padaria}`,{method:'PATCH',body:{venceEm:'2026-10-23',version:await versao(A.padaria)},s:adm});
    let item=(await lembrar()).itens.find(i=>i.id===A.padaria);
    assert.deepEqual([item.venceEm,item.etapa,item.ultimoContato],['2026-10-23',7,null]);
    await lembrete(A.padaria);
    // Pagar avança o vencimento para fora da régua; o estorno volta ao vencimento lembrado, que continua fora da lista.
    const pg=(await t.req(`/api/assinaturas/${A.padaria}/pagamentos`,{method:'POST',body:{valorCentavos:18000,pagoEm:'2026-10-20',forma:'pix',version:await versao(A.padaria)},s:fin})).json.pagamento.id;
    assert.equal((await lembrar()).itens.some(i=>i.id===A.padaria),false);
    await t.req('/api/auth/confirmar',{method:'POST',body:{senha:SENHA},s:fin});
    assert.equal((await t.req(`/api/pagamentos/${pg}/estornar`,{method:'POST',body:{motivo:'Pix duplicado'},s:fin})).json.assinatura.venceEm,'2026-10-23');
    assert.equal((await lembrar()).itens.some(i=>i.id===A.padaria),false,'o lembrete do vencimento de volta continua valendo');
    // O mensal pago entra de novo na régua quando o vencimento novo chega a 30 dias.
    await lembrete(A.austin);
    await t.req(`/api/assinaturas/${A.austin}/pagamentos`,{method:'POST',body:{valorCentavos:6700,pagoEm:'2026-10-20',forma:'pix',version:await versao(A.austin)},s:fin});
    assert.equal((await lembrar()).itens.some(i=>i.id===A.austin),false,'a 56 dias, fora da régua');
    await passar(30);
    item=(await lembrar()).itens.find(i=>i.id===A.austin);
    assert.deepEqual([item.venceEm,item.dias,item.etapa,item.ultimoContato],['2026-12-15',26,30,null]);
  } finally {await t.fim();}
});

test('modelos por etapa: opcionais, com as variáveis da cobrança, e a etapa sem modelo usa o de cobrança',async()=>{
  const {t,adm,A,lembrar}=await montar();
  try {
    let c=(await t.req('/api/configuracoes',{s:adm})).json;
    assert.deepEqual(c.etapas,ETAPAS);
    assert.deepEqual(c.modelosLembrete,{0:'',1:'',7:'',15:'',30:''},'padrão: nenhuma etapa com modelo próprio');
    const patch=body=>t.req('/api/configuracoes',{method:'PATCH',body:{...body,version:c.version},s:adm});
    const sete='Oi, {responsavel}! Lembrete: a assinatura {prazo}, no valor de {valor}. {desempenho} Chave Pix: {chave_pix}.';
    let r=await patch({modelosLembrete:{7:sete}});
    assert.equal(r.status,200);c=r.json;
    assert.deepEqual(c.modelosLembrete,{0:'',1:'',7:sete,15:'',30:''});
    assert.deepEqual((await t.auditoria('configuracoes_editadas'))[0].after,{modelosLembrete:{0:'',1:'',7:sete,15:'',30:''}});
    assert.deepEqual((await t.db.query('SELECT modelos_lembrete FROM settings')).rows[0].modelos_lembrete,{7:sete},'o banco guarda só os que existem');
    const itens=(await lembrar()).itens,texto=id=>decodeURIComponent(itens.find(i=>i.id===id).linkWhatsapp.split('?text=')[1]);
    assert.equal(texto(A.padaria),'Oi, Carlos Lima! Lembrete: a assinatura vence em 25/10/2026, no valor de R$ 180,00. Chave Pix: pix@exemplo.test.',
      'o {desempenho} vazio sai com o espaço');
    assert.match(texto(A.austin),/^Olá, Marina Souza! Aqui é do Nexus\./,'a etapa de 30 sem modelo usa o de cobrança');
    assert.match(decodeURIComponent((await t.req('/api/renovacoes',{s:adm})).json.itens[0].linkWhatsapp),/Auto Peças Iguaçu venceu em 15\/10\/2026/,'a vencida continua com o de cobrança');
    assert.match(decodeURIComponent((await t.req('/api/resumo',{s:adm})).json.cobrarHoje.find(i=>i.id===A.padaria).linkWhatsapp),/Lembrete: a assinatura vence em 25\/10\/2026/);
    // O mesmo texto não cria versão nova; vazio tira o modelo próprio.
    assert.equal((await patch({modelosLembrete:{7:sete}})).json.version,c.version);
    r=await patch({modelosLembrete:{7:''}});c=r.json;
    assert.deepEqual(c.modelosLembrete[7],'');
    assert.match(decodeURIComponent((await lembrar()).itens.find(i=>i.id===A.padaria).linkWhatsapp),/^.*Olá, Carlos Lima! Aqui é do Nexus\./);
    // Validação (7.2).
    const erro=async(m)=>{const x=await patch({modelosLembrete:m});assert.equal(x.status,422,JSON.stringify(m));return x.json;};
    assert.deepEqual(await erro({8:sete}),{erro:'Etapa desconhecida: 8.',campo:'modelosLembrete'});
    assert.deepEqual(await erro({1:'Curto {prazo}'}),{erro:'Use de 20 a 1.000 caracteres.',campo:'modelosLembrete.1'});
    assert.deepEqual(await erro({0:'x'.repeat(1001)}),{erro:'Use de 20 a 1.000 caracteres.',campo:'modelosLembrete.0'});
    assert.deepEqual(await erro({15:'Olá, {responsavel}, veja o {link} agora.'}),{erro:'Variável desconhecida: {link}.',campo:'modelosLembrete.15'});
    assert.deepEqual(await erro({30:5}),{erro:'Use de 20 a 1.000 caracteres.',campo:'modelosLembrete.30'});
    assert.equal((await erro('texto')).campo,'modelosLembrete');
    assert.equal((await erro([sete])).campo,'modelosLembrete');
  } finally {await t.fim();}
});

test('a migração 009 dá a etapa aos lembretes de antes da régua, pelo dia em São Paulo',async()=>{
  const {t,A}=await montar();
  try {
    const sql=await readFile(new URL('../../db/migrations/009_regua_lembretes.sql',import.meta.url),'utf8');
    const update=/UPDATE contacts[\s\S]*?;/.exec(sql)[0];
    const casos=[
      // [tipo, feito em, vencimento lembrado, etapa esperada]
      ['lembrete','2026-10-20T02:30:00Z','2026-10-24',7],
      ['lembrete','2026-10-20T12:00:00Z','2026-10-20',0],
      ['lembrete','2026-10-20T12:00:00Z','2026-10-21',1],
      ['lembrete','2026-10-20T12:00:00Z','2026-10-30',15],
      ['lembrete','2026-10-20T12:00:00Z','2026-11-05',30],
      ['lembrete','2026-10-20T12:00:00Z','2026-11-30',null],
      ['cobranca','2026-10-20T12:00:00Z','2026-10-15',null]
    ];
    for(const [i,[tipo,em,vence]] of casos.entries())
      await t.db.query('INSERT INTO contacts(id,subscription_id,tipo,vence_em,feito_em) VALUES($1,$2,$3,$4,$5)',[`k${i}`,A.padaria,tipo,vence,em]);
    await t.db.exec(update);
    const etapas=(await t.db.query("SELECT id,etapa FROM contacts WHERE id LIKE 'k%' ORDER BY id")).rows.map(k=>k.etapa);
    assert.deepEqual(etapas,casos.map(c=>c[3]));
    await assert.rejects(t.db.query("INSERT INTO contacts(id,subscription_id,tipo,vence_em,etapa) VALUES('x',$1,'cobranca','2026-10-15',7)",[A.padaria]),'só o lembrete tem etapa');
    await assert.rejects(t.db.query("INSERT INTO contacts(id,subscription_id,tipo,vence_em,etapa) VALUES('y',$1,'lembrete','2026-10-25',5)",[A.padaria]),'só as etapas da régua');
  } finally {await t.fim();}
});
