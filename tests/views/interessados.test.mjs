import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { tela, leadsLista, lead, funil, indicadores } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/leads: os interessados (contrato 14.4, v0.13.0), o item do menu só com modulos.interessados (14.5) e o funil nos
// Indicadores (14.6), a partir dos vms de exemplo do contrato.
const XSS='<img src=x onerror=alert(1)>';
const com=(dados,mudar)=>{const d=structuredClone(dados);mudar(d);return d;};
const ligado=vm=>({...vm,modulos:{interessados:true}});
const lista=(dados=leadsLista,filtros={})=>views.interessados(ligado(tela('interessados',dados,{filtros})));
const detalhe=(dados=lead)=>views.interessado(ligado(tela('interessado',dados)));
const pagina=(view,vm)=>renderPage({title:'Tela | Gestão Nexus',status:200,view,vm});
const linha=(h,codigo)=>{const i=h.indexOf(`<span class="codigo-pedido">${codigo}</span>`);assert.ok(i>=0,codigo);return h.slice(h.lastIndexOf('<tr>',i),h.indexOf('</tr>',i)+5);};

test('interessados: a última leitura, a busca pelo código, as situações em pílulas e a lista que vira ficha no celular',()=>{
  const h=lista();
  assert.match(h,/<h1 id="titulo">Interessados<\/h1>/);
  assert.match(h,/<div class="cabeca-acoes"><button type="button" class="botao secundario" data-buscar-leads><svg[^>]*>[^]*?<\/svg>Buscar agora<\/button><\/div>/);
  assert.match(h,/<div class="leitura"><p>Última leitura dos pedidos do guia: <time datetime="2026-10-20T08:00:03.000Z">[^<]+<\/time>\. A gestão lê uma vez por dia, de manhã; "Buscar agora" lê na hora\.<\/p><\/div>/);
  assert.doesNotMatch(h,/leitura-erro/,'sem erro na última tentativa');
  assert.match(h,/<form class="filtros" method="get" action="\/interessados" role="search" aria-label="Buscar interessados"><div class="campo filtros-busca"><label for="filtro-q">Código do pedido, nome ou WhatsApp<\/label><input type="search" id="filtro-q" name="q" value="" maxlength="80" autocomplete="off" aria-describedby="filtro-q-dica"><p class="campo-dica" id="filtro-q-dica">O código vem no fim da mensagem do WhatsApp, como “Pedido A7K3”\.<\/p><\/div>/);
  assert.doesNotMatch(h,/Limpar a busca/);
  assert.match(h,/<nav class="abas" aria-label="Situação dos interessados"><ul><li><a class="aba" href="\/interessados" aria-current="page">Todos<\/a><\/li><li><a class="aba" href="\/interessados\?situacao=novo">Novo<\/a><\/li><li><a class="aba" href="\/interessados\?situacao=em-conversa">Em conversa<\/a><\/li><li><a class="aba" href="\/interessados\?situacao=proposta">Proposta enviada<\/a><\/li><li><a class="aba" href="\/interessados\?situacao=perdido">Perdido<\/a><\/li><li><a class="aba" href="\/interessados\?situacao=cliente">Virou cliente<\/a><\/li><\/ul><\/nav>/);
  assert.match(h,/<p class="contagem">2 interessados<\/p><div class="tabela-caixa"><table class="tabela tabela-clientes tabela-interessados"><thead><tr><th scope="col">Pedido<\/th><th scope="col">Nome<\/th><th scope="col">WhatsApp<\/th><th scope="col">Situação<\/th><th scope="col">Próxima ação<\/th><th scope="col">Pedido em<\/th><\/tr><\/thead>/);
  const novo=linha(h,'C4MN'),conversa=linha(h,'A7K3');
  assert.match(novo,/<th scope="row"><a href="\/interessados\/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e41"><span class="codigo-pedido">C4MN<\/span><span class="sr-only">: pedido de 20\/10\/2026<\/span><\/a><\/th>/);
  assert.match(novo,/<td data-rotulo="Nome"><span class="muted">Sem nome ainda<\/span><\/td><td data-rotulo="WhatsApp"><span class="muted">—<\/span><\/td><td data-rotulo="Situação"><span class="selo is-lead-novo">Novo<\/span><\/td><td data-rotulo="Próxima ação"><span class="muted">—<\/span><\/td><td data-rotulo="Pedido em"><time datetime="2026-10-20T09:30:00.000Z">/);
  assert.match(conversa,/<td data-rotulo="Nome">Marta Souza<\/td><td data-rotulo="WhatsApp">\(21\) 98765-4321<\/td><td data-rotulo="Situação"><span class="selo is-lead-em-conversa">Em conversa<\/span><\/td><td data-rotulo="Próxima ação">Mandar a tabela de planos<span class="linha-apoio">22\/10\/2026<\/span><\/td>/);
  assert.doesNotMatch(h,/class="paginas"/,'uma página só');
  semInline(pagina('interessados',ligado(tela('interessados',leadsLista))));
  assert.match(pagina('interessados',ligado(tela('interessados',leadsLista))),/<script type="module" src="\/assets\/gestao\.js"><\/script><script type="module" src="\/assets\/interessados\.js"><\/script>/);
});

test('interessados: a leitura com erro ou nunca feita, a busca com filtro, as listas vazias e as páginas',()=>{
  const erro=lista(com(leadsLista,d=>{d.leitura={lidoEm:'2026-10-19T08:00:02.000Z',erro:'Os pedidos estão desligados no guia.',tentadoEm:'2026-10-20T08:00:03.000Z'};}));
  assert.match(erro,/Última leitura dos pedidos do guia: <time datetime="2026-10-19T08:00:02\.000Z">/);
  assert.match(erro,/<p class="leitura-erro"><svg[^>]*>[^]*?<\/svg><span>A última tentativa, em <time datetime="2026-10-20T08:00:03\.000Z">[^<]+<\/time>, falhou: Os pedidos estão desligados no guia\.<\/span><\/p><\/div>/);
  const nunca=lista(com(leadsLista,d=>{d.leitura={lidoEm:null,erro:'',tentadoEm:null};}));
  assert.match(nunca,/<div class="leitura"><p>A gestão ainda não leu os pedidos do guia nenhuma vez\. A gestão lê/);
  assert.match(lista(com(leadsLista,d=>{delete d.leitura;})),/A gestão ainda não leu os pedidos do guia nenhuma vez/,'sem o campo, não quebra');

  const filtrada=lista(leadsLista,{q:'a7k3',situacao:'em-conversa'});
  assert.match(filtrada,/<input type="hidden" name="situacao" value="em-conversa"><div class="campo filtros-busca">/);
  assert.match(filtrada,/name="q" value="a7k3"/);
  assert.match(filtrada,/<a class="botao-texto" href="\/interessados">Limpar a busca<\/a>/);
  assert.match(filtrada,/<a class="aba" href="\/interessados\?q=a7k3">Todos<\/a>/,'a busca fica ao trocar de situação');
  assert.match(filtrada,/<a class="aba" href="\/interessados\?q=a7k3&amp;situacao=em-conversa" aria-current="page">Em conversa<\/a>/);

  const vazia=com(leadsLista,d=>{d.itens=[];d.total=0;});
  assert.match(lista(vazia),/<div class="vazio"><p class="vazio-titulo">Nenhum interessado ainda<\/p><p>Quem preenche o cadastro do guia aparece aqui, com o código que manda no WhatsApp\.<\/p><\/div>/);
  assert.match(lista(vazia,{q:'ZZZZ'}),/<p class="vazio-titulo">Nenhum interessado com essa busca<\/p><p>Confira o código como veio no WhatsApp, ou limpe a busca para ver todos\.<\/p><a class="botao secundario" href="\/interessados">Limpar a busca<\/a><\/div>/);
  assert.doesNotMatch(lista(vazia),/<table/);

  const paginas=lista(com(leadsLista,d=>{d.total=45;d.pagina=2;d.paginas=3;}),{situacao:'novo'});
  assert.match(paginas,/<nav class="paginas" aria-label="Páginas da lista"><a class="botao secundario" rel="prev" href="\/interessados\?situacao=novo">[^]*?<span>Página 2 de 3<\/span><a class="botao secundario" rel="next" href="\/interessados\?situacao=novo&amp;page=3">/);
});

test('menu: "Interessados" na Carteira só com modulos.interessados e a ação clientes',()=>{
  const menu=vm=>{const h=views.clientes(vm);return h.slice(h.indexOf('<nav id="menu"'),h.indexOf('</nav>',h.indexOf('<nav id="menu"')));};
  const base=tela('clientes',{itens:[],total:0,pagina:1,paginas:1});
  assert.doesNotMatch(menu(base),/Interessados/,'desligado, como no exemplo da moldura');
  assert.doesNotMatch(menu({...base,modulos:undefined}),/Interessados/,'sem o campo, como antes da v0.13.0');
  assert.match(menu(ligado(base)),/<a href="\/clientes" aria-current="page">[^]*?<span>Clientes<\/span><\/a><\/li><li><a href="\/interessados"><svg[^>]*>[^]*?<\/svg><span>Interessados<\/span><\/a><\/li><\/ul>/);
  assert.doesNotMatch(menu(ligado({...base,pode:{...base.pode,clientes:false}})),/href="\/interessados"/,'sem a ação clientes');
  assert.match(lista(),/<a href="\/interessados" aria-current="page">/);
  assert.match(detalhe(),/<a href="\/interessados" aria-current="true">/,'o pedido fica na seção dos interessados');
});

test('interessado: o texto do pedido, os dados para completar, a situação, a próxima ação e as notas',()=>{
  const h=detalhe();
  assert.match(h,/<a class="voltar" href="\/interessados"><svg[^>]*>[^]*?<\/svg><span>Interessados<\/span><\/a>/);
  assert.match(h,/<h1 id="titulo">Pedido A7K3<\/h1><p class="cabeca-extra"><span class="selo is-lead-em-conversa">Em conversa<\/span><\/p>/);
  assert.match(h,/<section class="bloco" aria-labelledby="lead-pedido"><h2 id="lead-pedido">O pedido<\/h2><p class="pedido-meta">Feito no guia em <time datetime="2026-10-19T14:00:00\.000Z">[^<]+<\/time> · chegou à gestão em <time datetime="2026-10-20T08:00:03\.000Z">[^<]+<\/time> · veio de <span class="codigo-pedido">plano-premium<\/span><\/p><p class="balao pedido-texto">Olá, Lucas! Tenho interesse em me tornar afiliado ao Nexus\.\n\nMeu negócio/);
  assert.match(h,/Enviado pelo site site\.exemplo\.test\nPedido A7K3<\/p><\/section>/);
  assert.match(h,/<form class="formulario[^"]*"[^>]*data-form="lead" data-id="6d2e3f4a-5b6c-4d7e-9f80-a1b2c3d4e5f2"/);
  assert.match(h,/<input type="hidden" name="version" value="2"><fieldset class="secao-form"><legend>Quem pediu<\/legend><p class="secao-texto">O pedido chega sem nome nem número: complete quando a pessoa escrever no WhatsApp\.<\/p>/);
  assert.match(h,/id="lead-nome"[^>]*name="nome"[^>]*value="Marta Souza"[^>]*maxlength="160"[^>]*data-antes="Marta Souza"|name="nome"[^>]*id="lead-nome"[^>]*value="Marta Souza"[^>]*data-antes="Marta Souza"/);
  assert.match(h,/<input type="tel" [^>]*name="whatsapp"[^>]*value="\(21\) 98765-4321" inputmode="tel" maxlength="20" autocomplete="off" placeholder="\(21\) 98765-4321" data-antes="\(21\) 98765-4321">/);
  const select=h.slice(h.indexOf('<select'),h.indexOf('</select>')+9);
  assert.match(select,/name="situacao"/);
  assert.match(select,/data-antes="em-conversa"/);
  assert.deepEqual([...select.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),['novo','em-conversa','proposta','perdido'],'virar cliente é só pelo botão');
  assert.match(select,/<option value="em-conversa" selected>Em conversa<\/option>/);
  assert.match(h,/<div class="campo lead-motivo is-oculto"[^>]*>[^]*?Por que perdeu[^]*?name="motivoPerda"[^>]*minlength="3" data-antes=""/,'o motivo só aparece no perdido');
  assert.match(h,/De 3 a 200 caracteres\. Os motivos aparecem juntos no funil dos Indicadores\./);
  assert.match(h,/name="proximaAcao"[^>]*value="Mandar a tabela de planos"[^>]*maxlength="200"[^>]*placeholder="Ex\.: Mandar a tabela de planos" data-antes="Mandar a tabela de planos"/);
  assert.match(h,/<input type="date" [^>]*name="proximaEm"[^>]*value="2026-10-22" data-antes="2026-10-22">/);
  assert.match(h,/<textarea [^>]*name="notas"[^>]*maxlength="2000"[^>]*data-antes="Padaria em Austin\."[^>]*>Padaria em Austin\.<\/textarea>/);
  assert.match(h,/Salvar o interessado/);
  assert.match(h,/<section class="secao-form" aria-labelledby="lead-virar"><h2 id="lead-virar">Virar cliente<\/h2><p>Fechado o plano, crie o cliente com o nome e o WhatsApp deste pedido\.[^<]*<\/p><div><button type="button" class="botao" data-virar-cliente="6d2e3f4a-5b6c-4d7e-9f80-a1b2c3d4e5f2" data-version="2">Virar cliente<\/button><\/div><\/section>/);
  assert.doesNotMatch(h,/Complete e salve o nome antes/,'com o nome, sem o aviso');
  semInline(pagina('interessado',ligado(tela('interessado',lead))));
  assert.match(pagina('interessado',ligado(tela('interessado',lead))),/<script type="module" src="\/assets\/interessados\.js"><\/script>/);
});

test('interessado: o pedido novo sem nome, o perdido com o motivo e o que já virou cliente',()=>{
  const novo=detalhe(com(lead,d=>{Object.assign(d,{codigo:'C4MN',nome:'',whatsapp:'',situacao:'novo',proximaAcao:'',proximaEm:null,notas:'',origem:'',recebidoEm:null});}));
  assert.match(novo,/<p class="renovacao-falta"><svg[^>]*>[^]*?<\/svg><span>Complete e salve o nome antes\.<\/span><\/p><div><button type="button" class="botao" data-virar-cliente=/);
  assert.match(novo,/name="nome"[^>]*data-antes=""/);
  assert.match(novo,/name="whatsapp"[^>]*value=""[^>]*data-antes=""/);
  assert.match(novo,/<input type="date" [^>]*value="" data-antes="">/);
  assert.match(novo,/<p class="pedido-meta">Feito no guia em <time[^>]*>[^<]+<\/time><\/p>/,'sem a chegada nem a origem');

  const perdido=detalhe(com(lead,d=>{d.situacao='perdido';d.motivoPerda='Preço alto';d.perdidoEm='2026-10-21T10:00:00.000Z';}));
  assert.match(perdido,/<div class="campo lead-motivo"[^>]*>[^]*?name="motivoPerda"[^>]*value="Preço alto"[^>]*data-antes="Preço alto"/);
  assert.match(perdido,/<option value="perdido" selected>Perdido<\/option>/);
  assert.match(perdido,/<span class="selo is-lead-perdido">Perdido<\/span>/);

  const cliente=detalhe(com(lead,d=>{d.situacao='cliente';d.cliente={id:'0b8f4a9e-1c2d-4e3f-8a5b-6c7d8e9f0a1b',nome:'Padaria da Marta'};d.virouClienteEm='2026-10-25T15:00:00.000Z';}));
  assert.doesNotMatch(cliente,/<select|name="motivoPerda"|data-virar-cliente/,'já é cliente: sem trocar a situação nem virar de novo');
  assert.match(cliente,/<p class="rotulo">Situação<\/p><p><span class="selo is-lead-cliente">Virou cliente<\/span> <span class="muted">em <time datetime="2026-10-25T15:00:00\.000Z">/);
  assert.match(cliente,/<section class="secao-form" aria-labelledby="lead-cliente"><h2 id="lead-cliente">Já é cliente<\/h2><p>Este pedido virou cliente em <time[^>]*>[^<]+<\/time>\. Vincule a empresa do guia e cuide da assinatura na ficha\.<\/p><p><a class="botao secundario" href="\/clientes\/0b8f4a9e-1c2d-4e3f-8a5b-6c7d8e9f0a1b">Ver a ficha de Padaria da Marta<\/a><\/p><\/section>/);
  assert.match(cliente,/name="nome"/,'o nome e as notas seguem editáveis');
  assert.match(cliente,/<p class="cabeca-extra"><span class="selo is-lead-cliente">Virou cliente<\/span><\/p>/);
});

test('interessados: o escape do que vem do cadastro e da equipe',()=>{
  const l=lista(com(leadsLista,d=>{Object.assign(d.itens[1],{codigo:XSS,nome:XSS,proximaAcao:XSS});d.leitura.erro=XSS;}),{q:XSS,situacao:'"><b>'});
  assert.doesNotMatch(l,/<img src=x|<b>/);
  const p=detalhe(com(lead,d=>{Object.assign(d,{codigo:XSS,texto:`${XSS}\n</p><script>alert(1)</script>`,origem:XSS,nome:`"${XSS}`,proximaAcao:XSS,notas:`</textarea>${XSS}`,motivoPerda:XSS});}));
  assert.doesNotMatch(p,/<img src=x|<script>alert|<\/textarea><img/);
});

test('indicadores: o funil dos interessados, com o atalho, só quando vem',()=>{
  const sem=views.indicadores(tela('indicadores',indicadores));
  assert.equal(indicadores.funil,null,'o exemplo do contrato vem com a chave desligada');
  assert.doesNotMatch(sem,/id="funil"|href="#funil"/);
  const h=views.indicadores(tela('indicadores',{...indicadores,funil}));
  assert.match(h,/<li><a class="aba" href="#anunciantes">Anunciantes<\/a><\/li><li><a class="aba" href="#funil">Interessados<\/a><\/li><\/ul><\/nav>/);
  const i=h.indexOf('<section class="indicador is-largo" id="funil"'),bloco=h.slice(i);
  assert.ok(i>h.indexOf('id="anunciantes"'),'depois dos anunciantes');
  assert.match(bloco,/^<section class="indicador is-largo" id="funil" aria-labelledby="funil-titulo"><div class="indicador-cabeca"><h2 id="funil-titulo">Interessados<\/h2><p class="indicador-numero"><strong>6<\/strong><span>pedidos do cadastro em 12 meses<\/span><\/p><p class="indicador-nota">2 viraram cliente e 3 foram dados como perdidos\. Até virar cliente, a mediana é de 7 dias \(2 convertidos\)\.<\/p><p class="indicador-como">Pedidos do cadastro do site pelo mês do pedido/);
  assert.match(bloco,/Pedidos do mês/);
  assert.match(bloco,/<th scope="col">Mês<\/th><th scope="col" class="num">Pedidos<\/th><th scope="col" class="num">Viraram cliente<\/th><th scope="col" class="num">Perdidos<\/th>/);
  assert.match(bloco,/<tr><th scope="row">12 meses<\/th><td class="num">6<\/td><td class="num">2<\/td><td class="num">3<\/td><\/tr>/);
  assert.match(bloco,/<h3 id="funil-motivos">Por que se perderam<\/h3>[^]*?<th scope="row">Preço alto[^]*?<td class="num">2<\/td>[^]*?<th scope="row">Sem resposta[^]*?<td class="num">1<\/td>/);

  const um=views.indicadores(tela('indicadores',{...indicadores,funil:com(funil,f=>{f.meses=[{mes:'2026-10',novos:1,convertidos:1,perdidos:0,parcial:true}];f.motivosPerda=[];f.tempoAteCliente={convertidos:1,medianaDias:1};})}));
  assert.match(um,/<strong>1<\/strong><span>pedido do cadastro em 12 meses<\/span>/);
  assert.match(um,/1 virou cliente e 0 foram dados como perdidos\. Até virar cliente, a mediana é de 1 dia \(1 convertido\)\./);
  assert.match(um,/<div class="vazio"><p class="vazio-titulo">Nenhum perdido nos 12 meses<\/p><\/div><\/section>/);
  const ninguem=views.indicadores(tela('indicadores',{...indicadores,funil:com(funil,f=>{f.tempoAteCliente={convertidos:0,medianaDias:null};f.motivosPerda=[{motivo:XSS,qtd:1}];})}));
  assert.match(ninguem,/Ninguém virou cliente nos 12 meses ainda\./);
  assert.doesNotMatch(ninguem,/<img src=x/);
  semInline(h);
});
