import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDB } from '../../api/db.mjs';

// CLI (contrato 10): admin, link-senha e reset-2fa, num processo separado e num banco PGlite temporário.
let dir;
const CLI=fileURLToPath(new URL('../../api/cli.mjs',import.meta.url));
const cli=(args,input='')=>spawnSync(process.execPath,[CLI,...args],{encoding:'utf8',input,env:{...process.env,DATABASE_URL:'',DB_DIR:dir,NODE_ENV:'test',PUBLIC_ORIGIN:'https://gestao.exemplo.test'}});
const consulta=async(sql,params=[])=>{const db=await openDB({url:null,path:dir});try{return (await db.query(sql,params)).rows;}finally{await db.close();}};
before(async()=>{dir=await mkdtemp(join(tmpdir(),'gestao-cli-'));});
after(async()=>{await rm(dir,{recursive:true,force:true});});

test('admin: cria a conta sem senha e imprime o convite; de novo, promove e reativa',async()=>{
  let r=cli(['admin','Lucas@Exemplo.test','Lucas','Silva']);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/lucas@exemplo\.test é admin da gestão\.\nConvite de lucas@exemplo\.test \(vale até .+\):\nhttps:\/\/gestao\.exemplo\.test\/entrar\/definir-senha\?token=[a-f0-9]{64}\n/);
  let [u]=await consulta("SELECT * FROM users WHERE email='lucas@exemplo.test'");
  assert.deepEqual([u.nome,u.papel,u.password_hash],['Lucas Silva','admin','!sem-senha']);
  await consulta("UPDATE users SET papel='leitura',desativado=true WHERE id=$1",[u.id]);
  r=cli(['admin','lucas@exemplo.test']);assert.equal(r.status,0,r.stderr);
  [u]=await consulta("SELECT * FROM users WHERE email='lucas@exemplo.test'");
  assert.deepEqual([u.papel,u.desativado,u.nome],['admin',false,'Lucas Silva']);
  assert.equal((await consulta("SELECT count(*)::int AS n FROM access_tokens WHERE user_id=$1 AND used_at IS NULL",[u.id]))[0].n,1,'o link novo invalida o anterior');
  assert.equal((await consulta("SELECT count(*)::int AS n FROM audit_log WHERE action='admin_cli'"))[0].n,2);
  assert.notEqual(cli(['admin','sem-arroba']).status,0);
});

test('link-senha e reset-2fa: só com conta existente; o reset pede o e-mail de novo',async()=>{
  assert.match(cli(['link-senha','lucas@exemplo.test']).stdout,/^Convite de lucas@exemplo\.test/);
  assert.notEqual(cli(['link-senha','ninguem@exemplo.test']).status,0);
  await consulta("UPDATE users SET totp_secret='cifrado',totp_ativo=true WHERE email='lucas@exemplo.test'");
  let r=cli(['reset-2fa','lucas@exemplo.test'],'outro@exemplo.test\n');
  assert.notEqual(r.status,0);assert.match(r.stderr,/não confere/);
  assert.equal((await consulta("SELECT totp_ativo FROM users WHERE email='lucas@exemplo.test'"))[0].totp_ativo,true,'nada mudou');
  r=cli(['reset-2fa','lucas@exemplo.test'],'Lucas@exemplo.test\n');
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/2FA de lucas@exemplo\.test redefinido/);
  assert.deepEqual((await consulta("SELECT totp_ativo,totp_secret FROM users WHERE email='lucas@exemplo.test'"))[0],{totp_ativo:false,totp_secret:null});
  assert.equal((await consulta("SELECT count(*)::int AS n FROM audit_log WHERE action='2fa_redefinido_cli'"))[0].n,1);
});

test('limpar: expira as prévias vencidas e apaga os links usados ou vencidos',async()=>{
  await consulta(`INSERT INTO imports(id,tipo,arquivo_sha256,linhas,previa,resumo,criado_em,expira_em)
    VALUES('00000000-0000-4000-8000-0000000000aa','edirectory','abc',1,'{"linhas":[]}','{}',now()-interval '2 days',now()-interval '1 day')`);
  const r=cli(['limpar']);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/^Prévias expiradas: 1\. Apagados: \d+ links, \d+ logins pela metade, \d+ sessões e \d+ limites\.\n$/);
  assert.deepEqual(await consulta('SELECT status,previa FROM imports'),[{status:'expirada',previa:null}]);
  assert.equal((await consulta('SELECT count(*)::int AS n FROM access_tokens WHERE used_at IS NOT NULL OR expires_at<=now()'))[0].n,0);
  assert.match(cli(['limpar']).stdout,/^Prévias expiradas: 0\./);
});
