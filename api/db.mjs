import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Banco: PostgreSQL pela DATABASE_URL (homologação e produção, banco e usuário próprios da gestão, separados do site) ou
// PGlite em .runtime/postgres só na máquina local e nos testes. (Cópia de api/db.mjs do site.)
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function openDB({ url = process.env.DATABASE_URL, path = process.env.DB_DIR || resolve(root, '.runtime/postgres') } = {}) {
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url, max: 8 });
    const wrap = client => ({ query: (sql, params=[])=>client.query(sql,params), exec: sql=>client.query(sql) });
    return { ...wrap(pool), kind:'postgres', close:()=>pool.end(), transaction:async fn=> {
      const client=await pool.connect();
      try { await client.query('BEGIN'); const result=await fn(wrap(client)); await client.query('COMMIT'); return result; }
      catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Produção exige PostgreSQL externo (DATABASE_URL). PGlite é só local e teste.');
  const { PGlite } = await import('@electric-sql/pglite');
  if (path !== ':memory:') await mkdir(path, {recursive:true});
  const pg = new PGlite(path === ':memory:' ? undefined : path);
  await pg.waitReady;
  return { query:pg.query.bind(pg), exec:pg.exec.bind(pg), transaction:pg.transaction.bind(pg), close:pg.close.bind(pg), kind:'pglite' };
}

// Migrações em ordem de nome; uma migração já aplicada não pode mudar (o sha256 fica registrado).
export async function migrate(db) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const files=(await readdir(resolve(root,'db/migrations'))).filter(x=>x.endsWith('.sql')).sort();
  for(const file of files) {
    const sql=(await readFile(resolve(root,'db/migrations',file),'utf8')).replace(/\r\n/g,'\n');
    const hash=createHash('sha256').update(sql).digest('hex');
    const existing=(await db.query('SELECT sha256 FROM schema_migrations WHERE name=$1',[file])).rows[0];
    if(existing) { if(existing.sha256!==hash) throw new Error(`Migração aplicada foi alterada: ${file}`); continue; }
    await db.transaction(async tx=> { await tx.exec(sql); await tx.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[file,hash]); });
  }
}
