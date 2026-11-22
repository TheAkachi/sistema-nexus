import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { hoje, dias, diaValido, situacao, CICLOS } from '../lib/datas.mjs';
import { rejectExtra, needVersion, conflito, texto, iso, lista, filtro, casa, UUID } from './comum.mjs';
import { planoValido } from './planos.mjs';
import { enfileirar, planoEsperado, estadoSync } from './fila.mjs';

// Assinaturas (contrato 5.2 a 5.4, 6.7, 6.9 e 7.5). A situação é calculada aqui, com o dia de hoje em São Paulo e a
// tolerância das configurações; toda mudança de plano, empresa, vencimento ou situação vai para a fila do site. O contato
// é o último do vencimento atual (6.5): depois do pagamento, o vencimento novo ainda não foi cobrado.
export const SELECT=`SELECT s.id,s.client_id,c.nome AS cliente_nome,c.status AS cliente_status,c.responsavel AS cliente_responsavel,c.whatsapp AS cliente_whatsapp,
  s.business_id,b.nome_cache,b.slug_cache,b.foto_cache,
  s.plano_site,COALESCE(p.nome,NULLIF(s.plano_nome,''),s.plano_site) AS plano_nome,s.valor_centavos,s.ciclo,s.inicio::text AS inicio,s.vence_em::text AS vence_em,
  s.dia_base,s.status,s.suspensa_em::text AS suspensa_em,s.cancelada_em::text AS cancelada_em,s.motivo,s.origem,s.notas,s.gerida_em,s.criado_em,s.atualizado_em,s.version,
  (SELECT row_to_json(q) FROM (SELECT enviado_em,ultimo_erro,criado_em FROM plan_sync WHERE business_id=s.business_id ORDER BY seq DESC LIMIT 1) q) AS sync,
  (SELECT row_to_json(q) FROM (SELECT k.feito_em,k.tipo,k.etapa,k.feito_por,u.nome FROM contacts k LEFT JOIN users u ON u.id=k.feito_por WHERE k.subscription_id=s.id AND k.vence_em=s.vence_em
    ORDER BY k.feito_em DESC,k.id LIMIT 1) q) AS contato
  FROM subscriptions s JOIN clients c ON c.id=s.client_id LEFT JOIN client_businesses b ON b.business_id=s.business_id LEFT JOIN site_plans p ON p.id=s.plano_site`;

// Dia de hoje, tolerância, chave Pix, modelos das mensagens (v0.14.0: também os das etapas da régua) e a origem do site:
// o que todo vm de assinatura precisa.
export async function contexto(db,{now=new Date(),siteOrigin=''}={}) {
  const t=(await db.query('SELECT tolerancia_dias,chave_pix,modelo_mensagem,modelo_relatorio,modelos_lembrete FROM settings WHERE id=1')).rows[0];
  return {hoje:hoje(now),tolerancia:t?.tolerancia_dias??10,chavePix:t?.chave_pix||'',modelo:t?.modelo_mensagem||'',modeloRelatorio:t?.modelo_relatorio||'',modelosLembrete:t?.modelos_lembrete||{},siteOrigin,now};
}
export const empresaVM=(id,{nome,slug,foto},siteOrigin)=>id?{id,nome:nome||id,miniatura:foto&&siteOrigin?`${siteOrigin}${foto}`:'',url:slug&&siteOrigin?`${siteOrigin}/comercio/${slug}`:''}:null;
export const situacaoDe=(s,cx)=>situacao({status:s.status,venceEm:s.vence_em},cx.hoje,cx.tolerancia);
export function assinaturaVM(s,cx) {
  return {id:s.id,cliente:{id:s.client_id,nome:s.cliente_nome},empresa:empresaVM(s.business_id,{nome:s.nome_cache,slug:s.slug_cache,foto:s.foto_cache},cx.siteOrigin),
    plano:s.plano_site?{id:s.plano_site,nome:s.plano_nome}:null,valorCentavos:s.valor_centavos,ciclo:s.ciclo,inicio:s.inicio,venceEm:s.vence_em,diaBase:s.dia_base,
    dias:dias(cx.hoje,s.vence_em),situacao:situacaoDe(s,cx),status:s.status,suspensaEm:s.suspensa_em,canceladaEm:s.cancelada_em,motivo:s.motivo,origem:s.origem,
    notas:s.notas,gerida:Boolean(s.gerida_em),sincronizacao:estadoSync(s.business_id,s.sync,cx.now),criadaEm:iso(s.criado_em),atualizadaEm:iso(s.atualizado_em),version:s.version};
}
export async function linha(db,id,{lock=false}={}) {
  if(lock)await db.query('SELECT 1 FROM subscriptions WHERE id=$1 FOR UPDATE',[id]);
  const s=(await db.query(`${SELECT} WHERE s.id=$1`,[id])).rows[0];if(!s)throw fail('Assinatura não encontrada.',404);
  return s;
}
export const assinaturasDoCliente=async(db,clientId)=>(await db.query(`${SELECT} WHERE s.client_id=$1`,[clientId])).rows;

export async function listarAssinaturas(db,url,cx) {
  const q=filtro(url,'q'),status=filtro(url,'status'),sit=filtro(url,'situacao'),cliente=filtro(url,'cliente');
  const rows=(await db.query(`${SELECT} ORDER BY c.nome,s.vence_em`)).rows
    .filter(s=>casa(q,s.cliente_nome,s.nome_cache,s.plano_nome)&&(!status||s.status===status)&&(!sit||situacaoDe(s,cx)===sit)&&(!cliente||s.client_id===cliente));
  return lista(rows.map(s=>assinaturaVM(s,cx)),url);
}
export const obterAssinatura=async(db,id,cx)=>assinaturaVM(await linha(db,id),cx);

// Validação dos campos (7.2). Devolve só os que vieram, já no formato do banco.
const valorDe=v=>{if(!Number.isSafeInteger(v)||v<0||v>100000000)throw fail('Informe o valor, como 99,00.',422,'valorCentavos');return v;};
const cicloDe=v=>{if(!CICLOS.includes(v))throw fail('Escolha o ciclo.',422,'ciclo');return v;};
const diaDe=(v,campo)=>{if(!diaValido(v))throw fail('Use a data no formato aaaa-mm-dd.',422,campo);return v;};
const motivoDe=(v,{obrigatorio=false}={})=>{
  if(v===undefined&&!obrigatorio)return undefined;
  const t=typeof v==='string'?v.trim().replace(/\s+/g,' '):'';
  if(t.length<3||t.length>300)throw fail('Conte o motivo em poucas palavras.',422,'motivo');
  return t;
};
async function empresaDoCliente(db,clientId,empresa) {
  if(empresa===null)return null;
  if(typeof empresa!=='string'||!(await db.query('SELECT 1 FROM client_businesses WHERE client_id=$1 AND business_id=$2',[clientId,empresa])).rows.length)
    throw fail('Vincule a empresa ao cliente antes.',422,'empresa');
  return empresa;
}
async function empresaLivre(db,empresa,excetoId=null) {
  if(empresa&&(await db.query("SELECT 1 FROM subscriptions WHERE business_id=$1 AND status<>'cancelada' AND id<>$2",[empresa,excetoId||''])).rows.length)
    throw fail('Esta empresa já tem uma assinatura. Edite a que existe.',409,'empresa');
}
const CAMPOS_AUDIT=s=>({empresa:s.business_id,plano:s.plano_site,valorCentavos:s.valor_centavos,ciclo:s.ciclo,inicio:s.inicio,venceEm:s.vence_em,status:s.status,motivo:s.motivo,notas:s.notas});

export async function criarAssinatura(db,{p,session,ip,now=new Date(),site,siteOrigin}) {
  rejectExtra(p,['cliente','empresa','plano','valorCentavos','ciclo','inicio','venceEm','notas']);
  const cliente=typeof p.cliente==='string'&&UUID.test(p.cliente)?(await db.query('SELECT id,status FROM clients WHERE id=$1',[p.cliente])).rows[0]:null;
  if(!cliente)throw fail('Cliente não encontrado.',422,'cliente');
  if(cliente.status!=='ativo')throw fail('Reabra o cliente antes de criar uma assinatura.',422,'cliente');
  const empresa=await empresaDoCliente(db,cliente.id,p.empresa??null);
  if(typeof p.plano!=='string'||!p.plano)throw fail('Escolha um plano do guia.',422,'plano');
  const valor=valorDe(p.valorCentavos),ciclo=cicloDe(p.ciclo),inicio=diaDe(p.inicio,'inicio'),venceEm=diaDe(p.venceEm,'venceEm');
  if(venceEm<inicio)throw fail('O vencimento não pode vir antes do início.',422,'venceEm');
  const notas=texto(p.notas,'notas',2000)??'';
  const plano=await planoValido(db,{site,now,id:p.plano});
  const cx=await contexto(db,{now,siteOrigin}),id=randomUUID();
  return db.transaction(async tx=>{
    await empresaLivre(tx,empresa);
    await tx.query(`INSERT INTO subscriptions(id,client_id,business_id,plano_site,plano_nome,valor_centavos,ciclo,inicio,vence_em,dia_base,status,origem,notas,gerida_em,criado_em,atualizado_em)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ativa','manual',$11,$12,$12,$12)`,[id,cliente.id,empresa,plano.id,plano.nome,valor,ciclo,inicio,venceEm,+venceEm.slice(8,10),notas,now.toISOString()]);
    const s=await linha(tx,id);
    await enfileirar(tx,{businessId:empresa,plano:planoEsperado(s,cx.hoje,cx.tolerancia),assinatura:id,motivo:'ativacao',now});
    await audit(tx,{actor:session.user_id,action:'assinatura_criada',type:'assinatura',resource:id,after:CAMPOS_AUDIT(s),ip});
    return assinaturaVM(await linha(tx,id),cx);
  });
}

export async function editarAssinatura(db,{id,p,session,ip,now=new Date(),site,siteOrigin}) {
  const atual=await linha(db,id);
  rejectExtra(p,['empresa','plano','valorCentavos','ciclo','inicio','venceEm','notas','version']);const version=needVersion(p);
  const x={business_id:atual.business_id,plano_site:atual.plano_site,plano_nome:atual.plano_nome,valor_centavos:atual.valor_centavos,ciclo:atual.ciclo,inicio:atual.inicio,vence_em:atual.vence_em,notas:atual.notas};
  if(atual.status==='cancelada'&&Object.keys(p).some(k=>!['notas','version'].includes(k)))throw fail('A assinatura cancelada só aceita mudança nas notas.',422);
  if(p.empresa!==undefined)x.business_id=await empresaDoCliente(db,atual.client_id,p.empresa);
  if(p.plano!==undefined&&p.plano!==atual.plano_site){const pl=await planoValido(db,{site,now,id:p.plano,atual:atual.plano_site});x.plano_site=pl.id;x.plano_nome=pl.nome;}
  if(p.valorCentavos!==undefined)x.valor_centavos=valorDe(p.valorCentavos);
  if(p.ciclo!==undefined)x.ciclo=cicloDe(p.ciclo);
  if(p.inicio!==undefined)x.inicio=diaDe(p.inicio,'inicio');
  if(p.venceEm!==undefined)x.vence_em=diaDe(p.venceEm,'venceEm');
  if(x.vence_em<x.inicio)throw fail('O vencimento não pode vir antes do início.',422,'venceEm');
  if(p.notas!==undefined)x.notas=texto(p.notas,'notas',2000);
  const cx=await contexto(db,{now,siteOrigin});
  return db.transaction(async tx=>{
    const s=await linha(tx,id,{lock:true});if(s.version!==version)throw conflito();
    const mudou=diff(CAMPOS_AUDIT(s),CAMPOS_AUDIT({...s,...x}));
    if(!mudou.keys.length)return assinaturaVM(s,cx);
    if(x.business_id!==s.business_id)await empresaLivre(tx,x.business_id,id);
    await tx.query(`UPDATE subscriptions SET business_id=$2,plano_site=$3,plano_nome=$4,valor_centavos=$5,ciclo=$6,inicio=$7,vence_em=$8,dia_base=$9,notas=$10,
      gerida_em=COALESCE(gerida_em,$11),atualizado_em=$11,version=version+1 WHERE id=$1`,
      [id,x.business_id,x.plano_site,x.plano_nome,x.valor_centavos,x.ciclo,x.inicio,x.vence_em,x.vence_em!==s.vence_em?+x.vence_em.slice(8,10):s.dia_base,x.notas,now.toISOString()]);
    const n=await linha(tx,id);
    // O valor e o ciclo não mudam o plano, mas mudam a "Minha assinatura" que o afiliado vê (9.5).
    if(['empresa','plano','venceEm','valorCentavos','ciclo'].some(k=>mudou.keys.includes(k))) {
      if(s.business_id&&s.business_id!==n.business_id)await enfileirar(tx,{businessId:s.business_id,plano:null,assinatura:id,motivo:'edicao',now});
      await enfileirar(tx,{businessId:n.business_id,plano:planoEsperado(n,cx.hoje,cx.tolerancia),assinatura:id,motivo:'edicao',now});
    }
    await audit(tx,{actor:session.user_id,action:'assinatura_editada',type:'assinatura',resource:id,before:mudou.before,after:mudou.after,ip});
    return assinaturaVM(n,cx);
  });
}

// Suspender, reativar e cancelar (7.5): mudam o status, põem o plano esperado na fila e entram na auditoria.
const ACOES={
  suspender:{de:['ativa'],erro:'Só a assinatura ativa pode ser suspensa.',para:'suspensa',acao:'assinatura_suspensa',motivo:'suspensao'},
  reativar:{de:['suspensa'],erro:'Só a assinatura suspensa pode ser reativada.',para:'ativa',acao:'assinatura_reativada',motivo:'reativacao'},
  cancelar:{de:['ativa','suspensa'],erro:'Esta assinatura já está cancelada.',para:'cancelada',acao:'assinatura_cancelada',motivo:'cancelamento'}
};
export async function mudarStatus(db,{id,acao,p,session,ip,now=new Date(),siteOrigin}) {
  const a=ACOES[acao],atual=await linha(db,id);
  rejectExtra(p,acao==='suspender'?['motivo','version']:acao==='cancelar'?['motivo','canceladaEm','version']:['version']);const version=needVersion(p);
  const cx=await contexto(db,{now,siteOrigin});
  const motivo=acao==='reativar'?'':motivoDe(p.motivo,{obrigatorio:acao==='cancelar'})??'';
  let canceladaEm=null;
  if(acao==='cancelar'){canceladaEm=p.canceladaEm===undefined?cx.hoje:p.canceladaEm;if(!diaValido(canceladaEm)||canceladaEm<atual.inicio||canceladaEm>cx.hoje)throw fail('A data do cancelamento vai do início até hoje.',422,'canceladaEm');}
  return db.transaction(async tx=>{
    const s=await linha(tx,id,{lock:true});if(s.version!==version)throw conflito();
    if(!a.de.includes(s.status))throw fail(a.erro,422,'status');
    await tx.query(`UPDATE subscriptions SET status=$2,suspensa_em=$3,cancelada_em=$4,motivo=$5,gerida_em=COALESCE(gerida_em,$6),atualizado_em=$6,version=version+1 WHERE id=$1`,
      [id,a.para,a.para==='suspensa'?cx.hoje:a.para==='cancelada'?s.suspensa_em:null,canceladaEm,motivo,now.toISOString()]);
    const n=await linha(tx,id);
    await enfileirar(tx,{businessId:n.business_id,plano:planoEsperado(n,cx.hoje,cx.tolerancia),assinatura:id,motivo:a.motivo,now});
    const mudou=diff(CAMPOS_AUDIT(s),CAMPOS_AUDIT(n));
    await audit(tx,{actor:session.user_id,action:a.acao,type:'assinatura',resource:id,before:mudou.before,after:{...mudou.after,...(canceladaEm?{canceladaEm}:{})},ip});
    return assinaturaVM(n,cx);
  });
}
