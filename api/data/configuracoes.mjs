import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { VARIAVEIS, VARIAVEIS_RELATORIO, desconhecidas } from '../lib/mensagem.mjs';
import { hoje } from '../lib/datas.mjs';
import { rejectExtra, needVersion, conflito, iso } from './comum.mjs';
import { whatsappDe } from './clientes.mjs';
import { enfileirar, planoEsperado } from './fila.mjs';
import { ETAPAS } from '../lib/regua.mjs';

// Configurações (contrato 6.14 e 7.2): só dados do negócio, numa linha só. A chave Pix e o WhatsApp do atendimento pedem
// reautenticação (rota), porque chegam ao afiliado como "como pagar" na "Minha assinatura" (9.5).
const SELECT='SELECT s.*,u.nome AS atualizado_nome FROM settings s LEFT JOIN users u ON u.id=s.atualizado_por WHERE s.id=1';
// v0.14.0: os modelos das etapas da régua (15.4), uma chave por etapa, com '' na que usa o modelo de cobrança. O banco
// guarda só os que existem.
const ETAPA_CHAVES=ETAPAS.map(e=>String(e.dias));
const modelosVM=m=>Object.fromEntries(ETAPA_CHAVES.map(k=>[k,m?.[k]||'']));
const juntarModelos=(atual,mudou)=>Object.fromEntries(ETAPA_CHAVES.map(k=>[k,k in mudou?mudou[k]:atual?.[k]||'']).filter(([,v])=>v));
const vm=s=>({chavePix:s.chave_pix,whatsappAtendimento:s.whatsapp_atendimento,modeloMensagem:s.modelo_mensagem,toleranciaDias:s.tolerancia_dias,variaveis:VARIAVEIS,
  modeloRelatorio:s.modelo_relatorio,variaveisRelatorio:VARIAVEIS_RELATORIO,etapas:ETAPAS,modelosLembrete:modelosVM(s.modelos_lembrete),
  atualizadoEm:iso(s.atualizado_em),atualizadoPor:s.atualizado_por?{id:s.atualizado_por,nome:s.atualizado_nome||''}:null,version:s.version});
export const obterConfiguracoes=async db=>vm((await db.query(SELECT)).rows[0]);

export async function editarConfiguracoes(db,{p,session,ip,now=new Date()}) {
  rejectExtra(p,['chavePix','whatsappAtendimento','modeloMensagem','modeloRelatorio','modelosLembrete','toleranciaDias','version']);const version=needVersion(p);
  const x={};let lembretes=null;
  if(p.chavePix!==undefined) {
    if(typeof p.chavePix!=='string'||/[\r\n]/.test(p.chavePix)||p.chavePix.trim().length>77)throw fail('Use até 77 caracteres, numa linha só.',422,'chavePix');
    x.chave_pix=p.chavePix.trim();
  }
  if(p.whatsappAtendimento!==undefined) {
    try{x.whatsapp_atendimento=whatsappDe(p.whatsappAtendimento)??'';}catch(e){throw fail(e.message,422,'whatsappAtendimento');}
  }
  if(p.modeloMensagem!==undefined) {
    const m=typeof p.modeloMensagem==='string'?p.modeloMensagem.trim():'';
    if(m.length<20||m.length>1000)throw fail('Use de 20 a 1.000 caracteres.',422,'modeloMensagem');
    const [x1]=desconhecidas(m);if(x1)throw fail(`Variável desconhecida: {${x1}}.`,422,'modeloMensagem');
    x.modelo_mensagem=m;
  }
  // v0.11.0: o modelo do relatório do mês, só com as variáveis dele e sempre com o {link}.
  if(p.modeloRelatorio!==undefined) {
    const m=typeof p.modeloRelatorio==='string'?p.modeloRelatorio.trim():'';
    if(m.length<20||m.length>1000)throw fail('Use de 20 a 1.000 caracteres.',422,'modeloRelatorio');
    const [x1]=desconhecidas(m,VARIAVEIS_RELATORIO);if(x1)throw fail(`Variável desconhecida: {${x1}}.`,422,'modeloRelatorio');
    if(!m.includes('{link}'))throw fail('Ponha o {link} do relatório na mensagem.',422,'modeloRelatorio');
    x.modelo_relatorio=m;
  }
  if(p.toleranciaDias!==undefined) {
    if(!Number.isInteger(p.toleranciaDias)||p.toleranciaDias<0||p.toleranciaDias>60)throw fail('Use de 0 a 60 dias.',422,'toleranciaDias');
    x.tolerancia_dias=p.toleranciaDias;
  }
  // v0.14.0: os modelos das etapas da régua (15.4), só os que mudaram. Vazio tira o modelo próprio da etapa.
  if(p.modelosLembrete!==undefined) {
    const m=p.modelosLembrete;
    if(!m||typeof m!=='object'||Array.isArray(m))throw fail('Mande os modelos por etapa.',422,'modelosLembrete');
    lembretes={};
    for(const [k,v] of Object.entries(m)) {
      if(!ETAPA_CHAVES.includes(k))throw fail(`Etapa desconhecida: ${k}.`,422,'modelosLembrete');
      const t=typeof v==='string'?v.trim():null,campo=`modelosLembrete.${k}`;
      if(t===null||(t&&(t.length<20||t.length>1000)))throw fail('Use de 20 a 1.000 caracteres.',422,campo);
      const [x1]=desconhecidas(t);if(x1)throw fail(`Variável desconhecida: {${x1}}.`,422,campo);
      lembretes[k]=t;
    }
  }
  return db.transaction(async tx=>{
    const s=(await tx.query('SELECT * FROM settings WHERE id=1 FOR UPDATE')).rows[0];if(s.version!==version)throw conflito();
    const campos=c=>({chavePix:c.chave_pix,whatsappAtendimento:c.whatsapp_atendimento,modeloMensagem:c.modelo_mensagem,modeloRelatorio:c.modelo_relatorio,
      modelosLembrete:modelosVM(c.modelos_lembrete),toleranciaDias:c.tolerancia_dias});
    const n={...s,...x};if(lembretes)n.modelos_lembrete=juntarModelos(s.modelos_lembrete,lembretes);
    const mudou=diff(campos(s),campos(n));
    if(!mudou.keys.length)return vm((await tx.query(SELECT)).rows[0]);
    await tx.query('UPDATE settings SET chave_pix=$1,whatsapp_atendimento=$2,modelo_mensagem=$3,modelo_relatorio=$4,modelos_lembrete=$5::jsonb,tolerancia_dias=$6,atualizado_em=$7,atualizado_por=$8,version=version+1 WHERE id=1',
      [n.chave_pix,n.whatsapp_atendimento,n.modelo_mensagem,n.modelo_relatorio,JSON.stringify(n.modelos_lembrete||{}),n.tolerancia_dias,now.toISOString(),session.user_id]);
    await audit(tx,{actor:session.user_id,action:'configuracoes_editadas',type:'configuracoes',resource:'1',before:mudou.before,after:mudou.after,ip});
    // Como pagar mudou: toda empresa com assinatura não cancelada recebe a "Minha assinatura" nova (9.5).
    if(mudou.keys.some(k=>['chavePix','whatsappAtendimento'].includes(k))) {
      const subs=(await tx.query("SELECT id,business_id,plano_site,status,vence_em::text AS vence_em FROM subscriptions WHERE status<>'cancelada' AND business_id IS NOT NULL")).rows;
      for(const a of subs)await enfileirar(tx,{businessId:a.business_id,plano:planoEsperado(a,hoje(now),n.tolerancia_dias),assinatura:a.id,motivo:'configuracao',now});
    }
    return vm((await tx.query(SELECT)).rows[0]);
  });
}
