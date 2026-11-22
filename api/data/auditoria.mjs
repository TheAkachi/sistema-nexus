import { fail } from '../lib/erros.mjs';
import { diaValido } from '../lib/datas.mjs';
import { iso, filtro, pagina, POR_PAGINA, collator } from './comum.mjs';

// Leitura da auditoria (contrato 6.15), só para o admin. A tabela só aceita INSERT; aqui só se lê. Os dias de "de" e "ate"
// entram inteiros, no fuso de São Paulo (UTC−3, sem horário de verão desde 2019).
const semCuringa=v=>v.replace(/[\\%_]/g,'\\$&');
export async function listarAuditoria(db,url) {
  const acao=filtro(url,'acao'),usuario=filtro(url,'usuario'),recurso=filtro(url,'recurso'),q=filtro(url,'q'),de=filtro(url,'de'),ate=filtro(url,'ate');
  for(const [k,v] of [['de',de],['ate',ate]])if(v&&!diaValido(v))throw fail('Use a data no formato aaaa-mm-dd.',422,k);
  const cond=[],args=[],p=v=>(args.push(v),`$${args.length}`);
  if(acao)cond.push(`a.action=${p(acao)}`);
  if(usuario==='sistema')cond.push('a.actor_id IS NULL');else if(usuario)cond.push(`a.actor_id=${p(usuario)}`);
  if(recurso)cond.push(`a.resource_id=${p(recurso)}`);
  if(q){const n=p(semCuringa(q));cond.push(`(a.resource_id ILIKE '%'||${n}||'%' ESCAPE '\\' OR a.action ILIKE '%'||${n}||'%' ESCAPE '\\')`);}
  if(de)cond.push(`a.created_at>=(${p(de)}||'T00:00:00-03:00')::timestamptz`);
  if(ate)cond.push(`a.created_at<((${p(ate)}::date+1)::text||'T00:00:00-03:00')::timestamptz`);
  const where=cond.length?`WHERE ${cond.join(' AND ')}`:'',pg=pagina(url);
  const total=(await db.query(`SELECT count(*)::int AS n FROM audit_log a ${where}`,args)).rows[0].n;
  const rows=(await db.query(`SELECT a.*,u.nome,u.email FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ${where}
    ORDER BY a.created_at DESC,a.id LIMIT ${POR_PAGINA} OFFSET ${(pg-1)*POR_PAGINA}`,args)).rows;
  const acoes=(await db.query('SELECT DISTINCT action FROM audit_log ORDER BY action')).rows.map(r=>r.action);
  const pessoas=(await db.query('SELECT id,nome,email FROM users')).rows.map(u=>({id:u.id,nome:u.nome||u.email})).sort((a,b)=>collator.compare(a.nome,b.nome));
  return {itens:rows.map(a=>({id:a.id,em:iso(a.created_at),acao:a.action,recurso:{tipo:a.resource_type,id:a.resource_id},
      por:a.actor_id?{id:a.actor_id,nome:a.nome||'',email:a.email||''}:null,antes:a.before,depois:a.after,ip:a.ip})),
    total,pagina:pg,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),opcoes:{acoes,pessoas}};
}
