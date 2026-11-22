import { INATIVIDADE_MS } from './auth.mjs';
import { expirarImportacoes } from './data/importacao.mjs';

// Limpeza da rotina diária (contrato 10): as prévias de importação vencidas ficam expiradas (sem as linhas) e saem do banco
// os links usados ou vencidos, os logins pela metade vencidos, as sessões vencidas e os limites antigos.
export async function limpar(db,now=new Date()) {
  const t=now.toISOString(),apagar=async(sql,params)=>(await db.query(`${sql} RETURNING 1`,params)).rows.length;
  return {
    importacoes:await expirarImportacoes(db,now),
    links:await apagar('DELETE FROM access_tokens WHERE used_at IS NOT NULL OR expires_at<=$1',[t]),
    logins:await apagar('DELETE FROM login_challenges WHERE expires_at<=$1',[t]),
    sessoes:await apagar('DELETE FROM sessions WHERE expires_at<=$1 OR last_seen_at<=$2',[t,new Date(now.getTime()-INATIVIDADE_MS).toISOString()]),
    limites:await apagar('DELETE FROM rate_limits WHERE reset_at<$1',[t])
  };
}
