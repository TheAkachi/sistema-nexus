import { escape as e } from '../lib/html.mjs';
import { numero, plural, dia, tempo, numeroResumo, vazio } from './componentes.mjs';
import { colunas } from './graficos.mjs';
import { mesNome, mesAno, ano, rotuloMes, tabela, desenho, ouSem, canais, medido, comApoio } from './indicadores.mjs';

// Desempenho no guia de cada empresa vinculada (contrato 6.7, v0.10.0), da cópia das métricas do site: o mês anterior e o
// atual em números e as colunas dos 6 meses, como na Audiência dos Indicadores, com a tabela dos mesmos números. O mês sem
// medição fica em branco ("sem medição"), nunca zero, e o mês parcial vem marcado.
const maiuscula=t=>t?t[0].toUpperCase()+t.slice(1):t;
const ddmm=d=>dia(d).slice(0,5);
const MES_SP=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'});
const mesDaLeitura=iso=>{const d=new Date(iso||'');return iso&&!Number.isNaN(d.getTime())?MES_SP.format(d).slice(0,7):'';};

// O parcial de 6.7 junta dois casos, e a tela separa: o mês em que a medição começou depois do dia 1º (o mês do medidoDesde,
// "desde 14/07") e o mês ainda aberto na leitura (o da leitura e os seguintes, "até a leitura"). Um mês pode ter os dois.
function parcialDe(x,d) {
  if(!x?.parcial)return {inicio:false,aberto:false};
  const desde=d.medidoDesde||'',inicio=!!desde&&desde.slice(8,10)!=='01'&&x.mes===desde.slice(0,7);
  const leitura=mesDaLeitura(d.lidaEm),aberto=!inicio||(!!leitura&&x.mes>=leitura);
  return {inicio,aberto};
}
// "desde" e a data não se separam na quebra de linha (o espaço fixo), nem no cartão estreito do celular.
const sufixo=(x,d)=>{const {inicio,aberto}=parcialDe(x,d);return [inicio&&`desde ${ddmm(d.medidoDesde)}`,aberto&&'até a leitura'].filter(Boolean).join(', ');};
const comSufixo=(texto,x,d)=>{const s=sufixo(x,d);return s?`${texto}, ${s}`:texto;};

const celula=(x,d)=>{const s=sufixo(x,d);return `<th scope="row"><span aria-hidden="true">${mesNome(x.mes).slice(0,3)}.<span class="mes-ano"> ${ano(x.mes)}</span></span><span class="sr-only">${mesAno(x.mes)}</span>${s?`<span class="linha-apoio">${s}</span>`:''}</th>`;};
const mesEmNumero=(x,d)=>x?numeroResumo({rotulo:maiuscula(comSufixo(mesNome(x.mes),x,d)),valor:medido(x.visitas)?plural(x.visitas,'visita','visitas'):'Sem medição',
  nota:medido(x.contatosTotal)?`${plural(x.contatosTotal,'contato','contatos')}: ${canais(x.contatos)}`:'Contatos sem medição'}):'';

function empresa(m,i,d) {
  const id=`desempenho-${i}`,titulo=`<h3 id="${id}">${e(m.nome)}</h3>`;
  if(!m.naCopia)return `<section class="indicador desempenho-empresa" aria-labelledby="${id}">${titulo}<p class="lista-vazia">O site não mandou números desta empresa: ele só mede as empresas publicadas no guia.</p></section>`;
  const meses=m.meses||[],partes=meses.map(x=>parcialDe(x,d)),semMedicao=meses.some(x=>!medido(x.visitas));
  // O mês aberto fica no tom mais claro; o medido só em parte, num tom do meio. Com os dois motivos, vale o aberto.
  const svg=colunas(meses.map((x,j)=>({rotulo:rotuloMes(x.mes,j),valor:medido(x.visitas)?x.visitas:null,parcial:partes[j].aberto,inicio:partes[j].inicio&&!partes[j].aberto,
    dica:{titulo:comSufixo(mesAno(x.mes),x,d),valor:medido(x.visitas)?plural(x.visitas,'visita','visitas'):'Sem medição',nota:medido(x.contatosTotal)?plural(x.contatosTotal,'contato','contatos'):''}})),{formato:numero,inteiro:true,largura:.4});
  const chaves=[['is-a','Mês inteiro'],...partes.some(p=>p.inicio&&!p.aberto)?[['is-a-media','Mês medido só em parte']]:[],...partes.some(p=>p.aberto)?[['is-a-clara','Mês ainda aberto na leitura']]:[],...semMedicao?[['is-sem','Sem medição']]:[]];
  const linhas=meses.map(x=>`<tr>${celula(x,d)}<td class="num">${ouSem(x.visitas)}</td><td class="num">${medido(x.contatosTotal)?comApoio(numero(x.contatosTotal),canais(x.contatos)):ouSem(null)}</td></tr>`);
  return `<section class="indicador is-largo desempenho-empresa" aria-labelledby="${id}">${titulo}<div class="numeros desempenho-numeros">${mesEmNumero(m.anterior,d)}${mesEmNumero(m.atual,d)}</div><div class="indicador-corpo">${desenho(svg,{chaves})}${tabela(`Visitas e contatos de ${e(m.nome)} no guia em cada mês`,['Mês','Visitas','Contatos'],linhas)}</div></section>`;
}

export function blocoDesempenho(d) {
  const empresas=d?.empresas||[];
  if(!empresas.length)return '';
  const cabeca=`<div class="bloco-cabeca"><h2 id="ficha-desempenho">Desempenho no guia</h2>${d.lidaEm?`<p>Lido em ${tempo(d.lidaEm)}.</p>`:''}</div>`;
  if(!d.disponivel)return `<section class="bloco desempenho" aria-labelledby="ficha-desempenho">${cabeca}${vazio('Ainda sem as métricas do guia','A gestão lê as métricas do site uma vez por dia, às 05:00. Depois da primeira leitura, as visitas e os contatos de cada empresa aparecem aqui.')}</section>`;
  const desde=d.medidoDesde?` O site mede as visitas e os contatos desde ${dia(d.medidoDesde)}.`:'';
  return `<section class="bloco desempenho" aria-labelledby="ficha-desempenho">${cabeca}<p class="indicador-como">${e(d.como||'')}${desde}</p>${empresas.map((m,i)=>empresa(m,i,d)).join('')}</section>`;
}
