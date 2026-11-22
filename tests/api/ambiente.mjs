import { randomUUID, randomBytes } from 'node:crypto';
import { openDB, migrate } from '../../api/db.mjs';
import { createApp } from '../../api/server.mjs';
import { hashPassword, newSession, sessionFor, COOKIE } from '../../api/auth.mjs';
import { cifrar } from '../../api/lib/cifra.mjs';
import { novoSegredo, codigoDe, passoDe } from '../../api/lib/totp.mjs';
import { carregarPagina } from '../../api/data/paginas.mjs';
import { criarSite } from '../../api/integracao.mjs';
import { criarFila } from '../../api/data/fila.mjs';
import { siteFalso } from './site-falso.mjs';

// Ambiente de teste: banco em memória (PGlite) já migrado, servidor numa porta livre, um relógio que o teste avança, uma
// chave do 2FA só do teste e o site falso (t.site é o estado dele: empresas, planos, fora do ar e os pedidos recebidos).
export const origin='http://127.0.0.1:4184';
export const SENHA='Cavalo-Bateria-Grampo-77';
// leads: a chave dos interessados (14.1), desligada como na homologação, a não ser que o teste ligue.
export async function ambiente({siteOrigin='https://site.exemplo.test',comSite=true,comFila=false,leads=false}={}) {
  const db=await openDB({url:null,path:':memory:'});await migrate(db);
  const t={db,agora:new Date('2026-10-20T12:00:00Z'),chave:randomBytes(32),segredos:new Map(),siteOrigin};
  const chaveSite=randomBytes(32),falso=comSite?await siteFalso({chave:chaveSite}):null;
  t.site=falso?.estado||null;
  t.integracao=falso?criarSite({url:falso.url,chaveId:'k1',chave:chaveSite,timeoutMs:2000}):null;
  // comFila: o processador da fila roda depois das escritas, como no servidor de verdade (t.fila.rodar() espera a rodada).
  t.fila=comFila?criarFila({db,site:t.integracao,clock:()=>t.agora}):null;
  const server=await createApp({db,origin,siteOrigin,clock:()=>t.agora,totpKey:t.chave,site:t.integracao,fila:t.fila,leads});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.base=`http://127.0.0.1:${server.address().port}`;
  t.minutos=n=>{t.agora=new Date(t.agora.getTime()+n*60000);};
  // Requisição com Origin da gestão nas escritas; body objeto vira JSON; s = {cookie, csrf} manda a sessão e o CSRF.
  t.req=async(path,{method='GET',body,headers={},originValue=origin,s=null,cookie='',csrf=true}={})=>{
    const h={...headers};if(method!=='GET'&&method!=='HEAD'&&originValue)h.Origin=originValue;
    const c=[s?.cookie,cookie].filter(Boolean).join('; ');if(c)h.Cookie=c;
    if(s&&csrf&&method!=='GET')h['X-CSRF-Token']=s.csrf;
    if(body!==undefined&&typeof body==='object'&&!(body instanceof Uint8Array)){h['Content-Type']='application/json';body=JSON.stringify(body);}
    const r=await fetch(t.base+path,{method,headers:h,body,redirect:'manual'});
    const text=await r.text();let json=null;try{json=JSON.parse(text);}catch{}
    return {status:r.status,headers:r.headers,cookies:r.headers.getSetCookie(),text,json};
  };
  // Conta da equipe com senha e 2FA ativos (segredo guardado em t.segredos para gerar códigos).
  t.conta=async(email,{papel='admin',desativado=false,totp=true,nome='Pessoa de teste'}={})=>{
    const id=randomUUID(),segredo=novoSegredo();t.segredos.set(id,segredo);
    await db.query('INSERT INTO users(id,email,nome,papel,password_hash,totp_secret,totp_ativo,desativado) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id,email,nome,papel,await hashPassword(SENHA),totp?cifrar(t.chave,segredo,id):null,totp,desativado]);
    return id;
  };
  // Código do autenticador de uma conta, no passo de agora (ou num passo deslocado).
  t.codigo=(id,desloca=0,segredo=t.segredos.get(id))=>codigoDe(segredo,passoDe(t.agora)+desloca);
  // Sessão pronta (como se a pessoa tivesse acabado de entrar): {id, cookie, csrf}.
  t.sessao=async(email,opcoes={})=>{
    const id=await t.conta(email,opcoes),s=await newSession(db,id,{now:t.agora});
    return {id,cookie:`${COOKIE}=${s.value}`,csrf:s.csrf,valor:s.value};
  };
  // Loader de página com a sessão do cookie, para ler o vm (as views são do front).
  t.pagina=async(caminho,{s=null,cookie=''}={})=>{
    const url=new URL(caminho,origin),c=[s?.cookie,cookie].filter(Boolean).join('; ');
    return carregarPagina({db,path:url.pathname,url,now:t.agora,session:async()=>sessionFor(db,c,t.agora),cookie:c,chave:t.chave,site:t.integracao,siteOrigin,leads});
  };
  t.auditoria=async(action,resource)=>(await db.query('SELECT * FROM audit_log WHERE action=$1 AND ($2::text IS NULL OR resource_id=$2) ORDER BY created_at DESC',[action,resource??null])).rows;
  t.fim=async()=>{await new Promise(r=>server.close(r));await t.fila?.parar();await falso?.fechar();await db.close();};
  return t;
}
// Só o "nome=valor" de cada Set-Cookie, para mandar de volta.
export const valorCookie=(cookies,nome)=>cookies.find(c=>c.startsWith(`${nome}=`))?.split(';')[0]||'';
