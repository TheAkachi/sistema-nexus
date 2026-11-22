import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ambiente } from './ambiente.mjs';

// Indicadores, bloco Dinheiro (contrato 6.17). Hoje é 20/10/2026 em São Paulo, a tolerância é de 10 dias e os 12 meses vão
// de 2025-11 a 2026-10. As assinaturas e os pagamentos entram direto no banco, com datas do passado.
let t,s;const S={};
before(async()=>{
  t=await ambiente();s=await t.sessao('indicadores@exemplo.test',{papel:'leitura'});
  const cliente=randomUUID();await t.db.query("INSERT INTO clients(id,nome) VALUES($1,'Clínica Vida Plena')",[cliente]);
  const sub=async(k,{inicio,venceEm,plano=null,nome='',valor,ciclo='mensal',status='ativa',suspensaEm=null,canceladaEm=null})=>{
    S[k]=randomUUID();
    await t.db.query(`INSERT INTO subscriptions(id,client_id,plano_site,plano_nome,valor_centavos,ciclo,inicio,vence_em,dia_base,status,suspensa_em,cancelada_em,origem)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'manual')`,[S[k],cliente,plano,nome,valor,ciclo,inicio,venceEm,+venceEm.slice(8,10),status,suspensaEm,canceladaEm]);
  };
  const premium={plano:'plano-premium',nome:'Premium'},avancado={plano:'plano-avancado',nome:'Avançado'};
  await sub('s1',{...premium,valor:9900,inicio:'2026-03-10',venceEm:'2026-11-10'});
  await sub('s2',{...avancado,valor:18000,ciclo:'trimestral',inicio:'2026-07-24',venceEm:'2026-10-24'});
  await sub('s3',{...premium,valor:9900,inicio:'2026-01-05',venceEm:'2026-10-05'});
  await sub('s4',{...avancado,valor:6700,inicio:'2026-02-01',venceEm:'2026-10-15'});
  await sub('s5',{...premium,valor:120000,ciclo:'anual',inicio:'2025-06-01',venceEm:'2026-06-01',status:'cancelada',canceladaEm:'2026-08-15'});
  await sub('s6',{valor:5000,inicio:'2026-04-01',venceEm:'2026-11-01',status:'suspensa',suspensaEm:'2026-09-10'});
  await sub('s7',{...avancado,valor:6700,inicio:'2026-05-01',venceEm:'2026-11-18'});
  // A s7 ficou suspensa de 10/06 a 05/07 (pela auditoria); a reativação apagou a data da suspensão na assinatura.
  const evento=(action,resource,em)=>t.db.query("INSERT INTO audit_log(id,action,resource_type,resource_id,ip,created_at) VALUES($1,$2,'assinatura',$3,'',$4)",[randomUUID(),action,resource,em]);
  await evento('assinatura_suspensa',S.s7,'2026-06-10T13:00:00Z');await evento('assinatura_reativada',S.s7,'2026-07-05T13:00:00Z');
  const pagamento=(sub,valor,pagoEm,estornadoEm=null)=>t.db.query(`INSERT INTO payments(id,subscription_id,valor_centavos,pago_em,forma,meses,vence_antes,vence_depois,referencia_de,referencia_ate,estornado_em,motivo_estorno)
    VALUES($1,$2,$3,$4,'pix',1,$4,($4::date+30),$4,($4::date+29),$5,$6)`,[randomUUID(),sub,valor,pagoEm,estornadoEm,estornadoEm?'Pix duplicado':'']);
  await pagamento(S.s2,18000,'2026-07-24');
  await pagamento(S.s1,9900,'2026-09-12');
  // Estornado às 23h de 30/09 em São Paulo (02h de 01/10 em UTC): o estorno desconta em setembro.
  await pagamento(S.s3,9900,'2026-09-05','2026-10-01T02:00:00Z');
  await pagamento(S.s1,9900,'2026-10-10');
  await pagamento(S.s4,6700,'2025-10-15');
});
after(async()=>{await t?.fim();});
const ind=async()=>{const r=await t.req('/api/indicadores',{s});assert.equal(r.status,200,r.text);return r.json;};
const serie=(m,f)=>Object.fromEntries(m.filter(x=>f(x)!==0).map(x=>[x.mes,f(x)]));

test('meses: os 12 até o atual, com zero quando não há dado e o atual parcial',async()=>{
  const r=await ind();
  assert.equal(r.hoje,'2026-10-20');
  assert.deepEqual([r.meses.length,r.meses[0],r.meses[11]],[12,'2025-11','2026-10']);
  for(const bloco of ['recebido','mrr','movimento']) {
    assert.deepEqual(r[bloco].meses.map(m=>m.mes),r.meses,bloco);
    assert.deepEqual(r[bloco].meses.map(m=>m.parcial),[...Array(11).fill(false),true],bloco);
  }
  assert.deepEqual(r.recebido.meses[0],{mes:'2025-11',centavos:0,pagos:{qtd:0,centavos:0},estornados:{qtd:0,centavos:0},parcial:false});
});

test('recebido: pagamentos do mês menos os estornos feitos no mês, no dia de São Paulo',async()=>{
  const r=(await ind()).recebido;
  assert.deepEqual(serie(r.meses,m=>m.centavos),{'2026-07':18000,'2026-09':9900,'2026-10':9900});
  const set=r.meses.find(m=>m.mes==='2026-09'),out=r.meses.find(m=>m.mes==='2026-10');
  assert.deepEqual([set.pagos,set.estornados],[{qtd:2,centavos:19800},{qtd:1,centavos:9900}],'o pago de setembro conta mesmo estornado depois');
  assert.deepEqual([out.pagos,out.estornados],[{qtd:1,centavos:9900},{qtd:0,centavos:0}]);
  assert.equal(r.total,37800,'o pagamento de 2025-10 fica fora dos 12 meses');
});

test('receita mensal recorrente no fim de cada mês: início, suspensões (com a auditoria) e cancelamento',async()=>{
  const r=(await ind()).mrr;
  assert.deepEqual(r.meses.map(m=>[m.mes,m.centavos,m.assinaturas]),[
    ['2025-11',10000,1],['2025-12',10000,1],['2026-01',19900,2],['2026-02',26600,3],['2026-03',36500,4],['2026-04',41500,5],
    ['2026-05',48200,6],['2026-06',41500,5],['2026-07',54200,7],['2026-08',44200,6],['2026-09',39200,5],['2026-10',39200,5]]);
  assert.match(r.como,/As inadimplentes entram/);
});

test('novas e canceladas por mês, com a receita mensal de cada uma',async()=>{
  const r=(await ind()).movimento;
  assert.deepEqual(serie(r.meses,m=>m.novas.qtd),{'2026-01':1,'2026-02':1,'2026-03':1,'2026-04':1,'2026-05':1,'2026-07':1});
  assert.deepEqual(r.meses.find(m=>m.mes==='2026-07').novas,{qtd:1,centavos:6000},'o trimestral de R$ 180 vale R$ 60 por mês');
  assert.deepEqual(serie(r.meses,m=>m.canceladas.centavos),{'2026-08':10000});
});

test('previsão: as ativas que vencem em 30 dias, em 5 semanas, e as atrasadas à parte',async()=>{
  const r=(await ind()).previsao;
  assert.deepEqual([r.de,r.ate],['2026-10-20','2026-11-19']);
  assert.deepEqual(r.semanas.map(w=>[w.de,w.ate,w.qtd,w.centavos]),[['2026-10-20','2026-10-26',1,18000],['2026-10-27','2026-11-02',0,0],
    ['2026-11-03','2026-11-09',0,0],['2026-11-10','2026-11-16',1,9900],['2026-11-17','2026-11-19',1,6700]]);
  assert.deepEqual(r.semanas[0].itens,[{id:S.s2,cliente:{id:r.semanas[0].itens[0].cliente.id,nome:'Clínica Vida Plena'},empresa:null,plano:{id:'plano-avancado',nome:'Avançado'},
    venceEm:'2026-10-24',dias:4,valorCentavos:18000,situacao:'a-vencer'}]);
  assert.deepEqual(r.total,{qtd:3,centavos:34600});
  assert.deepEqual(r.atrasadas,{vencidas:{qtd:1,centavos:6700},inadimplentes:{qtd:1,centavos:9900}});
  // Igual ao "a renovar em 30 dias" do Resumo.
  const resumo=(await t.req('/api/resumo',{s})).json;
  assert.deepEqual(resumo.aRenovar30,{qtd:r.total.qtd,valor:r.total.centavos});
});

test('inadimplência por faixa de atraso e receita por plano, com o mesmo MRR do Resumo',async()=>{
  const r=await ind();
  assert.deepEqual({...r.inadimplencia,como:undefined},{como:undefined,qtd:1,centavos:9900,faixas:[{de:1,ate:30,qtd:1,centavos:9900},
    {de:31,ate:60,qtd:0,centavos:0},{de:61,ate:90,qtd:0,centavos:0},{de:91,ate:null,qtd:0,centavos:0}]});
  assert.match(r.inadimplencia.como,/há mais de 10 dias/);
  assert.deepEqual({...r.planos,como:undefined},{como:undefined,itens:[{plano:{id:'plano-avancado',nome:'Avançado'},assinaturas:3,centavos:19400},
    {plano:{id:'plano-premium',nome:'Premium'},assinaturas:1,centavos:9900}],assinaturas:4,mrr:29300,valorMedio:7325});
  assert.equal((await t.req('/api/resumo',{s})).json.mrr,r.planos.mrr);
});

test('página /indicadores para todo papel, com o mesmo vm da API',async()=>{
  const p=await t.pagina('/indicadores',{s});
  assert.deepEqual([p.status,p.view,p.title],[200,'indicadores','Indicadores | Gestão Nexus']);
  assert.deepEqual(p.vm.dados,await ind());
  assert.deepEqual(p.vm.filtros,{});
});
