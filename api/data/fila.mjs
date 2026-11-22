import { randomUUID } from 'node:crypto';
import { situacao } from '../lib/datas.mjs';
import { audit } from '../lib/auditoria.mjs';

// Fila do plano de cada empresa no site (contrato 9.3). Entra na mesma transação da mudança e é enviada logo depois (e a
// cada 30 s). O plano esperado é o da assinatura não cancelada, se ela está ativa e não inadimplente; senão, null.
export const planoEsperado=(s,hojeDia,tolerancia)=>s.status==='ativa'&&situacao({status:'ativa',venceEm:s.vence_em},hojeDia,tolerancia)!=='inadimplente'?s.plano_site:null;
export async function enfileirar(db,{businessId,plano,gerida=true,assinatura=null,motivo,now=new Date()}) {
  if(!businessId)return;
  await db.query('INSERT INTO plan_sync(id,business_id,plano,gerida,subscription_id,motivo,criado_em,proxima_em) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',
    [randomUUID(),businessId,plano,gerida,assinatura,motivo,now.toISOString()]);
}
// Estado do último envio da empresa (9.3): ok, falhou (há mais de 1 hora), pendente ou sem-empresa.
export function estadoSync(businessId,ultimo,now=new Date()) {
  if(!businessId)return {estado:'sem-empresa',em:null,erro:''};
  if(ultimo?.enviado_em)return {estado:'ok',em:new Date(ultimo.enviado_em).toISOString(),erro:''};
  if(ultimo?.ultimo_erro&&now.getTime()-new Date(ultimo.criado_em).getTime()>3600000)return {estado:'falhou',em:null,erro:ultimo.ultimo_erro};
  return {estado:'pendente',em:null,erro:''};
}

// "Minha assinatura" (9.5), montada na hora do envio: a assinatura não cancelada da empresa vinculada, os 3 últimos pagamentos
// não estornados e como pagar. Nada do cliente, das outras empresas dele nem da equipe. Sem vínculo ou sem assinatura: null.
export async function minhaAssinaturaDe(db,businessId,conf) {
  if(!(await db.query('SELECT 1 FROM client_businesses WHERE business_id=$1',[businessId])).rows.length)return null;
  const s=(await db.query(`SELECT s.id,s.plano_site,COALESCE(p.nome,NULLIF(s.plano_nome,''),s.plano_site) AS plano_nome,s.valor_centavos,s.ciclo,s.vence_em::text AS vence_em,s.status
    FROM subscriptions s LEFT JOIN site_plans p ON p.id=s.plano_site WHERE s.business_id=$1 AND s.status<>'cancelada' LIMIT 1`,[businessId])).rows[0];
  if(!s)return null;
  const pags=(await db.query(`SELECT pago_em::text AS pago_em,valor_centavos,forma,referencia_de::text AS de,referencia_ate::text AS ate FROM payments
    WHERE subscription_id=$1 AND estornado_em IS NULL ORDER BY pago_em DESC,registrado_em DESC LIMIT 3`,[s.id])).rows;
  return {plano:s.plano_site?{id:s.plano_site,nome:s.plano_nome}:null,valorCentavos:s.valor_centavos,ciclo:s.ciclo,venceEm:s.vence_em,status:s.status,
    ultimosPagamentos:pags.map(p=>({pagoEm:p.pago_em,valorCentavos:p.valor_centavos,forma:p.forma,referencia:{de:p.de,ate:p.ate}})),
    comoPagar:{chavePix:conf?.chave_pix||'',whatsapp:conf?.whatsapp_atendimento||''}};
}

// Espera depois de cada falha: 1, 5, 15 e 60 minutos, e depois a cada hora.
const ESPERA_MIN=[1,5,15,60];
export const esperaDe=tentativas=>ESPERA_MIN[Math.min(tentativas,ESPERA_MIN.length)-1]*60000;
// Envia a fila: de cada empresa, só o pedido mais novo, quando ele já está na hora. Chegou: ele e os mais antigos ainda
// pendentes da mesma empresa saem como enviados. Falhou: o erro fica nele, com a próxima tentativa mais adiante.
export async function processarFila(db,{site,now=new Date(),limite=100}) {
  const r={enviados:0,falhas:0};
  if(!site)return r;
  const pendentes=(await db.query('SELECT * FROM plan_sync WHERE enviado_em IS NULL ORDER BY seq')).rows;
  const ultimos=[...new Map(pendentes.map(p=>[p.business_id,p])).values()].filter(p=>new Date(p.proxima_em)<=now).slice(0,limite);
  for(const candidato of ultimos) await db.transaction(async tx=>{
    // O servidor e o CLI diário podem enviar ao mesmo tempo. A trava vive na mesma conexão da transação e cobre
    // o envio inteiro; outro processo pula esta empresa. A releitura impede enviar um pedido já substituído.
    const {locked}=(await tx.query('SELECT pg_try_advisory_xact_lock(41841, hashtext($1)) AS locked',[candidato.business_id])).rows[0];
    if(!locked)return;
    const p=(await tx.query('SELECT * FROM plan_sync WHERE business_id=$1 AND enviado_em IS NULL ORDER BY seq DESC LIMIT 1',[candidato.business_id])).rows[0];
    if(!p||new Date(p.proxima_em)>now)return;
    // A "Minha assinatura" (9.5) é montada dentro da mesma transação, com a trava: o envio leva o estado relido.
    const conf=(await tx.query('SELECT chave_pix,whatsapp_atendimento FROM settings WHERE id=1')).rows[0];
    let erro='',resposta=null;
    try {
      const minhaAssinatura=await minhaAssinaturaDe(tx,p.business_id,conf);
      resposta=await site.definirPlano(p.business_id,{plano:p.plano,gerida:p.gerida,assinatura:p.subscription_id,motivo:p.motivo,minhaAssinatura});
      if(!resposta)erro='Empresa não encontrada no guia.';
    } catch(e){erro=e.status===503?'O guia não respondeu.':e.status?e.message:'Falha ao enviar.';}
    if(erro) {
      const tentativas=p.tentativas+1;
      await tx.query('UPDATE plan_sync SET tentativas=$2,ultimo_erro=$3,proxima_em=$4 WHERE id=$1',[p.id,tentativas,erro,new Date(now.getTime()+esperaDe(tentativas)).toISOString()]);
      r.falhas++;return;
    }
    await tx.query("UPDATE plan_sync SET enviado_em=$3,ultimo_erro='' WHERE business_id=$1 AND enviado_em IS NULL AND seq<=$2",[p.business_id,p.seq,now.toISOString()]);
    await audit(tx,{action:'plano_enviado',type:'empresa',resource:p.business_id,after:{plano:p.plano,gerida:p.gerida,motivo:p.motivo,alterado:resposta.alterado===true}});
    r.enviados++;
  });
  return r;
}

// Processador da fila no servidor: roda logo depois de cada escrita (agora) e a cada intervalo, uma rodada por vez.
export function criarFila({db,site,clock=()=>new Date(),logger=()=>{}}) {
  let rodando=null,deNovo=false,timer=null;
  const rodar=async()=>{
    if(rodando){deNovo=true;return rodando;}
    rodando=(async()=>{
      do{deNovo=false;try{const r=await processarFila(db,{site,now:clock()});if(r.enviados||r.falhas)logger({fila:r});}catch{logger({error:'fila_falhou'});}}while(deNovo);
    })().finally(()=>{rodando=null;});
    return rodando;
  };
  return {
    agora:()=>{if(site)setImmediate(rodar);},
    rodar,
    iniciar:(ms=30000)=>{if(site&&!timer){timer=setInterval(rodar,ms);timer.unref();}},
    parar:async()=>{clearInterval(timer);timer=null;await rodando;}
  };
}
