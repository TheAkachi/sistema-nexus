import { readFile } from 'node:fs/promises';

// Senha fácil de adivinhar (contrato 4.2): lista local de senhas vazadas comuns, um caractere só repetido (ou quase),
// sequência simples e a senha que contém o e-mail, "nexus" ou "gestao". Tudo comparado em minúsculas e sem acento.
const normal=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const COMUNS=new Set((await readFile(new URL('./senhas-comuns.txt',import.meta.url),'utf8')).split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')));
const SEQUENCIAS=['0123456789','abcdefghijklmnopqrstuvwxyz','qwertyuiopasdfghjklzxcvbnm','qwertyuiop','asdfghjkl','zxcvbnm'];
const emSequencia=s=>SEQUENCIAS.some(seq=>{const ida=seq.repeat(Math.ceil(s.length/seq.length)+1),volta=[...ida].reverse().join('');return ida.includes(s)||volta.includes(s);});
export function senhaFraca(senha,email='') {
  const s=normal(senha),alnum=s.replace(/[^a-z0-9]/g,'');
  if(COMUNS.has(s)||COMUNS.has(alnum))return true;
  if(new Set(s).size<4)return true;
  if(alnum.length>=s.length-1&&emSequencia(alnum))return true;
  const usuario=normal(String(email).split('@')[0]).replace(/[^a-z0-9]/g,'');
  return ['nexus','gestao',...(usuario.length>=4?[usuario]:[])].some(p=>alnum.includes(p));
}
