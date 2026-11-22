import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { tela, comPapel, clientes, ficha, clienteNovo, assinaturaNova } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/clientes: lista (6.6), ficha (6.7), cliente (6.8) e assinatura (6.9), a partir dos vms de exemplo do contrato.
const XSS='<img src=x onerror=alert(1)>';
const [vencida,aVencer]=ficha.assinaturas;
const pagina=(view,vm)=>renderPage({title:'Tela | Gestão Nexus',status:200,view,vm});

test('clientes: busca, situação em pílulas, a lista que vira ficha no celular e o "Novo cliente" por permissão',()=>{
  const html=views.clientes(tela('clientes',clientes,{filtros:{q:'',status:'',situacao:'',page:'1'}}));
  assert.match(html,/<h1 id="titulo">Clientes<\/h1>[^]*<a class="botao" href="\/clientes\/novo">[^]*Novo cliente<\/a>/);
  assert.match(html,/<form class="filtros" method="get" action="\/clientes" role="search"[^>]*><div class="campo filtros-busca"><label for="filtro-q">Nome, empresa, e-mail ou WhatsApp<\/label><input type="search" id="filtro-q" name="q" value=""/);
  assert.match(html,/<nav class="abas" aria-label="Situação das assinaturas"><ul><li><a class="aba" href="\/clientes" aria-current="page">Todas<\/a><\/li><li><a class="aba" href="\/clientes\?situacao=inadimplente">Inadimplente<\/a>/);
  assert.match(html,/<p class="contagem">4 clientes<\/p>/);
  assert.match(html,/<th scope="row"><a href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">Clínica Vida Plena<\/a><span class="linha-apoio">Marina Souza<\/span><\/th><td data-rotulo="WhatsApp">\(21\) 90000-0001<\/td><td class="num" data-rotulo="Empresas">2<\/td><td data-rotulo="Plano principal">Premium<\/td><td data-rotulo="Situação"><span class="selo is-vencida">Vencida<\/span><\/td>/);
  assert.match(html,/Studio Bella<\/a><\/th><td data-rotulo="WhatsApp"><span class="muted">—<\/span><\/td>[^]*<span class="selo is-em-dia">Ativa<\/span>/);
  const filtrado=views.clientes(tela('clientes',clientes,{filtros:{q:`pão ${XSS}`,status:'ativo',situacao:'vencida',page:'1'}}));
  assert.match(filtrado,/value="pão &lt;img src=x onerror=alert\(1\)&gt;"/);
  assert.match(filtrado,/<input type="hidden" name="situacao" value="vencida">/);
  assert.match(filtrado,/<a class="aba" href="\/clientes\?q=p%C3%A3o\+%3Cimg[^"]*&amp;status=ativo&amp;situacao=vencida" aria-current="page">Vencida<\/a>/);
  assert.match(filtrado,/<option value="ativo" selected>Ativos<\/option>/);
  assert.match(filtrado,/<a class="botao-texto" href="\/clientes">Limpar a busca<\/a>/);
  assert.match(views.clientes(tela('clientes',{...clientes,itens:[{...clientes.itens[0],situacao:null,status:'encerrado',planoPrincipal:null}],total:1})),/<span class="selo">Encerrado<\/span>[^]*<span class="selo is-sem-assinatura">Sem assinatura<\/span>/);
  assert.match(views.clientes(tela('clientes',{itens:[],total:0,pagina:1,paginas:1},{filtros:{q:'x',status:'',situacao:'',page:'1'}})),/<p class="vazio-titulo">Nenhum cliente com essa busca<\/p>/);
  assert.match(views.clientes(tela('clientes',{itens:[],total:0,pagina:1,paginas:1})),/<p class="vazio-titulo">Nenhum cliente ainda<\/p>[^]*href="\/clientes\/novo"[^]*href="\/importacao"/);
  const leitura=views.clientes(comPapel(tela('clientes',clientes),'leitura'));
  assert.doesNotMatch(leitura,/clientes\/novo/);
  assert.match(views.clientes(tela('clientes',{...clientes,pagina:1,paginas:2,total:30},{filtros:{q:'clinica',status:'',situacao:'',page:'1'}})),/rel="next" href="\/clientes\?q=clinica&amp;page=2"/);
  semInline(pagina('clientes',tela('clientes',clientes)));
});

test('ficha: dados, assinaturas com o selo, o prazo e o plano no guia, empresas com "Ver no guia" e a linha do tempo',()=>{
  const html=views.cliente(tela('cliente',ficha));
  assert.match(html,/<a class="voltar" href="\/clientes">[^]*<h1 id="titulo">Clínica Vida Plena<\/h1>[^]*<a class="botao secundario" href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41\/editar">Editar o cliente<\/a>/);
  assert.match(html,/<dt>Responsável<\/dt><dd>Marina Souza<\/dd><\/div><div><dt>WhatsApp<\/dt><dd>\(21\) 90000-0001<\/dd><\/div><div><dt>E-mail<\/dt><dd><a href="mailto:marina@exemplo\.test">marina@exemplo\.test<\/a><\/dd><\/div><div><dt>Cliente desde<\/dt><dd>01\/10\/2026<\/dd><\/div><div class="is-largo"><dt>Notas<\/dt><dd class="nota-livre">Prefere ser chamada pelo WhatsApp depois das 14h\.<\/dd>/);
  assert.ok(html.indexOf('id="ficha-assinaturas"')<html.indexOf('id="ficha-empresas"'),'as assinaturas vêm antes das empresas');
  assert.match(html,/<li class="renovacao assinatura is-ativa">[^]*<h3>Clínica Vida Plena · Centro<\/h3><p class="renovacao-onde">Premium · Mensal · desde 15\/03\/2025<\/p><p class="renovacao-valor"><strong>R\$ 99,00<\/strong> por mês<\/p>[^]*<span class="selo is-vencida">Vencida<\/span><span>Venceu há 5 dias, em <time datetime="2026-10-15">15\/10\/2026<\/time><\/span>/);
  assert.match(html,/<p class="sync is-ok">No guia: atualizado em <time datetime="2026-09-14T17:45:02\.000Z">14\/09\/2026 às 14:45<\/time><\/p>/);
  assert.match(html,/<a class="botao secundario" href="\/assinaturas\/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01\/pagamento">Registrar pagamento/);
  assert.match(html,/<a class="botao-texto" href="\/assinaturas\/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01">Editar a assinatura/);
  assert.match(html,/<a class="botao secundario" href="\/assinaturas\/nova\?cliente=0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">[^]*Nova assinatura<\/a>/);
  assert.match(html,/<h2 id="ficha-empresas">Empresas do guia <span class="contador">2<\/span><\/h2><details class="vincular" data-vincular data-cliente="0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">/);
  assert.match(html,/<li class="empresa" data-empresa="clinica-vida-plena-austin"><img class="miniatura"[^>]*><div><p class="empresa-nome">Clínica Vida Plena · Austin<\/p><p class="empresa-apoio">Austin · vinculada em 01\/10\/2026<\/p><\/div><div class="empresa-acoes"><a class="botao-texto" href="https:\/\/nexus\.demo\/comercio\/clinica-vida-plena-austin" target="_blank" rel="noopener">Ver no guia[^]*<button type="button" class="botao-texto perigo" data-desvincular="clinica-vida-plena-austin">Desvincular/);
  assert.match(html,/<ol class="linha-tempo"><li class="evento is-contato"><p class="evento-titulo">Cobrança pelo WhatsApp<\/p><p>Clínica Vida Plena · Centro · Premium · vencimento de 15\/10\/2026<\/p><p class="evento-quando"><time[^>]*>16\/10\/2026 às 10:20<\/time> por Bruno<\/p><\/li>/);
  assert.match(html,/<li class="evento is-pagamento"><p class="evento-titulo">Pagamento de R\$ 67,00 · Pix<\/p><p>Clínica Vida Plena · Austin · Avançado · referente a 15\/10\/2026 a 14\/11\/2026 · pago em 15\/10\/2026<\/p><p class="evento-quando">Registrado em <time[^>]*>15\/10\/2026 às 11:10<\/time> por Ana<\/p><details class="estornar"><summary class="botao-texto perigo">Estornar/);
  assert.match(html,/<form class="formulario" method="post" data-form="estorno" data-id="5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d11" novalidate>[^]*name="motivo"[^]*required minlength="3"/);
  assert.match(pagina('cliente',tela('cliente',ficha)),/<script type="module" src="\/assets\/clientes\.js"><\/script>/);
  semInline(pagina('cliente',tela('cliente',ficha)));
});

test('ficha: o que cada papel vê, o pagamento estornado, a assinatura sem empresa, o cliente encerrado e os vazios',()=>{
  const leitura=views.cliente(comPapel(tela('cliente',ficha),'leitura'));
  assert.doesNotMatch(leitura,/data-vincular|data-desvincular|Editar o cliente|Nova assinatura|Registrar pagamento|Editar a assinatura|data-form="estorno"/);
  const comercial=views.cliente(comPapel(tela('cliente',ficha),'comercial'));
  assert.match(comercial,/data-vincular/);assert.doesNotMatch(comercial,/Registrar pagamento|data-form="estorno"/,'comercial não paga nem estorna');
  const financeiro=views.cliente(comPapel(tela('cliente',ficha),'financeiro'));
  assert.doesNotMatch(financeiro,/data-vincular|data-desvincular|Editar o cliente/);assert.match(financeiro,/data-form="estorno"[^]*Registrar pagamento|Registrar pagamento[^]*data-form="estorno"/);
  const pago=ficha.linhaDoTempo[1],estornado={...pago,pagamento:{...pago.pagamento,estorno:{em:'2026-10-18T12:00:00.000Z',por:{id:'x',nome:'Lucas'},motivo:'Pix devolvido'}}};
  const comEstorno=views.cliente(tela('cliente',{...ficha,linhaDoTempo:[{...estornado,tipo:'estorno',em:'2026-10-18T12:00:00.000Z',por:{id:'x',nome:'Lucas'}},estornado]}));
  assert.match(comEstorno,/<li class="evento is-estorno"><p class="evento-titulo">Estorno de R\$ 67,00<\/p><p>Clínica Vida Plena · Austin · Avançado · Pix devolvido<\/p>/);
  assert.match(comEstorno,/<li class="evento is-pagamento is-estornado">[^]*<span class="selo">Estornado<\/span> em <time[^>]*>18\/10\/2026 às 09:00<\/time> por Lucas<\/p><\/li>/);
  assert.doesNotMatch(comEstorno,/data-form="estorno"/,'estornado não estorna de novo');
  const semEmpresa=views.cliente(tela('cliente',{...ficha,assinaturas:[{...vencida,empresa:null,sincronizacao:{estado:'sem-empresa',em:null,erro:''}}]}));
  assert.match(semEmpresa,/<h3>Sem empresa do guia<\/h3>[^]*No guia: sem empresa vinculada[^]*Sem empresa do guia\. Vincule a empresa/);
  const falhou=views.cliente(tela('cliente',{...ficha,assinaturas:[{...aVencer,sincronizacao:{estado:'falhou',em:null,erro:'O guia não respondeu.'}}]}));
  assert.match(falhou,/<p class="sync is-falhou">No guia: o envio falhou: O guia não respondeu\.<\/p>/);
  const cancelada=views.cliente(tela('cliente',{...ficha,assinaturas:[{...aVencer,status:'cancelada',situacao:'cancelada',canceladaEm:'2026-10-18',motivo:'Fechou a unidade'}]}));
  assert.match(cancelada,/<li class="renovacao assinatura is-cancelada">[^]*<span class="selo is-cancelada">Cancelada<\/span><span>Cancelada em 18\/10\/2026: Fechou a unidade<\/span>/);
  assert.doesNotMatch(cancelada,/pagamento">Registrar/,'cancelada não paga');
  const encerrado=views.cliente(tela('cliente',{...ficha,status:'encerrado',assinaturas:[]}));
  assert.match(encerrado,/<p class="cabeca-extra"><span class="selo">Encerrado<\/span><span>Para criar uma assinatura, reabra o cliente\.<\/span><\/p>/);
  assert.doesNotMatch(encerrado,/Nova assinatura|data-vincular/);
  const nada=views.cliente(tela('cliente',{...ficha,empresas:[],assinaturas:[],linhaDoTempo:[]}));
  assert.match(nada,/Nenhuma empresa do guia vinculada[^]*|Nenhuma assinatura/);
  assert.match(nada,/<p class="vazio-titulo">Nenhum pagamento nem contato ainda<\/p>/);
  assert.match(views.cliente(tela('cliente',{...ficha,nome:XSS,notas:XSS})),/<h1 id="titulo">&lt;img src=x onerror=alert\(1\)&gt;<\/h1>[^]*nota-livre">&lt;img/);
});

test('cliente: criar e editar com um único salvar, e encerrar ou reabrir à parte',()=>{
  const novo=views['cliente-form'](tela('cliente-form',clienteNovo));
  assert.match(novo,/<h1 id="titulo">Novo cliente<\/h1>/);
  assert.match(novo,/<form class="formulario" method="post" data-form="cliente" data-novo novalidate>[^]*<input type="hidden" name="version" value="">/);
  assert.match(novo,/id="cliente-nome" name="nome"[^>]*value="" maxlength="160" required minlength="2"/);
  assert.match(novo,/<input type="tel" id="cliente-whatsapp" name="whatsapp"[^>]*inputmode="tel"/);
  assert.match(novo,/<button type="submit" class="botao">Cadastrar cliente<\/button>/);
  assert.doesNotMatch(novo,/data-situacao-cliente/);
  const editar=views['cliente-form'](tela('cliente-form',{cliente:ficha}));
  assert.match(editar,/<a class="voltar" href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">[^]*<span>Clínica Vida Plena<\/span><\/a>[^]*<h1 id="titulo">Editar Clínica Vida Plena<\/h1>/);
  assert.match(editar,/data-form="cliente" data-id="0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41" novalidate>[^]*name="version" value="3">/);
  assert.match(editar,/name="whatsapp"[^>]*value="\(21\) 90000-0001"/);
  assert.match(editar,/<textarea id="cliente-notas" name="notas"[^>]*>Prefere ser chamada pelo WhatsApp depois das 14h\.<\/textarea>/);
  assert.equal((editar.match(/data-form="cliente"/g)||[]).length,1);
  assert.match(editar,/<button type="button" class="botao perigo" data-situacao-cliente="encerrado" data-id="0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41" data-version="3">Encerrar o cliente<\/button>/);
  assert.match(views['cliente-form'](tela('cliente-form',{cliente:{...ficha,status:'encerrado'}})),/data-situacao-cliente="ativo"[^>]*>Reabrir o cliente<\/button>/);
  semInline(pagina('cliente-form',tela('cliente-form',{cliente:ficha})));
});

test('assinatura: criar com os planos e o preço, editar só o que mudou, e suspender, reativar e cancelar',()=>{
  const nova=views['assinatura-form'](tela('assinatura-form',assinaturaNova));
  assert.match(nova,/<a class="voltar" href="\/clientes\/1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52">[^]*<h1 id="titulo">Nova assinatura<\/h1><p class="cabeca-extra"><span>Padaria Pão Dourado<\/span><\/p>/);
  assert.match(nova,/data-form="assinatura" data-novo data-cliente="1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52" novalidate>/);
  assert.match(nova,/<select id="assinatura-empresa" name="empresa"[^>]*data-antes=""><option value="">Sem empresa por enquanto<\/option><option value="padaria-pao-dourado" selected>Padaria Pão Dourado<\/option><\/select>/,'uma empresa só já vem escolhida');
  assert.match(nova,/<option value="plano-avancado" data-preco="6700">Avançado · R\$ 67,00 por mês<\/option><option value="plano-premium" data-preco="9900">Premium · R\$ 99,00 por mês<\/option>/);
  assert.match(nova,/<select id="assinatura-ciclo" name="ciclo"[^>]*><option value="mensal" selected>Mensal<\/option><option value="trimestral">Trimestral<\/option>/);
  assert.match(nova,/<button type="submit" class="botao">Criar a assinatura<\/button>/);
  assert.doesNotMatch(nova,/assinatura-situacao/);
  const editar=views['assinatura-form'](tela('assinatura-form',{...assinaturaNova,assinatura:vencida,cliente:{id:ficha.id,nome:ficha.nome,empresas:ficha.empresas.map(m=>({id:m.id,nome:m.nome}))}}));
  assert.match(editar,/<h1 id="titulo">Clínica Vida Plena · Centro<\/h1><p class="cabeca-extra"><span>Clínica Vida Plena<\/span><span class="selo is-vencida">Vencida<\/span><span>Venceu há 5 dias/);
  assert.match(editar,/<p class="sync is-ok">No guia: atualizado/);
  assert.match(editar,/data-form="assinatura" data-id="9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01" data-cliente="0b9f6a3e[^"]*" novalidate>[^]*name="version" value="5">/);
  assert.match(editar,/name="valorCentavos"[^>]*value="99,00"[^>]*data-antes="99,00"/);
  assert.match(editar,/name="venceEm"[^>]*value="2026-10-15" required data-antes="2026-10-15"/);
  assert.match(editar,/<option value="plano-premium" data-preco="9900" selected>/);
  assert.match(editar,/<details class="acao"><summary class="botao secundario">Suspender<\/summary>[^]*data-form="suspender" data-id="9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01" data-version="5"/);
  assert.match(editar,/<summary class="botao perigo">Cancelar a assinatura<\/summary>[^]*data-form="cancelar"[^]*name="motivo"[^]*required minlength="3"[^]*type="date" id="cancelar-data" name="canceladaEm"[^>]*min="2025-03-15"/);
  const suspensa=views['assinatura-form'](tela('assinatura-form',{...assinaturaNova,assinatura:{...vencida,status:'suspensa',situacao:'suspensa',suspensaEm:'2026-10-18'}}));
  assert.match(suspensa,/<button type="button" class="botao secundario" data-reativar="9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01" data-version="5">Reativar<\/button>/);
  assert.doesNotMatch(suspensa,/Venceu há/,'suspensa não mostra o prazo');
  const cancelada=views['assinatura-form'](tela('assinatura-form',{...assinaturaNova,assinatura:{...vencida,status:'cancelada',situacao:'cancelada',canceladaEm:'2026-10-18',motivo:'Mudou de cidade'}}));
  assert.match(cancelada,/name="plano"[^>]* disabled required/);
  assert.doesNotMatch(cancelada,/name="notas"[^>]*disabled/,'as notas continuam editáveis');
  assert.match(cancelada,/Cancelada em 18\/10\/2026: Mudou de cidade\. Cancelar não tem volta/);
  assert.match(cancelada,/<p class="form-nota">A assinatura cancelada só aceita mudança nas notas\.<\/p>/);
  // Lista vazia: o guia respondeu sem nenhum plano ativo (a homologação do site, por enquanto) ou não respondeu e não há cópia.
  const semPlanoNoGuia=views['assinatura-form'](tela('assinatura-form',{...assinaturaNova,planos:[]}));
  assert.match(semPlanoNoGuia,/<p class="aviso"><svg[^]*<\/svg><span>O guia ainda não tem nenhum plano ativo\. Cadastre os planos no admin do site para criar a assinatura\.<\/span><\/p>/);
  assert.doesNotMatch(semPlanoNoGuia,/is-site-fora|não respondeu/,'o guia respondeu: nada de site fora');
  const siteFora=views['assinatura-form'](tela('assinatura-form',{...assinaturaNova,planos:[]},{avisos:[{tipo:'site-fora',texto:'O guia não respondeu, e não há cópia dos planos guardada. Tente de novo em instantes.',href:''}]}));
  assert.match(siteFora,/<li class="aviso is-site-fora"><svg[^]*<\/svg><p>O guia não respondeu, e não há cópia dos planos guardada\. Tente de novo em instantes\.<\/p><\/li>/,'o aviso da moldura diz tudo');
  assert.doesNotMatch(siteFora,/<p class="aviso(?! is-sem-script)/,'sem repetir o aviso no formulário');
  assert.doesNotMatch(views['assinatura-form'](tela('assinatura-form',assinaturaNova,{avisos:[{tipo:'site-fora',texto:'O guia não respondeu.',href:''}]})),/<p class="aviso is-site-fora">/,'com a cópia, só o aviso da moldura');
  assert.match(views['assinatura-form'](tela('assinatura-form',{...assinaturaNova,cliente:{...assinaturaNova.cliente,empresas:[]}})),/Este cliente ainda não tem empresa do guia\./);
  semInline(pagina('assinatura-form',tela('assinatura-form',assinaturaNova)));
});
