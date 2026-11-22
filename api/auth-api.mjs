import { fail } from './lib/erros.mjs';
import { audit } from './lib/auditoria.mjs';
import { rota } from './rotas.mjs';
import { rejectExtra } from './data/comum.mjs';
import { podeDe } from './permissoes.mjs';
import { sessionCookie, sameSecret, digest, cookieValue, isDemoEmail, demoAtivo, verifyPassword, newSession, limit } from './auth.mjs';
import { COOKIE_LOGIN, LOGIN_MS, entrar, conferirCodigo, ativar2fa, confirmar, definirSenha } from './login.mjs';

// APIs do login (contrato 4.4 e 7.1). O cookie gestao_login vale só entre a senha e o código; o da sessão nasce no fim.
const cookieLogin=(ctx,valor)=>sessionCookie(valor,{secure:ctx.secure,name:COOKIE_LOGIN,maxAgeMs:LOGIN_MS,clear:!valor});
const usuarioVM=s=>({id:s.user_id,email:s.email,nome:s.nome,papel:s.papel});
// Certo ou errado, a etapa do código termina com o cookie certo: sessão nova e login pendente apagado, ou login morto.
async function etapa(ctx,fn) {
  try {
    const r=await fn();
    ctx.cookie(sessionCookie(r.session.value,{secure:ctx.secure}));ctx.cookie(cookieLogin(ctx,''));
    const {session,...resto}=r;
    return {csrf:session.csrf,...resto};
  } catch(e){if(e.limparLogin)ctx.cookie(cookieLogin(ctx,''));throw e;}
}
const codigo=async ctx=>{const p=await ctx.body();rejectExtra(p,['codigo']);return p;};

export const rotasAuth=[
  rota('POST','/api/auth/login','publica',async ctx=>{
    const p=await ctx.body();rejectExtra(p,['email','senha']);
    const mail=typeof p.email==='string'?p.email.trim().toLowerCase():'';
    if(demoAtivo()&&isDemoEmail(mail)) {
      await limit(ctx.db,`login:ip:${ctx.ip}`,20,15*60000,ctx.now);
      const u=(await ctx.db.query('SELECT id,email,password_hash,desativado,totp_ativo FROM users WHERE email=$1',[mail])).rows[0];
      const ok=u&&!u.desativado&&u.totp_ativo&&(await verifyPassword(p.senha,u.password_hash)).ok;
      if(!ok)throw fail('E-mail ou senha incorretos.',401);
      const s=await newSession(ctx.db,u.id,{userAgent:ctx.req.headers['user-agent'],now:ctx.now});
      await ctx.db.query('UPDATE users SET ultimo_acesso=$2 WHERE id=$1',[u.id,ctx.now.toISOString()]);
      await audit(ctx.db,{actor:u.id,action:'login_demo',type:'usuario',resource:u.id,ip:ctx.ip});
      ctx.cookie(sessionCookie(s.value,{secure:ctx.secure}));ctx.cookie(cookieLogin(ctx,''));
      return {etapa:'sessao',csrf:s.csrf};
    }
    const {valor,etapa:e}=await entrar(ctx.db,{email:p.email,senha:p.senha,ip:ctx.ip,now:ctx.now,chave:ctx.chave});
    ctx.cookie(cookieLogin(ctx,valor));
    return {etapa:e};
  }),
  rota('POST','/api/auth/codigo','publica',async ctx=>{
    const p=await codigo(ctx);
    return etapa(ctx,()=>conferirCodigo(ctx.db,{header:ctx.req.headers.cookie,codigo:p.codigo,ip:ctx.ip,userAgent:ctx.req.headers['user-agent'],now:ctx.now,chave:ctx.chave}));
  }),
  rota('POST','/api/auth/2fa','publica',async ctx=>{
    const p=await codigo(ctx);
    return etapa(ctx,()=>ativar2fa(ctx.db,{header:ctx.req.headers.cookie,codigo:p.codigo,ip:ctx.ip,userAgent:ctx.req.headers['user-agent'],now:ctx.now,chave:ctx.chave}));
  }),
  rota('POST','/api/auth/senha','publica',async ctx=>{
    const p=await ctx.body();rejectExtra(p,['token','senha']);
    return definirSenha(ctx.db,{token:p.token,senha:p.senha,ip:ctx.ip,now:ctx.now});
  }),
  rota('POST','/api/auth/confirmar','sessao',async ctx=>{
    const p=await ctx.body();rejectExtra(p,['senha','codigo']);
    return confirmar(ctx.db,{session:ctx.session,senha:p.senha,codigo:p.codigo,ip:ctx.ip,now:ctx.now,chave:ctx.chave});
  }),
  // Com sessão, exige o CSRF e encerra a sessão; sem ela, cancela o login pendente ("Entrar com outra conta").
  rota('POST','/api/auth/logout','publica',async ctx=>{
    const s=await ctx.session();
    if(s) {
      if(!sameSecret(ctx.req.headers['x-csrf-token'],s.csrf))throw fail('Verificação da sessão falhou. Recarregue a página.',403);
      await ctx.db.query('DELETE FROM sessions WHERE token_hash=$1',[s.token_hash]);
      await audit(ctx.db,{actor:s.user_id,action:'logout',type:'usuario',resource:s.user_id,ip:ctx.ip});
    }
    const pendente=cookieValue(ctx.req.headers.cookie,COOKIE_LOGIN);
    if(pendente)await ctx.db.query('DELETE FROM login_challenges WHERE token_hash=$1',[digest(pendente)]);
    ctx.cookie(sessionCookie('',{secure:ctx.secure,clear:true}));ctx.cookie(cookieLogin(ctx,''));
    return {ok:true};
  }),
  rota('GET','/api/me','sessao',async ctx=>({usuario:usuarioVM(ctx.session),csrf:ctx.session.csrf,pode:podeDe(ctx.session.papel)}))
];
