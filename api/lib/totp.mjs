import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// TOTP da RFC 6238 (contrato 4.4): HMAC-SHA-1, 6 dígitos, passos de 30 s, aceitando o passo anterior e o seguinte.
// O passo aceito volta para quem chama, que o guarda em users.totp_ultimo_passo: o mesmo código não entra duas vezes.
const ALFABETO='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits=0,valor=0,out='';
  for(const byte of buf){valor=(valor<<8)|byte;bits+=8;while(bits>=5){out+=ALFABETO[(valor>>>(bits-5))&31];bits-=5;}}
  if(bits>0)out+=ALFABETO[(valor<<(5-bits))&31];
  return out;
}
export function deBase32(texto) {
  const s=String(texto).toUpperCase().replace(/[\s=-]/g,'');let bits=0,valor=0;const out=[];
  for(const ch of s){const i=ALFABETO.indexOf(ch);if(i<0)throw new Error('Base32 inválido');valor=(valor<<5)|i;bits+=5;if(bits>=8){out.push((valor>>>(bits-8))&255);bits-=8;}}
  return Buffer.from(out);
}
// Segredo novo: 20 bytes, 32 caracteres em base32.
export const novoSegredo=()=>base32(randomBytes(20));
export const PASSO_MS=30000;
export const passoDe=now=>Math.floor(now.getTime()/PASSO_MS);
export function codigoDe(segredo,passo,digitos=6) {
  const contador=Buffer.alloc(8);contador.writeBigUInt64BE(BigInt(passo));
  const h=createHmac('sha1',deBase32(segredo)).update(contador).digest(),o=h[h.length-1]&15;
  return String((h.readUInt32BE(o)&0x7fffffff)%10**digitos).padStart(digitos,'0');
}
// O passo em que o código vale (o atual, o anterior ou o seguinte), ou null. Passos até "ultimo" já foram usados.
export function conferir(segredo,codigo,now,ultimo=null) {
  if(!/^\d{6}$/.test(String(codigo??'')))return null;
  const atual=passoDe(now);
  for(const passo of [atual,atual-1,atual+1]) {
    if(ultimo!=null&&passo<=Number(ultimo))continue;
    if(timingSafeEqual(Buffer.from(codigoDe(segredo,passo)),Buffer.from(String(codigo))))return passo;
  }
  return null;
}
// Link que abre o autenticador no celular e vai dentro do QR.
export const EMISSOR='Gestão Nexus';
export const otpauth=(segredo,conta,emissor=EMISSOR)=>`otpauth://totp/${encodeURIComponent(emissor)}:${encodeURIComponent(conta)}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=30`;
// A chave em grupos de 4, para digitar.
export const emGrupos=segredo=>segredo.match(/.{1,4}/g).join(' ');
