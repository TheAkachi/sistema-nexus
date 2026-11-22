import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { hoje as diaDe, dias, diaValido } from '../lib/datas.mjs';
import { foraDoAr } from '../integracao.mjs';
import { rejectExtra, needVersion, conflito, texto, iso, lista, filtro, casa, normalize, collator } from './comum.mjs';
import { whatsappDe, inserirCliente } from './clientes.mjs';

// Interessados, os leads (contrato 14), só com LEADS_LIGADOS=1 (14.1). O pedido vem do cadastro do site com o código, o
// texto da mensagem, as respostas, a origem e a hora; o nome e o WhatsApp a equipe completa quando a pessoa escreve.
// [SEG] A base legal, a guarda, o lead perdido e o pedido de exclusão esperam a revisão de segurança (14.9).
export const leadsDoAmbiente=(valor=process.env.LEADS_LIGADOS)=>valor==='1';
const CODIGO=/^[ACDEFHJKMNPRTUVWXY3479]{4,5}$/,GUARDA_SITE_DIAS=30;
// [SEG] 14.2 e item 8 de 14.9: as tabelas novas não estão nem em TABELAS nem em FORA do api/backup.mjs (do colaborador) até a
// revisão decidir. Hoje o backup não as leva; restaurado o banco, a próxima leitura traz de novo os pedidos que o site ainda tem.
export const BACKUP_SEG=['leads','lead_leituras'];

// O que vem do site é conferido antes de entrar no banco: o código, a hora, textos curtos e as respostas como objeto.
function pedidoDoSite(p) {
  if(!p||typeof p!=='object'||typeof p.codigo!=='string'||!CODIGO.test(p.codigo)||typeof p.criadoEm!=='string')return null;
  const quando=new Date(p.criadoEm);if(Number.isNaN(quando.getTime()))return null;
  const r=p.respostas,respostas=r&&typeof r==='object'&&!Array.isArray(r)&&JSON.stringify(r).length<=4000?r:{};
  return {codigo:p.codigo,texto:typeof p.texto==='string'?p.texto.slice(0,4000):'',respostas,
    origem:typeof p.origem==='string'&&/^[a-z0-9-]{0,60}$/.test(p.origem)?p.origem:'',criadoEm:quando.toISOString()};
}

// A leitura (14.3): pela rotina diária, pelo comando leads e pelo "Buscar agora". Cada volta pede desde a hora do último
// pedido lido (inclusive), então um pedido apagado ou criado no meio não desloca os outros; o repetido sai pelo código e
// pela hora. Se falha, o cursor fica onde estava, com o erro e a hora da tentativa.
export async function lerPedidos(db,{site,now=new Date(),actor=null,ip=''}) {
  try {
    if(!site)throw foraDoAr();
    const cursor=iso((await db.query('SELECT cursor FROM lead_leituras WHERE id=1')).rows[0]?.cursor);
    let desde=cursor||new Date(now.getTime()-(GUARDA_SITE_DIAS+1)*86400000).toISOString();
    const pedidos=[];
    for(let volta=0;volta<1000;volta++) {
      const r=await site.pedidos({desde});
      if(r===null)throw Object.assign(new Error('Os pedidos estão desligados no guia.'),{status:502});
      if(!r||typeof r!=='object'||!Array.isArray(r.itens))throw Object.assign(new Error('Resposta inválida do guia.'),{status:502});
      const itens=r.itens.map(pedidoDoSite).filter(Boolean),ultimo=itens.at(-1)?.criadoEm;
      pedidos.push(...itens);
      if((Number(r.paginas)||1)<=1||!ultimo||ultimo===desde)break;
      desde=ultimo;
    }
    const maisNovo=pedidos.reduce((m,p)=>p.criadoEm>m?p.criadoEm:m,'')||null;
    const novos=await db.transaction(async tx=>{
      let n=0;
      for(const p of pedidos)n+=(await tx.query(`INSERT INTO leads(id,codigo,texto,respostas,origem,pedido_em,recebido_em,atualizado_em) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$7)
        ON CONFLICT (codigo,pedido_em) DO NOTHING RETURNING id`,[randomUUID(),p.codigo,p.texto,JSON.stringify(p.respostas),p.origem,p.criadoEm,now.toISOString()])).rows.length;
      // GREATEST: duas leituras ao mesmo tempo (a rotina e o "Buscar agora") não levam o cursor para trás.
      await tx.query(`INSERT INTO lead_leituras(id,cursor,lido_em,erro,tentado_em) VALUES(1,$1,$2,'',$2)
        ON CONFLICT(id) DO UPDATE SET cursor=GREATEST(lead_leituras.cursor,EXCLUDED.cursor),lido_em=$2,erro='',tentado_em=$2`,[maisNovo,now.toISOString()]);
      await audit(tx,{actor,action:'leads_lidos',type:'leads',resource:'1',after:{novos:n},ip});
      return n;
    });
    return {novos,erro:''};
  } catch(e) {
    const erro=e.status===503?'O guia não respondeu.':e.status===502?e.message:'Falha ao ler os pedidos.';
    await db.transaction(async tx=>{
      await tx.query(`INSERT INTO lead_leituras(id,erro,tentado_em) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET erro=$1,tentado_em=$2`,[erro,now.toISOString()]);
      await audit(tx,{actor,action:'leads_lidos',type:'leads',resource:'1',after:{novos:0,erro},ip});
    });
    return {novos:0,erro};
  }
}

const SELECT=`SELECT l.*,l.proxima_em::text AS proxima_dia,c.nome AS cliente_nome FROM leads l LEFT JOIN clients c ON c.id=l.client_id`;
const linhaVM=l=>({id:l.id,codigo:l.codigo,nome:l.nome,whatsapp:l.whatsapp,situacao:l.situacao,pedidoEm:iso(l.pedido_em),proximaAcao:l.proxima_acao,proximaEm:l.proxima_dia});
const leadVM=l=>({id:l.id,codigo:l.codigo,texto:l.texto,respostas:l.respostas,origem:l.origem,pedidoEm:iso(l.pedido_em),recebidoEm:iso(l.recebido_em),
  nome:l.nome,whatsapp:l.whatsapp,situacao:l.situacao,motivoPerda:l.motivo_perda,perdidoEm:iso(l.perdido_em),proximaAcao:l.proxima_acao,proximaEm:l.proxima_dia,
  notas:l.notas,cliente:l.client_id?{id:l.client_id,nome:l.cliente_nome}:null,virouClienteEm:iso(l.virou_cliente_em),atualizadoEm:iso(l.atualizado_em),version:l.version});
async function linha(db,id,{lock=false}={}) {
  if(lock)await db.query('SELECT 1 FROM leads WHERE id=$1 FOR UPDATE',[id]);
  const l=(await db.query(`${SELECT} WHERE l.id=$1`,[id])).rows[0];if(!l)throw fail('Interessado não encontrado.',404);
  return l;
}

// Lista (14.4): q acha pelo código (também só o começo, e "Pedido A7K3" como vem na mensagem), pelo nome ou por 4 ou mais
// dígitos do WhatsApp; do pedido mais novo para o mais velho. leitura diz como foi a última leitura dos pedidos.
export async function listarLeads(db,url) {
  const q=filtro(url,'q'),sit=filtro(url,'situacao'),codigo=q.toUpperCase().replace(/^PEDIDO\s*/,'').replace(/\s+/g,''),digitos=q.replace(/\D/g,'');
  const rows=(await db.query(`${SELECT} ORDER BY l.pedido_em DESC,l.codigo`)).rows;
  const itens=rows.filter(l=>(!q||(codigo&&l.codigo.startsWith(codigo))||casa(q,l.nome)&&l.nome||(digitos.length>=4&&l.whatsapp.includes(digitos)))&&(!sit||l.situacao===sit)).map(linhaVM);
  const leitura=(await db.query('SELECT lido_em,erro,tentado_em FROM lead_leituras WHERE id=1')).rows[0];
  return {...lista(itens,url),leitura:{lidoEm:iso(leitura?.lido_em),erro:leitura?.erro||'',tentadoEm:iso(leitura?.tentado_em)}};
}
export const obterLead=async(db,id)=>leadVM(await linha(db,id));

// Edição (14.4): a situação muda entre novo, em conversa, proposta e perdido; o cliente só pelo "Virar cliente".
const CAMPOS=['nome','whatsapp','situacao','motivoPerda','proximaAcao','proximaEm','notas'];
const auditoriaDe=l=>({nome:l.nome,whatsapp:l.whatsapp,situacao:l.situacao,motivoPerda:l.motivo_perda,proximaAcao:l.proxima_acao,proximaEm:l.proxima_dia,notas:l.notas});
export async function editarLead(db,{id,p,session,ip,now=new Date()}) {
  await linha(db,id);
  rejectExtra(p,[...CAMPOS,'version']);const version=needVersion(p);
  const v={};
  if(p.nome!==undefined){const nome=texto(p.nome,'nome',160);if(nome&&nome.length<2)throw fail('Use pelo menos 2 caracteres.',422,'nome');v.nome=nome;}
  const w=whatsappDe(p.whatsapp);if(w!==undefined)v.whatsapp=w;
  if(p.situacao!==undefined&&!['novo','em-conversa','proposta','perdido'].includes(p.situacao))
    throw fail('Escolha novo, em conversa, proposta enviada ou perdido. Para virar cliente, use o botão.',422,'situacao');
  if(p.situacao!==undefined)v.situacao=p.situacao;
  if(p.motivoPerda!==undefined)v.motivoPerda=texto(p.motivoPerda,'motivoPerda',200);
  if(p.proximaAcao!==undefined)v.proximaAcao=texto(p.proximaAcao,'proximaAcao',200);
  if(p.proximaEm!==undefined){if(p.proximaEm!==null&&!diaValido(p.proximaEm))throw fail('Informe a data como aaaa-mm-dd.',422,'proximaEm');v.proximaEm=p.proximaEm;}
  if(p.notas!==undefined){if(typeof p.notas!=='string'&&p.notas!==null)throw fail('Valor inválido.',422,'notas');const n=String(p.notas??'').trim();if(n.length>2000)throw fail('Use até 2.000 caracteres.',422,'notas');v.notas=n;}
  return db.transaction(async tx=>{
    const l=await linha(tx,id,{lock:true});if(l.version!==version)throw conflito();
    if(v.situacao!==undefined&&l.situacao==='cliente')throw fail('Este interessado já virou cliente.',422,'situacao');
    const antes=auditoriaDe(l),x={...antes,...v};
    if(x.situacao==='perdido'){if(x.motivoPerda.length<3)throw fail('Diga o motivo da perda, com pelo menos 3 caracteres.',422,'motivoPerda');}
    else if(v.motivoPerda)throw fail('O motivo só vale para o interessado perdido.',422,'motivoPerda');
    else x.motivoPerda='';
    const mudou=diff(antes,x);
    if(!mudou.keys.length)return leadVM(l);
    const perdidoEm=x.situacao!=='perdido'?null:l.situacao==='perdido'?iso(l.perdido_em):now.toISOString();
    await tx.query(`UPDATE leads SET nome=$2,whatsapp=$3,situacao=$4,motivo_perda=$5,perdido_em=$6,proxima_acao=$7,proxima_em=$8,notas=$9,atualizado_em=$10,version=version+1 WHERE id=$1`,
      [id,x.nome,x.whatsapp,x.situacao,x.motivoPerda,perdidoEm,x.proximaAcao,x.proximaEm,x.notas,now.toISOString()]);
    // [SEG] item 9 de 14.9: o nome e o WhatsApp mudados entram na auditoria, como no cliente.
    await audit(tx,{actor:session.user_id,action:'lead_editado',type:'lead',resource:id,before:mudou.before,after:mudou.after,ip});
    return leadVM(await linha(tx,id));
  });
}

// Virar cliente (14.4): cria o cliente com o nome e o WhatsApp do lead, como a tela de cliente novo, e liga os dois.
export async function virarCliente(db,{id,p,session,ip,now=new Date()}) {
  await linha(db,id);
  rejectExtra(p,['version']);const version=needVersion(p);
  return db.transaction(async tx=>{
    const l=await linha(tx,id,{lock:true});if(l.version!==version)throw conflito();
    if(l.situacao==='cliente')throw fail('Este interessado já virou cliente.',422,'situacao');
    if(l.nome.length<2)throw fail('Complete o nome antes de virar cliente.',422,'nome');
    const cliente=await inserirCliente(tx,{v:{nome:l.nome,whatsapp:l.whatsapp},session,ip,now});
    await tx.query(`UPDATE leads SET situacao='cliente',client_id=$2,virou_cliente_em=$3,motivo_perda='',perdido_em=NULL,atualizado_em=$3,version=version+1 WHERE id=$1`,
      [id,cliente.id,now.toISOString()]);
    await audit(tx,{actor:session.user_id,action:'lead_convertido',type:'lead',resource:id,before:{situacao:l.situacao},after:{situacao:'cliente',cliente:cliente.id},ip});
    return {lead:leadVM(await linha(tx,id)),cliente:{id:cliente.id,nome:cliente.nome}};
  });
}

// O funil nos Indicadores (14.6): só números, pelos 12 meses dos Indicadores, no fuso de São Paulo.
const COMO='Pedidos do cadastro do site pelo mês do pedido, convertidos pelo mês em que viraram cliente e perdidos pelo mês em que foram dados como perdidos. Os motivos e o tempo até virar cliente contam os 12 meses.';
export async function funilDe(db,meses,atual) {
  const rows=(await db.query('SELECT pedido_em,situacao,motivo_perda,perdido_em,virou_cliente_em FROM leads')).rows;
  const mes=d=>d?diaDe(new Date(d)).slice(0,7):null,dentro=d=>{const m=mes(d);return Boolean(m)&&m>=meses[0]&&m<=meses[11];};
  const perdidos=rows.filter(l=>l.situacao==='perdido');
  const porMes=meses.map(m=>({mes:m,novos:rows.filter(l=>mes(l.pedido_em)===m).length,convertidos:rows.filter(l=>mes(l.virou_cliente_em)===m).length,
    perdidos:perdidos.filter(l=>mes(l.perdido_em)===m).length,parcial:m===atual}));
  // Os motivos juntam pelo texto sem acento, maiúscula nem pontuação; vale a escrita do perdido mais recente.
  const grupos=new Map();
  for(const l of perdidos.filter(l=>dentro(l.perdido_em)).sort((a,b)=>new Date(b.perdido_em)-new Date(a.perdido_em))) {
    const k=normalize(l.motivo_perda).replace(/[^a-z0-9]+/g,' ').trim();
    if(!grupos.has(k))grupos.set(k,{motivo:l.motivo_perda,qtd:0});
    grupos.get(k).qtd++;
  }
  const motivosPerda=[...grupos.values()].sort((a,b)=>b.qtd-a.qtd||collator.compare(a.motivo,b.motivo)).slice(0,10);
  const tempos=rows.filter(l=>dentro(l.virou_cliente_em)).map(l=>dias(diaDe(new Date(l.pedido_em)),diaDe(new Date(l.virou_cliente_em)))).sort((a,b)=>a-b);
  const meio=Math.floor(tempos.length/2),medianaDias=!tempos.length?null:tempos.length%2?tempos[meio]:(tempos[meio-1]+tempos[meio])/2;
  return {como:COMO,meses:porMes,motivosPerda,tempoAteCliente:{convertidos:tempos.length,medianaDias}};
}
