import { createHmac, randomBytes } from 'node:crypto';
import { fail } from './lib/erros.mjs';
import { audit } from './lib/auditoria.mjs';
import { cifrar, decifrar } from './lib/cifra.mjs';
import { base32, novoSegredo, conferir } from './lib/totp.mjs';
import { senhaFraca } from './lib/senhas.mjs';
import { digest, token, DUMMY, validEmail, validPassword, hasPassword, verifyPassword, hashPassword, limit, hit, peek, clear,
  newSession, cookieValue, marcarConfirmada, CONFIRMACAO_MS } from './auth.mjs';

// Login em duas etapas, 2FA, reautenticação e links de uso único (contrato 4).
export const COOKIE_LOGIN='gestao_login';
export const LOGIN_MS=10*60000,JANELA_MS=15*60000;
export const VALIDADE={convite:72*3600000,senha:3600000};
export const SEM_SENHA='!sem-senha';
const MAX_CODIGOS=5;
const usuarioDe=u=>({id:u.id,email:u.email,nome:u.nome,papel:u.papel});
const mailDe=v=>typeof v==='string'?v.trim().toLowerCase():'';

// Códigos de recuperação: 10 caracteres em base32, em dois grupos (k7m2q-x9p4t). Guardados como HMAC-SHA-256 com a chave
// do 2FA: só o banco, sem o .env, não basta para testar códigos.
const normalCodigo=c=>String(c??'').toLowerCase().replace(/[\s-]/g,'');
const hashCodigo=(chave,c)=>createHmac('sha256',chave).update(normalCodigo(c)).digest('hex');
export const novosCodigos=()=>Array.from({length:10},()=>{const c=base32(randomBytes(7)).toLowerCase().slice(0,10);return `${c.slice(0,5)}-${c.slice(5)}`;});

// Etapa 1: senha. Até 20 tentativas por IP real e 5 falhas por conta em 15 min; a mesma resposta para conta inexistente,
// desativada ou sem senha. Certo: cria o login pendente (codigo ou configurar) e devolve o valor do cookie gestao_login.
export async function entrar(db,{email,senha,ip,now=new Date(),chave}) {
  const mail=mailDe(email);
  await limit(db,`login-ip:${ip}`,20,JANELA_MS,now);
  if(await peek(db,`login-conta:${mail}`,now)>=5){await audit(db,{action:'login_bloqueado',type:'usuario',resource:mail,after:{email:mail},ip});throw fail('Muitas tentativas. Tente de novo em alguns minutos.',429);}
  const user=validEmail(mail)?(await db.query('SELECT id,email,password_hash,totp_ativo FROM users WHERE email=$1 AND desativado=false',[mail])).rows[0]:null;
  const {ok,rehash}=await verifyPassword(senha,user?.password_hash||DUMMY);
  if(!user||!ok) {
    await hit(db,`login-conta:${mail}`,JANELA_MS,now);
    await audit(db,{actor:user?.id||null,action:'login_falha',type:'usuario',resource:mail,after:{email:mail},ip});
    throw fail('E-mail ou senha incorretos.',401);
  }
  await clear(db,`login-conta:${mail}`);
  if(rehash)await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await hashPassword(senha),user.id]);
  const etapa=user.totp_ativo?'codigo':'configurar',valor=token();
  await db.query('DELETE FROM login_challenges WHERE expires_at<=$1 OR user_id=$2',[now.toISOString(),user.id]);
  await db.query('INSERT INTO login_challenges(token_hash,user_id,stage,new_totp_secret,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
    [digest(valor),user.id,etapa,etapa==='configurar'?cifrar(chave,novoSegredo(),user.id):null,now.toISOString(),new Date(now.getTime()+LOGIN_MS).toISOString()]);
  return {valor,etapa};
}

// O login pendente do cookie gestao_login, com a conta (ativa), ou null.
export async function pendente(db,header,now=new Date()) {
  const valor=cookieValue(header,COOKIE_LOGIN);if(!valor)return null;
  return (await db.query(`SELECT c.token_hash,c.user_id,c.stage,c.new_totp_secret,c.failures,u.email,u.nome,u.papel,u.totp_secret,u.totp_ultimo_passo
    FROM login_challenges c JOIN users u ON u.id=c.user_id WHERE c.token_hash=$1 AND c.expires_at>$2 AND u.desativado=false`,[digest(valor),now.toISOString()])).rows[0]||null;
}
const semLogin=()=>Object.assign(fail('O login expirou. Entre de novo com a sua senha.',401),{limparLogin:true});

// Código errado: conta no login pendente (5 erros e ele morre) e na conta (10 erros em 15 min).
async function codigoErrado(db,d,{ip,now}) {
  await hit(db,`codigo-conta:${d.user_id}`,JANELA_MS,now);
  await audit(db,{actor:d.user_id,action:'codigo_falha',type:'usuario',resource:d.user_id,ip});
  const falhas=(await db.query('UPDATE login_challenges SET failures=failures+1 WHERE token_hash=$1 RETURNING failures',[d.token_hash])).rows[0]?.failures||MAX_CODIGOS;
  if(falhas>=MAX_CODIGOS){await db.query('DELETE FROM login_challenges WHERE token_hash=$1',[d.token_hash]);throw Object.assign(fail('Muitas tentativas. Entre de novo com a sua senha.',401),{limparLogin:true});}
  throw fail('Código incorreto.',422,'codigo');
}
async function contaBloqueada(db,userId,now) {if(await peek(db,`codigo-conta:${userId}`,now)>=10)throw fail('Muitas tentativas. Tente de novo em alguns minutos.',429);}
async function abrirSessao(db,d,{via,ip,userAgent,now}) {
  await db.query('DELETE FROM login_challenges WHERE token_hash=$1',[d.token_hash]);
  const session=await newSession(db,d.user_id,{userAgent,now});
  await db.query('UPDATE users SET ultimo_acesso=$2 WHERE id=$1',[d.user_id,now.toISOString()]);
  await audit(db,{actor:d.user_id,action:'login',type:'usuario',resource:d.user_id,after:{via},ip});
  return {session,usuario:usuarioDe({id:d.user_id,email:d.email,nome:d.nome,papel:d.papel})};
}

// Etapa 2: o código do autenticador (uma vez só por passo) ou um código de recuperação (uma vez só).
export async function conferirCodigo(db,{header,codigo,ip,userAgent,now=new Date(),chave}) {
  const d=await pendente(db,header,now);if(!d)throw semLogin();
  if(d.stage!=='codigo')throw fail('Configure o autenticador primeiro.',409);
  await contaBloqueada(db,d.user_id,now);
  const c=String(codigo??'').trim().replace(/\s/g,'');
  if(/^\d{6}$/.test(c)) {
    const passo=conferir(decifrar(chave,d.totp_secret,d.user_id),c,now,d.totp_ultimo_passo);
    if(passo!==null&&(await db.query('UPDATE users SET totp_ultimo_passo=$2 WHERE id=$1 AND (totp_ultimo_passo IS NULL OR totp_ultimo_passo<$2) RETURNING id',[d.user_id,passo])).rows.length)
      return abrirSessao(db,d,{via:'totp',ip,userAgent,now});
  } else if(/^[a-z2-7]{10}$/.test(normalCodigo(c))) {
    const usado=(await db.query('UPDATE recovery_codes SET used_at=$3 WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING code_hash',[d.user_id,hashCodigo(chave,c),now.toISOString()])).rows.length;
    if(usado) {
      const restantes=(await db.query('SELECT count(*)::int AS n FROM recovery_codes WHERE user_id=$1 AND used_at IS NULL',[d.user_id])).rows[0].n;
      await audit(db,{actor:d.user_id,action:'codigo_recuperacao_usado',type:'usuario',resource:d.user_id,after:{restantes},ip});
      return {...await abrirSessao(db,d,{via:'recuperacao',ip,userAgent,now}),recuperacao:{restantes}};
    }
  }
  return codigoErrado(db,d,{ip,now});
}

// Primeiro acesso (ou 2FA redefinido): confere o primeiro código com o segredo novo, ativa o 2FA e gera os 10 códigos de
// recuperação, que só aparecem nesta resposta.
export async function ativar2fa(db,{header,codigo,ip,userAgent,now=new Date(),chave}) {
  const d=await pendente(db,header,now);if(!d)throw semLogin();
  if(d.stage!=='configurar')throw fail('O autenticador já está configurado.',409);
  await contaBloqueada(db,d.user_id,now);
  const passo=conferir(decifrar(chave,d.new_totp_secret,d.user_id),String(codigo??'').trim().replace(/\s/g,''),now);
  if(passo===null)return codigoErrado(db,d,{ip,now});
  const codigos=novosCodigos();
  await db.transaction(async tx=>{
    const r=await tx.query('UPDATE users SET totp_secret=$2,totp_ativo=true,totp_ultimo_passo=$3,version=version+1 WHERE id=$1 AND totp_ativo=false RETURNING id',[d.user_id,d.new_totp_secret,passo]);
    if(!r.rows.length)throw fail('O autenticador já está configurado.',409);
    await tx.query('DELETE FROM recovery_codes WHERE user_id=$1',[d.user_id]);
    for(const c of codigos)await tx.query('INSERT INTO recovery_codes(user_id,code_hash,created_at) VALUES($1,$2,$3)',[d.user_id,hashCodigo(chave,c),now.toISOString()]);
    await audit(tx,{actor:d.user_id,action:'2fa_configurado',type:'usuario',resource:d.user_id,ip});
  });
  return {...await abrirSessao(db,d,{via:'configuracao',ip,userAgent,now}),codigosRecuperacao:codigos};
}

// Reautenticação (4.6): a senha ou um código do autenticador, com 5 erros por sessão em 15 min.
export async function confirmar(db,{session,senha,codigo,ip,now=new Date(),chave}) {
  if((senha===undefined)===(codigo===undefined))throw fail('Informe a senha ou um código do autenticador.',422,'senha');
  if(await peek(db,`confirmar:${session.id}`,now)>=5)throw fail('Muitas tentativas. Tente de novo em alguns minutos.',429);
  const u=(await db.query('SELECT password_hash,totp_secret,totp_ultimo_passo FROM users WHERE id=$1',[session.user_id])).rows[0];
  let ok=false;
  if(senha!==undefined)ok=(await verifyPassword(senha,u?.password_hash||DUMMY)).ok;
  else {
    const passo=u?.totp_secret?conferir(decifrar(chave,u.totp_secret,session.user_id),String(codigo??'').trim(),now,u.totp_ultimo_passo):null;
    ok=passo!==null&&(await db.query('UPDATE users SET totp_ultimo_passo=$2 WHERE id=$1 AND (totp_ultimo_passo IS NULL OR totp_ultimo_passo<$2) RETURNING id',[session.user_id,passo])).rows.length>0;
  }
  if(!ok) {
    await hit(db,`confirmar:${session.id}`,JANELA_MS,now);
    await audit(db,{actor:session.user_id,action:'reautenticacao_falha',type:'usuario',resource:session.user_id,ip});
    throw fail(senha!==undefined?'Senha incorreta.':'Código incorreto.',422,senha!==undefined?'senha':'codigo');
  }
  await marcarConfirmada(db,session,now);
  await audit(db,{actor:session.user_id,action:'reautenticacao',type:'usuario',resource:session.user_id,ip});
  return {ok:true,valeAte:new Date(now.getTime()+CONFIRMACAO_MS).toISOString()};
}

// Link de uso único (4.2): convite de 72 h para quem ainda não tem senha, link de senha de 1 h para quem tem. Um link novo
// invalida os anteriores da mesma pessoa.
export async function emitirLink(db,{userId,createdBy=null,now=new Date()}) {
  const u=(await db.query('SELECT password_hash FROM users WHERE id=$1',[userId])).rows[0];
  const kind=hasPassword(u)?'senha':'convite',value=token(),expires=new Date(now.getTime()+VALIDADE[kind]);
  await db.query('UPDATE access_tokens SET used_at=$2 WHERE user_id=$1 AND used_at IS NULL',[userId,now.toISOString()]);
  await db.query('INSERT INTO access_tokens(token_hash,kind,user_id,created_by,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[digest(value),kind,userId,createdBy,now.toISOString(),expires.toISOString()]);
  return {value,expires,kind};
}
export const linkDe=(origin,value)=>`${origin}/entrar/definir-senha?token=${value}`;
export async function tokenInfo(db,value,now=new Date()) {
  if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))return null;
  return (await db.query(`SELECT t.kind,t.user_id,t.expires_at,u.email,u.nome,c.nome AS criador_nome FROM access_tokens t JOIN users u ON u.id=t.user_id
    LEFT JOIN users c ON c.id=t.created_by WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>$2 AND u.desativado=false`,[digest(value),now.toISOString()])).rows[0]||null;
}
// Define a senha com o link: vale uma vez, recusa a senha fácil de adivinhar e encerra as sessões e o login pendente da
// pessoa. O 2FA continua exigido no próximo login.
export async function definirSenha(db,{token:value,senha,ip,now=new Date()}) {
  await limit(db,`senha-ip:${ip}`,10,JANELA_MS,now);
  const info=await tokenInfo(db,value,now);
  if(!info)throw fail('Este link não vale mais. Peça um novo.',422,'token');
  if(!validPassword(senha))throw fail('A senha precisa ter de 12 a 128 caracteres.',422,'senha');
  if(senhaFraca(senha,info.email))throw fail('Esta senha é fácil de adivinhar. Escolha outra.',422,'senha');
  const hash=await hashPassword(senha);
  return db.transaction(async tx=>{
    const row=(await tx.query(`UPDATE access_tokens SET used_at=$2 WHERE token_hash=$1 AND used_at IS NULL AND expires_at>$2
      AND user_id IN (SELECT id FROM users WHERE desativado=false) RETURNING kind,user_id`,[digest(value),now.toISOString()])).rows[0];
    if(!row)throw fail('Este link não vale mais. Peça um novo.',422,'token');
    await tx.query('UPDATE users SET password_hash=$1,version=version+1 WHERE id=$2',[hash,row.user_id]);
    await tx.query('DELETE FROM sessions WHERE user_id=$1',[row.user_id]);
    await tx.query('DELETE FROM login_challenges WHERE user_id=$1',[row.user_id]);
    await audit(tx,{actor:row.user_id,action:'senha_definida',type:'usuario',resource:row.user_id,after:{via:row.kind},ip});
    return {ok:true};
  });
}

// Redefinir o 2FA (4.7): apaga o segredo e os códigos de recuperação e encerra as sessões e o login pendente.
export async function zerar2fa(db,userId) {
  await db.query('UPDATE users SET totp_secret=NULL,totp_ativo=false,totp_ultimo_passo=NULL,version=version+1 WHERE id=$1',[userId]);
  for(const t of ['recovery_codes','sessions','login_challenges'])await db.query(`DELETE FROM ${t} WHERE user_id=$1`,[userId]);
}
