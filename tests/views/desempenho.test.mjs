import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { previa } from '../../api/views/admin.mjs';
import { tela, ficha, configuracoes } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/desempenho-anunciante e fe/parcial-desempenho: o desempenho no guia de cada empresa na ficha do cliente (6.7) e a variável {desempenho} na
// prévia das Configurações (6.14 e 7.3), a partir dos vms de exemplo do contrato v0.10.0.
const XSS='<img src=x onerror=alert(1)>';
const html=dados=>views.cliente(tela('cliente',dados));
const bloco=h=>{const i=h.indexOf('<section class="bloco desempenho"');assert.ok(i>=0,'o bloco');return h.slice(i,h.indexOf('<section class="bloco"',i+10)>0?h.indexOf('<section class="bloco"',i+10):undefined);};
const com=mudar=>{const d=structuredClone(ficha);mudar(d);return d;};

test('ficha: o desempenho no guia depois das empresas, com a leitura, o como e um cartão por empresa',()=>{
  const h=html(ficha),b=bloco(h);
  assert.ok(h.indexOf('id="ficha-empresas"')<h.indexOf('id="ficha-desempenho"'),'depois das empresas do guia');
  assert.match(b,/^<section class="bloco desempenho" aria-labelledby="ficha-desempenho"><div class="bloco-cabeca"><h2 id="ficha-desempenho">Desempenho no guia<\/h2><p>Lido em <time datetime="2026-10-20T08:00:04\.000Z">20\/10\/2026 às 05:00<\/time>\.<\/p><\/div><p class="indicador-como">Visitas e contatos no guia dos visitantes que aceitaram a medição no site[^<]*O site mede as visitas e os contatos desde\s14\/07\/2026\.<\/p>/);
  assert.match(b,/<section class="indicador is-largo desempenho-empresa" aria-labelledby="desempenho-0"><h3 id="desempenho-0">Clínica Vida Plena · Centro<\/h3><div class="numeros desempenho-numeros"><div class="numero"><span class="numero-rotulo">Setembro<\/span><strong class="numero-valor">312 visitas<\/strong><span class="numero-nota">65 contatos: 41 WhatsApp · 6 telefone · 14 rota · 4 site<\/span><\/div><div class="numero"><span class="numero-rotulo">Outubro, até a leitura<\/span><strong class="numero-valor">205 visitas<\/strong><span class="numero-nota">39 contatos: 27 WhatsApp · 3 telefone · 8 rota · 1 site<\/span><\/div><\/div>/);
  assert.match(b,/<ul class="legenda"><li><span class="legenda-cor is-a"><\/span>Mês inteiro<\/li><li><span class="legenda-cor is-a-media"><\/span>Mês medido só em parte<\/li><li><span class="legenda-cor is-a-clara"><\/span>Mês ainda aberto na leitura<\/li><li><span class="legenda-cor is-sem"><\/span>Sem medição<\/li><\/ul>/);
  assert.match(b,/<svg class="banda is-sem" x="0%" width="16\.6667%"[^>]*data-dica="maio de 2026" data-dica-valor="Sem medição"/,'o mês sem medição como faixa cinza');
  assert.match(b,/<svg class="banda is-inicio" x="33\.3333%"[^>]*data-dica="julho de 2026, desde\s14\/07"/,'o mês em que a medição começou: o tom do meio');
  assert.match(b,/<svg class="banda is-parcial" x="83\.3333%"[^>]*data-dica="outubro de 2026, até a leitura" data-dica-valor="205 visitas" data-dica-nota="39 contatos"/);
  assert.match(b,/<caption class="sr-only">Visitas e contatos de Clínica Vida Plena · Centro no guia em cada mês<\/caption>/);
  assert.match(b,/<span class="sr-only">maio de 2026<\/span><\/th><td class="num"><span class="sem-medicao">sem medição<\/span><\/td><td class="num"><span class="sem-medicao">sem medição<\/span><\/td><\/tr>/,'nunca zero');
  assert.match(b,/<span class="sr-only">setembro de 2026<\/span><\/th><td class="num">312<\/td><td class="num">65<span class="linha-apoio">41 WhatsApp · 6 telefone · 14 rota · 4 site<\/span><\/td><\/tr>/);
  assert.match(b,/<span class="sr-only">julho de 2026<\/span><span class="linha-apoio">desde 14\/07<\/span><\/th>/,'"desde" e a data com o espaço fixo');
  assert.match(b,/<span class="sr-only">outubro de 2026<\/span><span class="linha-apoio">até a leitura<\/span><\/th>/);
  assert.match(b,/<section class="indicador desempenho-empresa" aria-labelledby="desempenho-1"><h3 id="desempenho-1">Clínica Vida Plena · Austin<\/h3><p class="lista-vazia">O site não mandou números desta empresa: ele só mede as empresas publicadas no guia\.<\/p><\/section>/,'fora da cópia: o texto próprio, sem gráfico');
  assert.equal((b.match(/<div class="grafico-caixa" aria-hidden="true">/g)||[]).length,1);
  assert.match(renderPage({title:'Ficha',status:200,view:'cliente',vm:tela('cliente',ficha)}),/<script type="module" src="\/assets\/clientes\.js"><\/script><script type="module" src="\/assets\/indicadores\.js"><\/script><\/head>/,'a dica dos gráficos');
  semInline(renderPage({title:'Ficha',status:200,view:'cliente',vm:tela('cliente',ficha)}));
});

test('ficha: sem a cópia das métricas, sem empresa, sem mês aberto, e o escape',()=>{
  const sem=bloco(html(com(d=>{Object.assign(d.desempenho,{disponivel:false,lidaEm:null,medidoDesde:null});d.desempenho.empresas.forEach(m=>{m.naCopia=false;});})));
  assert.match(sem,/<h2 id="ficha-desempenho">Desempenho no guia<\/h2><\/div><div class="vazio"><p class="vazio-titulo">Ainda sem as métricas do guia<\/p><p>A gestão lê as métricas do site uma vez por dia, às 05:00\. Depois da primeira leitura, as visitas e os contatos de cada empresa aparecem aqui\.<\/p><\/div><\/section>/);
  assert.doesNotMatch(html(com(d=>{d.empresas=[];d.desempenho.empresas=[];})),/ficha-desempenho/,'sem empresa vinculada, sem o bloco');
  assert.doesNotMatch(html(com(d=>{delete d.desempenho;})),/ficha-desempenho/,'sem o campo, sem o bloco');
  const fechado=bloco(html(com(d=>{d.desempenho.empresas[0].meses.forEach(m=>{m.parcial=false;});d.desempenho.empresas[0].atual.parcial=false;})));
  assert.doesNotMatch(fechado,/Mês ainda aberto na leitura|até a leitura|Mês medido só em parte|desde\s14\/07"|>desde\s14\/07<|is-inicio|is-parcial/,'sem mês parcial, sem as legendas');
  const semMedicao=bloco(html(com(d=>{const m=d.desempenho.empresas[0];m.anterior={...m.anterior,visitas:null,contatos:null,contatosTotal:null};})));
  assert.match(semMedicao,/<span class="numero-rotulo">Setembro<\/span><strong class="numero-valor">Sem medição<\/strong><span class="numero-nota">Contatos sem medição<\/span>/);
  assert.match(bloco(html(com(d=>{d.desempenho.empresas[0].nome=XSS;}))),/<h3 id="desempenho-0">&lt;img src=x onerror=alert\(1\)&gt;<\/h3>/);
});

test('ficha: os dois parciais de 6.7, o mês medido só em parte e o mês aberto na leitura',()=>{
  const meses=(m,parciais)=>m.meses.forEach(x=>{x.parcial=parciais.includes(x.mes);});
  const legendas=b=>[...b.match(/<ul class="legenda">.*?<\/ul>/)[0].matchAll(/<\/span>([^<]+)<\/li>/g)].map(x=>x[1]);
  // A medição começou no mês anterior: o número de setembro diz desde quando, e o outubro continua até a leitura.
  const setembro=bloco(html(com(d=>{const m=d.desempenho.empresas[0];d.desempenho.medidoDesde='2026-09-10';meses(m,['2026-09','2026-10']);m.anterior.parcial=true;})));
  assert.match(setembro,/<span class="numero-rotulo">Setembro, desde\s10\/09<\/span>/);
  assert.match(setembro,/<span class="numero-rotulo">Outubro, até a leitura<\/span>/);
  assert.match(setembro,/<svg class="banda is-inicio" x="66\.6667%"[^>]*data-dica="setembro de 2026, desde\s10\/09"/);
  assert.deepEqual(legendas(setembro),['Mês inteiro','Mês medido só em parte','Mês ainda aberto na leitura','Sem medição']);
  // A medição começou no mês da leitura: os dois motivos no mesmo mês, no tom do mês aberto, sem a legenda do só em parte.
  const mesmo=bloco(html(com(d=>{d.desempenho.medidoDesde='2026-10-14';meses(d.desempenho.empresas[0],['2026-10']);})));
  assert.match(mesmo,/<span class="numero-rotulo">Outubro, desde\s14\/10, até a leitura<\/span>/);
  assert.match(mesmo,/<svg class="banda is-parcial" x="83\.3333%"[^>]*data-dica="outubro de 2026, desde\s14\/10, até a leitura"/);
  assert.match(mesmo,/<span class="sr-only">outubro de 2026<\/span><span class="linha-apoio">desde\s14\/10, até a leitura<\/span><\/th>/);
  assert.deepEqual(legendas(mesmo),['Mês inteiro','Mês ainda aberto na leitura','Sem medição']);
  assert.doesNotMatch(mesmo,/is-inicio/);
  // A medição começou no dia 1º: o mês dela é inteiro, sem "desde".
  const diaUm=bloco(html(com(d=>{d.desempenho.medidoDesde='2026-07-01';meses(d.desempenho.empresas[0],['2026-10']);})));
  assert.doesNotMatch(diaUm,/desde\s01\/07"|>desde\s01\/07<|Mês medido só em parte|is-inicio/);
  assert.match(diaUm,/O site mede as visitas e os contatos desde\s01\/07\/2026\./,'a frase do começo continua');
  assert.match(diaUm,/<svg class="banda" x="33\.3333%"[^>]*data-dica="julho de 2026"/);
  // A leitura de 30/09 às 23:00 em São Paulo (02:00 UTC do dia 1º): setembro ainda estava aberto, e julho segue desde 14/07.
  const tarde=bloco(html(com(d=>{const m=d.desempenho.empresas[0];d.desempenho.lidaEm='2026-10-01T02:00:00.000Z';meses(m,['2026-07','2026-09','2026-10']);m.anterior.parcial=true;})));
  assert.match(tarde,/<span class="numero-rotulo">Setembro, até a leitura<\/span>/);
  assert.match(tarde,/<svg class="banda is-parcial" x="66\.6667%"[^>]*data-dica="setembro de 2026, até a leitura"/);
  assert.match(tarde,/<svg class="banda is-inicio" x="33\.3333%"[^>]*data-dica="julho de 2026, desde\s14\/07"/);
});

test('configurações: a variável {desempenho} e a prévia com a frase ou sem ela, sem espaço sobrando',()=>{
  const v=configuracoes.variaveis;
  assert.ok(v.some(x=>x.chave==='desempenho'),'o exemplo do contrato traz a variável');
  const modelo='Olá, {responsavel}! {desempenho} A assinatura vence em {vencimento}.';
  assert.equal(previa(modelo,v,'pix'),'Olá, Marina Souza! Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro. A assinatura vence em 15/10/2026.');
  assert.equal(previa(modelo,v,'pix',{semDesempenho:true}),'Olá, Marina Souza! A assinatura vence em 15/10/2026.','sai com o espaço antes');
  assert.equal(previa('{desempenho} Olá!',v,'pix',{semDesempenho:true}),'Olá!','no começo, sai com o espaço depois');
  assert.equal(previa('Olá!{desempenho}',v,'pix',{semDesempenho:true}),'Olá!');
  const h=views.configuracoes(tela('configuracoes',configuracoes));
  assert.match(h,/<button type="button" class="aba" data-variavel="desempenho"[^>]*>\{desempenho\}/);
  assert.match(h,/<fieldset class="escolha previa-opcao" data-previa-desempenho hidden><legend class="sr-only">Na prévia, o desempenho no guia<\/legend><label><input type="radio" name="previaDesempenho" value="com" checked><span>Com a frase do desempenho<\/span><\/label><label><input type="radio" name="previaDesempenho" value="sem"><span>Sem a frase \(empresa sem medição ou sem visitas\)<\/span><\/label><\/fieldset>/,'escondida enquanto o modelo não usa a variável');
  // Só o bloco da cobrança: o do relatório do mês (v0.11.0) tem a escolha dele, que o teste do relatório confere.
  const cobranca=x=>x.slice(0,x.indexOf('data-modelo-relatorio'));
  assert.match(cobranca(views.configuracoes(tela('configuracoes',{...configuracoes,modeloMensagem:modelo}))),/data-previa-desempenho>/,'com a variável no modelo, a escolha aparece');
  assert.doesNotMatch(cobranca(views.configuracoes(tela('configuracoes',{...configuracoes,variaveis:v.filter(x=>x.chave!=='desempenho')}))),/data-previa-desempenho/,'sem a variável na lista, sem a escolha');
});
