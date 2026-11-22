import { randomUUID } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit, diff } from '../lib/auditoria.mjs';
import { validEmail } from '../auth.mjs';
import { MESES, SITUACOES } from '../lib/datas.mjs';
import { foraDoAr, empresaDoSite, idEmpresaValido } from '../integracao.mjs';
import { rejectExtra, needVersion, conflito, texto, iso, lista, filtro, casa, collator } from './comum.mjs';
import { assinaturaVM, assinaturasDoCliente, situacaoDe, empresaVM, SELECT as SELECT_ASSINATURAS } from './assinaturas.mjs';
import { enfileirar } from './fila.mjs';
import { linhaDoTempo } from './cobranca.mjs';
import { planosSite } from './planos.mjs';
import { desempenhoDaFicha } from './desempenho.mjs';
import { ETAPAS } from '../lib/regua.mjs';
import { relatorioDaFicha } from './relatorio.mjs';
import { pode } from '../permissoes.mjs';

// Clientes e vínculos com as empresas do guia (contrato 6.6 a 6.8 e 7.5). cx é o contexto das assinaturas (hoje,
// tolerância, origem do site).
// v0.12.0: acessosUrl abre a lista de acessos ao painel do admin do site já na empresa (6.7). Só o endereço: a gestão não
// convida nem vê convites, e a integração não muda.
const empresasVM=(rows,siteOrigin)=>rows.map(b=>({...empresaVM(b.business_id,{nome:b.nome_cache,slug:b.slug_cache,foto:b.foto_cache},siteOrigin),
  slug:b.slug_cache,bairro:b.bairro_cache,vinculadaEm:iso(b.vinculado_em),
  acessosUrl:siteOrigin?`${siteOrigin}/admin/acessos?empresa=${encodeURIComponent(b.business_id)}`:''}));
const empresasDe=async(db,id)=>(await db.query('SELECT * FROM client_businesses WHERE client_id=$1 ORDER BY nome_cache,business_id',[id])).rows;
async function cliente(db,id,{lock=false}={}) {
  if(lock)await db.query('SELECT 1 FROM clients WHERE id=$1 FOR UPDATE',[id]);
  const c=(await db.query('SELECT * FROM clients WHERE id=$1',[id])).rows[0];if(!c)throw fail('Cliente não encontrado.',404);
  return c;
}

// A situação do cliente é a pior das assinaturas; o plano principal, o da não cancelada de maior valor mensal (6.6).
function resumoAssinaturas(subs,cx) {
  const sits=subs.map(s=>situacaoDe(s,cx)).sort((a,b)=>SITUACOES.indexOf(a)-SITUACOES.indexOf(b));
  const principal=subs.filter(s=>s.status!=='cancelada'&&s.plano_site)
    .sort((a,b)=>b.valor_centavos/MESES[b.ciclo]-a.valor_centavos/MESES[a.ciclo]||a.inicio.localeCompare(b.inicio)||new Date(a.criado_em)-new Date(b.criado_em))[0];
  return {situacao:sits[0]||null,planoPrincipal:principal?{id:principal.plano_site,nome:principal.plano_nome}:null};
}
export async function listarClientes(db,url,cx) {
  const q=filtro(url,'q'),status=filtro(url,'status'),sit=filtro(url,'situacao'),digitos=q.replace(/\D/g,'');
  const [clientes,vinculos,subs]=await Promise.all([db.query('SELECT * FROM clients'),db.query('SELECT client_id,nome_cache FROM client_businesses'),db.query(SELECT_ASSINATURAS)]).then(r=>r.map(x=>x.rows));
  const itens=clientes.map(c=>{
    const emp=vinculos.filter(v=>v.client_id===c.id),r=resumoAssinaturas(subs.filter(s=>s.client_id===c.id),cx);
    return {c,emp,linha:{id:c.id,nome:c.nome,responsavel:c.responsavel,whatsapp:c.whatsapp,empresas:emp.length,planoPrincipal:r.planoPrincipal,situacao:r.situacao,status:c.status}};
  }).filter(({c,emp,linha})=>(casa(q,c.nome,c.responsavel,c.email,...emp.map(e=>e.nome_cache))||(digitos.length>=4&&c.whatsapp.includes(digitos)))
    &&(!status||c.status===status)&&(!sit||(sit==='sem-assinatura'?linha.situacao===null:linha.situacao===sit)))
    .map(x=>x.linha).sort((a,b)=>collator.compare(a.nome,b.nome));
  return lista(itens,url);
}

// podeCobrar (a ação cobrar de quem pede) libera o link do WhatsApp do relatório do mês (v0.11.0). As etapas (v0.14.0) dão o
// nome da etapa do lembrete na linha do tempo (15.3).
export async function obterFicha(db,id,cx,{podeCobrar=false}={}) {
  const c=await cliente(db,id);
  const subs=(await assinaturasDoCliente(db,id)).sort((a,b)=>(a.status==='cancelada')-(b.status==='cancelada')||new Date(b.criado_em)-new Date(a.criado_em));
  const empresas=empresasVM(await empresasDe(db,id),cx.siteOrigin);
  return {id:c.id,nome:c.nome,responsavel:c.responsavel,whatsapp:c.whatsapp,email:c.email,notas:c.notas,status:c.status,criadoEm:iso(c.criado_em),version:c.version,
    empresas,assinaturas:subs.map(s=>assinaturaVM(s,cx)),desempenho:await desempenhoDaFicha(db,empresas,cx),
    relatorio:await relatorioDaFicha(db,{cliente:c,empresas},cx,{podeCobrar}),linhaDoTempo:await linhaDoTempo(db,id),etapas:ETAPAS};
}

// WhatsApp (7.2): com máscara ou sem; DDD e número viram 55 + DDD + número.
export function whatsappDe(v) {
  if(v===undefined)return undefined;
  if(v===null||v==='')return '';
  if(typeof v!=='string')throw fail('Informe o WhatsApp com DDD, como (21) 98765-4321.',422,'whatsapp');
  // Com "+" na frente, o código do país já veio: só o 55 é aceito.
  let d=v.replace(/\D/g,'');if(!v.trim().startsWith('+')&&(d.length===10||d.length===11))d=`55${d}`;
  if(!/^55\d{10,11}$/.test(d))throw fail('Informe o WhatsApp com DDD, como (21) 98765-4321.',422,'whatsapp');
  return d;
}
function campos(p,{novo}) {
  const v={};
  if(novo||p.nome!==undefined) {
    const nome=typeof p.nome==='string'?p.nome.trim().replace(/\s+/g,' '):'';
    if(nome.length<2)throw fail('Informe o nome do cliente.',422,'nome');
    if(nome.length>160)throw fail('Use até 160 caracteres.',422,'nome');
    v.nome=nome;
  }
  const resp=texto(p.responsavel,'responsavel',120);if(resp!==undefined)v.responsavel=resp;
  const w=whatsappDe(p.whatsapp);if(w!==undefined)v.whatsapp=w;
  if(p.email!==undefined){const e=typeof p.email==='string'?p.email.trim().toLowerCase():p.email===null?'':null;if(e===null||(e&&!validEmail(e)))throw fail('Informe um e-mail válido.',422,'email');v.email=e;}
  if(p.notas!==undefined){if(typeof p.notas!=='string'&&p.notas!==null)throw fail('Valor inválido.',422,'notas');const n=String(p.notas??'').trim();if(n.length>2000)throw fail('Use até 2.000 caracteres.',422,'notas');v.notas=n;}
  return v;
}
const CAMPOS=['nome','responsavel','whatsapp','email','notas'];
const auditoriaDe=c=>Object.fromEntries([...CAMPOS,'status'].map(k=>[k,c[k]]));

// A criação, dentro da transação de quem chama: a tela de cliente novo (6.8) e o "Virar cliente" dos interessados (14.4).
export async function inserirCliente(tx,{v,session,ip,now}) {
  const c={responsavel:'',whatsapp:'',email:'',notas:'',...v,id:randomUUID()};
  await tx.query('INSERT INTO clients(id,nome,responsavel,whatsapp,email,notas,criado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',[c.id,c.nome,c.responsavel,c.whatsapp,c.email,c.notas,now.toISOString()]);
  await audit(tx,{actor:session.user_id,action:'cliente_criado',type:'cliente',resource:c.id,after:auditoriaDe({...c,status:'ativo'}),ip});
  return c;
}
export async function criarCliente(db,{p,session,ip,now=new Date()},cx) {
  rejectExtra(p,CAMPOS);
  const v=campos(p,{novo:true});
  return db.transaction(async tx=>{
    const {id}=await inserirCliente(tx,{v,session,ip,now});
    return obterFicha(tx,id,cx,{podeCobrar:pode(session.papel,'cobrar')});
  });
}

export async function editarCliente(db,{id,p,session,ip,now=new Date()},cx) {
  await cliente(db,id);
  rejectExtra(p,[...CAMPOS,'status','version']);const version=needVersion(p);
  const v=campos(p,{novo:false});
  if(p.status!==undefined){if(!['ativo','encerrado'].includes(p.status))throw fail('Situação: ativo ou encerrado.',422,'status');v.status=p.status;}
  return db.transaction(async tx=>{
    const c=await cliente(tx,id,{lock:true});if(c.version!==version)throw conflito();
    if(v.status==='encerrado'&&c.status!=='encerrado'&&(await tx.query("SELECT 1 FROM subscriptions WHERE client_id=$1 AND status<>'cancelada'",[id])).rows.length)
      throw fail('Cancele as assinaturas do cliente antes de encerrar.',422,'status');
    const mudou=diff(auditoriaDe(c),auditoriaDe({...c,...v}));
    if(!mudou.keys.length)return obterFicha(tx,id,cx,{podeCobrar:pode(session.papel,'cobrar')});
    const x={...c,...v};
    await tx.query('UPDATE clients SET nome=$2,responsavel=$3,whatsapp=$4,email=$5,notas=$6,status=$7,atualizado_em=$8,version=version+1 WHERE id=$1',[id,x.nome,x.responsavel,x.whatsapp,x.email,x.notas,x.status,now.toISOString()]);
    await audit(tx,{actor:session.user_id,action:'cliente_editado',type:'cliente',resource:id,before:mudou.before,after:mudou.after,ip});
    return obterFicha(tx,id,cx,{podeCobrar:pode(session.papel,'cobrar')});
  });
}

// Vínculo (7.5): a empresa é conferida no site na hora e guardada com nome, slug, bairro e foto.
export async function vincular(db,{id,businessId,session,ip,now=new Date(),site},cx) {
  const c=await cliente(db,id);
  if(!idEmpresaValido(businessId))throw fail('Empresa não encontrada no guia.',404);
  if(!site)throw foraDoAr();
  const r=await site.empresas({ids:[businessId]});
  const e=(Array.isArray(r?.itens)?r.itens:[]).map(empresaDoSite).find(x=>x?.id===businessId);
  if(!e)throw fail('Empresa não encontrada no guia.',404);
  return db.transaction(async tx=>{
    const dono=(await tx.query('SELECT c.id,c.nome FROM client_businesses b JOIN clients c ON c.id=b.client_id WHERE b.business_id=$1',[businessId])).rows[0];
    if(dono)throw dono.id===id?fail('Esta empresa já está vinculada a este cliente.',409,'businessId'):fail(`Esta empresa já é do cliente ${dono.nome}.`,409,'businessId');
    await tx.query('INSERT INTO client_businesses(client_id,business_id,nome_cache,slug_cache,bairro_cache,foto_cache,vinculado_em,vinculado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [c.id,e.id,e.nome,e.slug,e.bairro,e.foto,now.toISOString(),session.user_id]);
    await audit(tx,{actor:session.user_id,action:'empresa_vinculada',type:'cliente',resource:id,after:{empresa:e.id,nome:e.nome},ip});
    return {empresas:empresasVM(await empresasDe(tx,id),cx.siteOrigin)};
  });
}
export async function desvincular(db,{id,businessId,session,ip,now=new Date()},cx) {
  await cliente(db,id);
  return db.transaction(async tx=>{
    const b=(await tx.query('SELECT * FROM client_businesses WHERE client_id=$1 AND business_id=$2',[id,businessId])).rows[0];
    if(!b)throw fail('Esta empresa não está vinculada a este cliente.',404);
    if((await tx.query("SELECT 1 FROM subscriptions WHERE business_id=$1 AND status<>'cancelada'",[businessId])).rows.length)
      throw fail('Cancele a assinatura desta empresa antes de desvincular.',422,'businessId');
    await tx.query('DELETE FROM client_businesses WHERE client_id=$1 AND business_id=$2',[id,businessId]);
    await enfileirar(tx,{businessId,plano:null,gerida:false,motivo:'desvinculo',now});
    await audit(tx,{actor:session.user_id,action:'empresa_desvinculada',type:'cliente',resource:id,before:{empresa:businessId,nome:b.nome_cache},ip});
    return {empresas:empresasVM(await empresasDe(tx,id),cx.siteOrigin)};
  });
}

// Busca das empresas do guia para vincular (7.1), com o cliente que já tem cada uma.
export async function empresasSite(db,url,{site,siteOrigin}) {
  if(!site)throw foraDoAr();
  const q=filtro(url,'q'),page=Math.max(1,parseInt(url.searchParams.get('page')||'1',10)||1);
  const r=await site.empresas({q,page});
  const itens=(Array.isArray(r?.itens)?r.itens:[]).map(empresaDoSite).filter(Boolean);
  // O plano vem com o nome da lista de planos do site (ou da última cópia); um plano que ela não tem vem com o id (v0.8.1).
  const planos=itens.some(e=>e.plano)?(await planosSite(db,{site})).itens:[];
  const planoDe=id=>id?{id,nome:planos.find(p=>p.id===id)?.nome||id}:null;
  const donos=itens.length?(await db.query('SELECT b.business_id,c.id,c.nome FROM client_businesses b JOIN clients c ON c.id=b.client_id WHERE b.business_id=ANY($1)',[itens.map(e=>e.id)])).rows:[];
  return {itens:itens.map(e=>{const d=donos.find(x=>x.business_id===e.id);
    return {id:e.id,nome:e.nome,slug:e.slug,bairro:e.bairro,status:e.status,plano:planoDe(e.plano),...empresaVM(e.id,e,siteOrigin),cliente:d?{id:d.id,nome:d.nome}:null};}),
    total:Number.isSafeInteger(r?.total)?r.total:itens.length,pagina:Number.isSafeInteger(r?.pagina)?r.pagina:page,paginas:Number.isSafeInteger(r?.paginas)?r.paginas:1};
}
