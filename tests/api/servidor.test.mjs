import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clientIP } from '../../api/lib/ip.mjs';
import { escape } from '../../api/lib/html.mjs';
import { ambiente, origin } from './ambiente.mjs';

// Servidor do esqueleto (contrato 2.3, 2.5 e 2.6): cabeçalhos, saúde, origem nas escritas, erros e arquivos estáticos.
let t;
before(async()=>{t=await ambiente();});
after(async()=>{await t?.fim();});

test('toda resposta leva a CSP, os cabeçalhos de segurança e noindex',async()=>{
  for(const path of ['/health/live','/nao-existe','/api/nada']) {
    const r=await t.req(path);
    assert.equal(r.headers.get('content-security-policy'),"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://site.exemplo.test; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",path);
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');
    assert.equal(r.headers.get('referrer-policy'),'no-referrer');
    assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
    assert.equal(r.headers.get('cross-origin-opener-policy'),'same-origin');
    assert.match(r.headers.get('x-request-id'),/^[0-9a-f-]{36}$/);
    assert.equal(r.headers.get('strict-transport-security'),null,'HSTS só com origem https');
  }
  const robots=await t.req('/robots.txt');assert.equal(robots.text,'User-agent: *\nDisallow: /\n');
});

test('versão única: /health/live, package.json e a última entrada do CHANGELOG',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
  const changelog=await readFile(new URL('../../CHANGELOG.md',import.meta.url),'utf8');
  assert.deepEqual((await t.req('/health/live')).json,{status:'ok',version:pkg.version});
  assert.equal(changelog.match(/^## v(\S+)/m)[1],pkg.version);
  assert.deepEqual((await t.req('/health/ready')).json,{status:'ready',database:'pglite'});
});

test('escrita sem a origem da gestão: 403; método desconhecido: 405; API inexistente: 404 {erro}',async()=>{
  assert.deepEqual((await t.req('/api/clientes',{method:'POST',body:{},originValue:'https://outro.site'})).json,{erro:'Origem não autorizada.'});
  assert.equal((await t.req('/api/clientes',{method:'POST',body:{},originValue:''})).status,403,'sem Origin também');
  assert.equal((await t.req('/api/clientes',{method:'PUT',body:{}})).status,405);
  const r=await t.req('/api/nada');assert.equal(r.status,404);assert.deepEqual(r.json,{erro:'Endpoint não encontrado.'});
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal((await t.req('/%E0%A4%A')).status,400,'caminho mal codificado');
});

test('página sem sessão vai para o Entrar; com sessão, a inexistente é 404 em HTML sem cache, com o título escapado',async()=>{
  const sem=await t.req('/clientes/<script>?q=1');
  assert.equal(sem.status,303);assert.equal(sem.headers.get('location'),'/entrar?next=%2Fclientes%2F%3Cscript%3E%3Fq%3D1');
  const s=await t.sessao('servidor@exemplo.test');
  const r=await t.req('/clientes/<script>',{s});
  assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/^text\/html/);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.match(r.text,/<title>Página não encontrada \| Gestão Nexus<\/title>/);assert.doesNotMatch(r.text,/<script>/);
  assert.equal((await t.req('/clientes',{method:'POST',body:{}})).status,405);
});

test('/assets: só extensões da lista, sem sair de p2/',async()=>{
  for(const path of ['/assets/nao-existe.css','/assets/','/assets/..%2Fapi%2Fserver.mjs','/assets/.gitkeep','/assets/p2%2F..%2F..%2Fpackage.json'])
    assert.equal((await t.req(path)).status,404,path);
  // O fetch resolve o ".." antes de pedir: o caminho vira /package.json (página, que manda ao Entrar) ou /api/db.mjs (404).
  for(const path of ['/assets/%2e%2e/package.json','/assets/../api/db.mjs']){const r=await t.req(path);assert.ok([303,404].includes(r.status),path);assert.doesNotMatch(r.text,/"packageManager"|openDB/);}
});

test('origem https liga o HSTS; origem inválida não sobe',async()=>{
  const {createApp}=await import('../../api/server.mjs');
  await assert.rejects(createApp({db:t.db,origin:'https://gestao.exemplo.test/caminho',totpKey:t.chave}),/PUBLIC_ORIGIN/);
  await assert.rejects(createApp({db:t.db,origin,siteOrigin:'https://site.exemplo.test/x',totpKey:t.chave}),/SITE_PUBLIC_ORIGIN/);
  const server=await createApp({db:t.db,origin:'https://gestao.exemplo.test',totpKey:t.chave});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const r=await fetch(`http://127.0.0.1:${server.address().port}/health/live`);assert.equal(r.headers.get('strict-transport-security'),'max-age=31536000');
    assert.match(r.headers.get('content-security-policy'),/img-src 'self'; /,'sem site, só a própria gestão nas imagens');}
  finally{await new Promise(r=>server.close(r));}
});

test('IP real: X-Forwarded-For só vale vindo do proxy (rede privada) e só o último endereço',()=>{
  const req=(remoteAddress,forwarded)=>({socket:{remoteAddress},headers:forwarded?{'x-forwarded-for':forwarded}:{}});
  assert.equal(clientIP(req('172.16.9.1','203.0.113.7')),'203.0.113.7');
  assert.equal(clientIP(req('::ffff:127.0.0.1','198.51.100.1, 203.0.113.7')),'203.0.113.7','o cliente não escolhe o próprio IP');
  assert.equal(clientIP(req('198.51.100.9','203.0.113.7')),'198.51.100.9','conexão direta de fora ignora o cabeçalho');
  assert.equal(clientIP(req('172.16.9.1','lixo')),'172.16.9.1');
  assert.equal(clientIP(req('172.32.0.1','203.0.113.7')),'172.32.0.1','172.32/16 não é rede privada');
});

test('escape de HTML',()=>{
  assert.equal(escape(`<a href="x" onclick='y'>&</a>`),'&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(escape(null),'');
});

test('porta padrão: a mesma no servidor, no Dockerfile, no .env.example e no compose, e fora da lista de bloqueadas do fetch',async()=>{
  const ler=f=>readFile(new URL(`../../${f}`,import.meta.url),'utf8');
  const portas=[
    /PORT\|\|(\d+)/.exec(await ler('api/server.mjs'))[1],
    /PORT=(\d+)/.exec(await ler('Dockerfile'))[1],/EXPOSE (\d+)/.exec(await ler('Dockerfile'))[1],
    /^PORT=(\d+)/m.exec(await ler('.env.example'))[1],
    ...[...(await ler('scripts/deploy/docker-compose.exemplo.yml')).matchAll(/127\.0\.0\.1:(\d+)|server\.port=(\d+)/g)].map(m=>m[1]||m[2])
  ];
  assert.deepEqual([...new Set(portas)],['4184'],portas.join(' '));
  // A 4190 das primeiras versões o fetch recusa antes de conectar ("bad port"), como os navegadores.
  const causa=async porta=>(await fetch(`http://127.0.0.1:${porta}/`,{signal:AbortSignal.timeout(2000)}).then(()=>null,e=>e.cause?.message||e.message));
  assert.equal(await causa(4190),'bad port');
  assert.notEqual(await causa(4184),'bad port');
});
