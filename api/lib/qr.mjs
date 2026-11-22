import { encode } from 'uqr';

// QR do 2FA em SVG (contrato 6.2). Do uqr vem só a matriz; o SVG é desenhado aqui, só com <svg>, <rect> e <path>, sem
// nenhum texto, com 4 módulos de margem (a "zona quieta" que os leitores pedem). Cada trecho de módulos escuros seguidos
// numa linha vira um retângulo.
export function qrSvg(texto,{margem=4}={}) {
  const {data,size}=encode(texto,{ecc:'M',border:0}),lado=size+margem*2;
  let d='';
  data.forEach((linha,y)=>{
    for(let x=0;x<size;x++) {
      if(!linha[x])continue;
      let fim=x;while(fim+1<size&&linha[fim+1])fim++;
      d+=`M${x+margem} ${y+margem}h${fim-x+1}v1h-${fim-x+1}z`;x=fim;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" aria-label="QR code do autenticador"><rect width="${lado}" height="${lado}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}
