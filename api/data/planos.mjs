import { fail } from '../lib/erros.mjs';
import { planoDoSite, foraDoAr } from '../integracao.mjs';
import { iso, collator } from './comum.mjs';

// Planos do site (contrato 6.9 e 7.1): lidos na hora pela integração e guardados em site_plans; se o site não responde,
// vale a última cópia (copia: true), e a tela mostra o aviso site-fora.
const planoVM=p=>({id:p.id,nome:p.nome,pago:p.pago,status:p.status,precoCentavos:p.preco_centavos??null});
export async function planosSite(db,{site,now=new Date()}) {
  if(site) {
    try {
      const r=await site.planos();
      const itens=Array.isArray(r?.itens)?r.itens.map(planoDoSite).filter(Boolean):null;
      if(itens) {
        await db.transaction(async tx=>{
          await tx.query('DELETE FROM site_plans');
          for(const p of itens)await tx.query('INSERT INTO site_plans(id,nome,pago,status,preco_centavos,atualizado_em) VALUES($1,$2,$3,$4,$5,$6)',[p.id,p.nome,p.pago,p.status,p.precoCentavos,now.toISOString()]);
        });
        return {itens:itens.sort((a,b)=>collator.compare(a.nome,b.nome)),atualizadoEm:now.toISOString(),copia:false};
      }
    } catch(e){if(e.status!==503)throw e;}
  }
  const rows=(await db.query('SELECT * FROM site_plans')).rows;
  return {itens:rows.map(planoVM).sort((a,b)=>collator.compare(a.nome,b.nome)),atualizadoEm:iso(rows.reduce((m,p)=>!m||p.atualizado_em>m?p.atualizado_em:m,null)),copia:true};
}
// O plano escolhido precisa estar ativo no site; o que a assinatura já tem continua aceito na edição.
export async function planoValido(db,{site,now,id,atual=null}) {
  const {itens,copia}=await planosSite(db,{site,now});
  if(!itens.length&&copia)throw foraDoAr();
  const p=itens.find(x=>x.id===id&&(x.status==='ativo'||x.id===atual));
  if(!p)throw fail('Escolha um plano do guia.',422,'plano');
  return p;
}
