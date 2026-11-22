// Régua de lembretes (contrato 15.1): as etapas fixas antes do vencimento, em dias, com o nome que a tela mostra [P1].
// Ficam no código, sem tela para configurar (D3). A migração 009 repete a regra em SQL para os lembretes antigos.
export const ETAPAS=[
  {dias:30,nome:'30 dias antes'},
  {dias:15,nome:'15 dias antes'},
  {dias:7,nome:'7 dias antes'},
  {dias:1,nome:'1 dia antes'},
  {dias:0,nome:'No dia do vencimento'}
];
const INICIO=ETAPAS[0].dias;
// A etapa de quem está a d dias do vencimento: a mais próxima dele entre as que já começaram (a menor maior ou igual a d).
// Quem pulou etapas fica só na atual. Fora da régua (vencida ou a mais de 30 dias), null.
export const etapaDe=d=>d<0||d>INICIO?null:ETAPAS.reduce((e,x)=>x.dias>=d?x.dias:e,null);
// O modelo da mensagem de uma Renovacao: o da etapa, se a equipe Nexus escreveu um, ou o de cobrança (15.4).
export const modeloDaEtapa=(cx,etapa)=>etapa===null?cx.modelo:cx.modelosLembrete?.[etapa]||cx.modelo;
