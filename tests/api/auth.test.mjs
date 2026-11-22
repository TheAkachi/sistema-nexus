import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, DUMMY, sameSecret, sessionCookie, newSession, sessionFor, endSessions, limit, peek, clear,
  confirmada, exigirConfirmacao, marcarConfirmada, COOKIE } from '../../api/auth.mjs';
import { ambiente, SENHA } from './ambiente.mjs';

// Primitivas de autenticação copiadas do site, com a Parte B do briefing de segurança (contrato 4).
let t;
before(async()=>{t=await ambiente();});
after(async()=>{await t?.fim();});
const cookie=s=>`outro=1; ${COOKIE}=${s.value}`;

test('senha: scrypt com os parâmetros no hash, de 12 a 128 caracteres',async()=>{
  const h=await hashPassword(SENHA);assert.match(h,/^scrypt\$32768\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
  assert.deepEqual(await verifyPassword(SENHA,h),{ok:true,rehash:false});
  assert.equal((await verifyPassword('outra-senha-123',h)).ok,false);
  assert.equal((await verifyPassword(SENHA,DUMMY)).ok,false,'conta inexistente: calcula e recusa');
  assert.equal((await verifyPassword('x'.repeat(129),h)).ok,false);
  await assert.rejects(hashPassword('curta-demais'.slice(0,11)),e=>e.status===422&&e.campo==='senha');
  await assert.rejects(hashPassword('x'.repeat(129)),e=>e.status===422);
  assert.equal(sameSecret('abc','abc'),true);assert.equal(sameSecret('abc','abd'),false);assert.equal(sameSecret('abc','abcd'),false);assert.equal(sameSecret('',''),false);
});

test('cookie da sessão: HttpOnly, SameSite=Strict, Path=/, 8 h e Secure com https',()=>{
  assert.equal(sessionCookie('a'.repeat(64)),`gestao_sessao=${'a'.repeat(64)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
  assert.equal(sessionCookie('b',{secure:true}),'gestao_sessao=b; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800; Secure');
  assert.equal(sessionCookie('',{clear:true,secure:true}),'gestao_sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure');
});

test('sessão: vale 30 min sem uso e 8 h no total; conta desativada ou sem 2FA não entra',async()=>{
  const id=await t.conta('financeiro@exemplo.test',{papel:'financeiro'});
  const s=await newSession(t.db,id,{userAgent:'teste',now:t.agora});
  assert.equal((await t.db.query('SELECT token_hash FROM sessions WHERE id=$1',[s.id])).rows[0].token_hash.length,64,'o banco guarda só o hash');
  const lida=await sessionFor(t.db,cookie(s),t.agora);
  assert.equal(lida.papel,'financeiro');assert.equal(lida.csrf,s.csrf);
  assert.equal(await sessionFor(t.db,`${COOKIE}=nao-e-hex`,t.agora),null);
  // Uso a cada 29 min mantém a sessão até as 8 h.
  let agora=t.agora;
  for(let i=0;i<16;i++){agora=new Date(agora.getTime()+29*60000);assert.ok(await sessionFor(t.db,cookie(s),agora),`uso ${i}`);}
  assert.equal(await sessionFor(t.db,cookie(s),new Date(t.agora.getTime()+8*3600000+1000)),null,'passou das 8 h');
  const s2=await newSession(t.db,id,{now:t.agora});
  assert.equal(await sessionFor(t.db,cookie(s2),new Date(t.agora.getTime()+31*60000)),null,'31 min sem uso');
  const s3=await newSession(t.db,id,{now:t.agora});
  await t.db.query('UPDATE users SET desativado=true WHERE id=$1',[id]);
  assert.equal(await sessionFor(t.db,cookie(s3),t.agora),null,'desativada');
  await t.db.query('UPDATE users SET desativado=false,totp_ativo=false WHERE id=$1',[id]);
  assert.equal(await sessionFor(t.db,cookie(s3),t.agora),null,'2FA redefinido');
  await t.db.query('UPDATE users SET totp_ativo=true WHERE id=$1',[id]);
  await endSessions(t.db,id,{except:s3.id});
  assert.ok(await sessionFor(t.db,cookie(s3),t.agora));
  await endSessions(t.db,id);assert.equal(await sessionFor(t.db,cookie(s3),t.agora),null);
});

test('reautenticação: o login conta como confirmação por 5 min; depois, 403 com reautenticar',async()=>{
  const id=await t.conta('admin@exemplo.test');
  const s=await newSession(t.db,id,{now:t.agora});let lida=await sessionFor(t.db,cookie(s),t.agora);
  assert.equal(confirmada(lida,new Date(t.agora.getTime()+5*60000)),true);
  const depois=new Date(t.agora.getTime()+6*60000);lida=await sessionFor(t.db,cookie(s),depois);
  assert.throws(()=>exigirConfirmacao(lida,depois),e=>e.status===403&&e.extra.reautenticar===true);
  await marcarConfirmada(t.db,lida,depois);
  assert.equal(confirmada(await sessionFor(t.db,cookie(s),depois),depois),true);
});

test('limite de tentativas por chave e janela, guardando só o hash da chave',async()=>{
  for(let i=0;i<3;i++)await limit(t.db,'login-ip:203.0.113.7',3,15*60000,t.agora);
  await assert.rejects(limit(t.db,'login-ip:203.0.113.7',3,15*60000,t.agora),e=>e.status===429);
  assert.equal(await peek(t.db,'login-ip:203.0.113.7',t.agora),4);
  assert.equal((await t.db.query("SELECT count(*)::int AS n FROM rate_limits WHERE key_hash LIKE '%203.0.113.7%'")).rows[0].n,0);
  await limit(t.db,'login-ip:203.0.113.7',3,15*60000,new Date(t.agora.getTime()+16*60000));
  assert.equal(await peek(t.db,'login-ip:203.0.113.7',new Date(t.agora.getTime()+16*60000)),1,'janela nova');
  await clear(t.db,'login-ip:203.0.113.7');assert.equal(await peek(t.db,'login-ip:203.0.113.7',t.agora),0);
});
