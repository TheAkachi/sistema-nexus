import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { colunas } from '../../api/views/graficos.mjs';
import { tela, comPapel, indicadores, configuracoes } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/fase2-gestao: o WhatsApp do atendimento nas Configurações (6.14) e os blocos Audiência do Guia e Anunciantes dos
// Indicadores (6.17), a partir dos vms de exemplo do contrato v0.9.0.
const XSS='<img src=x onerror=alert(1)>';
const html=(dados=indicadores,papel='admin')=>views.indicadores(comPapel(tela('indicadores',dados),papel));
// A Audiência tem seções dentro (as listas): o bloco vai do começo dela até o começo dos Anunciantes.
const bloco=h=>{const i=h.indexOf('id="audiencia" aria-labelledby="audiencia-titulo"');assert.ok(i>=0);return h.slice(h.lastIndexOf('<section',i),h.indexOf('id="anunciantes"'));};
const com=mudar=>{const d=structuredClone(indicadores);mudar(d);return d;};

test('configurações: o WhatsApp do atendimento ao lado da chave Pix, com a máscara, e o texto do que muda no guia',()=>{
  const h=views.configuracoes(comPapel(tela('configuracoes',configuracoes),'admin'));
  assert.match(h,/<fieldset class="secao-form"><legend>Como o afiliado paga<\/legend><p class="secao-texto">A chave Pix e o WhatsApp do atendimento aparecem na "Minha assinatura", no painel do afiliado no guia\. Mudar um dos dois pede a confirmação da sua senha ou de um código e atualiza a "Minha assinatura" de todas as empresas com assinatura\.<\/p>/);
  assert.match(h,/<label for="config-whatsapp">WhatsApp do atendimento<\/label><input type="tel" id="config-whatsapp" name="whatsappAtendimento" aria-describedby="config-whatsapp-dica config-whatsapp-erro" value="\(21\) 90000-0000" inputmode="tel" maxlength="20" autocomplete="off" placeholder="\(21\) 98765-4321" data-antes="\(21\) 90000-0000">/);
  assert.match(h,/<p>Só os dados do negócio: a chave Pix, o WhatsApp do atendimento, a mensagem de cobrança, a do relatório do mês e a tolerância\.<\/p>/);
  assert.match(views.configuracoes(tela('configuracoes',{...configuracoes,whatsappAtendimento:''})),/name="whatsappAtendimento"[^>]*value=""[^>]*data-antes="">/,'sem número: o campo vazio');
  assert.doesNotMatch(views.configuracoes(tela('configuracoes',{...configuracoes,whatsappAtendimento:`"${XSS}`})),/<img src=x|onerror=/,'o campo só mostra dígitos');
  semInline(renderPage({title:'Configurações',status:200,view:'configuracoes',vm:tela('configuracoes',configuracoes)}));
});

test('gráficos: o mês sem medição é uma faixa cinza, nunca uma coluna zerada, e sem nenhuma medição o desenho diz isso',()=>{
  const svg=colunas([{rotulo:'set',valor:null,dica:{titulo:'setembro',valor:'Sem medição'}},{rotulo:'out',valor:0,dica:{titulo:'outubro',valor:'0'}},{rotulo:'nov',valor:40,dica:{titulo:'novembro',valor:'40'}}],{formato:String,inteiro:true});
  assert.match(svg,/<svg class="banda is-sem" x="0%"[^>]*><rect class="banda-fundo"[^>]*\/><rect class="barra-sem" x="25%" width="50%" y="10" height="170" rx="4"\/><\/svg>/);
  assert.match(svg,/<svg class="banda" x="33\.3333%"[^>]*><rect class="banda-fundo"[^>]*\/><\/svg>/,'zero: sem coluna e sem a faixa cinza');
  assert.doesNotMatch(svg,/grafico-vazio/);
  assert.match(colunas([{rotulo:'a',valor:null},{rotulo:'b',valor:null}],{formato:String}),/<text class="grafico-vazio"[^>]*>Sem medição neste período<\/text>/);
});

test('audiência: as visitas do mês, os contatos por canal, as buscas, o mês sem medição em branco e as quatro listas',()=>{
  const h=html(),b=bloco(h);
  assert.match(b,/<h2 id="audiencia-titulo">Audiência do guia<\/h2><p class="indicador-numero"><strong>1\.240<\/strong><span>visitas em outubro, até hoje<\/span><\/p><p class="indicador-nota">159 contatos \(96 WhatsApp · 21 telefone · 34 rota · 8 site\) e 310 buscas, 22 sem resultado\.<\/p>/);
  assert.match(b,/Mês sem medição aparece em branco\. Atualizada em <time datetime="2026-10-20T08:00:41\.000Z">20\/10\/2026 às 05:00<\/time>\. O site mede os contatos desde 28\/07\/2026, e as buscas desde 01\/10\/2026\.<\/p>/);
  assert.match(b,/<li><span class="legenda-cor is-sem"><\/span>Sem medição<\/li>/);
  assert.match(b,/<svg class="banda is-sem" x="0%"[^>]*data-dica="novembro de 2025" data-dica-valor="Sem medição"/);
  assert.match(b,/<span class="sr-only">novembro de 2025<\/span><\/th><td class="num"><span class="sem-medicao">sem medição<\/span><\/td><td class="num"><span class="sem-medicao">sem medição<\/span><\/td><td class="num"><span class="sem-medicao">sem medição<\/span><\/td><\/tr>/,'nunca zero');
  assert.match(b,/<td class="num">1\.240<\/td><td class="num">159<span class="linha-apoio">96 WhatsApp · 21 telefone · 34 rota · 8 site<\/span><\/td><td class="num">310<span class="linha-apoio">22 sem resultado<\/span><\/td>/);
  assert.match(b,/<section class="indicador-lista" aria-labelledby="audiencia-buscas"><h3 id="audiencia-buscas">Buscas mais feitas<\/h3>[^]*<th scope="row">pizzaria<svg class="barra-h"[^>]*><svg width="100%"[^]*<td class="num">41<\/td>[^]*<th scope="row">farmacia<svg class="barra-h"[^>]*><svg width="41\.4634%"/);
  assert.match(b,/<h3 id="audiencia-sem-resultado">Buscas sem resultado<\/h3>[^]*chaveiro 24 horas[^]*<h3 id="audiencia-bairros">Bairros mais procurados<\/h3>[^]*Centro[^]*<h3 id="audiencia-categorias">Categorias mais procuradas<\/h3>[^]*<th scope="row">Alimentação<svg/,'a categoria pelo nome (v0.9.2)');
  assert.doesNotMatch(b,/>alimentacao</,'o identificador não aparece');
  const semNome=bloco(html(com(d=>{d.audiencia.categorias=[{categoria:'alimentacao',vezes:77},{categoria:'saude',nome:'',vezes:40}];})));
  assert.match(semNome,/<th scope="row">alimentacao<svg[^]*<th scope="row">saude<svg/,'sem o nome, o identificador, como na cópia antiga');
  assert.match(bloco(html(com(d=>{d.audiencia.categorias[0].nome=XSS;}))),/<th scope="row">&lt;img src=x onerror=alert\(1\)&gt;<svg/);
  const vazia=bloco(html(com(d=>{d.audiencia.bairros=[];})));
  assert.match(vazia,/<h3 id="audiencia-bairros">Bairros mais procurados<\/h3><p class="lista-vazia">Nada apareceu 3 vezes ou mais no período\.<\/p>/);
  const semVisita=bloco(html(com(d=>{Object.assign(d.audiencia.meses.at(-1),{visitas:null,contatos:null,contatosTotal:null,buscas:null,buscasSemResultado:null});})));
  assert.match(semVisita,/<strong><span class="sem-medicao">sem medição<\/span><\/strong><span>em outubro, até hoje<\/span><\/p><p class="indicador-nota">contatos sem medição e buscas sem medição\.<\/p>/);
  assert.match(bloco(html(com(d=>{d.audiencia.buscasMaisFeitas[0].termo=XSS;}))),/<th scope="row">&lt;img src=x onerror=alert\(1\)&gt;<svg/);
});

test('anunciantes: a base, os em risco com o vencimento, mais e menos contatos na mesma escala, e os banners',()=>{
  const h=html(),i=h.indexOf('id="anunciantes"'),b=h.slice(h.lastIndexOf('<section',i));
  assert.match(b,/<h2 id="anunciantes-titulo">Anunciantes<\/h2><p class="indicador-numero"><strong>22<\/strong><span>anunciantes com assinatura ativa<\/span><\/p><p class="indicador-nota">1 está em risco: vence em até 30 dias com poucos contatos\.<\/p>/);
  assert.match(b,/Em risco: vence em até 30 dias e recebeu menos de 5 contatos\. Sem medição: o site não mede a empresa, porque ela não está publicada; fica fora das listas e do risco\. Atualizada em <time[^>]*>20\/10\/2026 às 05:00<\/time>\.<\/p>/);
  assert.match(b,/<h3 id="anunciantes-risco">Em risco <span class="contador">1<\/span><\/h3><ul class="vencem-lista"><li class="vence"><p class="vence-quem"><a href="\/clientes\/2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62">Padaria Pão Dourado<\/a><span class="linha-apoio">Padaria Pão Dourado<\/span><\/p><p class="vence-prazo"><span class="selo is-a-vencer">Vence em 4 dias<\/span><span>Vencimento em <time datetime="2026-10-24">24\/10\/2026<\/time><\/span><\/p><p class="vence-valor">2 contatos<span class="linha-apoio">38 visitas<\/span><\/p><\/li><\/ul>/);
  assert.match(b,/<h3 id="anunciantes-mais">Mais contatos em 30 dias<\/h3>[^]*<a href="\/clientes\/2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f61">Clínica Vida Plena · Centro<\/a><span class="linha-apoio">Clínica Vida Plena<\/span><svg class="barra-h"[^>]*><svg width="100%"[^]*<td class="num">41<span class="linha-apoio">30 WhatsApp · 6 telefone · 4 rota · 1 site<\/span><\/td><td class="num">412<\/td>/);
  assert.match(b,/<h3 id="anunciantes-menos">Menos contatos em 30 dias<\/h3>[^]*Padaria Pão Dourado<\/a>[^]*<svg width="4\.878%" height="10">/,'a mesma escala das duas listas: 2 de 41');
  assert.match(b,/<h3 id="anunciantes-banners">Banners<\/h3>[^]*<thead><tr><th scope="col">Banner<\/th><th scope="col" class="num">Impressões<\/th><th scope="col" class="num">Cliques<\/th><th scope="col" class="num">Cliques por impressão<\/th><\/tr><\/thead><tbody><tr><th scope="row">Pão de queijo em dobro<span class="linha-apoio">Padaria Pão Dourado<\/span><svg[^]*<td class="num">4\.210<\/td><td class="num">63<\/td><td class="num">1,5%<\/td><\/tr>/);
  const semRisco=html(com(d=>{d.anunciantes.emRisco=[];d.anunciantes.banners=[];}));
  assert.match(semRisco,/<p class="indicador-nota">Nenhum em risco agora\.<\/p>/);
  assert.match(semRisco,/<h3 id="anunciantes-risco">Em risco <span class="contador">0<\/span><\/h3><p class="lista-vazia">Nenhum anunciante vence nos próximos 30 dias com poucos contatos\.<\/p>/);
  assert.match(semRisco,/<p class="lista-vazia">Nenhum banner de anunciante no período\.<\/p>/);
  const semBase=html(com(d=>{Object.assign(d.anunciantes,{base:0,maisContatos:[],menosContatos:[],emRisco:[]});}));
  assert.match(semBase,/<p class="vazio-titulo">Nenhum anunciante com assinatura ativa<\/p>/);
  assert.match(html(com(d=>{d.anunciantes.emRisco[0].empresa.nome=XSS;})),/&lt;img src=x onerror=alert\(1\)&gt;<\/a>/);
});

test('anunciantes sem medição (v0.14.1): a ficha, o vencimento e nenhum número, entre as listas e os banners; sem itens, a seção não aparece',()=>{
  const h=html(),i=h.indexOf('<section class="indicador-lista" aria-labelledby="anunciantes-sem-medicao">');
  assert.ok(i>h.indexOf('id="anunciantes-menos"')&&i<h.indexOf('id="anunciantes-banners"'),'depois de mais e menos contatos, antes dos banners');
  const s=h.slice(i,h.indexOf('</section>',i));
  assert.match(s,/<h3 id="anunciantes-sem-medicao">Sem medição <span class="contador">1<\/span><\/h3><ul class="vencem-lista"><li class="vence"><p class="vence-quem"><a href="\/clientes\/2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63">Studio Bella<\/a><span class="linha-apoio">Studio Bella<\/span><\/p><p class="vence-prazo"><span class="selo is-a-vencer">Vence em 16 dias<\/span><span>Vencimento em <time datetime="2026-11-05">05\/11\/2026<\/time><\/span><\/p><p class="vence-valor"><span class="sem-medicao">sem medição<\/span><\/p><\/li><\/ul>$/);
  assert.doesNotMatch(s,/contato|visita/,'nenhum número de contatos ou visitas, nem zero');
  const vazia=html(com(d=>{d.anunciantes.semMedicao=[];}));
  assert.doesNotMatch(vazia,/anunciantes-sem-medicao/);
  assert.doesNotMatch(html(com(d=>{delete d.anunciantes.semMedicao;})),/anunciantes-sem-medicao/);
  assert.match(html(com(d=>{d.anunciantes.semMedicao[0].empresa.nome=XSS;})),/&lt;img src=x onerror=alert\(1\)&gt;<\/a>/);
});

test('indicadores: antes da primeira leitura das métricas, os dois blocos dizem isso, sem número; e os atalhos chegam aos blocos novos',()=>{
  const h=html(com(d=>{d.audiencia={...d.audiencia,disponivel:false,atualizadaEm:null,meses:d.audiencia.meses.map(m=>({...m,visitas:null})),buscasMaisFeitas:[],buscasSemResultado:[],bairros:[],categorias:[]};d.anunciantes={...d.anunciantes,disponivel:false,atualizadaEm:null,maisContatos:[],menosContatos:[],emRisco:[],banners:[]};}));
  for(const [id,titulo] of [['audiencia','Audiência do guia'],['anunciantes','Anunciantes']]) {
    const i=h.indexOf(`id="${id}"`),b=h.slice(i,h.indexOf('</section>',i));
    assert.match(b,new RegExp(`<h2 id="${id}-titulo">${titulo}</h2><p class="indicador-como">`),`${id}: sem número`);
    assert.match(b,/<p class="vazio-titulo">Ainda sem as métricas do guia<\/p><p>A gestão lê as métricas do site uma vez por dia, às 05:00\. Depois da primeira leitura, os números aparecem aqui\.<\/p>/);
    assert.doesNotMatch(b,/<table|grafico/);
  }
  assert.match(h,/<a class="aba" href="#audiencia">Audiência<\/a><\/li><li><a class="aba" href="#anunciantes">Anunciantes<\/a>/);
  assert.match(h,/<p>O dinheiro de novembro de 2025 a outubro de 2026, com os números da gestão, e a audiência do guia, com as métricas do site, até 20\/10\/2026\. A foto de hoje está no <a href="\/">Resumo<\/a>\.<\/p>/);
  semInline(renderPage({title:'Indicadores',status:200,view:'indicadores',vm:tela('indicadores',indicadores)}));
});
