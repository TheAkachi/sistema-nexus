import { fail } from './erros.mjs';

// Leitura de CSV (contrato 8.1): UTF-8 (com ou sem BOM) ou Windows-1252, separador detectado no cabeçalho (; , ou tab) e
// aspas no padrão do CSV ("" é uma aspa; a quebra de linha entre aspas é da célula). A primeira linha é o cabeçalho.
export function decodificar(buf) {
  if(buf.includes(0))throw fail('Envie um arquivo CSV (texto).',415,'arquivo');
  try {return {texto:new TextDecoder('utf-8',{fatal:true}).decode(buf).replace(/^﻿/,''),codificacao:'utf-8'};}
  catch {return {texto:new TextDecoder('windows-1252').decode(buf),codificacao:'windows-1252'};}
}
const SEPARADORES={';':';',',':',','\t':'tab'};
export function separadorDe(texto) {
  const contagem={';':0,',':0,'\t':0};let aspas=false;
  for(const ch of texto) {
    if(ch==='"')aspas=!aspas;
    else if(!aspas&&(ch==='\n'||ch==='\r'))break;
    else if(!aspas&&ch in contagem)contagem[ch]++;
  }
  const [sep,n]=Object.entries(contagem).sort((a,b)=>b[1]-a[1])[0];
  return n?sep:',';
}
// Linhas do arquivo em listas de células, já sem as linhas vazias.
export function linhasDe(texto,sep) {
  const linhas=[];let celula='',linha=[],aspas=false;
  for(let i=0;i<texto.length;i++) {
    const ch=texto[i];
    if(aspas) {
      if(ch==='"'&&texto[i+1]==='"'){celula+='"';i++;}
      else if(ch==='"')aspas=false;
      else celula+=ch;
    } else if(ch==='"')aspas=true;
    else if(ch===sep){linha.push(celula);celula='';}
    else if(ch==='\n'||ch==='\r') {
      if(ch==='\r'&&texto[i+1]==='\n')i++;
      linha.push(celula);linhas.push(linha);linha=[];celula='';
    } else celula+=ch;
  }
  if(celula!==''||linha.length){linha.push(celula);linhas.push(linha);}
  return linhas.filter(l=>l.some(c=>c.trim()!==''));
}
export function lerCsv(buf) {
  const {texto,codificacao}=decodificar(buf),sep=separadorDe(texto);
  const [cabecalho=[],...dados]=linhasDe(texto,sep);
  return {cabecalho:cabecalho.map(c=>c.trim()),dados,separador:SEPARADORES[sep],codificacao};
}
// Nome de coluna comparável: sem acento, sem caixa, sem pontuação e sem espaço (E-mail = email, Listing DB ID = listingdbid).
export const nomeColuna=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
// Nome de empresa comparável: igual, mas com as palavras separadas por um espaço ("Clínica Vida Plena · Centro").
export const nomeEmpresa=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
