import { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';

// Backup criptografado (AES-256-GCM, chave derivada da BACKUP_PASSPHRASE), no mesmo formato do site (api/backup.mjs).
// TABELAS: o que entra, na ordem de restauração (chaves estrangeiras). Cada módulo novo acrescenta as suas tabelas aqui.
// FORA: o que nunca entra. Sessões, logins em andamento, limites, links de uso único e códigos de recuperação morrem na
// restauração. A cópia das métricas do site (site_metrics) também fica fora: a rotina do dia seguinte lê de novo.
// O teste tests/api/backup.test.mjs exige que toda tabela do banco esteja numa das duas listas.
export const TABELAS=['users','clients','client_businesses','subscriptions','payments','contacts','settings','site_plans','plan_sync','imports','audit_log'];
export const FORA=['schema_migrations','sessions','login_challenges','recovery_codes','access_tokens','rate_limits','site_metrics'];
// Tabelas que a migração já cria com uma linha padrão: na restauração, a linha do backup toma o lugar dela.
const PADRAO=['settings'];
const IDENTIDADES={plan_sync:'seq'};
// A conta restaurada volta sem senha e sem 2FA: precisa de um link de senha novo e de configurar o 2FA de novo.
export const RESTORED_PASSWORD='!restaurado-sem-senha';
// A prévia da importação (nomes, e-mails e telefones do arquivo) não entra (8.6): a prévia aberta volta como expirada.
const SEM={users:['password_hash','totp_secret','totp_ultimo_passo'],imports:['previa']};
export async function backup(db,passphrase) {
  if(typeof passphrase!=='string'||passphrase.length<16) throw new Error('BACKUP_PASSPHRASE deve ter ao menos 16 caracteres');
  const {data,migrations}=await db.transaction(async tx=> {
    // Todas as tabelas e a versão do schema precisam vir do mesmo instante. Em READ COMMITTED, um pagamento
    // concorrente poderia entrar em payments depois de subscriptions já ter sido copiada com o vencimento antigo.
    await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data={}; for(const table of TABELAS) data[table]=(await tx.query(`SELECT * FROM ${table}`)).rows;
    const migrations=(await tx.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows;
    return {data,migrations};
  });
  for(const [table,cols] of Object.entries(SEM)) for(const row of data[table]) for(const c of cols) delete row[c];
  for(const row of data.imports) if(row.status==='previa') row.status='expirada';
  const plain=Buffer.from(JSON.stringify({format:1,migrations,data}));
  const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(passphrase,salt,32);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  return {format:1,algorithm:'aes-256-gcm',salt:salt.toString('hex'),iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:encrypted.toString('base64'),sha256:createHash('sha256').update(encrypted).digest('hex')};
}
export async function restore(db,archive,passphrase) {
  if(archive.format!==1 || archive.algorithm!=='aes-256-gcm') throw new Error('Formato não suportado');
  if(!/^[0-9a-f]{32}$/i.test(archive.salt||'')||!/^[0-9a-f]{24}$/i.test(archive.iv||'')||!/^[0-9a-f]{32}$/i.test(archive.tag||'')||!/^[0-9a-f]{64}$/i.test(archive.sha256||''))
    throw new Error('Parâmetros criptográficos inválidos');
  const encrypted=Buffer.from(archive.data,'base64');
  const hashReal=createHash('sha256').update(encrypted).digest();
  const hashArq=Buffer.from(archive.sha256,'hex');
  if(hashReal.length!==hashArq.length||!timingSafeEqual(hashReal,hashArq)) throw new Error('Checksum inválido');
  const key=scryptSync(passphrase,Buffer.from(archive.salt,'hex'),32);
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(archive.iv,'hex'),{authTagLength:16}); decipher.setAuthTag(Buffer.from(archive.tag,'hex'));
  const payload=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString());
  const migrations=(await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows;
  if(JSON.stringify(migrations)!==JSON.stringify(payload.migrations)) throw new Error('Versão de schema incompatível');
  await db.transaction(async tx=> {
    for(const table of TABELAS) if(!PADRAO.includes(table)&&(await tx.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n!==0) throw new Error('Restauração exige banco vazio, já migrado');
    for(const table of PADRAO) await tx.query(`DELETE FROM ${table}`);
    for(const table of TABELAS) {
      const allowed=(await tx.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['public',table])).rows.map(x=>x.column_name);
      if(!Array.isArray(payload.data[table])) throw new Error('Tabela ausente');
      for(const source of payload.data[table]) {
        const row=table==='users'?{...source,password_hash:RESTORED_PASSWORD,totp_ativo:false,totp_secret:null,totp_ultimo_passo:null}:source;
        const keys=Object.keys(row);
        if(!keys.length || keys.some(k=>!allowed.includes(k))) throw new Error('Coluna desconhecida');
        await tx.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,keys.map(k=>(row[k] && typeof row[k]==='object')?JSON.stringify(row[k]):row[k]));
      }
    }
    // As colunas de identidade continuam depois do maior valor restaurado.
    for(const [table,col] of Object.entries(IDENTIDADES))
      await tx.query(`SELECT setval(pg_get_serial_sequence('${table}','${col}'),COALESCE((SELECT max(${col}) FROM ${table}),0)+1,false)`);
  });
  return Object.fromEntries(TABELAS.map(t=>[t,payload.data[t].length]));
}
