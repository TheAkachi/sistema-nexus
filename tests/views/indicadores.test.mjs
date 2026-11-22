import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { views, renderPage } from '../../api/views/index.mjs';
import { escala, reaisCurto, colunas, opostas, linha, barraHorizontal } from '../../api/views/graficos.mjs';
import { tela, comPapel, indicadores } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/indicadores: a tela Indicadores, bloco Dinheiro (6.17), a partir do vm de exemplo do contrato v0.8.0, e os gráficos em
// SVG gerados no servidor. O exemplo do contrato traz só alguns dos 12 meses; a tela mostra os que vierem.
const XSS='<img src=x onerror=alert(1)>';
const pagina=vm=>renderPage({title:'Indicadores | Gestão Nexus',status:200,view:'indicadores',vm});
const html=(dados=indicadores,papel='admin')=>views.indicadores(comPapel(tela('indicadores',dados),papel));
const bloco=(h,id)=>{const i=h.indexOf(`<section class="indicador${id==='inadimplencia'||id==='planos'?'':' is-largo'}" id="${id}"`);assert.ok(i>=0,id);return h.slice(i,h.indexOf('</section>',i)+10);};
const com=mudar=>{const d=structuredClone(indicadores);mudar(d);return d;};

test('gráficos: escala redonda com o zero, reais curtos no eixo e só a linha do zero quando tudo é zero',()=>{
  assert.deepEqual(escala([0,51700,53600]),{de:0,ate:60000,marcas:[0,20000,40000,60000]});
  assert.deepEqual(escala([-5,12],{inteiro:true}).marcas,[-5,0,5,10,15]);
  assert.deepEqual(escala([1,2],{inteiro:true}).marcas,[0,1,2],'contagens: só inteiros');
  assert.deepEqual(escala([0,0]),{de:0,ate:0,marcas:[0]});
  assert.deepEqual([0,50000,125000,1200000,120000000,-20000].map(reaisCurto),['R$ 0','R$ 500','R$ 1,25 mil','R$ 12 mil','R$ 1,2 mi','-R$ 200']);
});

test('gráficos: colunas da linha do zero para cima e para baixo, ponta arredondada, base reta e a dica de cada faixa',()=>{
  const svg=colunas([{rotulo:['nov','2025'],valor:100,dica:{titulo:'novembro',valor:'R$ 1,00'}},{rotulo:'dez',valor:0,dica:{titulo:'dezembro',valor:'R$ 0,00'}},{rotulo:'jan',valor:-50,parcial:true,dica:{titulo:XSS,valor:'-R$ 0,50',nota:XSS}}],{formato:reaisCurto});
  assert.match(svg,/^<div class="grafico"><svg class="eixo-y" width="\d+" height="220" focusable="false">/);
  assert.match(svg,/<svg class="banda" x="0%" width="33\.3333%" height="180" data-dica="novembro" data-dica-valor="R\$ 1,00" data-dica-nota=""><rect class="banda-fundo" width="100%" height="180"\/><g class="barra-a"><rect x="25%" width="50%" y="10" height="113\.33" rx="4"\/><rect x="25%" width="50%" y="119\.33" height="4"\/><\/g><\/svg>/);
  assert.match(svg,/<svg class="banda" x="33\.3333%" width="33\.3333%" height="180" data-dica="dezembro"[^>]*><rect class="banda-fundo" width="100%" height="180"\/><\/svg>/,'zero: sem coluna');
  assert.match(svg,/<svg class="banda is-parcial" x="66\.6667%"[^>]*><rect class="banda-fundo"[^>]*\/><g class="barra-a"><rect x="25%" width="50%" y="123\.33" height="56\.67" rx="4"\/><rect x="25%" width="50%" y="123\.33" height="4"\/>/,'negativa: desce da linha do zero');
  assert.match(svg,/data-dica="&lt;img src=x onerror=alert\(1\)&gt;"/);
  assert.match(svg,/<line class="grade is-zero" x1="0" x2="100%" y1="123\.5" y2="123\.5"\/>/);
  assert.match(svg,/<text class="rotulo-x" x="16\.6667%" y="197" text-anchor="middle">nov<tspan x="16\.6667%" dy="15">2025<\/tspan><\/text>/);
  assert.match(svg,/<text x="\d+" y="184" text-anchor="end">-R\$ 0,5<\/text>/);
  assert.match(colunas([{rotulo:'a',valor:0},{rotulo:'b',valor:0}],{formato:reaisCurto}),/<text class="grafico-vazio" x="50%" y="95" text-anchor="middle">Nenhum valor neste período<\/text>/);
  assert.doesNotMatch(svg,/grafico-vazio/);
  const alternado=colunas([1,2,3,4].map(v=>({rotulo:String(v),valor:v})),{formato:String,alternar:true});
  assert.deepEqual([...alternado.matchAll(/<text class="rotulo-x( is-alternado)?"/g)].map(m=>!!m[1]),[true,false,true,false],'o último rótulo sempre fica');
});

test('gráficos: opostas com o eixo sem sinal, linha esticada com o traço sem escala e a barra horizontal da tabela',()=>{
  const op=opostas([{rotulo:'out',a:2,b:1,dica:{titulo:'o',valor:'v'}}],{formato:String});
  assert.match(op,/<g class="barra-a">[^]*<\/g><g class="barra-b">/);
  assert.deepEqual([...op.matchAll(/<text x="\d+" y="[\d.]+" text-anchor="end">(\d+)<\/text>/g)].map(m=>m[1]),['1','0','1','2'],'as canceladas contam para baixo, sem o sinal');
  const ln=linha([{rotulo:'a',valor:100},{rotulo:'b',valor:200},{rotulo:'c',valor:150}].map(i=>({...i,dica:{titulo:i.rotulo,valor:String(i.valor)}})),{formato:String});
  assert.match(ln,/^<div class="grafico is-linha">/);
  assert.match(ln,/<svg width="100%" height="180" viewBox="0 0 300 180" preserveAspectRatio="none" focusable="false"><path class="area-a" d="M50 95L150 10L250 52\.5L250 180L50 180Z"\/><path class="linha-a" d="M50 95L150 10L250 52\.5" vector-effect="non-scaling-stroke"\/><\/svg><circle class="ponto-a" cx="83\.3333%" cy="52\.5" r="4"\/>/);
  assert.match(ln,/<line class="banda-guia" x1="50%" x2="50%" y1="10" y2="180"\/><circle class="banda-ponto" cx="50%" cy="10" r="4"\/>/);
  assert.equal(barraHorizontal(0),'<svg class="barra-h" width="100%" height="10" aria-hidden="true" focusable="false"></svg>');
  assert.match(barraHorizontal(.5),/<svg width="50%" height="10"><rect width="100%" height="10" rx="4"\/><rect width="50%" height="10"\/><\/svg>/);
  assert.match(barraHorizontal(3),/<svg width="100%" height="10">/);
});

test('indicadores: o período, os atalhos e os oito blocos, cada um com o número em texto, o como, o gráfico decorativo e a tabela',()=>{
  const h=html();
  assert.match(h,/<h1 id="titulo">Indicadores<\/h1><p>O dinheiro de novembro de 2025 a outubro de 2026, com os números da gestão, e a audiência do guia, com as métricas do site, até 20\/10\/2026\. A foto de hoje está no <a href="\/">Resumo<\/a>\.<\/p>/);
  assert.match(h,/<nav class="abas" aria-label="Ir para um bloco"><ul><li><a class="aba" href="#recebido">Recebido<\/a><\/li><li><a class="aba" href="#receita">Receita recorrente<\/a>[^]*href="#planos">Por plano<\/a><\/li>[^]*href="#anunciantes">Anunciantes<\/a><\/li><\/ul><\/nav>/);
  assert.deepEqual([...h.matchAll(/<section class="indicador[^"]*" id="([^"]+)" aria-labelledby="\1-titulo">/g)].map(m=>m[1]),['recebido','receita','movimento','previsao','inadimplencia','planos','audiencia','anunciantes']);
  assert.equal((h.match(/<div class="grafico-caixa" aria-hidden="true">/g)||[]).length,5,'cinco gráficos de colunas e linha, todos decorativos');
  assert.equal((h.match(/<table class="tabela-dados/g)||[]).length,14,'uma tabela por bloco do dinheiro, e as listas da audiência e dos anunciantes');
  assert.match(h,/<a href="\/indicadores" aria-current="page">/);
  assert.match(pagina(tela('indicadores',indicadores)),/<script type="module" src="\/assets\/gestao\.js"><\/script><script type="module" src="\/assets\/indicadores\.js"><\/script><\/head>/);
  semInline(pagina(tela('indicadores',indicadores)));
  assert.equal(html(indicadores,'leitura'),html(indicadores,'leitura'),'todo papel vê o mesmo corpo');
  assert.match(html(indicadores,'leitura'),/id="planos"/);
});

test('recebido: o total de 12 meses, o mês atual até hoje, o porquê da diferença com o Resumo e a tabela com pagamentos e estornos',()=>{
  const b=bloco(html(),'recebido');
  assert.match(b,/<h2 id="recebido-titulo">Recebido por mês<\/h2><p class="indicador-numero"><strong>R\$ 1\.053,00<\/strong><span>em 12 meses<\/span><\/p><p class="indicador-nota">Em outubro, até hoje: <span class="sem-quebra">R\$ 536,00<\/span>\. Em setembro: <span class="sem-quebra">R\$ 517,00<\/span>\.<\/p>/);
  assert.match(b,/<p class="indicador-como">Pagamentos registrados com data no mês, menos os estornos feitos no mês\. O estorno desconta no mês em que foi feito\. Por isso, o mês atual pode ser diferente do Resumo, que tira o pagamento estornado do mês em que ele foi pago\.<\/p>/);
  assert.match(b,/<ul class="legenda"><li><span class="legenda-cor is-a"><\/span>Mês fechado<\/li><li><span class="legenda-cor is-a-clara"><\/span>Mês atual, até hoje<\/li><\/ul>/);
  assert.match(b,/<svg class="banda is-parcial" x="66\.6667%" width="33\.3333%" height="180" data-dica="outubro de 2026, até hoje" data-dica-valor="R\$ 536,00" data-dica-nota="5 pagamentos">/);
  assert.match(b,/data-dica="setembro de 2026" data-dica-valor="R\$ 517,00" data-dica-nota="6 pagamentos e 1 estorno"/);
  assert.match(b,/<caption class="sr-only">Recebido em cada mês: pagamentos menos estornos<\/caption><thead><tr><th scope="col">Mês<\/th><th scope="col" class="num">Recebido<\/th><th scope="col" class="num">Pagamentos<\/th><th scope="col" class="num">Estornos<\/th><\/tr><\/thead>/);
  assert.match(b,/<tr><th scope="row"><span aria-hidden="true">set\.<span class="mes-ano"> 2026<\/span><\/span><span class="sr-only">setembro de 2026<\/span><\/th><td class="num"><strong>R\$ 517,00<\/strong><\/td><td class="num">R\$ 616,00<span class="linha-apoio">6 pagamentos<\/span><\/td><td class="num">R\$ 99,00<span class="linha-apoio">1 estorno<\/span><\/td><\/tr>/);
  assert.match(b,/<span class="sr-only">outubro de 2026<\/span><span class="linha-apoio">até hoje<\/span><\/th>/);
  assert.match(b,/<tr><th scope="row"><span aria-hidden="true">nov\.<span class="mes-ano"> 2025<\/span><\/span><span class="sr-only">novembro de 2025<\/span><\/th><td class="num"><strong>R\$ 0,00<\/strong><\/td><td class="num">R\$ 0,00<\/td><td class="num">R\$ 0,00<\/td><\/tr>/,'mês sem dado: zero, não lacuna');
  assert.match(b,/<tfoot><tr><th scope="row">12 meses<\/th><td class="num">R\$ 1\.053,00<\/td><td class="num">R\$ 1\.152,00<\/td><td class="num">R\$ 99,00<\/td><\/tr><\/tfoot>/);
});

test('receita recorrente e movimento: a receita de hoje com a linha, e o saldo de novas e canceladas com as duas cores',()=>{
  const r=bloco(html(),'receita');
  assert.match(r,/<strong>R\$ 1\.966,00<\/strong><span>hoje<\/span><\/p><p class="indicador-nota">23 assinaturas entram na conta\. No fim de setembro: <span class="sem-quebra">R\$ 1\.867,00<\/span>\.<\/p>/);
  assert.match(r,/As inadimplentes entram\. Por isso, pode ser maior que a receita mensal do Resumo, que tira as inadimplentes de hoje\.<\/p>/);
  assert.match(r,/<div class="grafico is-linha">[^]*<path class="linha-a"[^]*<p class="grafico-nota">A linha mede o último dia de cada mês; no mês atual, hoje\.<\/p>/);
  assert.match(r,/data-dica="Hoje \(outubro\)" data-dica-valor="R\$ 1\.966,00" data-dica-nota="23 assinaturas"/);
  assert.match(r,/data-dica="Fim de setembro de 2026"/);
  assert.match(r,/<td class="num"><strong>R\$ 1\.966,00<\/strong><span class="linha-apoio">hoje<\/span><\/td><td class="num">23<\/td>/);
  const m=bloco(html(),'movimento');
  assert.match(m,/<strong>\+1<\/strong><span>assinatura de saldo em 12 meses<\/span><\/p><p class="indicador-nota">2 novas e 1 cancelada\. Na receita mensal, <span class="sem-quebra">R\$ 166,00<\/span> entraram com as novas e <span class="sem-quebra">R\$ 67,00<\/span> saíram com as canceladas\.<\/p>/);
  assert.match(m,/<li><span class="legenda-cor is-a"><\/span>Novas, acima da linha<\/li><li><span class="legenda-cor is-b"><\/span>Canceladas, abaixo<\/li>/);
  assert.match(m,/<g class="barra-a">[^]*<g class="barra-b">/);
  assert.match(m,/<td class="num">2<span class="linha-apoio">R\$ 166,00 por mês<\/span><\/td><td class="num">1<span class="linha-apoio">R\$ 67,00 por mês<\/span><\/td><\/tr>/);
  assert.match(m,/<tfoot><tr><th scope="row">12 meses<\/th><td class="num">2<\/td><td class="num">1<\/td><\/tr><\/tfoot>/);
  const saldo=bloco(html(com(d=>{d.movimento.meses[1].canceladas={qtd:4,centavos:30000};})),'movimento');
  assert.match(saldo,/<strong>−2<\/strong><span>assinaturas de saldo em 12 meses<\/span>/);
});

test('previsão: o total e o período, as semanas, as atrasadas fora da previsão e quem vence, com a situação',()=>{
  const b=bloco(html(),'previsao');
  assert.match(b,/<strong>R\$ 434,00<\/strong><span>de 20\/10\/2026 a 19\/11\/2026<\/span><\/p><p class="indicador-nota">4 assinaturas vencem nesse período\.<\/p>/);
  assert.match(b,/<text class="rotulo-x" x="10%" y="197" text-anchor="middle">20\/10<tspan x="10%" dy="15">a 26\/10<\/tspan><\/text>/);
  assert.match(b,/data-dica="De 20\/10 a 26\/10" data-dica-valor="R\$ 180,00" data-dica-nota="1 assinatura"/);
  assert.match(b,/<tr><th scope="row">20\/10 a 26\/10<\/th><td class="num">1<\/td><td class="num"><strong>R\$ 180,00<\/strong><\/td><\/tr>/);
  assert.match(b,/<tfoot><tr><th scope="row">30 dias<\/th><td class="num">4<\/td><td class="num">R\$ 434,00<\/td><\/tr><\/tfoot>/);
  assert.match(b,/<p class="indicador-atrasadas"><svg[^]*<\/svg><span>Fora da previsão, já venceram e não foram pagas: <span class="sem-quebra">R\$ 198,00<\/span> \(1 vencida dentro da tolerância e 1 inadimplente\)\. <a href="\/renovacoes">Ver em Renovações/);
  assert.match(b,/<details class="vencem"><summary class="botao-texto">Ver quem vence <span class="contador">1<\/span><\/summary><h3>De 20\/10\/2026 a 26\/10\/2026<\/h3><ul class="vencem-lista"><li class="vence"><p class="vence-quem"><a href="\/clientes\/2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62">Padaria Pão Dourado<\/a><span class="linha-apoio">Padaria Pão Dourado · Avançado<\/span><\/p><p class="vence-prazo"><span class="selo is-a-vencer">Vence em 4 dias<\/span><span>Vencimento em <time datetime="2026-10-24">24\/10\/2026<\/time><\/span><\/p><p class="vence-valor">R\$ 180,00<\/p><\/li><\/ul><\/details>/);
  const vazia=bloco(html(com(d=>{d.previsao.atrasadas={vencidas:{qtd:0,centavos:0},inadimplentes:{qtd:0,centavos:0}};d.previsao.semanas.forEach(s=>{s.itens=[];});})),'previsao');
  assert.doesNotMatch(vazia,/indicador-atrasadas|<details/);
  const xss=bloco(html(com(d=>{const it=d.previsao.semanas[0].itens[0];it.cliente.nome=XSS;it.empresa=null;it.plano=null;})),'previsao');
  assert.match(xss,/&lt;img src=x onerror=alert\(1\)&gt;<\/a><span class="linha-apoio">Sem empresa do guia · Sem plano<\/span>/);
});

test('inadimplência e planos: as faixas e os planos numa tabela com a barra de cada linha, os vazios e o arredondamento',()=>{
  const i=bloco(html(),'inadimplencia');
  assert.match(i,/<strong>R\$ 99,00<\/strong><span>hoje<\/span><\/p><p class="indicador-nota">1 assinatura depois da tolerância\. <a href="\/renovacoes">Ver as vencidas em Renovações/);
  assert.match(i,/<table class="tabela-dados com-barras"><caption class="sr-only">Inadimplência de hoje por dias de atraso<\/caption>/);
  assert.match(i,/<tr><th scope="row">1 a 30 dias<svg class="barra-h"[^>]*><svg width="100%" height="10">[^]*<\/th><td class="num">1<\/td><td class="num"><strong>R\$ 99,00<\/strong><\/td><\/tr>/);
  assert.match(i,/<tr><th scope="row">91 dias ou mais<svg class="barra-h" width="100%" height="10" aria-hidden="true" focusable="false"><\/svg><\/th><td class="num">0<\/td><td class="num"><strong>R\$ 0,00<\/strong><\/td><\/tr>/);
  const semAtraso=bloco(html(com(d=>{d.inadimplencia.qtd=0;d.inadimplencia.centavos=0;d.inadimplencia.faixas.forEach(f=>{f.qtd=0;f.centavos=0;});})),'inadimplencia');
  assert.match(semAtraso,/<p class="indicador-nota">Nenhuma assinatura inadimplente hoje\.<\/p>/);
  const p=bloco(html(),'planos');
  assert.match(p,/<strong>R\$ 1\.867,00<\/strong><span>por mês<\/span><\/p><p class="indicador-nota">22 assinaturas, com valor médio de <span class="sem-quebra">R\$ 84,86<\/span> por mês\.<\/p>/);
  assert.match(p,/<tr><th scope="row">Premium<svg class="barra-h"[^>]*><svg width="100%" height="10">[^]*<\/th><td class="num">12<\/td><td class="num"><strong>R\$ 1\.188,00<\/strong><\/td><\/tr><tr><th scope="row">Avançado<svg class="barra-h"[^>]*><svg width="57\.1549%" height="10">/);
  assert.match(p,/<tr><th scope="row">Sem plano<svg class="barra-h"[^>]*><\/svg><\/th><td class="num">1<\/td><td class="num"><strong>R\$ 0,00<\/strong><\/td><\/tr>/);
  assert.doesNotMatch(p,/arredondamento/,'a soma bate com a receita');
  assert.match(bloco(html(com(d=>{d.planos.mrr=186702;})),'planos'),/<p class="grafico-nota">A soma dos planos fica <span class="sem-quebra">R\$ 0,02<\/span> abaixo da receita total, por arredondamento\.<\/p>/);
  assert.match(bloco(html(com(d=>{d.planos.itens[0].plano.nome=XSS;})),'planos'),/<th scope="row">&lt;img src=x onerror=alert\(1\)&gt;<svg/);
  const semPlanos=bloco(html(com(d=>{d.planos={...d.planos,itens:[],assinaturas:0,mrr:0,valorMedio:0};})),'planos');
  assert.match(semPlanos,/<p class="vazio-titulo">Nenhuma assinatura ativa em dia<\/p>/);
  assert.doesNotMatch(semPlanos,/<table/);
  assert.match(bloco(html(com(d=>{d.recebido.como=XSS;})),'recebido'),/<p class="indicador-como">&lt;img src=x onerror=alert\(1\)&gt; Por isso/);
});

test('moldura: o cabeçalho é branco e opaco, sem o desfoque que deixava um risco preto sob o logo',async()=>{
  const css=await readFile(new URL('../../p2/gestao.css',import.meta.url),'utf8');
  const topo=/\n\.topo\{([^}]*)\}/.exec(css)?.[1]||'';
  assert.match(topo,/background:var\(--papel\)/);
  assert.doesNotMatch(topo,/backdrop-filter/);
});
