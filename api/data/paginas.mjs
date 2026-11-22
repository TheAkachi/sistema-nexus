import { cookieValue, demoAtivo } from '../auth.mjs';
import { pode, podeDe } from '../permissoes.mjs';
import { decifrar } from '../lib/cifra.mjs';
import { otpauth, emGrupos, EMISSOR } from '../lib/totp.mjs';
import { qrSvg } from '../lib/qr.mjs';
import { CICLOS } from '../lib/datas.mjs';
import { pendente, tokenInfo } from '../login.mjs';
import { rota, titulo } from './rota.mjs';
import { UUID, filtro } from './comum.mjs';
import { listarEquipe } from './equipe.mjs';
import { listarClientes, obterFicha } from './clientes.mjs';
import { contexto, obterAssinatura } from './assinaturas.mjs';
import { planosSite } from './planos.mjs';
import { resumo, listarRenovacoes, telaPagamento } from './cobranca.mjs';
import { obterConfiguracoes } from './configuracoes.mjs';
import { listarAuditoria } from './auditoria.mjs';
import { listarImportacoes, obterImportacao } from './importacao.mjs';
import { indicadores } from './indicadores.mjs';
import { listarLeads, obterLead } from './leads.mjs';

// Páginas (contrato 6.1). Sem sessão, toda página fora do /entrar vai para o Entrar; com sessão, cada tela confere a
// permissão e recebe a moldura (usuario, csrf, pode, modulos, avisos, tela, filtros, dados).
export const MOTIVOS=['expirou','saiu','senha-definida'];
// next: só caminho interno, sem "//" nem "\", e nunca de volta ao próprio Entrar.
export function proximo(v) {
  const s=typeof v==='string'?v:'';
  return s.length<=300&&/^\/(?![/\\])[^\s\\]*$/.test(s)&&!/^\/entrar(\/|\?|$)/.test(s)?s:'';
}
// modulos (v0.13.0): os módulos que ligam por chave; interessados só com LEADS_LIGADOS e a ação clientes (14.5).
export const moldura=(s,{tela,filtros={},dados=null,avisos=[],leads=false})=>
  ({usuario:{id:s.user_id,nome:s.nome,email:s.email,papel:s.papel},csrf:s.csrf,pode:podeDe(s.papel),modulos:{interessados:Boolean(leads)&&pode(s.papel,'clientes')},avisos,tela,filtros,dados});

// Avisos da moldura (6.1): a chave Pix vazia, para quem cobra; um envio ao site falhando há mais de 1 hora, para o admin.
export async function avisosDe(db,s,now=new Date()) {
  const a=[];
  if(pode(s.papel,'cobrar')&&!(await db.query("SELECT 1 FROM settings WHERE id=1 AND chave_pix<>''")).rows.length)
    a.push({tipo:'chave-pix',texto:'Defina a chave Pix em Configurações. Sem ela, a mensagem de cobrança sai sem a chave.',href:'/configuracoes'});
  if(s.papel==='admin'&&(await db.query("SELECT 1 FROM plan_sync WHERE enviado_em IS NULL AND ultimo_erro<>'' AND criado_em<$1 LIMIT 1",[new Date(now.getTime()-3600000).toISOString()])).rows.length)
    a.push({tipo:'sincronizacao',texto:'O plano de uma ou mais empresas não chega ao guia há mais de 1 hora.',href:'/auditoria'});
  return a;
}
// O aviso site-fora (6.1) diz se a lista de planos é a última cópia ou se não há cópia nenhuma (v0.8.1).
const siteFora=semCopia=>({tipo:'site-fora',texto:semCopia?'O guia não respondeu, e não há cópia dos planos guardada. Tente de novo em instantes.':'O guia não respondeu. A lista de planos é a última cópia guardada.',href:''});
async function erro({db,now,leads},s,status,mensagem) {
  const title=titulo(status===403?'Sem permissão':status===404?'Página não encontrada':'Não foi possível abrir');
  return rota('erro',moldura(s,{tela:'erro',dados:{status,mensagem},avisos:await avisosDe(db,s,now),leads}),{title,status});
}
const semPermissao=(ctx,s)=>erro(ctx,s,403,'O seu papel não permite abrir esta tela.');
async function tela(ctx,s,{nome,title,filtros={},dados,avisos=[]}) {
  return rota(nome,moldura(s,{tela:nome,filtros,dados,avisos:[...await avisosDe(ctx.db,s,ctx.now),...avisos],leads:ctx.leads}),{title:titulo(title)});
}
// Os 404 de registro que não existe e os 422 da regra (pagar assinatura suspensa, por exemplo) viram a página de erro.
const ou404=async(ctx,s,fn)=>{try{return await fn();}catch(e){if(e.status===404)return erro(ctx,s,404,'Este registro não existe.');if(e.status===422)return erro(ctx,s,422,e.message);throw e;}};

async function loadEntrar({db,url,now,session,cookie,chave}) {
  const next=proximo(url.searchParams.get('next'));
  if(await session())return {redirect:next||'/'};
  const m=url.searchParams.get('motivo'),motivo=MOTIVOS.includes(m)?m:'';
  const d=await pendente(db,cookie,now),title=titulo('Entrar');
  if(!d){
    const demo=demoAtivo()&&Boolean((await db.query("SELECT 1 FROM users WHERE email='admin@nexus.demo' AND desativado=false AND totp_ativo=true")).rows.length);
    return rota('entrar',{etapa:'senha',next,motivo,email:'',configurar:null,...(demo?{demo:true}:{})},{title});
  }
  if(d.stage==='codigo')return rota('entrar',{etapa:'codigo',next,motivo:'',email:d.email,configurar:null},{title});
  const segredo=decifrar(chave,d.new_totp_secret,d.user_id),link=otpauth(segredo,d.email);
  return rota('entrar',{etapa:'configurar',next,motivo:'',email:d.email,configurar:{qrSvg:qrSvg(link),link,chave:emGrupos(segredo),emissor:EMISSOR,conta:d.email}},{title});
}
async function loadDefinirSenha({db,url,now}) {
  const t=url.searchParams.get('token'),info=await tokenInfo(db,t,now);
  const vm=info?{token:t,valido:true,tipo:info.kind,email:info.email,nome:info.nome,convidadoPor:info.criador_nome||'Equipe Nexus'}
    :{token:'',valido:false,tipo:'',email:'',nome:'',convidadoPor:''};
  return rota('definir-senha',vm,{title:titulo('Definir senha')});
}

// Formulário da assinatura (6.9): os planos ativos do site, mais o atual da assinatura, e o aviso quando vem da cópia.
async function formAssinatura(ctx,s,{assinatura,ficha}) {
  const {itens,copia}=await planosSite(ctx.db,{site:ctx.site,now:ctx.now});
  const planos=itens.filter(p=>p.status==='ativo'||p.id===assinatura?.plano?.id).map(({id,nome,pago,precoCentavos})=>({id,nome,pago,precoCentavos}));
  if(assinatura?.plano&&!planos.some(p=>p.id===assinatura.plano.id))planos.push({id:assinatura.plano.id,nome:assinatura.plano.nome,pago:true,precoCentavos:null});
  const cliente={id:ficha.id,nome:ficha.nome,empresas:ficha.empresas.map(e=>({id:e.id,nome:e.nome}))};
  const title=assinatura?`Assinatura · ${assinatura.empresa?.nome||ficha.nome}`:'Nova assinatura';
  return tela(ctx,s,{nome:'assinatura-form',title,dados:{assinatura,cliente,planos,ciclos:CICLOS},avisos:copia?[siteFora(!itens.length)]:[]});
}

export async function carregarPagina(ctx) {
  const {db,path,url,now,session,cookie}=ctx;
  if(path==='/entrar')return loadEntrar(ctx);
  if(path==='/entrar/definir-senha')return loadDefinirSenha(ctx);
  const s=await session();
  // A sessão que existia e acabou volta com motivo=expirou.
  if(!s)return {redirect:`/entrar?next=${encodeURIComponent(path+url.search)}${cookieValue(cookie)?'&motivo=expirou':''}`};
  const cx=()=>contexto(db,{now,siteOrigin:ctx.siteOrigin}),cobra={podeCobrar:pode(s.papel,'cobrar')};
  if(path==='/')return tela(ctx,s,{nome:'resumo',title:'Resumo',dados:await resumo(db,await cx(),cobra)});
  if(path==='/renovacoes') {
    const dados=await listarRenovacoes(db,url,await cx(),cobra);
    return tela(ctx,s,{nome:'renovacoes',title:'Renovações',filtros:{janela:dados.janela,page:String(dados.pagina)},dados});
  }
  if(path==='/indicadores')return tela(ctx,s,{nome:'indicadores',title:'Indicadores',dados:await indicadores(db,await cx(),{leads:ctx.leads})});
  if(path==='/configuracoes')return pode(s.papel,'configuracoes')?tela(ctx,s,{nome:'configuracoes',title:'Configurações',dados:await obterConfiguracoes(db)}):semPermissao(ctx,s);
  if(path==='/auditoria') {
    if(!pode(s.papel,'auditoria'))return semPermissao(ctx,s);
    const filtros=Object.fromEntries(['acao','usuario','recurso','de','ate','q'].map(k=>[k,filtro(url,k)]));filtros.page=filtro(url,'page')||'1';
    return ou404(ctx,s,async()=>tela(ctx,s,{nome:'auditoria',title:'Auditoria',filtros,dados:await listarAuditoria(db,url)}));
  }
  if(path==='/importacao')return pode(s.papel,'importar')?tela(ctx,s,{nome:'importacao',title:'Importação',filtros:{page:filtro(url,'page')||'1'},dados:await listarImportacoes(db,url,now)}):semPermissao(ctx,s);
  if(path==='/equipe')return pode(s.papel,'equipe')?tela(ctx,s,{nome:'equipe',title:'Equipe',dados:await listarEquipe(db,now)}):semPermissao(ctx,s);
  if(path==='/clientes') {
    const filtros={q:filtro(url,'q'),status:filtro(url,'status'),situacao:filtro(url,'situacao'),page:filtro(url,'page')||'1'};
    return tela(ctx,s,{nome:'clientes',title:'Clientes',filtros,dados:await listarClientes(db,url,await cx())});
  }
  if(path==='/clientes/novo')return pode(s.papel,'clientes')?tela(ctx,s,{nome:'cliente-form',title:'Novo cliente',dados:{cliente:null}}):semPermissao(ctx,s);
  let m=/^\/clientes\/([^/]+)(\/editar)?$/.exec(path);
  if(m&&UUID.test(m[1])) {
    if(m[2]&&!pode(s.papel,'clientes'))return semPermissao(ctx,s);
    return ou404(ctx,s,async()=>{
      const ficha=await obterFicha(db,m[1],await cx(),cobra);
      return m[2]?tela(ctx,s,{nome:'cliente-form',title:`Editar ${ficha.nome}`,dados:{cliente:ficha}}):tela(ctx,s,{nome:'cliente',title:`${ficha.nome} · Clientes`,dados:ficha});
    });
  }
  if(path==='/assinaturas/nova') {
    if(!pode(s.papel,'assinaturas'))return semPermissao(ctx,s);
    const id=url.searchParams.get('cliente');
    if(!UUID.test(id||''))return erro(ctx,s,404,'Este registro não existe.');
    return ou404(ctx,s,async()=>{
      const ficha=await obterFicha(db,id,await cx());
      if(ficha.status!=='ativo')return erro(ctx,s,422,'Reabra o cliente antes de criar uma assinatura.');
      return formAssinatura(ctx,s,{assinatura:null,ficha});
    });
  }
  m=/^\/assinaturas\/([^/]+)\/pagamento$/.exec(path);
  if(m&&UUID.test(m[1])) {
    if(!pode(s.papel,'pagamentos'))return semPermissao(ctx,s);
    return ou404(ctx,s,async()=>{
      const dados=await telaPagamento(db,m[1],await cx());
      return tela(ctx,s,{nome:'pagamento',title:`Registrar pagamento · ${dados.assinatura.empresa?.nome||dados.cliente.nome}`,dados});
    });
  }
  m=/^\/assinaturas\/([^/]+)$/.exec(path);
  if(m&&UUID.test(m[1])) {
    if(!pode(s.papel,'assinaturas'))return semPermissao(ctx,s);
    return ou404(ctx,s,async()=>{
      const c=await cx(),assinatura=await obterAssinatura(db,m[1],c);
      return formAssinatura(ctx,s,{assinatura,ficha:await obterFicha(db,assinatura.cliente.id,c)});
    });
  }
  m=/^\/importacao\/([^/]+)$/.exec(path);
  if(m&&UUID.test(m[1])) {
    if(!pode(s.papel,'importar'))return semPermissao(ctx,s);
    return ou404(ctx,s,async()=>tela(ctx,s,{nome:'importacao-previa',title:'Prévia da importação',dados:await obterImportacao(db,m[1],now)}));
  }
  // Interessados (14.5): só com a chave ligada; desligada, as duas páginas não existem.
  if(ctx.leads&&path==='/interessados') {
    if(!pode(s.papel,'clientes'))return semPermissao(ctx,s);
    const filtros={q:filtro(url,'q'),situacao:filtro(url,'situacao'),page:filtro(url,'page')||'1'};
    return tela(ctx,s,{nome:'interessados',title:'Interessados',filtros,dados:await listarLeads(db,url)});
  }
  m=/^\/interessados\/([^/]+)$/.exec(path);
  if(ctx.leads&&m&&UUID.test(m[1])) {
    if(!pode(s.papel,'clientes'))return semPermissao(ctx,s);
    return ou404(ctx,s,async()=>{const lead=await obterLead(db,m[1]);return tela(ctx,s,{nome:'interessado',title:`Pedido ${lead.codigo} · Interessados`,dados:lead});});
  }
  return erro(ctx,s,404,'Esta página não existe.');
}
