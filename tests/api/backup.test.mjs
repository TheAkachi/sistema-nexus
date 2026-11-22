import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDB, migrate } from '../../api/db.mjs';
import { backup, restore, TABELAS, FORA, RESTORED_PASSWORD } from '../../api/backup.mjs';
import { audit } from '../../api/lib/auditoria.mjs';
import { BACKUP_SEG } from '../../api/data/leads.mjs';

// Backup criptografado (contrato 10): restaura num banco vazio, sem senha nem 2FA, e recusa senha errada, adulteração e
// banco preenchido.
const SENHA_BACKUP='passphrase-for-test-only';
let db;
before(async()=>{
  db=await openDB({url:null,path:':memory:'});await migrate(db);
  await db.query("INSERT INTO users(id,email,nome,papel,password_hash,totp_secret,totp_ativo,totp_ultimo_passo) VALUES('u1','admin@exemplo.test','Admin','admin','scrypt$hash','cifrado',true,123)");
  await db.query("INSERT INTO sessions(token_hash,id,user_id,csrf,created_at,last_seen_at,expires_at) VALUES('h','s1','u1','c',now(),now(),now()+interval '1 hour')");
  await db.query("INSERT INTO recovery_codes(user_id,code_hash) VALUES('u1','r1')");
  await audit(db,{actor:'u1',action:'login',type:'usuario',resource:'u1',after:{via:'teste'},ip:'203.0.113.7'});
  await db.query("INSERT INTO clients(id,nome,whatsapp) VALUES('c1','Padaria Pão Dourado','5521900000002')");
  await db.query("INSERT INTO client_businesses(client_id,business_id,nome_cache) VALUES('c1','padaria-pao-dourado','Padaria Pão Dourado')");
  await db.query("INSERT INTO subscriptions(id,client_id,business_id,plano_site,valor_centavos,ciclo,inicio,vence_em,dia_base,origem) VALUES('s1','c1','padaria-pao-dourado','plano-avancado',18000,'trimestral','2026-07-24','2026-10-24',24,'manual')");
  for(let i=0;i<3;i++)await db.query("INSERT INTO plan_sync(id,business_id,plano,motivo) VALUES($1,'padaria-pao-dourado','plano-avancado','ativacao')",[`p${i}`]);
  await db.query("INSERT INTO payments(id,subscription_id,valor_centavos,pago_em,forma,meses,vence_antes,vence_depois,referencia_de,referencia_ate,registrado_por) VALUES('pg1','s1',18000,'2026-07-24','pix',3,'2026-07-24','2026-10-24','2026-07-24','2026-10-23','u1')");
  await db.query("INSERT INTO contacts(id,subscription_id,tipo,vence_em,feito_por) VALUES('k1','s1','lembrete','2026-10-24','u1')");
  await db.query("UPDATE settings SET chave_pix='pix@exemplo.test',tolerancia_dias=5");
});
after(async()=>{await db?.close();});

test('toda tabela do banco está no backup ou fora dele, de propósito',async()=>{
  const tabelas=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1")).rows.map(r=>r.table_name);
  // v0.13.0: as tabelas dos interessados esperam a revisão de segurança (14.2 e 14.9) para entrar ou não no backup.
  assert.ok(BACKUP_SEG.every(x=>!TABELAS.includes(x)&&!FORA.includes(x)),'decidida a tabela, ela sai de BACKUP_SEG');
  assert.deepEqual([...TABELAS,...FORA,...BACKUP_SEG].sort(),tabelas,'tabela nova precisa entrar em TABELAS ou FORA (api/backup.mjs)');
});

test('restaura num banco vazio, sem hash de senha nem segredo do 2FA',async()=>{
  const archive=await backup(db,SENHA_BACKUP);
  assert.doesNotMatch(JSON.stringify(archive),/admin@exemplo\.test|cifrado/,'o arquivo sai criptografado');
  const target=await openDB({url:null,path:':memory:'});
  try {
    await migrate(target);
    await assert.rejects(restore(target,archive,'wrong-password-123'));
    await assert.rejects(restore(target,{...archive,data:'quebrado'},SENHA_BACKUP),/Checksum/);
    assert.deepEqual(await restore(target,archive,SENHA_BACKUP),{users:1,clients:1,client_businesses:1,subscriptions:1,payments:1,contacts:1,settings:1,site_plans:0,plan_sync:3,imports:0,audit_log:1});
    assert.equal((await target.query("SELECT referencia_ate::text AS r FROM payments WHERE id='pg1'")).rows[0].r,'2026-10-23');
    assert.deepEqual((await target.query('SELECT chave_pix,tolerancia_dias FROM settings')).rows,[{chave_pix:'pix@exemplo.test',tolerancia_dias:5}],'a configuração do backup substitui a padrão');
    assert.equal((await target.query("SELECT vence_em::text AS v FROM subscriptions WHERE id='s1'")).rows[0].v,'2026-10-24');
    await target.query("INSERT INTO plan_sync(id,business_id,plano,motivo) VALUES('p9','padaria-pao-dourado',NULL,'cancelamento')");
    const seqs=(await target.query('SELECT id,seq FROM plan_sync ORDER BY seq')).rows.map(r=>r.id);
    assert.deepEqual(seqs,['p0','p1','p2','p9'],'a fila continua na ordem depois da restauração');
    const u=(await target.query("SELECT * FROM users WHERE id='u1'")).rows[0];
    assert.equal(u.password_hash,RESTORED_PASSWORD);assert.equal(u.totp_secret,null);assert.equal(u.totp_ativo,false);assert.equal(u.totp_ultimo_passo,null);
    assert.equal(u.email,'admin@exemplo.test');
    for(const t of ['sessions','recovery_codes'])assert.equal((await target.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n,0,t);
    assert.equal((await target.query("SELECT ip FROM audit_log WHERE action='login'")).rows[0].ip,'203.0.113.7');
    await assert.rejects(restore(target,archive,SENHA_BACKUP),/banco vazio/);
  } finally {await target.close();}
  await assert.rejects(backup(db,'curta'),/16 caracteres/);
});

test('schema diferente não restaura',async()=>{
  const archive=await backup(db,SENHA_BACKUP);
  const target=await openDB({url:null,path:':memory:'});
  try {await migrate(target);await target.query("INSERT INTO schema_migrations(name,sha256) VALUES($1,'x')",[`999_${randomUUID()}.sql`]);
    await assert.rejects(restore(target,archive,SENHA_BACKUP),/schema/);}
  finally {await target.close();}
});

test('backup conserva um único instante durante pagamento concorrente (PostgreSQL)',{skip:!process.env.TEST_DATABASE_URL},async()=>{
  // Um schema exclusivo permite executar este teste junto dos outros sem tocar em suas tabelas.
  const {Client}=await import('pg');
  const control=new Client({connectionString:process.env.TEST_DATABASE_URL});
  const schema=`backup_test_${randomUUID().replaceAll('-','')}`;
  await control.connect();
  let source,writer,target;
  try {
    await control.query(`CREATE SCHEMA ${schema}`);
    const url=new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set('options',`-c search_path=${schema}`);
    source=await openDB({url:url.toString()});writer=await openDB({url:url.toString()});
    await migrate(source);
    await source.query("INSERT INTO clients(id,nome) VALUES('c1','Cliente de teste')");
    await source.query("INSERT INTO subscriptions(id,client_id,valor_centavos,ciclo,inicio,vence_em,dia_base,origem) VALUES('s1','c1',10000,'mensal','2026-09-15','2026-10-15',15,'manual')");
    let committed=false;
    const interleaved={transaction:fn=>source.transaction(tx=>fn({...tx,query:async(sql,params)=>{
      const result=await tx.query(sql,params);
      if(sql==='SELECT * FROM subscriptions') {
        await writer.transaction(async other=>{
          await other.query("UPDATE subscriptions SET vence_em='2026-11-15' WHERE id='s1'");
          await other.query("INSERT INTO payments(id,subscription_id,valor_centavos,pago_em,forma,meses,vence_antes,vence_depois,referencia_de,referencia_ate) VALUES('pg1','s1',10000,'2026-10-15','pix',1,'2026-10-15','2026-11-15','2026-10-15','2026-11-14')");
        });
        committed=true;
      }
      return result;
    }}))};
    const archive=await backup(interleaved,SENHA_BACKUP);
    assert.equal(committed,true,'o pagamento confirmou enquanto o backup lia as tabelas');
    assert.equal((await source.query('SELECT count(*)::int AS n FROM payments')).rows[0].n,1);
    target=await openDB({url:null,path:':memory:'});await migrate(target);
    await restore(target,archive,SENHA_BACKUP);
    assert.equal((await target.query("SELECT vence_em::text AS v FROM subscriptions WHERE id='s1'")).rows[0].v,'2026-10-15');
    assert.equal((await target.query('SELECT count(*)::int AS n FROM payments')).rows[0].n,0,'o vencimento antigo precisa vir sem o pagamento posterior');
  } finally {
    await target?.close();await writer?.close();await source?.close();
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await control.end();
  }
});
