import { randomBytes, randomUUID, createHash, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from './lib/erros.mjs';

// Senha, sessão, CSRF, limites de tentativa e reautenticação (contrato, seção 4). Copiado de api/auth.mjs do site, com as
// mudanças da Parte B do briefing de segurança: cookie SameSite=Strict, sessão mais curta e só para conta com 2FA ativo.
// O fluxo de login em duas etapas (senha e código) chega com o módulo de login.
const scrypt=promisify(rawScrypt);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export const COOKIE='gestao_sessao';
// Provisório até o docs/SEGURANCA.md (contrato 4.3): 30 min sem uso, 8 h no total, reautenticação vale 5 min.
export const INATIVIDADE_MS=30*60000,DURACAO_MS=8*3600000,CONFIRMACAO_MS=5*60000;
export const validEmail=v=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const validPassword=v=>typeof v==='string'&&v.length>=12&&v.length<=128;
export const isDemoEmail=v=>typeof v==='string'&&/@nexus\.demo$/i.test(v.trim());
export const DEMO_PROTECTED_MSG='Esta conta é protegida no ambiente de demonstração e não pode ser alterada ou desativada.';
export const demoAtivo=(env=process.env)=>env.DEMO_MODE==='1'||env.NODE_ENV!=='production';

// Senha com scrypt; os parâmetros ficam no próprio hash: scrypt$N$r$p$sal$chave (base64url).
const PARAMS={N:32768,r:8,p:1};
const derive=(password,salt,{N,r,p})=>scrypt(password,salt,64,{N,r,p,maxmem:256*N*r});
export async function hashPassword(password,params=PARAMS) {
  if(!validPassword(password))throw fail('A senha precisa ter de 12 a 128 caracteres.',422,'senha');
  const salt=randomBytes(16),key=await derive(password,salt,params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
function parseHash(stored) {
  const m=/^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/.exec(stored||'');
  return m?{params:{N:+m[1],r:+m[2],p:+m[3]},salt:Buffer.from(m[4],'base64url'),key:Buffer.from(m[5],'base64url'),current:+m[1]===PARAMS.N&&+m[2]===PARAMS.r&&+m[3]===PARAMS.p}:null;
}
// Hash de referência para conta inexistente ou sem senha: o tempo de resposta não revela se a conta existe.
export const DUMMY=`scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;
export async function verifyPassword(password,stored) {
  if(typeof password!=='string'||password.length>128)return {ok:false};
  const h=parseHash(stored);
  const key=await derive(password,h?.salt??Buffer.alloc(16),h?.params??PARAMS);
  const ok=Boolean(h)&&key.length===h.key.length&&timingSafeEqual(key,h.key);
  return {ok,rehash:ok&&!h.current};
}
export const hasPassword=user=>Boolean(parseHash(user.password_hash));
export const sameSecret=(a,b)=>{const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);};

// Limite por chave (IP real, conta ou sessão) numa janela; guarda só o hash da chave.
export async function hit(db,key,windowMs,now=new Date()) {
  await db.query('DELETE FROM rate_limits WHERE reset_at<$1',[now.toISOString()]);
  return (await db.query('INSERT INTO rate_limits(key_hash,count,reset_at) VALUES($1,1,$2) ON CONFLICT(key_hash) DO UPDATE SET count=rate_limits.count+1 RETURNING count',[digest(key),new Date(now.getTime()+windowMs).toISOString()])).rows[0].count;
}
export const peek=async(db,key,now=new Date())=>(await db.query('SELECT count FROM rate_limits WHERE key_hash=$1 AND reset_at>=$2',[digest(key),now.toISOString()])).rows[0]?.count||0;
export const clear=(db,key)=>db.query('DELETE FROM rate_limits WHERE key_hash=$1',[digest(key)]);
export async function limit(db,key,max,windowMs,now) {if(await hit(db,key,windowMs,now)>max)throw fail('Muitas tentativas. Tente de novo em alguns minutos.',429);}

// Sessão nova (só depois da senha e do código do 2FA). Limpa as vencidas.
export async function newSession(db,userId,{userAgent='',now=new Date()}={}) {
  const value=token(),csrf=token(),id=randomUUID();
  await db.query('DELETE FROM sessions WHERE expires_at<=$1 OR last_seen_at<=$2',[now.toISOString(),new Date(now.getTime()-INATIVIDADE_MS).toISOString()]);
  await db.query('INSERT INTO sessions(token_hash,id,user_id,csrf,created_at,last_seen_at,expires_at,confirmed_at,user_agent) VALUES($1,$2,$3,$4,$5,$5,$6,$5,$7)',
    [digest(value),id,userId,csrf,now.toISOString(),new Date(now.getTime()+DURACAO_MS).toISOString(),String(userAgent).slice(0,160)]);
  return {value,csrf,id};
}
export function cookieValue(header='',name=COOKIE) {
  const value=String(header).split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1);
  return value&&/^[a-f0-9]{64}$/.test(value)?value:null;
}
// Sessão válida: dentro das 8 h, usada nos últimos 30 min, de conta ativa e com 2FA ativo. Renova o último uso a cada minuto.
export async function sessionFor(db,header,now=new Date()) {
  const value=cookieValue(header);if(!value)return null;
  const row=(await db.query(`SELECT s.id,s.user_id,s.csrf,s.token_hash,s.last_seen_at,s.confirmed_at,u.email,u.nome,u.papel
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>$2 AND s.last_seen_at>$3 AND u.desativado=false AND u.totp_ativo=true`,
    [digest(value),now.toISOString(),new Date(now.getTime()-INATIVIDADE_MS).toISOString()])).rows[0];
  if(!row)return null;
  if(now.getTime()-new Date(row.last_seen_at).getTime()>60000)await db.query('UPDATE sessions SET last_seen_at=$1 WHERE token_hash=$2',[now.toISOString(),row.token_hash]);
  return row;
}
export const sessionCookie=(value,{secure=false,clear=false,name=COOKIE,maxAgeMs=DURACAO_MS}={})=>`${name}=${clear?'':value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:Math.round(maxAgeMs/1000)}${secure?'; Secure':''}`;
export const endSessions=(db,userId,{except=null}={})=>db.query('DELETE FROM sessions WHERE user_id=$1 AND ($2::text IS NULL OR id<>$2)',[userId,except]);

// Reautenticação (contrato 4.6): as ações sensíveis exigem senha ou código confirmados nos últimos 5 minutos.
export const confirmada=(session,now=new Date())=>Boolean(session?.confirmed_at)&&now.getTime()-new Date(session.confirmed_at).getTime()<=CONFIRMACAO_MS;
export function exigirConfirmacao(session,now=new Date()) {
  if(!confirmada(session,now))throw fail('Confirme a sua senha ou um código do autenticador para continuar.',403,undefined,{reautenticar:true});
}
export const marcarConfirmada=(db,session,now=new Date())=>db.query('UPDATE sessions SET confirmed_at=$1 WHERE token_hash=$2',[now.toISOString(),session.token_hash]);
