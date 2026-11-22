import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit } from '../lib/auditoria.mjs';
import { preencher, linkWhatsapp } from '../lib/mensagem.mjs';
import { rejectExtra, iso } from './comum.mjs';
import { mesesAte, rotuloMes, frasesDoMesAnterior } from './desempenho.mjs';
import { contatoVM } from './cobranca.mjs';

// Relatório do mês para o anunciante (contrato 6.7, 7.3 e 7.4, v0.11.0). O relatório é uma página do painel do site
// (seção 20 do contrato do site); a gestão só monta o endereço, a mensagem pelo WhatsApp do cliente e registra o envio.
// O mês é o último fechado, o anterior ao atual, e a frase do {desempenho} sai da cópia das métricas, como na cobrança.

// Ficha (6.7): uma linha por empresa vinculada ({id, nome} da ficha), com o link e o último envio do mês.
export async function relatorioDaFicha(db,{cliente,empresas},cx,{podeCobrar=false}={}) {
  const mes=mesesAte(cx.hoje,2)[0],rotulo=rotuloMes(mes),url=id=>cx.siteOrigin?`${cx.siteOrigin}/painel/${id}/relatorio/${mes}`:'';
  const pode=podeCobrar&&Boolean(cliente.whatsapp)&&Boolean(cx.siteOrigin);
  const frases=pode&&empresas.length&&cx.modeloRelatorio.includes('{desempenho}')?await frasesDoMesAnterior(db,empresas.map(e=>e.id),cx):null;
  const envios=new Map((await db.query(`SELECT DISTINCT ON (k.business_id) k.business_id,k.feito_em,k.feito_por,u.nome FROM contacts k LEFT JOIN users u ON u.id=k.feito_por
    WHERE k.client_id=$1 AND k.tipo='relatorio' AND k.mes=$2 ORDER BY k.business_id,k.feito_em DESC`,[cliente.id,mes])).rows.map(r=>[r.business_id,r]));
  return {mes,rotulo,empresas:empresas.map(e=>{
    const ultimo=envios.get(e.id),valores={responsavel:cliente.responsavel||cliente.nome,cliente:cliente.nome,empresa:e.nome,mes:rotulo,desempenho:frases?.get(e.id)||'',link:url(e.id)};
    return {id:e.id,url:url(e.id),linkWhatsapp:pode?linkWhatsapp(cliente.whatsapp,preencher(cx.modeloRelatorio,valores)):null,
      ultimoEnvio:ultimo?{em:iso(ultimo.feito_em),por:ultimo.feito_por?{id:ultimo.feito_por,nome:ultimo.nome||''}:null}:null};
  })};
}

// Envio (7.4): registra que o relatório de um mês foi aberto no WhatsApp do cliente. Pode ser enviado de novo.
export async function registrarRelatorio(db,{id,businessId,p,session,ip,now=new Date()},cx) {
  const c=(await db.query('SELECT id,whatsapp FROM clients WHERE id=$1',[id])).rows[0];if(!c)throw fail('Cliente não encontrado.',404);
  if(!(await db.query('SELECT 1 FROM client_businesses WHERE client_id=$1 AND business_id=$2',[id,businessId])).rows.length)
    throw fail('Esta empresa não está vinculada a este cliente.',404);
  rejectExtra(p,['mes']);
  if(typeof p.mes!=='string'||!mesesAte(cx.hoje,13).slice(0,12).includes(p.mes))throw fail('Escolha um dos 12 meses fechados antes do atual.',422,'mes');
  if(!c.whatsapp)throw fail('O cliente não tem WhatsApp.',422,'whatsapp');
  const k={id:randomUUID(),canal:'whatsapp',tipo:'relatorio',client_id:id,business_id:businessId,mes:p.mes,feito_em:now.toISOString()};
  return db.transaction(async tx=>{
    await tx.query('INSERT INTO contacts(id,canal,tipo,client_id,business_id,mes,feito_em,feito_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [k.id,k.canal,k.tipo,k.client_id,k.business_id,k.mes,k.feito_em,session.user_id]);
    await audit(tx,{actor:session.user_id,action:'relatorio_enviado',type:'cliente',resource:id,after:{empresa:businessId,mes:p.mes},ip});
    return contatoVM(k,{id:session.user_id,nome:session.nome});
  });
}
