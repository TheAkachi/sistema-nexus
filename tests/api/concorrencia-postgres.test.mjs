import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDB,migrate } from '../../api/db.mjs';
import { enfileirar,processarFila } from '../../api/data/fila.mjs';
import { conferirPlanos } from '../../api/data/sincronizacao.mjs';

// PostgreSQL real: duas conexões independentes. Nunca apontar TEST_DATABASE_URL
// para dados reais. Cada cenário usa e remove exclusivamente seu próprio schema.
const options={skip:!process.env.TEST_DATABASE_URL,timeout:15000};
const now=new Date('2026-10-20T12:00:00Z');
const sinal=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function isolado(fn) {
  const {Client}=await import('pg');
  const c=new Client({connectionString:process.env.TEST_DATABASE_URL});
  const schema=`concorrencia_${randomUUID().replaceAll('-','')}`;
  let a,b;
  await c.connect();
  try {
    await c.query(`CREATE SCHEMA ${schema}`);
    const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);
    a=await openDB({url:url.toString()});b=await openDB({url:url.toString()});await migrate(a);
    await fn(a,b);
  } finally {
    await a?.close();await b?.close();
    await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await c.end();
  }
}

test('PostgreSQL: dois processadores não reaplicam o plano antigo depois do cancelamento',options,async()=>isolado(async(a,b)=>{
  const iniciou=sinal(),liberar=sinal(),envios=[];let plano=null;
  const site={definirPlano:async(id,p)=>{
    if(p.plano==='plano-premium'){iniciou.resolve();await liberar.promise;}
    plano=p.plano;envios.push(plano);return {id,plano,alterado:true};
  }};
  await enfileirar(a,{businessId:'empresa-teste',plano:'plano-premium',motivo:'ativacao',now});
  const primeira=processarFila(a,{site,now});
  try {
    await iniciou.promise;
    await enfileirar(b,{businessId:'empresa-teste',plano:null,motivo:'cancelamento',now});
    assert.deepEqual(await processarFila(b,{site,now}),{enviados:0,falhas:0},'outro processo não ultrapassa o envio em andamento');
  } finally {liberar.resolve();await primeira;}
  assert.deepEqual(await processarFila(b,{site,now}),{enviados:1,falhas:0});
  assert.deepEqual(envios,['plano-premium',null]);assert.equal(plano,null);
  assert.equal((await a.query('SELECT count(*)::int AS n FROM plan_sync WHERE enviado_em IS NULL')).rows[0].n,0);
}));

for(const acao of ['cancelar','desvincular'])test(`PostgreSQL: conferência relê estado depois de ${acao} durante consulta ao guia`,options,async()=>isolado(async(a,b)=>{
  await a.query("INSERT INTO clients(id,nome) VALUES('c1','Cliente teste')");
  await a.query("INSERT INTO client_businesses(client_id,business_id,nome_cache) VALUES('c1','empresa-teste','Empresa teste')");
  await a.query("INSERT INTO subscriptions(id,client_id,business_id,plano_site,valor_centavos,ciclo,inicio,vence_em,dia_base,origem) VALUES('s1','c1','empresa-teste','plano-premium',10000,'mensal','2026-10-01','2026-11-01',1,'manual')");
  const iniciou=sinal(),liberar=sinal(),envios=[];let plano=null,gerida=true;
  const site={
    empresas:async()=>{const itens=[{id:'empresa-teste',nome:'Empresa teste',slug:'empresa-teste',plano}];iniciou.resolve();await liberar.promise;return {itens};},
    definirPlano:async(id,p)=>{plano=p.plano;gerida=p.gerida;envios.push(plano);return {id,plano,alterado:true};}
  };
  const conferencia=conferirPlanos(a,{site,now,aplicar:true});let resultado;
  try {
    await iniciou.promise;
    await b.transaction(async tx=>{
      await tx.query("UPDATE subscriptions SET status='cancelada',cancelada_em='2026-10-20' WHERE id='s1'");
      if(acao==='desvincular') {
        await tx.query("UPDATE subscriptions SET business_id=NULL WHERE id='s1'");
        await tx.query("DELETE FROM client_businesses WHERE business_id='empresa-teste'");
      }
      await enfileirar(tx,{businessId:'empresa-teste',plano:null,gerida:acao!=='desvincular',motivo:acao==='cancelar'?'cancelamento':'desvinculo',now});
    });
  } finally {liberar.resolve();resultado=await conferencia;}
  assert.equal(resultado.envio.falhas,0);assert.equal(plano,null);
  assert.ok(envios.every(p=>p===null),'a conferência não envia a assinatura antiga');
  if(acao==='desvincular')assert.equal(gerida,false);
}));
