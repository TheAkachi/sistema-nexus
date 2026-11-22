import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { root,openDB,migrate } from './db.mjs';
import { clientIP } from './lib/ip.mjs';
import { sessionFor } from './auth.mjs';
import { chaveDoAmbiente } from './lib/cifra.mjs';
import { siteDoAmbiente } from './integracao.mjs';
import { criarFila } from './data/fila.mjs';
import { renderPage } from './views/index.mjs';
import { naoEncontrada } from './data/rota.mjs';
import { carregarPagina } from './data/paginas.mjs';
import { api } from './api.mjs';
import { leadsDoAmbiente } from './data/leads.mjs';

// Versão única do projeto: a do package.json (a mesma do CHANGELOG), exposta em /health/live.
const VERSION=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;

// Arquivos de p2/ servidos em /assets/<caminho> (cópia do site). Só extensões da lista; segmentos começam por letra ou
// número (sem "..", sem arquivo oculto). Lidos uma vez: ETag para revalidar sem baixar de novo e gzip para texto.
const ASSET_TYPES={css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
const P2=resolve(root,'p2');
const assets=new Map();
async function asset(path) {
  const match=/^\/assets\/((?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9._-]*\.([a-z0-9]+))$/i.exec(path);
  const type=match&&ASSET_TYPES[match[2].toLowerCase()];
  if(!type)return null;
  const file=resolve(P2,match[1]);
  if(!file.startsWith(P2+sep))return null;
  if(!assets.has(file)) {
    let bytes;try{bytes=await readFile(file);}catch{return null;}
    assets.set(file,{type,bytes,gzip:/^(text\/|image\/svg)/.test(type)?gzipSync(bytes,{level:9}):null,etag:`"${createHash('sha1').update(bytes).digest('base64url').slice(0,20)}"`});
  }
  return assets.get(file);
}

// CSP (contrato 2.5): sem script nem estilo inline; imagens só daqui e da origem pública do site (miniaturas das empresas).
export const csp=siteOrigin=>`default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'${siteOrigin?` ${siteOrigin}`:''}; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;

// Módulos da API (contrato, seção 7): cada um recebe o ctx e devolve true quando atendeu a rota (api/api.mjs).
const APIS=[api];
// Páginas (contrato, seção 6): cada loader devolve uma rota ({title, status, view, vm} ou {redirect}) ou null.
const PAGINAS=[carregarPagina];

const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Envie JSON.'),{status:415});
  const chunks=[];let size=0;
  for await(const chunk of req) { size+=chunk.length; if(size>16384) throw Object.assign(new Error('O corpo pode ter até 16 KB.'),{status:413}); chunks.push(chunk); }
  let data;try {data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}
  if(!data||typeof data!=='object'||Array.isArray(data)) throw Object.assign(new Error('Envie um objeto JSON.'),{status:400});
  return data;
}
// Corpo binário com limite de tamanho (o CSV da importação, até 2 MB).
async function rawBody(req,max,mensagem) {
  const chunks=[];let size=0;
  for await(const chunk of req) { size+=chunk.length; if(size>max) throw Object.assign(new Error(mensagem),{status:413,campo:'arquivo'}); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

// siteOrigin: origem pública do site (SITE_PUBLIC_ORIGIN), a única liberada em img-src além da própria gestão.
// totpKey: a chave que cifra os segredos do 2FA (TOTP_KEY, contrato 11). site: o cliente da integração (api/integracao.mjs),
// ou null quando ela não está configurada. fila: o processador da fila do plano (api/data/fila.mjs), que roda depois das escritas.
// leads: a chave dos interessados (LEADS_LIGADOS, 14.1), desligada por padrão.
export async function createApp({db,origin='http://127.0.0.1:4184',siteOrigin='',logger=()=>{},clock=()=>new Date(),totpKey=chaveDoAmbiente(),site=siteDoAmbiente(),fila=null,leads=leadsDoAmbiente()}) {
  const parsedOrigin=new URL(origin);
  if(parsedOrigin.origin!==origin || !['http:','https:'].includes(parsedOrigin.protocol)) throw new Error('PUBLIC_ORIGIN inválida');
  if(siteOrigin&&new URL(siteOrigin).origin!==siteOrigin) throw new Error('SITE_PUBLIC_ORIGIN inválida');
  const secure=parsedOrigin.protocol==='https:',policy=csp(siteOrigin);
  const html=(res,req,route)=>{
    res.writeHead(route.status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:renderPage(route));
  };
  const sendAsset=(res,req,a)=>{
    const gzip=a.gzip&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
    const headers={'Content-Type':a.type,'Cache-Control':'no-cache',ETag:a.etag,Vary:'Accept-Encoding'};
    if(req.headers['if-none-match']===a.etag){res.writeHead(304,headers);return res.end();}
    res.writeHead(200,gzip?{...headers,'Content-Encoding':'gzip'}:headers);return res.end(req.method==='HEAD'?undefined:gzip?a.gzip:a.bytes);
  };
  const server=createServer(async(req,res)=> {
    const requestId=randomUUID(),started=Date.now();
    // Cabeçalhos de toda resposta (contrato 2.5). A gestão nunca entra em buscador.
    res.setHeader('X-Request-ID',requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',policy);res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
    // Log sem caminho, query, corpo, e-mail ou IP (contrato 2.6).
    res.on('finish',()=>logger({requestId,method:req.method,status:res.statusCode,durationMs:Date.now()-started}));
    try {
      const url=new URL(req.url,origin),path=decodeURIComponent(url.pathname);
      if(path.includes('\\')||path.includes('\0'))return json(res,400,{erro:'Rota inválida.'});
      if(!['GET','HEAD','POST','PATCH','DELETE'].includes(req.method))return json(res,405,{erro:'Método não permitido.'});
      if(['POST','PATCH','DELETE'].includes(req.method)&&req.headers.origin!==origin)return json(res,403,{erro:'Origem não autorizada.'});
      // Sessão lida só quando a rota precisa.
      let sess;const session=async()=>sess===undefined?(sess=await sessionFor(db,req.headers.cookie,clock())):sess;
      if(path==='/health/live')return json(res,200,{status:'ok',version:VERSION});
      if(path==='/health/ready'){await db.query('SELECT 1');return json(res,200,{status:'ready',database:db.kind});}
      if(path.startsWith('/assets/')) {
        const a=['GET','HEAD'].includes(req.method)&&await asset(path);
        if(!a)return json(res,404,{erro:'Não encontrado.'});
        return sendAsset(res,req,a);
      }
      if(path==='/favicon.ico'&&['GET','HEAD'].includes(req.method)){const a=await asset('/assets/favicon.svg');if(a)return sendAsset(res,req,a);return json(res,404,{erro:'Não encontrado.'});}
      if(path==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('User-agent: *\nDisallow: /\n');}
      if(path.startsWith('/api/')) {
        const send=(status,value)=>json(res,status,value);
        // O corpo é lido uma vez só (a rota pode olhar um campo antes do handler); os cookies valem também nas respostas de erro.
        let corpo;
        const cookie=c=>{const antes=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(antes?[].concat(antes):[]),c]);};
        const ctx={db,req,res,path,method:req.method,url,ip:clientIP(req),now:clock(),origin,secure,siteOrigin,site,fila,leads,chave:totpKey,send,session,cookie,
          body:()=>(corpo??=body(req)),raw:(max,mensagem)=>rawBody(req,max,mensagem)};
        for(const api of APIS)if(await api(ctx))return;
        return json(res,404,{erro:'Endpoint não encontrado.'});
      }
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{erro:'Método não permitido.'});
      let route=null;
      for(const pagina of PAGINAS)if((route=await pagina({db,path,url,now:clock(),session,cookie:req.headers.cookie,chave:totpKey,site,siteOrigin,leads}))) break;
      route||=naoEncontrada();
      if(route.redirect){res.writeHead(303,{Location:route.redirect,'Cache-Control':'no-store'});return res.end();}
      return html(res,req,route);
    } catch(error) {
      if(error instanceof URIError)Object.assign(error,{status:400,message:'Rota inválida.'});
      const status=error.code==='23505'?409:error.status||500,message=error.code==='23505'?'Este registro já existe.':error.status?error.message:'Falha interna. Tente de novo em instantes.';
      // Erro {erro, campo?} (contrato 2.3); o 500 leva o requestId e nunca a pilha.
      if(!res.headersSent)json(res,status,{erro:message,...(error.campo?{campo:error.campo}:{}),...(error.extra||{}),...(status===500?{requestId}:{})});else res.end();
      logger({requestId,error:status===500?'request_failed':'request_rejected',status});
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.timeout=20000;
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const db=await openDB();await migrate(db);
  const origin=process.env.PUBLIC_ORIGIN||'http://127.0.0.1:4184';
  if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw new Error('Produção exige PUBLIC_ORIGIN HTTPS');
  const logger=entry=>console.log(JSON.stringify(entry)),site=siteDoAmbiente(),fila=criarFila({db,site,logger});
  const server=await createApp({db,origin,siteOrigin:process.env.SITE_PUBLIC_ORIGIN||'',logger,site,fila});
  server.listen(Number(process.env.PORT||4184),process.env.HOST||'127.0.0.1',()=>console.log(`Gestão Nexus: ${origin}`));
  // A fila do plano no site também roda a cada 30 s (contrato 9.3), para as falhas e o que ficou pendente.
  fila.iniciar(30000);fila.agora();
  const stop=()=>server.close(async()=>{await fila.parar();await db.close();process.exit(0);});process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
