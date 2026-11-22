import { createHash, createHmac, randomBytes } from 'node:crypto';
import { fail } from './lib/erros.mjs';

// Cliente da integração com o site (contrato 9). Cada chamada vai assinada com HMAC-SHA256: a mensagem é o método, o caminho
// com a query, o carimbo (segundos), o nonce e o SHA-256 do corpo, juntados por \n (9.2 e 9.4). O site responde 401 sem
// detalhe para assinatura inválida, carimbo vencido ou nonce repetido; aqui, qualquer falha vira o 503 "o guia não respondeu".
const sha256=b=>createHash('sha256').update(b).digest('hex');
export const assinar=({chave,metodo,caminho,carimbo,nonce,corpo=''})=>createHmac('sha256',chave).update([metodo,caminho,carimbo,nonce,sha256(corpo)].join('\n')).digest('hex');
export const foraDoAr=()=>fail('O guia não respondeu. Tente de novo em instantes.',503);

// Sem SITE_API_URL, INTEGRACAO_CHAVE_ID e INTEGRACAO_CHAVE, não há integração: quem precisa dela responde 503.
export function siteDoAmbiente(env=process.env) {
  if(!env.SITE_API_URL||!env.INTEGRACAO_CHAVE_ID||!env.INTEGRACAO_CHAVE)return null;
  if(!/^[0-9a-f]{64}$/i.test(env.INTEGRACAO_CHAVE))throw new Error('INTEGRACAO_CHAVE deve ter 32 bytes em hex (64 caracteres).');
  return criarSite({url:env.SITE_API_URL,chaveId:env.INTEGRACAO_CHAVE_ID,chave:Buffer.from(env.INTEGRACAO_CHAVE,'hex')});
}

// agora: o relógio real (o site confere o carimbo com o dele); os testes podem trocar.
export function criarSite({url,chaveId,chave,fetchImpl=globalThis.fetch,timeoutMs=5000,agora=()=>new Date()}) {
  const base=new URL(url);
  async function pedir(metodo,caminho,corpo) {
    const texto=corpo===undefined?'':JSON.stringify(corpo),carimbo=String(Math.floor(agora().getTime()/1000)),nonce=randomBytes(16).toString('hex');
    const headers={Accept:'application/json','X-Gestao-Chave':chaveId,'X-Gestao-Carimbo':carimbo,'X-Gestao-Nonce':nonce,
      'X-Gestao-Assinatura':assinar({chave,metodo,caminho,carimbo,nonce,corpo:texto})};
    if(corpo!==undefined)headers['Content-Type']='application/json';
    let r;
    try{r=await fetchImpl(new URL(caminho,base),{method:metodo,headers,body:corpo===undefined?undefined:texto,signal:AbortSignal.timeout(timeoutMs)});}
    catch{throw foraDoAr();}
    if(r.status===404)return null;
    if(!r.ok)throw foraDoAr();
    try{return await r.json();}catch{throw foraDoAr();}
  }
  return {
    // Empresas do guia: busca (q), página ou ids exatos, para vincular e atualizar os caches.
    empresas:({q='',ids=[],page=1}={})=>{
      const p=new URLSearchParams();if(q)p.set('q',q);if(ids.length)p.set('ids',ids.join(','));if(page>1)p.set('page',String(page));
      const query=p.toString();return pedir('GET',`/api/integracao/v1/empresas${query?`?${query}`:''}`);
    },
    planos:()=>pedir('GET','/api/integracao/v1/planos'),
    definirPlano:(businessId,corpo)=>pedir('PUT',`/api/integracao/v1/empresas/${encodeURIComponent(businessId)}/plano`,corpo),
    // Totais de audiência e de contatos (9.5), de aaaa-mm a aaaa-mm, uma página de empresas por vez.
    metricas:({de,ate,page=1})=>pedir('GET',`/api/integracao/v1/metricas?${new URLSearchParams({de,ate,page:String(page)})}`),
    // Pedidos do cadastro (14.3, v0.13.0): desde a hora pedida, inclusive. Desligados no site, o 404 vira null.
    pedidos:({desde,page=1})=>pedir('GET',`/api/integracao/v1/pedidos?${new URLSearchParams({desde,page:String(page)})}`)
  };
}

// O que vem do site é conferido antes de entrar no banco ou na tela: ids, textos e o caminho da foto.
const ID=/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;
export const idEmpresaValido=v=>typeof v==='string'&&ID.test(v);
const txt=(v,max=200)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
export function empresaDoSite(e) {
  if(!e||!idEmpresaValido(e.id))return null;
  const foto=typeof e.foto==='string'&&/^\/midia\/[a-f0-9]{32}\/320\.webp$/.test(e.foto)?e.foto:'';
  return {id:e.id,nome:txt(e.nome)||e.id,slug:idEmpresaValido(e.slug)?e.slug:e.id,status:txt(e.status,40),bairro:txt(e.bairro,120),plano:idEmpresaValido(e.plano)?e.plano:null,foto};
}
export function planoDoSite(p) {
  if(!p||!idEmpresaValido(p.id))return null;
  return {id:p.id,nome:txt(p.nome,120)||p.id,pago:p.pago===true,status:p.status==='ativo'?'ativo':'pausado',
    precoCentavos:Number.isSafeInteger(p.precoCentavos)&&p.precoCentavos>=0?p.precoCentavos:null};
}
