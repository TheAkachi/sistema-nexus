import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { ACAO, nomeAcao } from '../../api/views/auditoria.mjs';
import { tela, comPapel, auditoria, ficha, assinaturaNova } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';
import { readFile } from 'node:fs/promises';

// Auditoria (6.15), a partir do vm de exemplo do contrato, e os links "Ver na auditoria" da ficha e da assinatura.
const XSS='<img src=x onerror=alert(1)>';
const filtros={acao:'',usuario:'',recurso:'',de:'',ate:'',q:'',page:'1'};

test('auditoria: filtros na URL, a ação pelo nome, quem fez, o registro com o histórico e o antes e depois',()=>{
  const html=views.auditoria(tela('auditoria',auditoria,{filtros}));
  assert.match(html,/<h1 id="titulo">Auditoria<\/h1>/);
  assert.match(html,/<form class="filtros filtros-auditoria" method="get" action="\/auditoria" role="search"[^>]*>[^]*<select id="filtro-acao" name="acao"><option value="">Todas<\/option><option value="login">Entrou<\/option><option value="pagamento_estornado">Estornou um pagamento<\/option><option value="pagamento_registrado">Registrou um pagamento<\/option><option value="login_falha">Senha errada no login<\/option><\/select>/,'as ações em ordem alfabética do nome');
  assert.match(html,/<select id="filtro-usuario" name="usuario"><option value="">Todos<\/option><option value="sistema">Sistema \(CLI, rotina e fila\)<\/option><option value="a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21">Ana<\/option><\/select>/);
  assert.match(html,/<input type="date" id="filtro-de" name="de" value="">[^]*<input type="date" id="filtro-ate" name="ate" value="">/);
  assert.doesNotMatch(html,/Limpar os filtros/);
  assert.match(html,/<p class="contagem">1 registro, do mais novo para o mais antigo<\/p>/);
  assert.match(html,/<tr><td data-rotulo="Quando"><time datetime="2026-10-15T14:10:40\.000Z">15\/10\/2026 às 11:10<\/time><\/td><th scope="row">Registrou um pagamento<span class="linha-apoio">pagamento_registrado<\/span><\/th><td data-rotulo="Quem">Ana<span class="linha-apoio">ana@exemplo\.test<\/span><\/td>/);
  assert.match(html,/<td data-rotulo="Registro"><span class="audit-recurso"><a href="\/assinaturas\/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02">Assinatura<\/a><span class="audit-id">9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02<\/span><a class="audit-historico" href="\/auditoria\?recurso=9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02">Histórico<\/a><\/span><\/td>/);
  assert.match(html,/<summary class="botao-texto">3 campos<\/summary><dl><div><dt>Vencimento<\/dt><dd><span class="audit-antes">15\/10\/2026<\/span> <span aria-hidden="true">→<\/span><span class="sr-only"> passou a <\/span> <span class="audit-depois">15\/11\/2026<\/span><\/dd><\/div><div><dt>Valor<\/dt><dd><span class="audit-depois">R\$ 67,00<\/span><\/dd><\/div><div><dt>Forma<\/dt><dd><span class="audit-depois">Pix<\/span><\/dd><\/div><\/dl><p class="muted">IP 203\.0\.113\.7<\/p>/);
  assert.match(renderPage({title:'Auditoria | Gestão Nexus',status:200,view:'auditoria',vm:tela('auditoria',auditoria,{filtros})}),/<script type="module" src="\/assets\/gestao\.js"><\/script><\/head>/,'sem script próprio: os filtros são um GET');
  semInline(renderPage({title:'Auditoria | Gestão Nexus',status:200,view:'auditoria',vm:tela('auditoria',auditoria,{filtros})}));
});

test('auditoria: o histórico de um registro, o sistema, os filtros ativos, os vazios e a paginação',()=>{
  const sistema={...auditoria.itens[0],acao:'plano_enviado',por:null,recurso:{tipo:'empresa',id:'clinica-vida-plena-austin'},antes:null,depois:{plano:'plano-avancado',gerida:true,alterado:false}};
  const html=views.auditoria(tela('auditoria',{...auditoria,itens:[sistema]},{filtros:{...filtros,recurso:'clinica-vida-plena-austin',usuario:'sistema'}}));
  assert.match(html,/<input type="hidden" name="recurso" value="clinica-vida-plena-austin">/);
  assert.match(html,/<p class="aviso">Histórico de um registro: <code>clinica-vida-plena-austin<\/code>\. <a href="\/auditoria\?usuario=sistema">Ver tudo<\/a><\/p>/);
  assert.match(html,/<option value="sistema" selected>/);
  assert.match(html,/<th scope="row">Plano enviado ao guia[^]*<td data-rotulo="Quem"><span class="muted">Sistema<\/span><\/td><td data-rotulo="Registro"><span class="audit-recurso">Empresa do guia<span class="audit-id">clinica-vida-plena-austin<\/span>/);
  assert.match(html,/<dt>Gerida pela gestão<\/dt><dd><span class="audit-depois">Sim<\/span><\/dd><\/div><div><dt>O guia mudou<\/dt><dd><span class="audit-depois">Não<\/span>/);
  assert.match(html,/<a class="botao-texto" href="\/auditoria">Limpar os filtros<\/a>/);
  assert.match(views.auditoria(tela('auditoria',{...auditoria,itens:[],total:0},{filtros:{...filtros,acao:'login'}})),/<p class="vazio-titulo">Nenhum registro com esses filtros<\/p>/);
  assert.match(views.auditoria(tela('auditoria',{...auditoria,itens:[],total:0},{filtros})),/<p class="vazio-titulo">Nenhum registro ainda<\/p>/);
  assert.match(views.auditoria(tela('auditoria',{...auditoria,pagina:1,paginas:4,total:70},{filtros:{...filtros,acao:'login',de:'2026-10-01'}})),/rel="next" href="\/auditoria\?acao=login&amp;de=2026-10-01&amp;page=2"/);
  assert.match(views.auditoria(tela('auditoria',{...auditoria,itens:[{...auditoria.itens[0],acao:'acao_nova_do_back'}]},{filtros})),/<th scope="row">acao nova do back/,'ação sem nome: o código legível');
  assert.match(views.auditoria(tela('auditoria',{...auditoria,itens:[{...auditoria.itens[0],depois:{notas:XSS}}]},{filtros:{...filtros,q:XSS}})),/value="&lt;img src=x[^]*&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('auditoria: toda ação de auditoria do contrato tem nome em português',async()=>{
  const contrato=await readFile(new URL('../../docs/CONTRATO.md',import.meta.url),'utf8');
  const acoes=new Set([...contrato.matchAll(/`([a-z0-9]+(?:_[a-z0-9]+)+|login|logout|reautenticacao)`/g)].map(m=>m[1]).filter(a=>a!=='login_challenges'&&/^(login|logout|codigo_|2fa_|senha_definida|plano_enviado|sincronizacao_conferida|reautenticacao|membro_|link_senha|admin_cli|cliente_|empresa_vinculada|empresa_desvinculada|assinatura_(criada|editada|suspensa|reativada|cancelada)|pagamento_(registrado|estornado)|cobranca_registrada|configuracoes_editadas|importacao_(enviada|confirmada|descartada))/.test(a)));
  assert.ok(acoes.size>=30,`${acoes.size} ações`);
  for(const a of acoes)assert.ok(ACAO[a],a);
  assert.equal(nomeAcao('2fa_redefinido_cli'),'2FA redefinido pelo CLI');
});

test('ficha e assinatura: "Ver na auditoria" só para quem lê a auditoria',()=>{
  const admin=views.cliente(tela('cliente',ficha));
  assert.match(admin,/<a class="botao-texto" href="\/auditoria\?recurso=0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">Ver na auditoria<\/a>/);
  assert.doesNotMatch(views.cliente(comPapel(tela('cliente',ficha),'comercial')),/Ver na auditoria/);
  const vm={...assinaturaNova,assinatura:ficha.assinaturas[0]};
  assert.match(views['assinatura-form'](tela('assinatura-form',vm)),/<p class="historico"><a href="\/auditoria\?recurso=9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01">Ver esta assinatura na auditoria/);
  assert.doesNotMatch(views['assinatura-form'](comPapel(tela('assinatura-form',vm),'financeiro')),/na auditoria/);
  assert.doesNotMatch(views['assinatura-form'](tela('assinatura-form',assinaturaNova)),/na auditoria/,'a nova ainda não tem histórico');
});
