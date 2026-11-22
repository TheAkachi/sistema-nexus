import { hoje, somarMeses } from '../lib/datas.mjs';
import { audit } from '../lib/auditoria.mjs';
import { foraDoAr } from '../integracao.mjs';

// Métricas do site para os Indicadores (contrato 9.5 e 6.17): a gestão lê uma vez por dia os totais de audiência e de
// contatos dos 12 meses dos Indicadores e guarda a cópia em site_metrics. Os Indicadores nunca chamam o site.
export const mesesIndicadores=now=>{const atual=hoje(now).slice(0,7);return Array.from({length:12},(_,i)=>somarMeses(`${atual}-01`,i-11).slice(0,7));};

// O que vem do site é conferido antes de ser guardado: números inteiros não negativos (ou null, sem medição) e textos curtos.
const num=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const txt=(v,max=120)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const dia=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
const canais=c=>c&&typeof c==='object'?{whatsapp:num(c.whatsapp)??0,telefone:num(c.telefone)??0,rota:num(c.rota)??0,site:num(c.site)??0}:null;
const mesVM=m=>({mes:txt(m?.mes,7),visitas:num(m?.visitas),contatos:canais(m?.contatos),...('buscas' in (m||{})?{buscas:num(m.buscas),buscasSemResultado:num(m.buscasSemResultado)}:{})});
const lista=(l,chave)=>(Array.isArray(l)?l:[]).slice(0,20).map(x=>({[chave]:txt(x?.[chave],100),vezes:num(x?.vezes)??0})).filter(x=>x[chave]);
// v0.9.2: a categoria vem com o nome que o guia mostra; de um site que ainda não manda o nome, ele repete o identificador.
export const comNome=l=>(Array.isArray(l)?l:[]).slice(0,20).map(x=>({categoria:txt(x?.categoria,100),nome:txt(x?.nome),vezes:num(x?.vezes)??0}))
  .filter(x=>x.categoria).map(x=>({...x,nome:x.nome||x.categoria}));
function limparResposta(r,itens) {
  const s=r.site||{};
  return {medidoDesde:{contatos:dia(r.medidoDesde?.contatos),buscas:dia(r.medidoDesde?.buscas)},
    site:{meses:(Array.isArray(s.meses)?s.meses:[]).map(mesVM),buscasMaisFeitas:lista(s.buscasMaisFeitas,'termo'),buscasSemResultado:lista(s.buscasSemResultado,'termo'),
      bairros:lista(s.bairros,'bairro'),categorias:comNome(s.categorias)},
    empresas:itens.filter(e=>typeof e?.id==='string').map(e=>({id:txt(e.id,120),nome:txt(e.nome),meses:(Array.isArray(e.meses)?e.meses:[]).map(mesVM),
      ultimos30:{visitas:num(e.ultimos30?.visitas)??0,contatos:canais(e.ultimos30?.contatos)||canais({})}})),
    banners:(Array.isArray(r.banners)?r.banners:[]).map(b=>({id:txt(b?.id,120),titulo:txt(b?.titulo),empresa:b?.empresa?.id?{id:txt(b.empresa.id,120),nome:txt(b.empresa.nome)}:null,
      impressoes:num(b?.impressoes)??0,cliques:num(b?.cliques)??0})).filter(b=>b.id)};
}

// Lê todas as páginas e guarda a cópia; se falha, a cópia anterior continua, com o erro e a hora da tentativa.
export async function lerMetricas(db,{site,now=new Date()}) {
  const meses=mesesIndicadores(now),de=meses[0],ate=meses[11];
  try {
    if(!site)throw foraDoAr();
    let primeira=null;const itens=[];
    for(let pagina=1;pagina<=200;pagina++) {
      const r=await site.metricas({de,ate,page:pagina});
      if(!r||typeof r!=='object'||!r.empresas||!Array.isArray(r.empresas.itens))throw Object.assign(new Error('Resposta inválida do guia.'),{status:502});
      primeira??=r;itens.push(...r.empresas.itens);
      if(pagina>=(Number(r.empresas.paginas)||1))break;
    }
    const dados=limparResposta(primeira,itens);
    await db.transaction(async tx=>{
      await tx.query(`INSERT INTO site_metrics(id,de,ate,dados,lido_em,erro,tentado_em) VALUES(1,$1,$2,$3,$4,'',$4)
        ON CONFLICT(id) DO UPDATE SET de=$1,ate=$2,dados=$3,lido_em=$4,erro='',tentado_em=$4`,[de,ate,JSON.stringify(dados),now.toISOString()]);
      await audit(tx,{action:'metricas_lidas',type:'metricas',resource:'1',after:{de,ate,empresas:dados.empresas.length}});
    });
    return {de,ate,empresas:dados.empresas.length,erro:''};
  } catch(e) {
    const erro=e.status===503?'O guia não respondeu.':e.status===502?e.message:'Falha ao ler as métricas.';
    await db.transaction(async tx=>{
      await tx.query(`INSERT INTO site_metrics(id,erro,tentado_em) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET erro=$1,tentado_em=$2`,[erro,now.toISOString()]);
      await audit(tx,{action:'metricas_lidas',type:'metricas',resource:'1',after:{de,ate,empresas:0,erro}});
    });
    return {de,ate,empresas:0,erro};
  }
}
