// Dias no fuso de São Paulo, vencimentos e a situação da assinatura (contrato 5.3 e 5.4). Os dias andam como texto
// aaaa-mm-dd do começo ao fim: nada de Date local no meio, para o fuso do servidor não mudar a data.
const ZONA='America/Sao_Paulo';
const pad=n=>String(n).padStart(2,'0');
export function hoje(now=new Date()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONA,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const utc=dia=>Date.UTC(+dia.slice(0,4),+dia.slice(5,7)-1,+dia.slice(8,10));
// Dia válido no calendário (29/02 só nos anos bissextos).
export const diaValido=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(utc(v)).toISOString().slice(0,10)===v;
// Quantos dias de "de" até "ate" (negativo quando "ate" vem antes).
export const dias=(de,ate)=>Math.round((utc(ate)-utc(de))/86400000);
export const ultimoDia=(ano,mes)=>new Date(Date.UTC(ano,mes,0)).getUTCDate();
// Soma (ou subtrai) meses mantendo o dia base; no mês sem esse dia, vale o último dia do mês (31/01 → 28/02 → 31/03).
export function somarMeses(dia,meses,diaBase=+dia.slice(8,10)) {
  const total=+dia.slice(0,4)*12+(+dia.slice(5,7)-1)+meses,ano=Math.floor(total/12),mes=total-ano*12+1;
  return `${ano}-${pad(mes)}-${pad(Math.min(diaBase,ultimoDia(ano,mes)))}`;
}
export const MESES={mensal:1,trimestral:3,semestral:6,anual:12};
export const CICLOS=Object.keys(MESES);
export function situacao({status,venceEm},hojeDia,tolerancia) {
  if(status!=='ativa')return status;
  const d=dias(hojeDia,venceEm);
  return d>30?'em-dia':d>=0?'a-vencer':d>=-tolerancia?'vencida':'inadimplente';
}
// Da pior para a melhor (6.6): a situação do cliente é a pior entre as assinaturas dele.
export const SITUACOES=['inadimplente','vencida','a-vencer','em-dia','suspensa','cancelada'];
