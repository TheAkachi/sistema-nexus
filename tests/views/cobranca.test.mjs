import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { tela, comPapel, resumo, renovacoes, pagamento } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/cobranca: Resumo (6.4), Renovações (6.5) e Registrar pagamento (6.10), a partir dos vms de exemplo do contrato.
const XSS='<img src=x onerror=alert(1)>';
const linhas=html=>(html.match(/<li class="renovacao"/g)||[]).length;

test('resumo: os 4 números, o "Cobrar hoje" com as ações e nada de boas-vindas nem atalho repetido',()=>{
  const html=views.resumo(tela('resumo',resumo));
  assert.match(html,/<h1 id="titulo">Resumo<\/h1><p>A carteira em 20\/10\/2026\.<\/p>/);
  assert.match(html,/<section class="numeros" aria-label="A carteira hoje"><a class="numero" href="\/clientes"><span class="numero-rotulo">Receita mensal recorrente<\/span><strong class="numero-valor">R\$ 1\.867,00<\/strong><span class="numero-nota">23 assinaturas ativas<\/span><\/a>/);
  assert.match(html,/<div class="numero"><span class="numero-rotulo">Recebido em outubro<\/span><strong class="numero-valor">R\$ 536,00<\/strong>/);
  assert.match(html,/<a class="numero" href="\/renovacoes\?janela=30"><span class="numero-rotulo">A renovar em 30 dias<\/span><strong class="numero-valor">R\$ 434,00<\/strong><span class="numero-nota">4 assinaturas<\/span><\/a>/);
  assert.match(html,/<a class="numero is-destaque" href="\/renovacoes\?janela=vencidas"><span class="numero-rotulo">Inadimplentes<\/span><strong class="numero-valor">R\$ 99,00<\/strong><span class="numero-nota">1 assinatura depois da tolerância<\/span><\/a>/);
  assert.match(html,/<h2 id="cobrar-hoje">Cobrar hoje <span class="contador">3<\/span><\/h2>/);
  assert.equal(linhas(html),3);
  assert.ok(html.indexOf('Auto Peças Iguaçu')<html.indexOf('Clínica Vida Plena')&&html.indexOf('Clínica Vida Plena')<html.indexOf('Padaria Pão Dourado'),'na ordem do vm');
  assert.equal((html.match(/data-cobrar=/g)||[]).length,3);
  assert.match(html,/href="\/assinaturas\/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03\/pagamento\?volta=%2F"/,'o pagamento volta ao Resumo');
  assert.doesNotMatch(html,/Boas-vindas|Bem-vindo|bloco-mais/);
  semInline(renderPage({title:'Resumo | Gestão Nexus',status:200,view:'resumo',vm:tela('resumo',resumo)}));
});

test('resumo: mais itens do que cabem, ninguém para cobrar, carteira vazia e o leitura sem ações',()=>{
  assert.match(views.resumo(tela('resumo',{...resumo,cobrarHojeTotal:73})),/<p class="bloco-mais"><a href="\/renovacoes">Ver as 73 em Renovações <span aria-hidden="true">→<\/span><\/a><\/p>/);
  const nada=views.resumo(tela('resumo',{...resumo,cobrarHoje:[],cobrarHojeTotal:0,inadimplentes:{qtd:0,valor:0}}));
  assert.match(nada,/<p class="vazio-titulo">Ninguém para cobrar hoje<\/p>[^]*href="\/renovacoes\?janela=30">Ver quem vence nos próximos 30 dias/);
  assert.match(nada,/<a class="numero" href="\/renovacoes\?janela=vencidas">[^]*Nenhuma assinatura depois da tolerância/,'sem destaque quando não há inadimplente');
  const vazia={...resumo,mrr:0,recebidoMes:0,aRenovar30:{qtd:0,valor:0},inadimplentes:{qtd:0,valor:0},ativas:0,cobrarHoje:[],cobrarHojeTotal:0};
  assert.match(views.resumo(tela('resumo',vazia)),/A carteira ainda está vazia[^]*<a class="botao" href="\/importacao">Importar a carteira<\/a><a class="botao secundario" href="\/clientes\/novo">/);
  assert.match(views.resumo(comPapel(tela('resumo',vazia),'comercial')),/<a class="botao" href="\/clientes\/novo">[^]*Cadastrar um cliente/);
  assert.doesNotMatch(views.resumo(comPapel(tela('resumo',vazia),'leitura')),/vazio-acoes/);
  const leitura=views.resumo(comPapel(tela('resumo',{...resumo,cobrarHoje:resumo.cobrarHoje.map(r=>({...r,linkWhatsapp:null}))}),'leitura'));
  assert.doesNotMatch(leitura,/data-cobrar|Registrar pagamento|Sem WhatsApp/);
});

test('renovações: abas que se somam com a contagem, a lista na ordem e o caminho de volta do pagamento',()=>{
  const html=views.renovacoes(tela('renovacoes',renovacoes,{filtros:{janela:'vencidas',page:'1'}}));
  assert.match(html,/<h1 id="titulo">Renovações<\/h1>/);
  assert.match(html,/<nav class="abas" aria-label="Janela das renovações"><ul><li><a class="aba" href="\/renovacoes" aria-current="page">Vencidas <span class="aba-contagem">2<\/span><\/a><\/li><li><a class="aba" href="\/renovacoes\?janela=7">Até 7 dias <span class="aba-contagem">1<\/span><\/a><\/li><li><a class="aba" href="\/renovacoes\?janela=15">Até 15 dias <span class="aba-contagem">1<\/span><\/a><\/li><li><a class="aba" href="\/renovacoes\?janela=30">Até 30 dias <span class="aba-contagem">4<\/span><\/a><\/li><\/ul><\/nav>/);
  assert.match(html,/<p class="contagem">2 assinaturas, da mais atrasada para a menos<\/p>/);
  assert.equal(linhas(html),2);
  assert.match(html,/pagamento\?volta=%2Frenovacoes"/);
  const sete=views.renovacoes(tela('renovacoes',{...renovacoes,janela:'7',itens:[resumo.cobrarHoje[2]],total:1}));
  assert.match(sete,/<a class="aba" href="\/renovacoes\?janela=7" aria-current="page">/);
  assert.match(sete,/1 assinatura, da mais próxima para a mais distante[^]*<span class="selo is-a-vencer">Vence em 4 dias<\/span>/);
  assert.match(sete,/pagamento\?volta=%2Frenovacoes%3Fjanela%3D7"/);
  assert.match(views.renovacoes(tela('renovacoes',{...renovacoes,janela:'30',itens:[],total:0})),/<p class="vazio-titulo">Nenhuma renovação nos próximos 30 dias<\/p>/);
  assert.match(views.renovacoes(tela('renovacoes',{...renovacoes,itens:[],total:0})),/<p class="vazio-titulo">Nenhuma assinatura vencida<\/p>/);
  const paginas=views.renovacoes(tela('renovacoes',{...renovacoes,janela:'30',pagina:2,paginas:3,total:45}));
  assert.match(paginas,/<a class="botao secundario" rel="prev" href="\/renovacoes\?janela=30">[^]*<span>Página 2 de 3<\/span><a class="botao secundario" rel="next" href="\/renovacoes\?janela=30&amp;page=3">/);
  assert.match(views.renovacoes(tela('renovacoes',{...renovacoes,janela:`x${XSS}`})),/aria-current="page">Vencidas/,'janela desconhecida vira vencidas');
});

test('pagamento: a assinatura, o formulário já preenchido, o vencimento novo antes de salvar e o painel do pago',()=>{
  const html=views.pagamento(tela('pagamento',pagamento));
  assert.match(html,/<a class="voltar" href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41"><svg[^]*<span>Clínica Vida Plena<\/span><\/a>[^]*<h1 id="titulo">Registrar pagamento<\/h1><p class="cabeca-extra"><span>Clínica Vida Plena · Centro · Premium<\/span><a href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">Ficha de Clínica Vida Plena<\/a><\/p>/);
  assert.match(html,/<dl class="ficha-dados is-curta"><div><dt>Valor do ciclo<\/dt><dd><strong>R\$ 99,00<\/strong> por mês<\/dd>/);
  assert.match(html,/<dt>Vencimento atual<\/dt><dd><span class="dd-linha"><span class="selo is-vencida">Vencida<\/span><span>Venceu há 5 dias, em <time datetime="2026-10-15">15\/10\/2026<\/time><\/span><\/span><\/dd>/);
  assert.match(html,/<form class="formulario" method="post" data-form="pagamento" data-id="9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01" novalidate>[^]*<input type="hidden" name="version" value="5">/);
  assert.match(html,/<input type="text" id="pagamento-valor" name="valorCentavos" aria-describedby="pagamento-valor-dica pagamento-valor-erro" value="99,00" inputmode="decimal"/);
  assert.match(html,/<input type="date" id="pagamento-data" name="pagoEm" aria-describedby="pagamento-data-dica pagamento-data-erro" value="2026-10-20" max="2026-10-20" required>/);
  assert.match(html,/<input type="radio" name="forma" value="pix" checked><span>Pix<\/span>[^]*value="mercado-pago"><span>Mercado Pago<\/span>/);
  assert.equal((html.match(/name="forma"/g)||[]).length,6);
  assert.match(html,/<p class="form-nota">O vencimento passa de 15\/10\/2026 para <strong>15\/11\/2026<\/strong>: avança um ciclo a partir do vencimento atual, qualquer que seja o valor pago\.<\/p><div class="form-acoes"><button type="submit" class="botao">Registrar pagamento<\/button>/);
  assert.equal((html.match(/type="submit"/g)||[]).length,2,'o salvar do pagamento e o da confirmação de identidade');
  assert.match(html,/<section class="pago" data-pago hidden tabindex="-1" aria-labelledby="pago-titulo"><h2 id="pago-titulo">Pago\. Próximo vencimento: <span data-pago-vence><\/span><\/h2>/);
  assert.match(renderPage({title:'Registrar pagamento | Gestão Nexus',status:200,view:'pagamento',vm:tela('pagamento',pagamento)}),/<script type="module" src="\/assets\/gestao\.js"><\/script><script type="module" src="\/assets\/pagamento\.js"><\/script><\/head>/);
  const sem=views.pagamento(tela('pagamento',{...pagamento,assinatura:{...pagamento.assinatura,empresa:null,plano:null}}));
  assert.match(sem,/Sem empresa do guia · Sem plano/);
  assert.match(views.pagamento(tela('pagamento',{...pagamento,cliente:{...pagamento.cliente,nome:XSS}})),/&lt;img src=x onerror=alert\(1\)&gt;/);
  semInline(html);
});
