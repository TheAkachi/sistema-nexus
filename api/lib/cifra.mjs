import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Segredos guardados cifrados no banco, como o do 2FA (contrato 4.4): AES-256-GCM com a TOTP_KEY do .env. O contexto (o id
// da conta) entra como dado autenticado: o segredo cifrado de uma conta não abre se for copiado para outra.
// Formato: v1.<iv>.<tag>.<dados>, em base64url.
export function chaveDe(hex) {
  if(!/^[0-9a-f]{64}$/i.test(hex||''))throw new Error('TOTP_KEY deve ter 32 bytes em hex (64 caracteres).');
  return Buffer.from(hex,'hex');
}
// Fora de produção, sem TOTP_KEY, vale esta chave fixa: o 2FA local não se perde a cada reinício (contrato 11).
const DESENVOLVIMENTO='67657374616f2d6e657875732d646573656e766f6c76696d656e746f2d303031';
const ehLocal=o=>!o||/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(o);
export function chaveDoAmbiente(env=process.env,avisar=console.warn) {
  if(env.TOTP_KEY)return chaveDe(env.TOTP_KEY);
  const exigeChave=env.NODE_ENV==='production'||(Boolean(env.DATABASE_URL)&&env.NODE_ENV!=='test')||!ehLocal(env.PUBLIC_ORIGIN);
  if(exigeChave)throw new Error('Produção exige TOTP_KEY (32 bytes em hex).');
  avisar('TOTP_KEY ausente: usando a chave fixa de desenvolvimento. Nunca use assim em produção.');
  return chaveDe(DESENVOLVIMENTO);
}
export function cifrar(chave,texto,contexto) {
  const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',chave,iv);c.setAAD(Buffer.from(String(contexto)));
  const dados=Buffer.concat([c.update(String(texto),'utf8'),c.final()]);
  return ['v1',iv.toString('base64url'),c.getAuthTag().toString('base64url'),dados.toString('base64url')].join('.');
}
export function decifrar(chave,valor,contexto) {
  const [v,iv,tag,dados]=String(valor||'').split('.');
  if(v!=='v1'||!iv||!tag||!dados)throw new Error('Segredo cifrado inválido');
  const d=createDecipheriv('aes-256-gcm',chave,Buffer.from(iv,'base64url'));d.setAAD(Buffer.from(String(contexto)));d.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([d.update(Buffer.from(dados,'base64url')),d.final()]).toString('utf8');
}
