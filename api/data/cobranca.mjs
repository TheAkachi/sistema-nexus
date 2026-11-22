import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit } from '../lib/auditoria.mjs';
import { dias, diaValido, somarMeses, MESES } from '../lib/datas.mjs';
import { preencher, valoresDe, linkWhatsapp } from '../lib/mensagem.mjs';
import { rejectExtra, needVersion, conflito, iso, lista, filtro, collator } from './comum.mjs';
import { SELECT, linha, assinaturaVM, situacaoDe, empresaVM } from './assinaturas.mjs';
import { enfileirar, planoEsperado } from './fila.mjs';
import { frasesDoMesAnterior } from './desempenho.mjs';
import { ETAPAS, etapaDe, modeloDaEtapa } from '../lib/regua.mjs';

// Cobrança (contrato 6.4, 6.5, 6.7, 6.10, 7.3 a 7.5): renovações com o WhatsApp, resumo, contatos, pagamentos e estornos.
// v0.14.0: a régua de lembretes (15), com a etapa de cada assinatura a vencer e a lista "Lembrar hoje".
// cx é o contexto das assinaturas (hoje, tolerância, chave Pix, modelo e origem do site).
export const FORMAS=['pix','dinheiro','cartao','boleto','transferencia','mercado-pago'];

// Renovacao (6.5): a assinatura com o cliente, o último contato do vencimento atual e o link do WhatsApp (só para quem pode cobrar).
// A que está numa etapa da régua usa o modelo da etapa (15.4).
// frases traz a frase do {desempenho} de cada empresa (7.3), lida só quando o modelo usa a variável.
export function renovacaoVM(s,cx,{podeCobrar,frases=null}) {
  const d=dias(cx.hoje,s.vence_em),etapa=s.status==='ativa'?etapaDe(d):null;
  return {id:s.id,cliente:{id:s.client_id,nome:s.cliente_nome,responsavel:s.cliente_responsavel,whatsapp:s.cliente_whatsapp},
    empresa:empresaVM(s.business_id,{nome:s.nome_cache,slug:s.slug_cache,foto:s.foto_cache},cx.siteOrigin),plano:s.plano_site?{id:s.plano_site,nome:s.plano_nome}:null,
    valorCentavos:s.valor_centavos,ciclo:s.ciclo,venceEm:s.vence_em,dias:d,situacao:situacaoDe(s,cx),etapa,
    ultimoContato:s.contato?{em:iso(s.contato.feito_em),por:s.contato.feito_por?{id:s.contato.feito_por,nome:s.contato.nome||''}:null,tipo:s.contato.tipo,etapa:s.contato.etapa??null}:null,
    linkWhatsapp:podeCobrar&&s.cliente_whatsapp?linkWhatsapp(s.cliente_whatsapp,preencher(modeloDaEtapa(cx,etapa),valoresDe(s,{dias:d,chavePix:cx.chavePix,desempenho:frases?.get(s.business_id)}))):null,version:s.version};
}
const usaDesempenho=cx=>[cx.modelo,...Object.values(cx.modelosLembrete||{})].some(m=>m.includes('{desempenho}'));
const frasesPara=(db,linhas,cx,{podeCobrar})=>podeCobrar&&usaDesempenho(cx)?frasesDoMesAnterior(db,linhas.map(s=>s.business_id),cx):null;
const porVencimento=(a,b)=>a.vence_em.localeCompare(b.vence_em)||collator.compare(a.cliente_nome,b.cliente_nome);
// _lembrar (15.2): a assinatura está numa etapa e ainda não recebeu o lembrete dela no vencimento atual. Pagar ou mudar o
// vencimento recomeça a régua, porque só contam os lembretes do vencimento atual.
async function ativas(db,cx) {
  const lembradas=new Set((await db.query(`SELECT k.subscription_id,k.etapa FROM contacts k JOIN subscriptions s ON s.id=k.subscription_id AND k.vence_em=s.vence_em
    WHERE s.status='ativa' AND k.etapa IS NOT NULL`)).rows.map(k=>`${k.subscription_id}:${k.etapa}`));
  return (await db.query(`${SELECT} WHERE s.status='ativa'`)).rows.map(s=>{
    const d=dias(cx.hoje,s.vence_em),etapa=etapaDe(d);
    return {...s,_dias:d,_lembrar:etapa!==null&&!lembradas.has(`${s.id}:${etapa}`)};
  }).sort(porVencimento);
}
const JANELAS={vencidas:s=>s._dias<0,7:s=>s._dias>=0&&s._dias<=7,15:s=>s._dias>=0&&s._dias<=15,30:s=>s._dias>=0&&s._dias<=30,lembrar:s=>s._lembrar};
export async function listarRenovacoes(db,url,cx,{podeCobrar}) {
  const j=filtro(url,'janela'),janela=JANELAS[j]?j:'vencidas',todas=await ativas(db,cx);
  const contagem={vencidas:todas.filter(JANELAS.vencidas).length,ate7:todas.filter(JANELAS[7]).length,ate15:todas.filter(JANELAS[15]).length,ate30:todas.filter(JANELAS[30]).length,
    lembrar:todas.filter(JANELAS.lembrar).length};
  const da=todas.filter(JANELAS[janela]),frases=await frasesPara(db,da,cx,{podeCobrar});
  return {janela,contagem,etapas:ETAPAS,...lista(da.map(s=>renovacaoVM(s,cx,{podeCobrar,frases})),url)};
}

// Resumo (6.4). O MRR soma as ativas que não estão inadimplentes, com o valor de cada uma dividido pelos meses do ciclo.
// v0.14.0: as etapas dão o nome da etapa do último contato no cobrarHoje (15.5).
export async function resumo(db,cx,{podeCobrar}) {
  const todas=await ativas(db,cx),inad=todas.filter(s=>situacaoDe(s,cx)==='inadimplente'),a30=todas.filter(JANELAS[30]);
  const soma=l=>l.reduce((t,s)=>t+s.valor_centavos,0),mes=cx.hoje.slice(0,7);
  const recebido=(await db.query(`SELECT COALESCE(sum(valor_centavos),0)::int AS n FROM payments WHERE estornado_em IS NULL AND pago_em>=$1::date AND pago_em<($1::date+interval '1 month')`,[`${mes}-01`])).rows[0].n;
  const cobrar=todas.filter(s=>s._dias<=7),primeiras=cobrar.slice(0,50),frases=await frasesPara(db,primeiras,cx,{podeCobrar});
  return {hoje:cx.hoje,mrr:Math.round(todas.filter(s=>!inad.includes(s)).reduce((t,s)=>t+s.valor_centavos/MESES[s.ciclo],0)),recebidoMes:recebido,
    aRenovar30:{qtd:a30.length,valor:soma(a30)},inadimplentes:{qtd:inad.length,valor:soma(inad)},ativas:todas.length,lembrarHoje:todas.filter(JANELAS.lembrar).length,
    cobrarHoje:primeiras.map(s=>renovacaoVM(s,cx,{podeCobrar,frases})),cobrarHojeTotal:cobrar.length,etapas:ETAPAS};
}

// Contato (7.4): registra a cobrança aberta no WhatsApp e marca a assinatura como gerida. v0.11.0: o envio do relatório do
// mês também é um Contato, com a empresa e o mês no lugar da assinatura e do vencimento. v0.14.0: o lembrete guarda a etapa
// da régua do dia do registro (15.3), calculada aqui; a cobrança da vencida fica sem etapa.
export const contatoVM=(k,por)=>({id:k.id,assinaturaId:k.subscription_id??null,empresaId:k.business_id??null,canal:k.canal,tipo:k.tipo,etapa:k.etapa??null,venceEm:k.vence_em??null,
  mes:k.mes??null,em:iso(k.feito_em),por});
export async function registrarContato(db,{id,session,ip,now=new Date()},cx) {
  const s=await linha(db,id);
  if(s.status!=='ativa')throw fail('Só a assinatura ativa pode ser cobrada.',422);
  if(!s.cliente_whatsapp)throw fail('O cliente não tem WhatsApp.',422,'whatsapp');
  const d=dias(cx.hoje,s.vence_em),tipo=d<0?'cobranca':'lembrete';
  const k={id:randomUUID(),subscription_id:id,canal:'whatsapp',tipo,etapa:tipo==='lembrete'?etapaDe(d):null,vence_em:s.vence_em,feito_em:now.toISOString()};
  return db.transaction(async tx=>{
    await tx.query('INSERT INTO contacts(id,subscription_id,canal,tipo,etapa,vence_em,feito_em,feito_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[k.id,id,k.canal,k.tipo,k.etapa,k.vence_em,k.feito_em,session.user_id]);
    await tx.query('UPDATE subscriptions SET gerida_em=COALESCE(gerida_em,$2) WHERE id=$1',[id,k.feito_em]);
    await audit(tx,{actor:session.user_id,action:'cobranca_registrada',type:'assinatura',resource:id,after:{tipo:k.tipo,venceEm:k.vence_em,...(k.etapa!==null&&{etapa:k.etapa})},ip});
    return contatoVM(k,{id:session.user_id,nome:session.nome});
  });
}

// Pagamento (5.4 e 7.5). O vencimento avança um ciclo a partir do vencimento anterior, com o dia base.
const PAG=`SELECT p.*,p.pago_em::text AS pago,p.vence_antes::text AS antes,p.vence_depois::text AS depois,p.referencia_de::text AS ref_de,p.referencia_ate::text AS ref_ate,
  r.nome AS registrado_nome,e.nome AS estornado_nome FROM payments p LEFT JOIN users r ON r.id=p.registrado_por LEFT JOIN users e ON e.id=p.estornado_por`;
export const pagamentoVM=p=>({id:p.id,assinaturaId:p.subscription_id,valorCentavos:p.valor_centavos,pagoEm:p.pago,forma:p.forma,referencia:{de:p.ref_de,ate:p.ref_ate},
  venceAntes:p.antes,venceDepois:p.depois,obs:p.obs,registradoPor:p.registrado_por?{id:p.registrado_por,nome:p.registrado_nome||''}:null,registradoEm:iso(p.registrado_em),
  estorno:p.estornado_em?{em:iso(p.estornado_em),por:p.estornado_por?{id:p.estornado_por,nome:p.estornado_nome||''}:null,motivo:p.motivo_estorno}:null});
const pagamento=async(db,id)=>{const p=(await db.query(`${PAG} WHERE p.id=$1`,[id])).rows[0];if(!p)throw fail('Pagamento não encontrado.',404);return p;};
export const proximoVencimento=s=>somarMeses(s.vence_em,MESES[s.ciclo],s.dia_base);

export async function registrarPagamento(db,{id,p,session,ip,now=new Date()},cx) {
  const atual=await linha(db,id);
  rejectExtra(p,['valorCentavos','pagoEm','forma','obs','version']);const version=needVersion(p);
  if(!Number.isSafeInteger(p.valorCentavos)||p.valorCentavos<1||p.valorCentavos>100000000)throw fail('Informe o valor, como 99,00.',422,'valorCentavos');
  if(!diaValido(p.pagoEm))throw fail('Use a data no formato aaaa-mm-dd.',422,'pagoEm');
  if(p.pagoEm>cx.hoje)throw fail('A data do pagamento não pode ser no futuro.',422,'pagoEm');
  if(!FORMAS.includes(p.forma))throw fail('Escolha a forma de pagamento.',422,'forma');
  const obs=p.obs===undefined||p.obs===null?'':typeof p.obs==='string'?p.obs.trim().replace(/\s+/g,' '):null;
  if(obs===null||obs.length>300)throw fail('Use até 300 caracteres.',422,'obs');
  if(atual.status!=='ativa')throw fail('Reative a assinatura antes de registrar o pagamento.',422,'status');
  return db.transaction(async tx=>{
    const s=await linha(tx,id,{lock:true});if(s.version!==version)throw conflito();
    if(s.status!=='ativa')throw fail('Reative a assinatura antes de registrar o pagamento.',422,'status');
    const meses=MESES[s.ciclo],depois=proximoVencimento(s),pid=randomUUID();
    await tx.query(`INSERT INTO payments(id,subscription_id,valor_centavos,pago_em,forma,meses,vence_antes,vence_depois,referencia_de,referencia_ate,obs,registrado_por,registrado_em)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7,($8::date-1),$9,$10,$11)`,[pid,id,p.valorCentavos,p.pagoEm,p.forma,meses,s.vence_em,depois,obs,session.user_id,now.toISOString()]);
    await tx.query('UPDATE subscriptions SET vence_em=$2,gerida_em=COALESCE(gerida_em,$3),atualizado_em=$3,version=version+1 WHERE id=$1',[id,depois,now.toISOString()]);
    const n=await linha(tx,id);
    await enfileirar(tx,{businessId:n.business_id,plano:planoEsperado(n,cx.hoje,cx.tolerancia),assinatura:id,motivo:'pagamento',now});
    await audit(tx,{actor:session.user_id,action:'pagamento_registrado',type:'assinatura',resource:id,before:{venceEm:s.vence_em},
      after:{venceEm:depois,valorCentavos:p.valorCentavos,forma:p.forma,pagoEm:p.pagoEm,pagamento:pid},ip});
    return {pagamento:pagamentoVM(await pagamento(tx,pid)),assinatura:assinaturaVM(n,cx)};
  });
}

// Estorno (7.5): não apaga; marca o pagamento e recua o vencimento pelos meses dele, sem passar do início.
export async function estornar(db,{id,p,session,ip,now=new Date()},cx) {
  const pg=await pagamento(db,id);
  rejectExtra(p,['motivo']);
  const motivo=typeof p.motivo==='string'?p.motivo.trim().replace(/\s+/g,' '):'';
  if(motivo.length<3||motivo.length>300)throw fail('Conte o motivo em poucas palavras.',422,'motivo');
  if(pg.estornado_em)throw fail('Este pagamento já foi estornado.',422);
  return db.transaction(async tx=>{
    const s=await linha(tx,pg.subscription_id,{lock:true});
    const r=await tx.query('UPDATE payments SET estornado_em=$2,estornado_por=$3,motivo_estorno=$4 WHERE id=$1 AND estornado_em IS NULL RETURNING id',[id,now.toISOString(),session.user_id,motivo]);
    if(!r.rows.length)throw fail('Este pagamento já foi estornado.',422);
    const recuado=somarMeses(s.vence_em,-pg.meses,s.dia_base),vence=recuado<s.inicio?s.inicio:recuado;
    await tx.query('UPDATE subscriptions SET vence_em=$2,gerida_em=COALESCE(gerida_em,$3),atualizado_em=$3,version=version+1 WHERE id=$1',[s.id,vence,now.toISOString()]);
    const n=await linha(tx,s.id);
    await enfileirar(tx,{businessId:n.business_id,plano:planoEsperado(n,cx.hoje,cx.tolerancia),assinatura:s.id,motivo:'estorno',now});
    await audit(tx,{actor:session.user_id,action:'pagamento_estornado',type:'assinatura',resource:s.id,before:{venceEm:s.vence_em},after:{venceEm:vence,pagamento:id,motivo},ip});
    return {pagamento:pagamentoVM(await pagamento(tx,id)),assinatura:assinaturaVM(n,cx)};
  });
}

// Linha do tempo da ficha (6.7): pagamentos, estornos, contatos e envios do relatório do mês, os 100 mais novos.
export async function linhaDoTempo(db,clientId) {
  const subs=(await db.query(`SELECT s.id,COALESCE(b.nome_cache,'') AS empresa,COALESCE(p.nome,NULLIF(s.plano_nome,''),s.plano_site) AS plano FROM subscriptions s
    LEFT JOIN client_businesses b ON b.business_id=s.business_id LEFT JOIN site_plans p ON p.id=s.plano_site WHERE s.client_id=$1`,[clientId])).rows;
  // O relatório pode ser de empresa sem assinatura; a que foi desvinculada depois aparece pelo id.
  const rels=(await db.query(`SELECT k.*,u.nome,b.nome_cache FROM contacts k LEFT JOIN users u ON u.id=k.feito_por LEFT JOIN client_businesses b ON b.business_id=k.business_id
    WHERE k.client_id=$1 AND k.tipo='relatorio'`,[clientId])).rows;
  if(!subs.length&&!rels.length)return [];
  const ids=subs.map(s=>s.id),ref=id=>{const s=subs.find(x=>x.id===id);return {id,empresa:s.empresa||null,plano:s.plano||null};};
  const pags=(await db.query(`${PAG} WHERE p.subscription_id=ANY($1)`,[ids])).rows;
  const conts=(await db.query('SELECT k.*,k.vence_em::text AS vence,u.nome FROM contacts k LEFT JOIN users u ON u.id=k.feito_por WHERE k.subscription_id=ANY($1)',[ids])).rows;
  const por=k=>k.feito_por?{id:k.feito_por,nome:k.nome||''}:null;
  const itens=[
    ...rels.map(k=>({tipo:'relatorio',em:iso(k.feito_em),por:por(k),assinatura:null,empresa:{id:k.business_id,nome:k.nome_cache||k.business_id},contato:contatoVM(k,por(k))})),
    ...pags.map(p=>({tipo:'pagamento',em:iso(p.registrado_em),por:p.registrado_por?{id:p.registrado_por,nome:p.registrado_nome||''}:null,assinatura:ref(p.subscription_id),pagamento:pagamentoVM(p)})),
    ...pags.filter(p=>p.estornado_em).map(p=>({tipo:'estorno',em:iso(p.estornado_em),por:p.estornado_por?{id:p.estornado_por,nome:p.estornado_nome||''}:null,assinatura:ref(p.subscription_id),pagamento:pagamentoVM(p)})),
    ...conts.map(k=>({tipo:'contato',em:iso(k.feito_em),por:k.feito_por?{id:k.feito_por,nome:k.nome||''}:null,assinatura:ref(k.subscription_id),
      contato:contatoVM({...k,vence_em:k.vence},k.feito_por?{id:k.feito_por,nome:k.nome||''}:null)}))
  ];
  return itens.sort((a,b)=>b.em.localeCompare(a.em)).slice(0,100);
}

// Registrar pagamento (6.10): a sugestão do formulário e as formas aceitas.
export async function telaPagamento(db,id,cx) {
  const s=await linha(db,id);
  if(s.status!=='ativa')throw fail('Reative a assinatura antes de registrar o pagamento.',422);
  return {assinatura:assinaturaVM(s,cx),cliente:{id:s.client_id,nome:s.cliente_nome},
    sugestao:{valorCentavos:s.valor_centavos,pagoEm:cx.hoje,forma:'pix',venceDepois:proximoVencimento(s)},formas:FORMAS};
}
