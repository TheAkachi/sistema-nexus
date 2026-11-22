import { randomUUID } from 'node:crypto';

// Auditoria (contrato 4.8): quem, o quê, sobre qual registro, o valor antes e depois e o IP real.
// A tabela só aceita INSERT (gatilho na migração 001).
export async function audit(db,{actor=null,action,type='',resource,before=null,after=null,ip=''}) {
  await db.query('INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,before,after,ip) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)',
    [randomUUID(),actor,action,type,String(resource??''),before==null?null:JSON.stringify(before),after==null?null:JSON.stringify(after),ip||'']);
}
// Só os campos que mudaram, para o antes e o depois.
export function diff(before,after) {
  const keys=Object.keys(after).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
  return {before:Object.fromEntries(keys.map(k=>[k,before[k]??null])),after:Object.fromEntries(keys.map(k=>[k,after[k]])),keys};
}
