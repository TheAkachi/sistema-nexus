// Mensagens no WhatsApp (contrato 6.14 e 7.3), a de cobrança e a do relatório do mês: o modelo das configurações com as
// variáveis trocadas, o valor em pt-BR com espaço comum (o Intl usa espaço não separável, que o WhatsApp mostra diferente)
// e o link wa.me já montado.
export const VARIAVEIS=[
  {chave:'responsavel',descricao:'Responsável pelo cliente (ou o nome do cliente, se não houver)',exemplo:'Marina Souza'},
  {chave:'cliente',descricao:'Nome do cliente',exemplo:'Clínica Vida Plena'},
  {chave:'empresa',descricao:'Empresa do guia (ou o nome do cliente, se não houver)',exemplo:'Clínica Vida Plena · Centro'},
  {chave:'plano',descricao:'Nome do plano',exemplo:'Premium'},
  {chave:'valor',descricao:'Valor de um ciclo',exemplo:'R$ 99,00'},
  {chave:'vencimento',descricao:'Data do vencimento',exemplo:'15/10/2026'},
  {chave:'prazo',descricao:'"vence em…", "vence hoje" ou "venceu em…"',exemplo:'venceu em 15/10/2026'},
  {chave:'chave_pix',descricao:'Chave Pix das Configurações',exemplo:'pix@exemplo.test'},
  {chave:'desempenho',descricao:'Visitas e contatos pelo WhatsApp do mês anterior no guia (fica vazia sem medição ou sem visitas)',exemplo:'Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro.'}
];
// v0.11.0: as variáveis do modelo da mensagem do relatório do mês (6.14 e 7.3).
export const VARIAVEIS_RELATORIO=[
  VARIAVEIS[0],VARIAVEIS[1],
  {chave:'empresa',descricao:'Empresa do guia do relatório',exemplo:'Clínica Vida Plena · Centro'},
  {chave:'mes',descricao:'Mês do relatório',exemplo:'setembro de 2026'},
  {chave:'desempenho',descricao:'Visitas e contatos pelo WhatsApp no mês do relatório (fica vazia sem medição ou sem visitas)',exemplo:'Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro.'},
  {chave:'link',descricao:'Endereço do relatório no painel do site (pede login)',exemplo:'https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09'}
];
const CHAVES=new Set([...VARIAVEIS,...VARIAVEIS_RELATORIO].map(v=>v.chave));
export function reais(centavos) {
  const [inteiro,decimal]=(Math.abs(centavos)/100).toFixed(2).split('.');
  return `${centavos<0?'-':''}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g,'.')},${decimal}`;
}
export const dataBR=dia=>`${dia.slice(8,10)}/${dia.slice(5,7)}/${dia.slice(0,4)}`;
export const prazo=(venceEm,dias)=>dias>0?`vence em ${dataBR(venceEm)}`:dias===0?'vence hoje':`venceu em ${dataBR(venceEm)}`;
// O que está entre chaves e não é variável fica como está. O {desempenho} vazio sai com o espaço antes dele (ou, sem
// espaço antes, com o de depois), para a mensagem não ficar com dois espaços seguidos.
export const preencher=(modelo,valores)=>(valores.desempenho===''?modelo.replace(/ \{desempenho\}|\{desempenho\} ?/g,''):modelo)
  .replace(/\{(\w+)\}/g,(m,k)=>CHAVES.has(k)&&k in valores?String(valores[k]??''):m);
// As variáveis do modelo que não estão na lista dele (a da cobrança, ou a do relatório).
export const desconhecidas=(modelo,lista=VARIAVEIS)=>{
  const aceitas=new Set(lista.map(v=>v.chave));
  return [...new Set([...String(modelo).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(k=>!aceitas.has(k)))];
};
export const linkWhatsapp=(numero,texto)=>`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
// Os valores de uma assinatura (a linha do banco com o cliente e a empresa) para o modelo. desempenho é a frase pronta do
// mês anterior (data/desempenho.mjs), ou vazia.
export function valoresDe(s,{dias,chavePix,desempenho}) {
  return {responsavel:s.cliente_responsavel||s.cliente_nome,cliente:s.cliente_nome,empresa:s.nome_cache||s.cliente_nome,plano:s.plano_site?s.plano_nome:'',
    valor:reais(s.valor_centavos),vencimento:dataBR(s.vence_em),prazo:prazo(s.vence_em,dias),chave_pix:chavePix||'',desempenho:desempenho||''};
}
