import { escape as e } from '../lib/html.mjs';

// Gráficos dos Indicadores (contrato 6.17), em SVG gerado no servidor: nenhuma biblioteca nem script de terceiros, por
// causa da CSP. O SVG não tem viewBox: as coordenadas são pixels, a largura vem em porcentagem e o texto nunca encolhe no
// celular. Só a linha da receita fica num SVG esticado na horizontal, com o traço sem escala (vector-effect).
// Todo gráfico é decorativo (aria-hidden): a tabela ao lado traz os mesmos números, para o leitor de tela e para o celular.
// Cada faixa leva no data-dica o texto que o indicadores.js mostra ao passar o mouse ou tocar.

const TOPO=10,ALTURA=170,EIXO_X=40,BASE=TOPO+ALTURA,TOTAL=BASE+EIXO_X;
const pct=n=>`${+(n*100).toFixed(4)}%`;
const px=n=>+n.toFixed(2);

// Reais curtos para o eixo: R$ 0, R$ 500, R$ 1,25 mil, R$ 12 mil, R$ 1,2 mi.
export function reaisCurto(centavos) {
  const r=Math.abs(Number(centavos)||0)/100,s=centavos<0?'-':'',f=(n,d)=>n.toLocaleString('pt-BR',{maximumFractionDigits:d});
  if(r>=1e6)return `${s}R$ ${f(r/1e6,2)} mi`;
  if(r>=1e3)return `${s}R$ ${f(r/1e3,2)} mil`;
  return `${s}R$ ${f(r,2)}`;
}

// Escala do eixo y: passos redondos (1, 2, 2,5 ou 5 × 10ⁿ), o zero sempre dentro e, nas contagens, só inteiros. Sem nenhum
// valor diferente de zero, a escala é só a linha do zero.
export function escala(valores,{inteiro=false}={}) {
  const min=Math.min(0,...valores),max=Math.max(0,...valores);
  if(min===max)return {de:0,ate:0,marcas:[0]};
  const bruto=(max-min)/4,p=10**Math.floor(Math.log10(bruto)),f=bruto/p;
  let passo=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;
  if(inteiro)passo=Math.max(1,Math.ceil(passo));
  const de=Math.floor(min/passo)*passo,ate=Math.ceil(max/passo)*passo,marcas=[];
  for(let v=de;v<=ate+passo/2;v+=passo)marcas.push(Math.round(v*1e6)/1e6);
  return {de,ate,marcas};
}
const yDe=(esc,v)=>esc.ate===esc.de?BASE:TOPO+(esc.ate-v)/(esc.ate-esc.de)*ALTURA;

// O eixo y fica num SVG próprio, à esquerda, da mesma altura do desenho: os rótulos ficam na altura exata das linhas.
function eixoY(esc,formato) {
  const rotulos=esc.marcas.map(formato),largura=Math.ceil(Math.max(...rotulos.map(r=>r.length))*7)+10;
  return `<svg class="eixo-y" width="${largura}" height="${TOTAL}" focusable="false">${esc.marcas.map((v,i)=>`<text x="${largura-8}" y="${px(yDe(esc,v)+4)}" text-anchor="end">${e(rotulos[i])}</text>`).join('')}</svg>`;
}
const grade=esc=>esc.marcas.map(v=>{const y=Math.round(yDe(esc,v))+.5;return `<line class="grade${v===0?' is-zero':''}" x1="0" x2="100%" y1="${y}" y2="${y}"/>`;}).join('');

// Rótulos do eixo x, uma ou duas linhas por faixa. Com alternar, no gráfico estreito só fica um sim, um não (sempre o último).
function rotulosX(itens,alternar) {
  const n=itens.length;
  return itens.map((it,i)=>{
    const [l1,l2]=[].concat(it.rotulo),x=pct((i+.5)/n),alt=alternar&&(n-1-i)%2===1;
    return `<text class="rotulo-x${alt?' is-alternado':''}" x="${x}" y="${BASE+17}" text-anchor="middle">${e(l1)}${l2?`<tspan x="${x}" dy="15">${e(l2)}</tspan>`:''}</text>`;
  }).join('');
}

// Coluna com a ponta arredondada (4 px) e a base reta, crescendo da linha do zero para cima ou para baixo.
function coluna(y0,y,cls,x,w) {
  const alt=Math.abs(y-y0);
  if(alt<1e-6)return '';
  const h=Math.max(alt,1),sobe=y<y0,topo=sobe?y0-h:y0,r=Math.min(4,h/2),reto=Math.min(h,4);
  return `<g class="${cls}"><rect x="${x}" width="${w}" y="${px(topo)}" height="${px(h)}" rx="${r}"/><rect x="${x}" width="${w}" y="${px(sobe?y0-reto:y0)}" height="${px(reto)}"/></g>`;
}

// Faixa de cada mês ou semana: o alvo do mouse (maior que a marca), com a dica e o fundo que acende ao passar.
function faixa(i,n,it,conteudo) {
  const d=it.dica||{};
  return `<svg class="banda${it.parcial?' is-parcial':''}${it.inicio?' is-inicio':''}${it.valor===null?' is-sem':''}" x="${pct(i/n)}" width="${pct(1/n)}" height="${BASE}" data-dica="${e(d.titulo)}" data-dica-valor="${e(d.valor)}" data-dica-nota="${e(d.nota||'')}"><rect class="banda-fundo" width="100%" height="${BASE}"/>${conteudo}</svg>`;
}

// Sem nenhum valor diferente de zero, o desenho diz isso no meio, em vez de mostrar só a linha do zero.
const grafico=(esc,formato,desenho,cls='',vazio='Nenhum valor neste período')=>`<div class="grafico${cls}">${eixoY(esc,formato)}<svg class="grafico-plot" width="100%" height="${TOTAL}" focusable="false">${esc.marcas.length===1?`<text class="grafico-vazio" x="50%" y="${TOPO+ALTURA/2}" text-anchor="middle">${vazio}</text>`:''}${desenho}</svg></div>`;

// Colunas de uma série. itens: [{rotulo: texto ou [linha1, linha2], valor, parcial?, inicio?, dica: {titulo, valor, nota?}}].
// parcial: o mês aberto, no tom claro; inicio: o mês medido só em parte, no tom do meio.
// largura: a parte da faixa que a coluna ocupa. valor null é o mês sem medição: no lugar da coluna, uma faixa cinza clara
// da altura do desenho, para nunca parecer zero.
export function colunas(itens,{formato,inteiro=false,largura=.5,alternar=false}={}) {
  const medidos=itens.map(i=>i.valor).filter(v=>v!==null&&v!==undefined);
  const esc=escala(medidos,{inteiro}),n=itens.length,y0=yDe(esc,0),x=pct((1-largura)/2),w=pct(largura);
  const faixas=itens.map((it,i)=>faixa(i,n,it,it.valor===null?`<rect class="barra-sem" x="${x}" width="${w}" y="${TOPO}" height="${ALTURA}" rx="4"/>`:coluna(y0,yDe(esc,it.valor),'barra-a',x,w))).join('');
  return grafico(esc,formato,`${grade(esc)}${faixas}${rotulosX(itens,alternar)}`,'',medidos.length?'Nenhum valor neste período':'Sem medição neste período');
}

// Duas séries opostas na mesma faixa: a de cima (a) e a de baixo (b), como as novas e as canceladas. O eixo mostra as
// contagens sem sinal; a legenda diz qual fica de que lado.
export function opostas(itens,{formato,largura=.5,alternar=false}={}) {
  const esc=escala([...itens.map(i=>i.a),...itens.map(i=>-i.b)],{inteiro:true}),n=itens.length,y0=yDe(esc,0),x=pct((1-largura)/2),w=pct(largura);
  const faixas=itens.map((it,i)=>faixa(i,n,it,`${coluna(y0,yDe(esc,it.a),'barra-a',x,w)}${coluna(y0,yDe(esc,-it.b),'barra-b',x,w)}`)).join('');
  return grafico(esc,v=>formato(Math.abs(v)),`${grade(esc)}${faixas}${rotulosX(itens,alternar)}`);
}

// Linha com a área clara embaixo e o ponto do fim. A linha e a área ficam num SVG esticado (viewBox de 100 por faixa); as
// faixas vêm por cima, transparentes, com a guia e o ponto de cada mês ao passar o mouse.
export function linha(itens,{formato,alternar=false}={}) {
  const esc=escala(itens.map(i=>i.valor)),n=itens.length,y0=px(yDe(esc,0)),ys=itens.map(it=>px(yDe(esc,it.valor)));
  const caminho=ys.map((y,i)=>`${i?'L':'M'}${i*100+50} ${y}`).join('');
  const esticado=`<svg width="100%" height="${BASE}" viewBox="0 0 ${n*100} ${BASE}" preserveAspectRatio="none" focusable="false"><path class="area-a" d="${caminho}L${n*100-50} ${y0}L50 ${y0}Z"/><path class="linha-a" d="${caminho}" vector-effect="non-scaling-stroke"/></svg>`;
  const fim=n?`<circle class="ponto-a" cx="${pct((n-.5)/n)}" cy="${ys[n-1]}" r="4"/>`:'';
  const faixas=itens.map((it,i)=>faixa(i,n,it,`<line class="banda-guia" x1="50%" x2="50%" y1="${TOPO}" y2="${BASE}"/><circle class="banda-ponto" cx="50%" cy="${ys[i]}" r="4"/>`)).join('');
  return grafico(esc,formato,`${grade(esc)}${esticado}${fim}${faixas}${rotulosX(itens,alternar)}`,' is-linha');
}

// Barra horizontal dentro da tabela (inadimplência e planos): a largura é a parte do maior valor, com a base reta à
// esquerda e a ponta arredondada à direita.
export function barraHorizontal(parte) {
  const w=Math.max(0,Math.min(1,Number(parte)||0));
  return `<svg class="barra-h" width="100%" height="10" aria-hidden="true" focusable="false">${w?`<svg width="${pct(w)}" height="10"><rect width="100%" height="10" rx="4"/><rect width="50%" height="10"/></svg>`:''}</svg>`;
}
