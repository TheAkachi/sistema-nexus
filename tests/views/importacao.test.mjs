import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { tela, importacoes, importacao } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/importacao: envio e lista (6.11) e prévia (6.12), a partir dos vms de exemplo do contrato v0.7.0.
const XSS='<img src=x onerror=alert(1)>';
const pagina=(view,vm)=>renderPage({title:'Tela | Gestão Nexus',status:200,view,vm});
const linha=(html,n)=>{const i=html.indexOf(`id="linha-${n}"`);assert.ok(i>=0,`linha ${n}`);return html.slice(i,html.indexOf('</li>',html.indexOf('linha-corpo',i)+1)+5);};

test('importação: o envio com o tipo e o arquivo, a lista dos envios com a situação e o resumo numa frase',()=>{
  const html=views.importacao(tela('importacao',importacoes,{filtros:{page:'1'}}));
  assert.match(html,/<h1 id="titulo">Importação<\/h1>/);
  assert.match(html,/<form class="formulario" method="post" data-form="importacao" novalidate>[^]*<fieldset class="campo" data-campo="tipo"><legend class="rotulo">De onde vem o arquivo<\/legend>[^]*<input type="radio" name="tipo" value="edirectory" checked><span><strong>Exportação do eDirectory<\/strong>[^]*value="planilha"><span><strong>Planilha de controle<\/strong>/);
  assert.match(html,/<input type="file" id="importacao-arquivo" name="arquivo"[^>]*accept="\.csv,\.txt,text\/csv,text\/plain" required>/);
  assert.match(html,/Até 2 MB e 2\.000 linhas, em UTF-8 ou Windows-1252/);
  assert.match(html,/<p class="form-nota">Primeiro vem a prévia: nada é gravado até você conferir e confirmar\./);
  assert.match(html,/<p class="contagem">2 importações, da mais nova para a mais antiga<\/p>/);
  assert.match(html,/<th scope="row">Exportação do eDirectory<span class="linha-apoio">46 linhas<\/span><\/th><td data-rotulo="Situação"><span class="selo is-a-vencer">Prévia aberta<\/span><\/td><td data-rotulo="Resumo">3 novos e 2 atualizados \(1 sem empresa do guia\)\. Ficam de fora: 31 iguais, 8 ignorados, 2 linhas com erro\.<\/td><td data-rotulo="Abrir"><a class="botao secundario pequeno" href="\/importacao\/8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a31">Abrir a prévia/);
  assert.match(html,/<span class="selo is-em-dia">Confirmada<\/span><span class="linha-apoio">em <time[^>]*>01\/10\/2026 às 08:02<\/time><\/span>[^]*42 novos \(4 sem empresa do guia\)\. Ficam de fora: 2 linhas com erro\.[^]*<a class="botao-texto" href="\/importacao\/8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a30">Ver o resumo/);
  assert.match(views.importacao(tela('importacao',{itens:[],total:0,pagina:1,paginas:1})),/<p class="vazio-titulo">Nenhuma importação ainda<\/p>/);
  assert.match(pagina('importacao',tela('importacao',importacoes)),/<script type="module" src="\/assets\/importacao\.js"><\/script><\/head>/);
  semInline(pagina('importacao',tela('importacao',importacoes)));
});

test('prévia aberta: o arquivo, o resumo que filtra, cada linha com a empresa, os dados, o aviso e o erro, e confirmar ou descartar',()=>{
  const html=views['importacao-previa'](tela('importacao-previa',importacao));
  assert.match(html,/<a class="voltar" href="\/importacao">[^]*<h1 id="titulo">Prévia da importação<\/h1><p class="cabeca-extra"><span class="selo is-a-vencer">Prévia aberta<\/span><span>Exportação do eDirectory, enviada em <time[^>]*>20\/10\/2026 às 07:58<\/time> por Lucas<\/span><\/p><p class="cabeca-extra"><span>46 linhas · separador vírgula · UTF-8 · datas em dia\/mês<\/span><span>A prévia vale até <time[^>]*>21\/10\/2026 às 07:58<\/time>\.<\/span><\/p>/);
  assert.match(html,/<div class="previa-importacao" data-importacao="8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a31" data-version="1">/);
  assert.match(html,/<button type="button" class="numero" data-filtro="novo" aria-pressed="false"><span class="numero-rotulo">Novos<\/span><strong class="numero-valor">3<\/strong><\/button>[^]*data-filtro="sem-empresa"[^]*<strong class="numero-valor">1<\/strong>[^]*data-filtro="erro"[^]*<strong class="numero-valor">2<\/strong>/);
  const ignorada=linha(html,2);
  assert.match(ignorada,/^id="linha-2" tabindex="-1" data-acao="ignorar"><div class="linha-topo"><p class="linha-numero">Linha 2<\/p><span class="selo is-cancelada">Ignorada<\/span><\/div><div class="linha-corpo"><h3>Clínica Vida Plena<\/h3><p class="linha-apoio">marina@exemplo\.test · \(21\) 90000-0001<\/p>/);
  assert.match(ignorada,/<span>Editada na gestão depois da importação\.<\/span>/);
  assert.match(html,/data-ignorar-linha="2" data-valor="false">Voltar a importar esta linha/);
  const atualizar=linha(html,4);
  assert.match(atualizar,/<span class="selo is-a-vencer">Atualizar<\/span>[^]*<p class="linha-empresa"><svg[^]*<\/svg><span>Padaria Pão Dourado<\/span><\/p>/);
  assert.match(atualizar,/<dt>Valor<\/dt><dd>R\$ 180,00 por trimestre<\/dd><\/div><div><dt>Ciclo<\/dt><dd>Trimestral<\/dd><\/div><div><dt>Vencimento<\/dt><dd>24\/10\/2026<\/dd><\/div><div><dt>Situação<\/dt><dd>Ativa<\/dd>/);
  assert.match(atualizar,/<p class="linha-mudam">Muda: valor, ciclo\.<\/p>/);
  assert.match(atualizar,/<summary class="botao-texto">Trocar a empresa<span class="sr-only"> da linha 4<\/span><\/summary>[^]*<button type="button" class="botao-texto perigo" data-empresa-linha="4" data-empresa="">Tirar a empresa/);
  assert.match(html,/<li class="linha-importacao is-novo is-sem-empresa" id="linha-7"/);
  const semEmpresa=linha(html,7);
  assert.match(semEmpresa,/<p class="linha-empresa is-falta"><svg[^]*<\/svg><span>Sem empresa do guia: entra assim mesmo, e a empresa é vinculada depois, na ficha<\/span><\/p><div class="sugestoes"><p class="linha-apoio">Parecidas no guia:<\/p><button type="button" class="botao secundario pequeno" data-empresa-linha="7" data-empresa="studio-bella">Usar Studio Bella/);
  assert.match(semEmpresa,/<summary class="botao-texto">Buscar outra empresa[^]*<input type="search" id="busca-linha-7" name="q"/);
  assert.match(semEmpresa,/<span>Sem valor no arquivo: usado o preço do plano\.<\/span>/);
  const erro=linha(html,12);
  assert.match(erro,/<span class="selo is-inadimplente">Erro<\/span>[^]*<h3>Sem nome no arquivo<\/h3><p class="linha-erro"><svg[^]*<\/svg><span>Falta o título do anúncio\.<\/span><\/p>/);
  assert.doesNotMatch(erro,/data-empresa-linha|linha-dados|<dt>/,'a linha com erro não muda nem mostra dados');
  assert.doesNotMatch(html,/data-ignorar-linha="12"/);
  assert.match(html,/<section class="importacao-acoes"[^>]*><h2[^>]*>Confirmar ou descartar<\/h2><p>3 novos e 2 atualizados \(1 sem empresa do guia\)\. Ficam de fora: 31 iguais, 8 ignorados, 2 linhas com erro\.<\/p><div class="form-acoes"><button type="button" class="botao" data-confirmar-importacao>Confirmar a importação<\/button><button type="button" class="botao perigo" data-descartar-importacao>Descartar a prévia<\/button><\/div>/);
  assert.match(html,/Pede a sua senha ou um código do autenticador\./);
  assert.match(pagina('importacao-previa',tela('importacao-previa',importacao)),/<script type="module" src="\/assets\/importacao\.js"><\/script><\/head>/);
  semInline(pagina('importacao-previa',tela('importacao-previa',importacao)));
});

test('prévia fechada: confirmada, descartada e vencida só com o resumo, sem ações; os dados do arquivo saem escapados',()=>{
  const confirmada=views['importacao-previa'](tela('importacao-previa',{...importacao,status:'confirmada',confirmadaEm:'2026-10-20T11:30:00.000Z',linhas:[]}));
  assert.match(confirmada,/<h1 id="titulo">Importação confirmada<\/h1>[^]*<span class="selo is-em-dia">Confirmada<\/span>[^]*Confirmada em <time[^>]*>20\/10\/2026 às 08:30<\/time>/);
  assert.match(confirmada,/<div class="numero"><span class="numero-rotulo">Novos<\/span>/,'os números não filtram');
  assert.match(confirmada,/<p class="vazio-titulo">Os clientes e as assinaturas foram gravados<\/p><p>A prévia, com os nomes e os contatos do arquivo, foi apagada ao confirmar\./);
  assert.doesNotMatch(confirmada,/data-confirmar-importacao|data-descartar-importacao|data-empresa-linha|data-ignorar-linha|A prévia vale até/);
  assert.match(views['importacao-previa'](tela('importacao-previa',{...importacao,status:'descartada',linhas:[]})),/<h1 id="titulo">Prévia descartada<\/h1>[^]*Nada foi gravado[^]*<a class="botao" href="\/importacao">Enviar o arquivo de novo<\/a>/);
  assert.match(views['importacao-previa'](tela('importacao-previa',{...importacao,status:'expirada',linhas:[]})),/<h1 id="titulo">Prévia vencida<\/h1>[^]*A prévia venceu sem ser confirmada/);
  const sujo={...importacao,linhas:[{...importacao.linhas[2],cliente:{nome:XSS,email:XSS,whatsapp:''},aviso:XSS,sugestoes:[{id:'x',nome:XSS}]}]};
  const html=views['importacao-previa'](tela('importacao-previa',sujo));
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/<h3>&lt;img src=x onerror=alert\(1\)&gt;<\/h3>/);
});
