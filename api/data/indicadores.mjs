import { hoje as diaDe, dias, ultimoDia, somarMeses, MESES } from '../lib/datas.mjs';
import { collator, iso } from './comum.mjs';
import { SELECT, situacaoDe } from './assinaturas.mjs';
import { comNome } from './metricas-site.mjs';
import { funilDe } from './leads.mjs';

// Indicadores, bloco Dinheiro (contrato 6.17 e D9 do plano): a evolução do dinheiro em 12 meses, só com dados da gestão.
// Nenhum número é estimado: o que não dá para reconstruir (o valor e o ciclo de meses passados, o atraso de meses passados)
// está dito no contrato e no "como" de cada bloco. cx é o contexto das assinaturas (hoje e tolerância).
const COMO={
  recebido:'Pagamentos registrados com data no mês, menos os estornos feitos no mês. O estorno desconta no mês em que foi feito.',
  mrr:'Assinaturas que, no último dia de cada mês (hoje, no mês atual), já tinham começado e não estavam suspensas nem canceladas, cada uma com o valor de hoje dividido pelos meses do ciclo. As inadimplentes entram.',
  movimento:'Novas pelo mês do início e canceladas pelo mês do cancelamento, com a receita mensal de cada uma.',
  previsao:'Assinaturas ativas que vencem nos próximos 30 dias, por semana, com o valor de um ciclo. Atrasadas são as que já venceram e ainda não foram pagas.',
  inadimplencia:t=>`Assinaturas ativas vencidas há mais de ${t} ${t===1?'dia':'dias'} (a tolerância das Configurações), pelos dias de atraso, com o valor de um ciclo.`,
  planos:'Assinaturas ativas que não estão inadimplentes, com o valor dividido pelos meses do ciclo: a mesma conta da receita mensal do Resumo.',
  audiencia:'Visitas e contatos dos visitantes que aceitaram a medição no site; buscas contadas pelo servidor do site, sem dado pessoal. Mês sem medição aparece em branco.',
  anunciantes:'Empresas com assinatura ativa na gestão, com as visitas e os contatos dos últimos 30 dias no guia. Em risco: vence em até 30 dias e recebeu menos de 5 contatos. Sem medição: o site não mede a empresa, porque ela não está publicada; fica fora das listas e do risco.'
};
// Audiência do Guia e Anunciantes (9.5, v0.9.0): da cópia das métricas do site, nunca do site na hora.
const RISCO_CONTATOS=5;
const totalContatos=c=>c?c.whatsapp+c.telefone+c.rota+c.site:null;
function audienciaDe(copia,meses,atual) {
  const d=copia?.dados,lidos=new Map((d?.site?.meses||[]).map(m=>[m.mes,m]));
  return {como:COMO.audiencia,disponivel:Boolean(d),atualizadaEm:iso(d?copia.lido_em:null),medidoDesde:d?.medidoDesde||{contatos:null,buscas:null},
    meses:meses.map(mes=>{const m=lidos.get(mes);
      return {mes,visitas:m?.visitas??null,contatos:m?.contatos??null,contatosTotal:totalContatos(m?.contatos),buscas:m?.buscas??null,buscasSemResultado:m?.buscasSemResultado??null,parcial:mes===atual};}),
    buscasMaisFeitas:d?.site?.buscasMaisFeitas||[],buscasSemResultado:d?.site?.buscasSemResultado||[],bairros:d?.site?.bairros||[],categorias:comNome(d?.site?.categorias)};
}
// A empresa que o site não listou (não publicada) não tem número: fica em semMedicao, fora das listas e do risco (v0.14.1).
function anunciantesDe(copia,ativas) {
  const d=copia?.dados,porId=new Map((d?.empresas||[]).map(e=>[e.id,e])),ultimos=a=>porId.get(a.empresa.id)?.ultimos30;
  const base=ativas.filter(s=>s.business_id).map(s=>({empresa:{id:s.business_id,nome:s.nome_cache||porId.get(s.business_id)?.nome||s.business_id},cliente:{id:s.client_id,nome:s.cliente_nome},
    assinatura:{id:s.id,venceEm:s.vence_em,dias:s._dias,situacao:s._situacao}}));
  const porNome=(a,b)=>collator.compare(a.empresa.nome,b.empresa.nome);
  const medidas=base.filter(ultimos).map(a=>({...a,visitas30:ultimos(a).visitas,contatos30:totalContatos(ultimos(a).contatos),contatos30Canais:ultimos(a).contatos}));
  const mais=[...medidas].sort((a,b)=>b.contatos30-a.contatos30||porNome(a,b)).slice(0,5);
  const menos=medidas.filter(x=>!mais.includes(x)).sort((a,b)=>a.contatos30-b.contatos30||porNome(a,b)).slice(0,5);
  const risco=medidas.filter(x=>x.assinatura.dias>=0&&x.assinatura.dias<=30&&x.contatos30<RISCO_CONTATOS)
    .sort((a,b)=>a.assinatura.venceEm.localeCompare(b.assinatura.venceEm)||porNome(a,b));
  const banners=(d?.banners||[]).map(b=>({...b,ctr:b.impressoes?Math.round(b.cliques/b.impressoes*10000)/10000:0}));
  return {como:COMO.anunciantes,disponivel:Boolean(d),atualizadaEm:iso(d?copia.lido_em:null),base:base.length,semMedicao:d?base.filter(a=>!ultimos(a)).sort(porNome):[],maisContatos:mais,menosContatos:menos,emRisco:risco,banners};
}
const SEMANAS=[[0,6],[7,13],[14,20],[21,27],[28,30]];
const FAIXAS=[[1,30],[31,60],[61,90],[91,null]];
const mensal=s=>s.valor_centavos/MESES[s.ciclo];
const soma=(lista,f)=>lista.reduce((t,x)=>t+f(x),0);
const somarDias=(dia,n)=>new Date(Date.UTC(+dia.slice(0,4),+dia.slice(5,7)-1,+dia.slice(8,10)+n)).toISOString().slice(0,10);
const fimDoMes=mes=>`${mes}-${String(ultimoDia(+mes.slice(0,4),+mes.slice(5,7))).padStart(2,'0')}`;

// Os períodos de suspensão de cada assinatura: os pares suspensa → reativada da auditoria e a suspensão em aberto.
async function suspensoes(db,subs) {
  const rows=(await db.query(`SELECT resource_id,action,created_at FROM audit_log WHERE resource_type='assinatura'
    AND action IN ('assinatura_suspensa','assinatura_reativada') ORDER BY created_at,id`)).rows;
  const periodos=new Map(subs.map(s=>[s.id,s.suspensa_em?[[s.suspensa_em,null]]:[]])),abertas=new Map();
  for(const r of rows) {
    const dia=diaDe(new Date(r.created_at)),lista=periodos.get(r.resource_id);if(!lista)continue;
    if(r.action==='assinatura_suspensa'){if(!abertas.has(r.resource_id))abertas.set(r.resource_id,dia);}
    else if(abertas.has(r.resource_id)){lista.push([abertas.get(r.resource_id),dia]);abertas.delete(r.resource_id);}
  }
  for(const [id,dia] of abertas)periodos.get(id).push([dia,null]);
  return periodos;
}

// leads: a chave dos interessados (14.1); desligada, funil vem null.
export async function indicadores(db,cx,{leads=false}={}) {
  const subs=(await db.query(SELECT)).rows,pags=(await db.query('SELECT valor_centavos,pago_em::text AS pago_em,estornado_em FROM payments')).rows;
  const atual=cx.hoje.slice(0,7),meses=Array.from({length:12},(_,i)=>somarMeses(`${atual}-01`,i-11).slice(0,7));
  const parcial=mes=>mes===atual,periodos=await suspensoes(db,subs);
  const copia=(await db.query('SELECT dados,lido_em FROM site_metrics WHERE id=1 AND dados IS NOT NULL')).rows[0]||null;

  const recebidoMeses=meses.map(mes=>{
    const pagos=pags.filter(p=>p.pago_em.slice(0,7)===mes),estornados=pags.filter(p=>p.estornado_em&&diaDe(new Date(p.estornado_em)).slice(0,7)===mes);
    const p={qtd:pagos.length,centavos:soma(pagos,x=>x.valor_centavos)},e={qtd:estornados.length,centavos:soma(estornados,x=>x.valor_centavos)};
    return {mes,centavos:p.centavos-e.centavos,pagos:p,estornados:e,parcial:parcial(mes)};
  });

  const suspensa=(s,dia)=>periodos.get(s.id).some(([de,ate])=>de<=dia&&(ate===null||dia<ate));
  const vigente=(s,dia)=>s.inicio<=dia&&(!s.cancelada_em||s.cancelada_em>dia)&&!suspensa(s,dia);
  const mrrMeses=meses.map(mes=>{
    const dia=parcial(mes)?cx.hoje:fimDoMes(mes),contam=subs.filter(s=>vigente(s,dia));
    return {mes,centavos:Math.round(soma(contam,mensal)),assinaturas:contam.length,parcial:parcial(mes)};
  });

  const movimentoMeses=meses.map(mes=>{
    const novas=subs.filter(s=>s.inicio.slice(0,7)===mes),canceladas=subs.filter(s=>s.cancelada_em?.slice(0,7)===mes);
    return {mes,novas:{qtd:novas.length,centavos:Math.round(soma(novas,mensal))},canceladas:{qtd:canceladas.length,centavos:Math.round(soma(canceladas,mensal))},parcial:parcial(mes)};
  });

  const ativas=subs.filter(s=>s.status==='ativa').map(s=>({...s,_dias:dias(cx.hoje,s.vence_em),_situacao:situacaoDe(s,cx)}));
  const item=s=>({id:s.id,cliente:{id:s.client_id,nome:s.cliente_nome},empresa:s.business_id?{id:s.business_id,nome:s.nome_cache||s.business_id}:null,
    plano:s.plano_site?{id:s.plano_site,nome:s.plano_nome}:null,venceEm:s.vence_em,dias:s._dias,valorCentavos:s.valor_centavos,situacao:s._situacao});
  const porVencimento=(a,b)=>a.vence_em.localeCompare(b.vence_em)||collator.compare(a.cliente_nome,b.cliente_nome);
  const semanas=SEMANAS.map(([de,ate])=>{
    const nela=ativas.filter(s=>s._dias>=de&&s._dias<=ate).sort(porVencimento);
    return {de:somarDias(cx.hoje,de),ate:somarDias(cx.hoje,ate),qtd:nela.length,centavos:soma(nela,s=>s.valor_centavos),itens:nela.map(item)};
  });
  const contagem=lista=>({qtd:lista.length,centavos:soma(lista,s=>s.valor_centavos)});
  const inad=ativas.filter(s=>s._situacao==='inadimplente');

  const base=ativas.filter(s=>s._situacao!=='inadimplente'),grupos=new Map();
  for(const s of base){const k=s.plano_site??'';if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(s);}
  const planos=[...grupos.values()].map(l=>({plano:l[0].plano_site?{id:l[0].plano_site,nome:l[0].plano_nome}:null,assinaturas:l.length,centavos:Math.round(soma(l,mensal))}))
    .sort((a,b)=>b.centavos-a.centavos||collator.compare(a.plano?.nome??'',b.plano?.nome??''));
  const mrr=Math.round(soma(base,mensal));

  return {hoje:cx.hoje,meses,
    recebido:{como:COMO.recebido,meses:recebidoMeses,total:soma(recebidoMeses,m=>m.centavos)},
    mrr:{como:COMO.mrr,meses:mrrMeses},
    movimento:{como:COMO.movimento,meses:movimentoMeses},
    previsao:{como:COMO.previsao,de:cx.hoje,ate:somarDias(cx.hoje,30),semanas,total:{qtd:soma(semanas,w=>w.qtd),centavos:soma(semanas,w=>w.centavos)},
      atrasadas:{vencidas:contagem(ativas.filter(s=>s._situacao==='vencida')),inadimplentes:contagem(inad)}},
    inadimplencia:{como:COMO.inadimplencia(cx.tolerancia),...contagem(inad),
      faixas:FAIXAS.map(([de,ate])=>({de,ate,...contagem(inad.filter(s=>-s._dias>=de&&(ate===null||-s._dias<=ate)))}))},
    planos:{como:COMO.planos,itens:planos,assinaturas:base.length,mrr,valorMedio:base.length?Math.round(mrr/base.length):0},
    audiencia:audienciaDe(copia,meses,atual),anunciantes:anunciantesDe(copia,ativas),funil:leads?await funilDe(db,meses,atual):null};
}
