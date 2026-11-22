import { fail } from '../lib/erros.mjs';

// Convenções das APIs (contrato 2.2 e 2.3), copiadas do admin do site (api/data/admin/comum.mjs): campo desconhecido
// recusado, versão em toda alteração, texto com limite e listas de 20.
export const POR_PAGINA=20;
export const rejectExtra=(p,keys)=>{const extra=Object.keys(p||{}).find(k=>!keys.includes(k));if(extra)throw fail('Campo não permitido.',422,extra);};
export const needVersion=p=>{if(!Number.isInteger(p?.version)||p.version<1)throw fail('Informe a versão que você abriu.',422,'version');return p.version;};
export const conflito=()=>fail('Esta informação mudou desde que você abriu. Recarregue.',409);
export function texto(v,campo,max,{obrigatorio=false,min=0}={}) {
  if(v===undefined&&!obrigatorio)return undefined;
  if(v===null&&!obrigatorio)return '';
  if(typeof v!=='string')throw fail('Valor inválido.',422,campo);
  const t=v.trim().replace(/\s+/g,' ');
  if(t.length>max)throw fail(`Use até ${max} caracteres.`,422,campo);
  if((obrigatorio||min)&&t.length<Math.max(1,min))throw fail(min>1?`Use pelo menos ${min} caracteres.`:'Preencha este campo.',422,campo);
  return t;
}
export const iso=d=>d?new Date(d).toISOString():null;

// Listas: ?page= a partir de 1, 20 por página; a página além da última vem vazia (2.2).
export function pagina(url) {
  const p=parseInt(url?.searchParams?.get('page')||'1',10);
  return Number.isInteger(p)&&p>=1&&p<=10000?p:1;
}
export const filtro=(url,k)=>(url?.searchParams?.get(k)||'').trim().slice(0,100);
export function lista(itens,url) {
  const p=pagina(url),total=itens.length;
  return {itens:itens.slice((p-1)*POR_PAGINA,p*POR_PAGINA),total,pagina:p,paginas:Math.max(1,Math.ceil(total/POR_PAGINA))};
}
// Busca de texto sem acento nem caixa, nos campos dados.
export const normalize=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export const casa=(q,...campos)=>!q||campos.some(c=>normalize(String(c??'')).includes(normalize(q)));
// Ordem alfabética pt-BR (acentos não empurram "Álvaro" para o fim).
export const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
