import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { validEmail, hasPassword, endSessions, isDemoEmail, DEMO_PROTECTED_MSG } from '../auth.mjs';
import { PAPEIS } from '../permissoes.mjs';
import { SEM_SENHA, emitirLink, linkDe, zerar2fa } from '../login.mjs';
import { rejectExtra, needVersion, conflito, texto, iso, collator } from './comum.mjs';

// Equipe (contrato 6.13 e 7.6): convidar, mudar nome e papel, desativar, gerar link de senha e redefinir o 2FA.
const SELECT=`SELECT u.*,(SELECT t.expires_at FROM access_tokens t WHERE t.user_id=u.id AND t.kind='convite' ORDER BY t.created_at DESC LIMIT 1) AS convite_expira FROM users u`;
const membroVM=(u,now)=>({id:u.id,email:u.email,nome:u.nome,papel:u.papel,desativado:u.desativado,doisFatores:u.totp_ativo,ultimoAcesso:iso(u.ultimo_acesso),
  convitePendente:hasPassword(u)?null:{expira:iso(u.convite_expira),vencido:!u.convite_expira||new Date(u.convite_expira)<=now},version:u.version});
async function membro(db,id,{lock=false}={}) {
  if(lock)await db.query('SELECT 1 FROM users WHERE id=$1 FOR UPDATE',[id]);
  const u=(await db.query(`${SELECT} WHERE u.id=$1`,[id])).rows[0];if(!u)throw fail('Pessoa não encontrada.',404);
  return u;
}
const nomeDe=v=>texto(v,'nome',120,{obrigatorio:true});
const papelDe=v=>{if(!PAPEIS.includes(v))throw fail('Escolha o papel: admin, financeiro, comercial ou leitura.',422,'papel');return v;};

export async function listarEquipe(db,now=new Date()) {
  const rows=(await db.query(SELECT)).rows.sort((a,b)=>Number(a.desativado)-Number(b.desativado)||collator.compare(a.nome||a.email,b.nome||b.email));
  return {itens:rows.map(u=>membroVM(u,now))};
}

export async function convidar(db,{p,session,ip,now=new Date(),origin}) {
  rejectExtra(p,['email','nome','papel']);
  const email=typeof p.email==='string'?p.email.trim().toLowerCase():'';
  if(!validEmail(email))throw fail('Informe um e-mail válido.',422,'email');
  const nome=nomeDe(p.nome),papel=papelDe(p.papel);
  if((await db.query('SELECT 1 FROM users WHERE email=$1',[email])).rows.length)throw fail('Este e-mail já está na equipe.',409,'email');
  const id=randomUUID();
  return db.transaction(async tx=>{
    await tx.query('INSERT INTO users(id,email,nome,papel,password_hash,criado_em) VALUES($1,$2,$3,$4,$5,$6)',[id,email,nome,papel,SEM_SENHA,now.toISOString()]);
    const {value,expires}=await emitirLink(tx,{userId:id,createdBy:session.user_id,now});
    await audit(tx,{actor:session.user_id,action:'membro_convidado',type:'usuario',resource:id,after:{email,nome,papel},ip});
    return {membro:membroVM(await membro(tx,id),now),link:linkDe(origin,value),expira:expires.toISOString()};
  });
}

export async function editarMembro(db,{id,p,session,ip,now=new Date()}) {
  return db.transaction(async tx=>{
    const u=await membro(tx,id,{lock:true});
    if(isDemoEmail(u.email))throw fail(DEMO_PROTECTED_MSG,403);
    rejectExtra(p,['nome','papel','desativado','version']);const version=needVersion(p);
    if(id===session.user_id&&p.papel!==undefined&&p.papel!==u.papel)throw fail('Você não pode mudar o próprio papel.',422,'papel');
    if(id===session.user_id&&p.desativado===true)throw fail('Você não pode se desativar.',422,'desativado');
    if(p.desativado!==undefined&&typeof p.desativado!=='boolean')throw fail('Valor inválido.',422,'desativado');
    const x={nome:p.nome!==undefined?nomeDe(p.nome):u.nome,papel:p.papel!==undefined?papelDe(p.papel):u.papel,desativado:p.desativado??u.desativado};
    if(u.version!==version)throw conflito();
    // Sempre sobra um admin ativo.
    if(u.papel==='admin'&&!u.desativado&&(x.papel!=='admin'||x.desativado)&&
      !(await tx.query("SELECT 1 FROM users WHERE papel='admin' AND desativado=false AND id<>$1",[id])).rows.length)
      throw fail('A gestão precisa de pelo menos um admin ativo.',422,x.desativado?'desativado':'papel');
    await tx.query('UPDATE users SET nome=$2,papel=$3,desativado=$4,version=version+1 WHERE id=$1',[id,x.nome,x.papel,x.desativado]);
    if(x.desativado&&!u.desativado){await endSessions(tx,id);await tx.query('DELETE FROM login_challenges WHERE user_id=$1',[id]);}
    const mudou=diff({nome:u.nome,papel:u.papel,desativado:u.desativado},x);
    if(mudou.keys.length)await audit(tx,{actor:session.user_id,action:'membro_editado',type:'usuario',resource:id,before:mudou.before,after:mudou.after,ip});
    return membroVM(await membro(tx,id),now);
  });
}

export async function gerarLink(db,{id,session,ip,now=new Date(),origin}) {
  const u=await membro(db,id);
  if(isDemoEmail(u.email))throw fail(DEMO_PROTECTED_MSG,403);
  if(u.desativado)throw fail('Reative a conta antes de gerar o link.',422);
  const {value,expires,kind}=await emitirLink(db,{userId:id,createdBy:session.user_id,now});
  await audit(db,{actor:session.user_id,action:'link_senha_gerado',type:'usuario',resource:id,after:{tipo:kind},ip});
  return {link:linkDe(origin,value),expira:expires.toISOString(),tipo:kind};
}

export async function redefinir2fa(db,{id,p,session,ip,now=new Date()}) {
  return db.transaction(async tx=>{
    const u=await membro(tx,id,{lock:true});
    if(isDemoEmail(u.email))throw fail(DEMO_PROTECTED_MSG,403);
    rejectExtra(p,['version']);const version=needVersion(p);
    if(id===session.user_id)throw fail('Peça a outro admin ou use o CLI para redefinir o seu 2FA.',422);
    if(u.version!==version)throw conflito();
    await zerar2fa(tx,id);
    await audit(tx,{actor:session.user_id,action:'2fa_redefinido',type:'usuario',resource:id,before:{doisFatores:u.totp_ativo},after:{doisFatores:false},ip});
    return membroVM(await membro(tx,id),now);
  });
}
