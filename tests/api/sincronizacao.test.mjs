import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { conferirPlanos } from '../../api/data/sincronizacao.mjs';
import { processarFila } from '../../api/data/fila.mjs';
import { siteFalso } from './site-falso.mjs';
import { ambiente } from './ambiente.mjs';

// Rotina diária (contrato 9.3 e 10): divergências entre o plano esperado e o do site, caches, tolerância e o CLI.
let t,s;
before(async()=>{
  t=await ambiente();s=await t.sessao('admin@exemplo.test');
  const cli=async(nome,empresas)=>{const id=(await t.req('/api/clientes',{method:'POST',body:{nome},s})).json.id;
    for(const e of empresas)await t.req(`/api/clientes/${id}/empresas/${e}`,{method:'POST',body:{},s});return id;};
  const vida=await cli('Clínica Vida Plena',['clinica-vida-plena-centro','clinica-vida-plena-austin']);
  const padaria=await cli('Padaria Pão Dourado',['padaria-pao-dourado']);
  const nova=(cliente,empresa,venceEm)=>t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa,plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2026-01-15',venceEm}});
  await nova(vida,'clinica-vida-plena-centro','2026-11-15');
  await nova(padaria,'padaria-pao-dourado','2026-10-25');
  await processarFila(t.db,{site:t.integracao,now:t.agora});
});
after(async()=>{await t?.fim();});
const emp=id=>t.site.empresas.find(e=>e.id===id);

test('sem aplicar: relata divergências, caches e empresas que o site não conhece, sem mudar nada',async()=>{
  let r=await conferirPlanos(t.db,{site:t.integracao,now:t.agora});
  assert.deepEqual([r.empresas,r.divergencias,r.naoEncontradas,r.caches],[3,[],[],0],'tudo em dia depois da fila');
  // Alguém mexeu no site; uma empresa mudou de nome; outra sumiu; e a padaria passa da tolerância (25/10 + 10 dias).
  emp('clinica-vida-plena-centro').plano=null;emp('padaria-pao-dourado').nome='Padaria Pão Dourado & Cia';
  t.site.empresas=t.site.empresas.filter(e=>e.id!=='clinica-vida-plena-austin');
  t.minutos(17*24*60);
  const filaAntes=(await t.db.query('SELECT count(*)::int AS n FROM plan_sync')).rows[0].n;
  r=await conferirPlanos(t.db,{site:t.integracao,now:t.agora});
  assert.deepEqual(r.divergencias,[
    {empresa:'clinica-vida-plena-centro',nome:'Clínica Vida Plena · Centro',noSite:null,esperado:'plano-premium'},
    {empresa:'padaria-pao-dourado',nome:'Padaria Pão Dourado & Cia',noSite:'plano-premium',esperado:null}]);
  assert.deepEqual([r.naoEncontradas,r.caches,r.aplicado,r.envio],[['clinica-vida-plena-austin'],1,false,null]);
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM plan_sync')).rows[0].n,filaAntes,'nada entrou na fila');
  assert.equal((await t.db.query("SELECT nome_cache FROM client_businesses WHERE business_id='padaria-pao-dourado'")).rows[0].nome_cache,'Padaria Pão Dourado');
});

test('com aplicar: caches, fila com o motivo certo, envio e auditoria',async()=>{
  const r=await conferirPlanos(t.db,{site:t.integracao,now:t.agora,aplicar:true});
  assert.deepEqual(r.envio,{enviados:2,falhas:0});
  assert.deepEqual([emp('clinica-vida-plena-centro').plano,emp('padaria-pao-dourado').plano],['plano-premium',null]);
  const motivos=(await t.db.query("SELECT business_id,motivo FROM plan_sync WHERE motivo IN ('conferencia','tolerancia') ORDER BY business_id")).rows;
  assert.deepEqual(motivos.map(m=>[m.business_id,m.motivo]),[['clinica-vida-plena-centro','conferencia'],['padaria-pao-dourado','tolerancia']]);
  assert.equal((await t.db.query("SELECT nome_cache FROM client_businesses WHERE business_id='padaria-pao-dourado'")).rows[0].nome_cache,'Padaria Pão Dourado & Cia');
  assert.deepEqual((await t.auditoria('sincronizacao_conferida','todas'))[0].after,{empresas:3,divergencias:2,naoEncontradas:1,caches:1,enviados:2,falhas:0});
  assert.deepEqual((await conferirPlanos(t.db,{site:t.integracao,now:t.agora})).divergencias,[],'depois de aplicar, sem divergências');
});

test('CLI: sincronizar-planos com a integração configurada; sem ela, erro',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'gestao-sync-')),chave=randomBytes(32),falso=await siteFalso({chave});
  const CLI=fileURLToPath(new URL('../../api/cli.mjs',import.meta.url));
  const cli=(args,env={})=>spawnSync(process.execPath,[CLI,...args],{encoding:'utf8',env:{...process.env,DATABASE_URL:'',DB_DIR:dir,NODE_ENV:'test',SITE_API_URL:'',INTEGRACAO_CHAVE_ID:'',INTEGRACAO_CHAVE:'',...env}});
  try {
    const sem=cli(['sincronizar-planos']);assert.notEqual(sem.status,0);assert.match(sem.stderr,/Integração não configurada/);
    const r=cli(['sincronizar-planos'],{SITE_API_URL:falso.url,INTEGRACAO_CHAVE_ID:'k1',INTEGRACAO_CHAVE:chave.toString('hex')});
    assert.equal(r.status,0,r.stderr);
    assert.match(r.stdout,/Empresas vinculadas: 0\. Divergências: 0\. O site não conhece: 0\. Caches a atualizar: 0\.\nNada mudou\. Para corrigir, rode de novo com --aplicar\./);
    const a=cli(['sincronizar-planos','--aplicar'],{SITE_API_URL:falso.url,INTEGRACAO_CHAVE_ID:'k1',INTEGRACAO_CHAVE:chave.toString('hex')});
    assert.equal(a.status,0,a.stderr);assert.match(a.stdout,/Aplicado\. Fila: 0 enviados, 0 falhas\./);
  } finally {await falso.fechar();await rm(dir,{recursive:true,force:true});}
});
