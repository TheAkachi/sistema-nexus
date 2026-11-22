import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDB, migrate } from '../../api/db.mjs';
import { audit } from '../../api/lib/auditoria.mjs';

// Banco (contrato 5): migrações e regras que o próprio banco garante. Com TEST_DATABASE_URL (o GitHub Actions passa um
// PostgreSQL 17 descartável), roda no PostgreSQL de verdade; sem ela, no PGlite em memória.
let db;
before(async()=>{db=await openDB({url:process.env.TEST_DATABASE_URL||null,path:':memory:'});await migrate(db);});
after(async()=>{await db?.close();});

test('migrar de novo não muda nada',async()=>{
  const antes=(await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows;
  await migrate(db);
  assert.deepEqual((await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows,antes);
  assert.ok(antes.some(m=>m.name==='001_fundacao.sql'));
});

test('audit_log só aceita INSERT: UPDATE, DELETE e TRUNCATE são recusados',async()=>{
  const id=randomUUID();
  await audit(db,{actor:null,action:'teste',type:'teste',resource:id,before:{a:1},after:{a:2},ip:'203.0.113.7'});
  const row=(await db.query('SELECT * FROM audit_log WHERE resource_id=$1',[id])).rows[0];
  assert.deepEqual([row.action,row.resource_type,row.before,row.after,row.ip],['teste','teste',{a:1},{a:2},'203.0.113.7']);
  await assert.rejects(db.query("UPDATE audit_log SET action='x' WHERE resource_id=$1",[id]),/só aceita INSERT/);
  await assert.rejects(db.query('DELETE FROM audit_log WHERE resource_id=$1',[id]),/só aceita INSERT/);
  await assert.rejects(db.exec('TRUNCATE audit_log'),/só aceita INSERT/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE resource_id=$1',[id])).rows[0].n,1);
});

test('users: e-mail em minúsculas, papel da lista e 2FA ativo só com segredo',async()=>{
  const ins=(email,papel,totp=false,secret=null)=>db.query('INSERT INTO users(id,email,papel,password_hash,totp_ativo,totp_secret) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),email,papel,'x',totp,secret]);
  await ins(`${randomUUID()}@exemplo.test`,'leitura');
  await assert.rejects(ins(`Maiuscula-${randomUUID()}@exemplo.test`,'leitura'));
  await assert.rejects(ins(`${randomUUID()}@exemplo.test`,'dono'));
  await assert.rejects(ins(`${randomUUID()}@exemplo.test`,'admin',true,null));
  await ins(`${randomUUID()}@exemplo.test`,'admin',true,'cifrado');
});
