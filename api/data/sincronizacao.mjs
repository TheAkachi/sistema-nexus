import { audit } from '../lib/auditoria.mjs';
import { empresaDoSite } from '../integracao.mjs';
import { contexto, situacaoDe, SELECT } from './assinaturas.mjs';
import { enfileirar, planoEsperado, processarFila } from './fila.mjs';

// Rotina diária (contrato 9.3 e 10): compara o plano esperado de cada empresa vinculada com o plano no site. Sem aplicar,
// só relata. Com aplicar: atualiza os caches (nome, slug, bairro e foto), põe as divergências na fila, envia a fila e
// registra na auditoria.
const LOTE=20;
async function comparar(db,noSite,{now,ids,aplicar}) {
  const cx=await contexto(db,{now});
  const vinculos=(await db.query('SELECT business_id,nome_cache,slug_cache,bairro_cache,foto_cache FROM client_businesses WHERE business_id=ANY($1) ORDER BY business_id',[ids])).rows;
  const subs=(await db.query(`${SELECT} WHERE s.status<>'cancelada' AND s.business_id IS NOT NULL`)).rows;
  const divergencias=[],naoEncontradas=[],caches=[];
  for(const v of vinculos) {
    const e=noSite.get(v.business_id);
    if(!e){naoEncontradas.push(v.business_id);continue;}
    const s=subs.find(x=>x.business_id===v.business_id),esperado=s?planoEsperado(s,cx.hoje,cx.tolerancia):null;
    if(e.plano!==esperado)divergencias.push({empresa:v.business_id,nome:e.nome,noSite:e.plano,esperado,assinatura:s?.id||null,
      motivo:s&&esperado===null&&situacaoDe(s,cx)==='inadimplente'?'tolerancia':'conferencia'});
    if(e.nome!==v.nome_cache||e.slug!==v.slug_cache||e.bairro!==v.bairro_cache||e.foto!==v.foto_cache)caches.push(e);
  }
  const relatorio={empresas:vinculos.length,divergencias:divergencias.map(({motivo,assinatura,...d})=>d),naoEncontradas,caches:caches.length,aplicado:aplicar,envio:null};
  return {relatorio,divergencias,caches};
}
export async function conferirPlanos(db,{site,now=new Date(),aplicar=false}) {
  const ids=(await db.query('SELECT business_id FROM client_businesses ORDER BY business_id')).rows.map(v=>v.business_id);
  const noSite=new Map();
  for(let i=0;i<ids.length;i+=LOTE) {
    const r=await site.empresas({ids:ids.slice(i,i+LOTE)});
    for(const e of (Array.isArray(r?.itens)?r.itens:[]).map(empresaDoSite).filter(Boolean))noSite.set(e.id,e);
  }
  if(!aplicar)return (await comparar(db,noSite,{now,ids,aplicar})).relatorio;
  const relatorio=await db.transaction(async tx=>{
    // As consultas remotas terminam antes das travas. Relemos assinaturas, vínculos e tolerância aqui: um pagamento,
    // cancelamento ou desvínculo feito durante a chamada ao guia não pode ser desfeito por uma fotografia antiga.
    // A ordem segue a importação (vínculos antes de assinaturas); o modo também serializa duas conferências.
    await tx.query("SET LOCAL lock_timeout = '5s'");
    await tx.query('LOCK TABLE client_businesses, subscriptions, settings IN SHARE ROW EXCLUSIVE MODE');
    const {relatorio,divergencias,caches}=await comparar(tx,noSite,{now,ids,aplicar});
    for(const e of caches)await tx.query('UPDATE client_businesses SET nome_cache=$2,slug_cache=$3,bairro_cache=$4,foto_cache=$5 WHERE business_id=$1',[e.id,e.nome,e.slug,e.bairro,e.foto]);
    for(const d of divergencias)await enfileirar(tx,{businessId:d.empresa,plano:d.esperado,assinatura:d.assinatura,motivo:d.motivo,now});
    return relatorio;
  });
  relatorio.envio=await processarFila(db,{site,now});
  await audit(db,{action:'sincronizacao_conferida',type:'empresa',resource:'todas',after:{empresas:relatorio.empresas,divergencias:relatorio.divergencias.length,
    naoEncontradas:relatorio.naoEncontradas.length,caches:relatorio.caches,enviados:relatorio.envio.enviados,falhas:relatorio.envio.falhas}});
  return relatorio;
}
