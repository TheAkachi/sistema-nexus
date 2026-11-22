import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { assinar, criarSite, siteDoAmbiente, empresaDoSite, planoDoSite } from '../../api/integracao.mjs';
import { siteFalso } from './site-falso.mjs';

// Cliente da integração (contrato 9.2 e 9.4): a assinatura HMAC, o site falso que confere como o de verdade e o 503 em
// qualquer falha.
const chave=randomBytes(32);let falso,site;
before(async()=>{falso=await siteFalso({chave});site=criarSite({url:falso.url,chaveId:'k1',chave});});
after(async()=>{await falso?.fechar();});

test('assinatura: HMAC-SHA256 de método, caminho com query, carimbo, nonce e SHA-256 do corpo',()=>{
  const corpo='{"plano":null}',k=Buffer.alloc(32,7);
  const esperado=createHmac('sha256',k).update(['PUT','/api/integracao/v1/empresas/x/plano?a=1','1760000000','ab'.repeat(16),createHash('sha256').update(corpo).digest('hex')].join('\n')).digest('hex');
  assert.equal(assinar({chave:k,metodo:'PUT',caminho:'/api/integracao/v1/empresas/x/plano?a=1',carimbo:'1760000000',nonce:'ab'.repeat(16),corpo}),esperado);
  assert.match(assinar({chave:k,metodo:'GET',caminho:'/',carimbo:'1',nonce:'n'}),/^[a-f0-9]{64}$/,'corpo vazio entra como o SHA-256 de ""');
});

test('lê empresas e planos com a assinatura aceita pelo site; chave errada ou relógio fora da janela, 503',async()=>{
  const r=await site.empresas({q:'vida'});
  assert.deepEqual(r.itens.map(e=>e.id),['clinica-vida-plena-austin','clinica-vida-plena-centro']);
  assert.deepEqual((await site.empresas({ids:['padaria-pao-dourado']})).itens.map(e=>e.id),['padaria-pao-dourado']);
  assert.equal((await site.planos()).itens.length,4);
  assert.ok(falso.estado.pedidos.every(p=>p.ok));
  const outra=criarSite({url:falso.url,chaveId:'k1',chave:randomBytes(32)});
  await assert.rejects(outra.planos(),e=>e.status===503&&e.message==='O guia não respondeu. Tente de novo em instantes.');
  const atrasado=criarSite({url:falso.url,chaveId:'k1',chave,agora:()=>new Date(Date.now()-6*60000)});
  await assert.rejects(atrasado.planos(),e=>e.status===503);
  assert.equal(falso.estado.pedidos.at(-1).ok,false);
});

test('site fora do ar, resposta que não é JSON ou demorada: 503; rota inexistente: null',async()=>{
  falso.estado.fora=true;await assert.rejects(site.planos(),e=>e.status===503);falso.estado.fora=false;
  await assert.rejects(criarSite({url:'http://127.0.0.1:9',chaveId:'k1',chave}).planos(),e=>e.status===503);
  const lento=createServer((req,res)=>{setTimeout(()=>{res.writeHead(200);res.end('não é json');},300);});
  await new Promise(r=>lento.listen(0,'127.0.0.1',r));
  try {
    const url=`http://127.0.0.1:${lento.address().port}`;
    await assert.rejects(criarSite({url,chaveId:'k1',chave,timeoutMs:100}).planos(),e=>e.status===503,'demorou');
    await assert.rejects(criarSite({url,chaveId:'k1',chave,timeoutMs:2000}).planos(),e=>e.status===503,'não é JSON');
  } finally {await new Promise(r=>lento.close(r));}
  assert.equal(await site.definirPlano('nao-existe',{plano:null,gerida:true}),null,'empresa que o site não conhece');
  assert.deepEqual(await site.definirPlano('padaria-pao-dourado',{plano:'plano-premium',gerida:true,assinatura:null,motivo:'teste'}),{id:'padaria-pao-dourado',plano:'plano-premium',alterado:true});
});

test('o que vem do site é conferido: ids, textos e o caminho da foto',()=>{
  assert.deepEqual(empresaDoSite({id:'studio-bella',nome:'  Studio   Bella ',slug:'studio-bella',status:'publicado',bairro:'Centro',plano:'x y',foto:'javascript:alert(1)'}),
    {id:'studio-bella',nome:'Studio Bella',slug:'studio-bella',status:'publicado',bairro:'Centro',plano:null,foto:''});
  for(const ruim of [null,{id:'../x'},{id:'A'},{id:'-x'}])assert.equal(empresaDoSite(ruim),null);
  assert.deepEqual(planoDoSite({id:'plano-x',nome:'X',pago:'sim',status:'qualquer',precoCentavos:-1}),{id:'plano-x',nome:'X',pago:false,status:'pausado',precoCentavos:null});
  assert.equal(siteDoAmbiente({}),null,'sem configuração, sem integração');
  assert.throws(()=>siteDoAmbiente({SITE_API_URL:'http://site',INTEGRACAO_CHAVE_ID:'k1',INTEGRACAO_CHAVE:'curta'}),/INTEGRACAO_CHAVE/);
  assert.ok(siteDoAmbiente({SITE_API_URL:'http://site',INTEGRACAO_CHAVE_ID:'k1',INTEGRACAO_CHAVE:'ab'.repeat(32)}));
});
