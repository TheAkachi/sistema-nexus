import { hoje, somarMeses } from '../lib/datas.mjs';
import { iso } from './comum.mjs';

// Desempenho por anunciante (contrato 6.7 e 7.3, v0.10.0): as visitas e os contatos de cada empresa no guia, mês a mês, da
// cópia das métricas do site (9.5). Nada é estimado: o mês sem medição vem null, e a frase da mensagem só sai de um mês
// medido inteiro, que já tinha acabado quando a cópia foi lida.
const COMO='Visitas e contatos no guia dos visitantes que aceitaram a medição no site, da cópia das métricas lida uma vez por dia. Mês sem medição aparece em branco; o mês que os números não cobrem inteiro aparece como parcial.';
const NOMES_MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
// O mês por extenso, como "setembro de 2026" (o botão e a mensagem do relatório do mês, v0.11.0).
export const rotuloMes=mes=>`${NOMES_MES[+mes.slice(5,7)-1]} de ${mes.slice(0,4)}`;
const totalContatos=c=>c?c.whatsapp+c.telefone+c.rota+c.site:null;
// Os n meses até o do dia, do mais antigo ao do dia.
export const mesesAte=(dia,n)=>Array.from({length:n},(_,i)=>somarMeses(`${dia.slice(0,7)}-01`,i-n+1).slice(0,7));

// Só as empresas pedidas saem do JSON da cópia, no próprio banco. Sem cópia lida, null.
async function copia(db,ids) {
  const r=(await db.query(`SELECT lido_em,dados->'medidoDesde'->>'contatos' AS medido,
    (SELECT COALESCE(jsonb_agg(e),'[]'::jsonb) FROM jsonb_array_elements(dados->'empresas') e WHERE e->>'id'=ANY($1::text[])) AS empresas
    FROM site_metrics WHERE id=1 AND dados IS NOT NULL`,[ids])).rows[0];
  if(!r)return null;
  return {lidoEm:r.lido_em,mesLeitura:hoje(new Date(r.lido_em)).slice(0,7),medidoDesde:r.medido||null,porId:new Map(r.empresas.map(e=>[e.id,e]))};
}

// Parcial é o mês que os números não cobrem inteiro: o da leitura e os seguintes (ainda não tinham acabado) e o mês em que
// a medição começou depois do dia 1º. Sem cópia, só o atual é parcial.
const parcialDe=(mes,c,atual)=>c?mes>=c.mesLeitura||(c.medidoDesde?.slice(0,7)===mes&&c.medidoDesde.slice(8)!=='01'):mes===atual;
function mesVM(mes,e,c,atual) {
  const m=(e?.meses||[]).find(x=>x.mes===mes),contatos=m?.contatos??null;
  return {mes,visitas:m?.visitas??null,contatos,contatosTotal:totalContatos(contatos),parcial:parcialDe(mes,c,atual)};
}

// Ficha (6.7): uma linha por empresa vinculada ({id, nome} da ficha), com os 6 meses até o atual.
export async function desempenhoDaFicha(db,empresas,{hoje:dia}) {
  const meses=mesesAte(dia,6),c=await copia(db,empresas.map(e=>e.id));
  return {como:COMO,disponivel:Boolean(c),lidaEm:iso(c?.lidoEm),medidoDesde:c?.medidoDesde??null,meses,
    empresas:empresas.map(x=>{
      const e=c?.porId.get(x.id),lista=meses.map(mes=>mesVM(mes,e,c,meses[5]));
      return {id:x.id,nome:x.nome||e?.nome||x.id,naCopia:Boolean(e),atual:lista[5],anterior:lista[4],meses:lista};
    })};
}

// A frase do {desempenho} (7.3): vazia sem medição, com o mês parcial ou sem visitas.
const milhar=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const qtd=(n,um,varios)=>`${milhar(n)} ${n===1?um:varios}`;
export function frase(m) {
  if(!m||m.parcial||!m.visitas)return '';
  const zap=m.contatos?.whatsapp||0;
  return `Seu anúncio teve ${qtd(m.visitas,'visita','visitas')}${zap?` e ${qtd(zap,'contato','contatos')} pelo WhatsApp`:''} em ${NOMES_MES[+m.mes.slice(5,7)-1]}.`;
}
// As frases do mês anterior de cada empresa, numa leitura só da cópia.
export async function frasesDoMesAnterior(db,ids,{hoje:dia}) {
  const unicos=[...new Set(ids.filter(Boolean))];if(!unicos.length)return new Map();
  const c=await copia(db,unicos),anterior=mesesAte(dia,2)[0];
  return new Map(unicos.map(id=>[id,c?frase(mesVM(anterior,c.porId.get(id),c,null)):'']));
}
