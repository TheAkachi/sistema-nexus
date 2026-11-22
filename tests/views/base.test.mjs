import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { moldura } from '../../api/views/moldura.mjs';
import * as c from '../../api/views/componentes.mjs';
import { semInline } from './ajuda.mjs';
import { tela, comPapel, entrarSenha, entrarConfigurar, definirSenha, erro, renovacoes, resumo } from './exemplos.mjs';

// fe/base: a moldura (menu por papel, avisos, gaveta e confirmação de identidade), os componentes base e as telas de
// entrada, a partir dos vms de exemplo do contrato. Nada inline (a CSP proíbe) e nada sem escape.
const pagina=(view,vm,title='Tela | Gestão Nexus')=>renderPage({title,status:200,view,vm});
const XSS='<img src=x onerror=alert(1)>';

test('documento: idioma, noindex, fonte, CSS, scripts da tela e nada inline',()=>{
  const html=pagina('erro',tela('erro',erro));
  assert.match(html,/^<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">/);
  assert.match(html,/<title>Tela \| Gestão Nexus<\/title>/);
  assert.match(html,/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Plus\+Jakarta\+Sans[^"]*"><link rel="stylesheet" href="\/assets\/gestao\.css"><noscript><link rel="stylesheet" href="\/assets\/sem-script\.css"><\/noscript>/);
  assert.match(html,/<script type="module" src="\/assets\/gestao\.js"><\/script><\/head>/,'com sessão, o gestao.js');
  assert.match(pagina('entrar',entrarSenha),/<script type="module" src="\/assets\/entrar\.js"><\/script><\/head>/);
  assert.doesNotMatch(pagina('entrar',entrarSenha),/gestao\.js/,'o Entrar não carrega a moldura');
  assert.doesNotMatch(pagina('erro',{status:404,mensagem:'Esta página não existe.'}),/<script/,'erro sem sessão, sem script');
  semInline(html);semInline(pagina('entrar',entrarConfigurar));
  assert.match(renderPage({title:`A ${XSS}`,status:200,view:'nao-existe',vm:{mensagem:XSS}}),/<title>A &lt;img src=x onerror=alert\(1\)&gt;<\/title>[^]*<p>&lt;img/,'view desconhecida sai com o título e a mensagem, escapados');
});

test('moldura: cabeçalho, casca com o csrf, gaveta acessível, área de avisos e confirmação de identidade',()=>{
  const html=moldura(tela('resumo',resumo),{cabeca:{titulo:'Resumo',texto:'O que cobrar hoje.'},corpo:'<p>corpo</p>'});
  assert.match(html,/^<a class="pular" href="#conteudo">Pular para o conteúdo<\/a><header class="topo"><button type="button" class="botao-icone menu-botao" data-menu-abrir aria-controls="menu" aria-expanded="false">/);
  assert.match(html,/<a class="marca" href="\/"><img src="\/assets\/logo-nexus\.svg" alt="Nexus" width="220" height="56"><span>Gestão comercial<\/span><\/a>/);
  assert.match(html,/<div class="casca" data-csrf="4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c" data-tela="resumo"><nav id="menu" class="menu" aria-label="Gestão">/);
  assert.match(html,/<button type="button" class="botao-icone" data-menu-fechar aria-label="Fechar o menu">/);
  assert.match(html,/<div class="menu-fundo" data-menu-fundo hidden><\/div><main id="conteudo" class="principal" tabindex="-1" aria-labelledby="titulo"><header class="cabeca"><div class="cabeca-linha"><div class="cabeca-texto"><h1 id="titulo">Resumo<\/h1><p>O que cobrar hoje\.<\/p><\/div><\/div><\/header>/);
  assert.match(html,/<div class="flash" data-flash role="status" tabindex="-1" hidden><\/div><p class="sr-only" data-anuncio aria-live="polite"><\/p><noscript>[^]*<\/noscript><p>corpo<\/p><\/main><\/div>/);
  assert.match(html,/<dialog class="dialogo" data-reautenticar aria-labelledby="reautenticar-titulo"><form class="formulario" method="post" data-form="reautenticar" novalidate>/);
  assert.match(html,/name="modo" value="senha" checked>[^]*name="modo" value="codigo">[^]*type="password" id="reautenticar-senha" name="senha"[^]*autocomplete="current-password"[^]*id="reautenticar-codigo" name="codigo"[^]*inputmode="numeric" autocomplete="one-time-code"/);
  assert.match(html,/<p><strong>Lucas<\/strong><span>Admin · lucas@exemplo\.test<\/span><\/p><button type="button" class="botao secundario" data-sair>/);
  semInline(html);
});

test('moldura: o menu mostra só o que o papel pode usar e marca onde a pessoa está',()=>{
  const itens=html=>[...html.matchAll(/<li><a href="([^"]+)"/g)].map(m=>m[1]);
  const vm=tela('resumo',resumo);
  assert.deepEqual(itens(moldura(vm,{cabeca:{titulo:'R'},corpo:''})),['/','/indicadores','/renovacoes','/clientes','/importacao','/equipe','/configuracoes','/auditoria']);
  for(const papel of ['financeiro','comercial','leitura']) {
    const html=moldura(comPapel(vm,papel),{cabeca:{titulo:'R'},corpo:''});
    assert.deepEqual(itens(html),['/','/indicadores','/renovacoes','/clientes'],papel);
    assert.doesNotMatch(html,/Administração/,`${papel}: sem o grupo vazio`);
  }
  assert.match(moldura(vm,{cabeca:{titulo:'R'},corpo:''}),/<a href="\/" aria-current="page">/);
  const ficha=moldura(tela('cliente',{}),{cabeca:{titulo:'C',voltar:['/clientes','Clientes']},corpo:''});
  assert.match(ficha,/<a href="\/clientes" aria-current="true">/,'na ficha, o item Clientes marca a seção');
  assert.match(ficha,/<a class="voltar" href="\/clientes"><svg[^]*<\/svg><span>Clientes<\/span><\/a>/);
  assert.doesNotMatch(moldura(tela('erro',erro),{cabeca:{titulo:'E'},corpo:''}),/aria-current/,'no erro, nada marcado');
});

test('moldura: avisos com o texto pronto, e o link só para quem pode abrir o destino',()=>{
  const vm=tela('resumo',resumo,{avisos:[{tipo:'chave-pix',texto:'Defina a chave Pix em Configurações.',href:'/configuracoes'},{tipo:'sincronizacao',texto:`Falha ${XSS}`,href:'/auditoria'},{tipo:'site-fora',texto:'O guia não respondeu.',href:''}]});
  const html=moldura(vm,{cabeca:{titulo:'R'},corpo:''});
  assert.match(html,/<ul class="avisos"><li class="aviso is-chave-pix"><svg[^]*<\/svg><p>Defina a chave Pix em Configurações\. <a href="\/configuracoes">Abrir as Configurações <span aria-hidden="true">→<\/span><\/a><\/p><\/li><li class="aviso is-sincronizacao">[^]*Falha &lt;img[^]*<a href="\/auditoria">Ver na Auditoria/);
  assert.match(html,/<li class="aviso is-site-fora"><svg[^]*<\/svg><p>O guia não respondeu\.<\/p><\/li>/);
  const financeiro=moldura(comPapel(vm,'financeiro'),{cabeca:{titulo:'R'},corpo:''});
  assert.match(financeiro,/<p>Defina a chave Pix em Configurações\.<\/p>/,'sem o link para quem não abre as Configurações');
  assert.doesNotMatch(financeiro,/href="\/configuracoes"|href="\/auditoria"/);
  assert.doesNotMatch(moldura(tela('resumo',resumo,{avisos:[]}),{cabeca:{titulo:'R'},corpo:''}),/class="avisos"/);
});

test('formatos pt-BR: dinheiro, datas, instantes em São Paulo e WhatsApp',()=>{
  assert.equal(c.reais(125000),'R$ 1.250,00');assert.equal(c.reais(9900),'R$ 99,00');assert.equal(c.reais(5),'R$ 0,05');
  assert.equal(c.reais(100000000),'R$ 1.000.000,00');assert.equal(c.reais(null),'—');assert.equal(c.valorCampo(186700),'1.867,00');
  assert.equal(c.dia('2026-11-15'),'15/11/2026');assert.equal(c.dia('15/11/2026'),'');
  assert.equal(c.instante('2026-10-16T13:20:00.000Z'),'16/10/2026 às 10:20','UTC−3');
  assert.equal(c.instante('2026-10-20T02:30:00.000Z'),'19/10/2026 às 23:30','o dia muda em São Paulo');
  assert.equal(c.whatsapp('5521987654321'),'(21) 98765-4321');assert.equal(c.whatsapp('552133334444'),'(21) 3333-4444');
  assert.equal(c.plural(1,'cliente','clientes'),'1 cliente');assert.equal(c.plural(1234,'cliente','clientes'),'1.234 clientes');
});

test('selo de situação: sempre com texto, uma classe por situação (contrato 5.3)',()=>{
  assert.equal(c.selo('em-dia',40),'<span class="selo is-em-dia">Ativa</span>');
  assert.equal(c.selo('a-vencer',4),'<span class="selo is-a-vencer">Vence em 4 dias</span>');
  assert.equal(c.selo('a-vencer',1),'<span class="selo is-a-vencer">Vence amanhã</span>');
  assert.equal(c.selo('a-vencer',0),'<span class="selo is-a-vencer">Vence hoje</span>');
  assert.equal(c.selo('vencida',-5),'<span class="selo is-vencida">Vencida</span>');
  assert.equal(c.selo('inadimplente',-18),'<span class="selo is-inadimplente">Inadimplente</span>');
  assert.equal(c.selo('suspensa'),'<span class="selo is-suspensa">Suspensa</span>');
  assert.equal(c.selo('cancelada'),'<span class="selo is-cancelada">Cancelada</span>');
  assert.equal(c.selo(null),'<span class="selo is-sem-assinatura">Sem assinatura</span>');
  assert.equal(c.selo('desconhecida'),'');
  assert.equal(c.prazo(-5,'2026-10-15'),'Venceu há 5 dias, em <time datetime="2026-10-15">15/10/2026</time>');
  assert.equal(c.prazo(-1,'2026-10-19'),'Venceu ontem, em <time datetime="2026-10-19">19/10/2026</time>');
  assert.equal(c.prazo(0,'2026-10-20'),'Vence hoje, <time datetime="2026-10-20">20/10/2026</time>');
  assert.equal(c.prazo(4,'2026-10-24'),'Vencimento em <time datetime="2026-10-24">24/10/2026</time>');
});

test('número do Resumo: rótulo, valor e nota, como link quando leva a uma lista',()=>{
  assert.equal(c.numeroResumo({rotulo:'A renovar em 30 dias',valor:'R$ 434,00',nota:'4 assinaturas',href:'/renovacoes?janela=30'}),
    '<a class="numero" href="/renovacoes?janela=30"><span class="numero-rotulo">A renovar em 30 dias</span><strong class="numero-valor">R$ 434,00</strong><span class="numero-nota">4 assinaturas</span></a>');
  assert.equal(c.numeroResumo({rotulo:'Recebido no mês',valor:'R$ 536,00',destaque:true}),'<div class="numero is-destaque"><span class="numero-rotulo">Recebido no mês</span><strong class="numero-valor">R$ 536,00</strong></div>');
  assert.match(c.numeroResumo({rotulo:XSS,valor:XSS}),/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('linha de renovação: quem, empresa, plano, valor, prazo, último contato e as ações por permissão',()=>{
  const [inadimplente,vencida]=renovacoes.itens,admin={cobrar:true,pagamentos:true,clientes:true};
  const html=c.linhaRenovacao(vencida,{pode:admin,volta:'/renovacoes?janela=vencidas'});
  assert.match(html,/^<li class="renovacao" data-assinatura="9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01"><div class="renovacao-quem"><img class="miniatura" src="https:\/\/nexus\.demo\/midia\/3f2a9c1b7d4e5f60718293a4b5c6d7e8\/320\.webp" alt="" width="48" height="48" loading="lazy" decoding="async">/);
  assert.match(html,/<h3><a href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41">Clínica Vida Plena<\/a><\/h3><p class="renovacao-onde">Clínica Vida Plena · Centro · Premium<\/p><p class="renovacao-valor"><strong>R\$ 99,00<\/strong> por mês<\/p>/);
  assert.match(html,/<span class="selo is-vencida">Vencida<\/span><span>Venceu há 5 dias, em <time datetime="2026-10-15">15\/10\/2026<\/time><\/span>/);
  assert.match(html,/<p class="renovacao-contato" data-ultimo-contato>Cobrado em <time datetime="2026-10-16T13:20:00\.000Z">16\/10\/2026 às 10:20<\/time> por Bruno<\/p>/);
  assert.match(html,/<a class="botao whatsapp" href="https:\/\/wa\.me\/5521900000001\?text=Ol%C3%A1%2C%20Marina[^"]*" target="_blank" rel="noopener" data-cobrar="9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01"><svg[^]*<\/svg><span>Cobrar no WhatsApp<\/span><span class="sr-only">: Clínica Vida Plena \(abre o WhatsApp em outra aba\)<\/span><span class="seta" aria-hidden="true">↗<\/span><\/a>/);
  assert.match(html,/<a class="botao secundario" href="\/assinaturas\/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01\/pagamento\?volta=%2Frenovacoes%3Fjanela%3Dvencidas">Registrar pagamento<span class="sr-only"> de Clínica Vida Plena<\/span><\/a>/);
  assert.match(c.linhaRenovacao(inadimplente,{pode:admin}),/<span class="selo is-inadimplente">Inadimplente<\/span>[^]*Nenhum contato ainda/);
  const leitura=c.linhaRenovacao({...vencida,linkWhatsapp:null},{pode:{}});
  assert.doesNotMatch(leitura,/renovacao-acoes|data-cobrar|pagamento/,'leitura: sem ações');
  const comercial=c.linhaRenovacao(vencida,{pode:{cobrar:true,clientes:true}});
  assert.match(comercial,/data-cobrar/);assert.doesNotMatch(comercial,/Registrar pagamento/,'comercial não registra pagamento');
  const semZap=c.linhaRenovacao({...vencida,linkWhatsapp:null,cliente:{...vencida.cliente,whatsapp:''}},{pode:admin});
  assert.match(semZap,/Sem WhatsApp cadastrado\. <a href="\/clientes\/0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41\/editar">Cadastrar o WhatsApp/);
  const semEmpresa=c.linhaRenovacao({...vencida,empresa:null,plano:null},{pode:{}});
  assert.match(semEmpresa,/<span class="miniatura is-iniciais" aria-hidden="true">CV<\/span>[^]*Sem empresa do guia · Sem plano/);
  assert.match(c.linhaRenovacao({...vencida,empresa:{...vencida.empresa,miniatura:''}},{pode:{}}),/<span class="miniatura is-iniciais" aria-hidden="true">CV<\/span>/,'sem foto, as iniciais');
  assert.match(c.linhaRenovacao({...vencida,cliente:{...vencida.cliente,nome:XSS}},{pode:admin}),/&lt;img src=x onerror=alert\(1\)&gt;/);
  semInline(html);
});

test('formulário com um único salvar, campos ligados à dica e ao erro',()=>{
  const html=c.formulario({attrs:'data-form="teste"',corpo:c.campo('nome','Nome',c.texto('Ana',160,' required'),{dica:'Como aparece na lista.'}),salvar:'Salvar cliente',nota:'Salva na hora.'});
  assert.equal((html.match(/type="submit"/g)||[]).length,1,'um salvar só');
  assert.match(html,/^<form class="formulario" method="post" data-form="teste" novalidate><div class="form-erros" role="alert" tabindex="-1" hidden><\/div>/);
  assert.match(html,/<div class="campo" data-campo="nome"><label for="campo-nome">Nome<\/label><input type="text" id="campo-nome" name="nome" aria-describedby="campo-nome-dica campo-nome-erro" value="Ana" maxlength="160" required><p class="campo-dica" id="campo-nome-dica">Como aparece na lista\.<\/p><p class="campo-erro" id="campo-nome-erro" hidden><\/p><\/div>/);
  assert.match(html,/<p class="form-nota">Salva na hora\.<\/p><div class="form-acoes"><button type="submit" class="botao">Salvar cliente<\/button><\/div><\/form>$/,'a nota fica fora da barra fixa do celular');
  assert.match(c.campo('x','X',c.texto(XSS,10)),/value="&lt;img src=x onerror=alert\(1\)&gt;"/);
});

test('entrar, etapa da senha: e-mail, senha com "Mostrar", o motivo e um único botão',()=>{
  const html=views.entrar(entrarSenha);
  assert.match(html,/<main id="conteudo" class="acesso"><div class="acesso-marca"><img src="\/assets\/logo-nexus\.svg" alt="Nexus"[^>]*><p class="acesso-nome">Gestão comercial<\/p><h1>Entrar<\/h1>/);
  assert.match(html,/<div data-entrar data-etapa="senha" data-next="\/renovacoes">/);
  assert.match(html,/<p class="flash" role="status">A sua sessão terminou\. Entre de novo para continuar de onde parou\.<\/p>/);
  assert.match(html,/<input type="email" id="entrar-email" name="email" aria-describedby="entrar-email-erro" autocomplete="username"/);
  assert.match(html,/<input type="password" id="entrar-senha" name="senha"[^>]*autocomplete="current-password"[^>]*required><button type="button" class="botao secundario pequeno" data-mostrar-senha aria-pressed="false">Mostrar<\/button>/);
  assert.match(html,/<p class="form-nota">Esqueceu a senha\? Peça um link novo ao admin da gestão\.<\/p><div class="form-acoes"><button type="submit" class="botao">Continuar<\/button>/);
  assert.match(views.entrar({...entrarSenha,motivo:'senha-definida'}),/class="flash is-ok" role="status">Senha definida\./);
  assert.doesNotMatch(views.entrar({...entrarSenha,motivo:''}),/class="flash/);
  assert.match(views.entrar({...entrarSenha,next:`"${XSS}`}),/data-next="&quot;&lt;img/);
});

test('entrar, etapa do código e configuração do 2FA: QR do servidor, link, chave e os códigos de recuperação',()=>{
  const codigo=views.entrar({...entrarSenha,etapa:'codigo',email:'lucas@exemplo.test',motivo:''});
  assert.match(codigo,/<h1>Confirme o acesso<\/h1>/);
  assert.match(codigo,/Entrando como <strong>lucas@exemplo\.test<\/strong>\. <button type="button" class="botao-texto" data-outra-conta>Entrar com outra conta<\/button>/);
  assert.match(codigo,/id="entrar-codigo" name="codigo"[^>]*inputmode="numeric" autocomplete="one-time-code" maxlength="11"/,'cabe o código de recuperação com o hífen');
  const html=views.entrar(entrarConfigurar);
  assert.match(html,/<h1>Ative a verificação em duas etapas<\/h1>/);
  assert.ok(html.includes(`<div class="qr">${entrarConfigurar.configurar.qrSvg}</div>`),'o SVG do servidor entra sem escape');
  assert.match(html,/<a class="botao secundario" href="otpauth:\/\/totp\/Gest%C3%A3o%20Nexus:lucas%40exemplo\.test\?secret=[A-Z0-9]+&amp;issuer=/);
  assert.match(html,/<code class="chave" data-chave>JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP<\/code> <button type="button" class="botao-texto" data-copiar="\[data-chave\]">Copiar a chave<\/button>/);
  assert.match(html,/<button type="submit" class="botao">Ativar e entrar<\/button>/);
  assert.match(html,/<section class="recuperacao" data-recuperacao hidden[^>]*>[^]*não aparecem de novo[^]*<ol class="codigos" data-codigos><\/ol>[^]*<input type="checkbox" data-guardei>[^]*<button type="button" class="botao" data-ja-guardei disabled>Já guardei<\/button>/);
  assert.match(views.entrar({...entrarConfigurar,email:XSS,configurar:{...entrarConfigurar.configurar,conta:XSS}}),/&lt;img src=x/);
  semInline(html);
});

test('definir senha: convite com quem convidou, as regras, as duas senhas e o link vencido',()=>{
  const html=views['definir-senha'](definirSenha);
  assert.match(html,/<h1>Boas-vindas, Ana<\/h1><p class="acesso-texto">Lucas convidou você para a gestão comercial do Nexus\./);
  assert.match(html,/Conta: <strong>ana@exemplo\.test<\/strong><\/p><input type="hidden" name="token" value="0f1e2d3c/);
  assert.match(html,/id="nova-senha" name="senha" aria-describedby="nova-senha-dica nova-senha-erro" autocomplete="new-password"[^>]*minlength="12"/);
  assert.match(html,/id="nova-senha-repetida" name="confirmacao"[^>]*autocomplete="new-password"/);
  assert.match(html,/De 12 a 128 caracteres\./);
  assert.equal((html.match(/type="submit"/g)||[]).length,1);
  assert.match(views['definir-senha']({...definirSenha,tipo:'senha'}),/<h1>Defina uma senha nova<\/h1>[^]*entre com o e-mail, a senha nova e o código do autenticador/);
  const vencido=views['definir-senha']({token:'',valido:false,tipo:'',email:'',nome:'',convidadoPor:''});
  assert.match(vencido,/<h1>Este link não vale mais<\/h1>[^]*Peça um link novo ao admin da gestão\.[^]*<a class="botao secundario" href="\/entrar">Ir para o Entrar<\/a>/);
  assert.doesNotMatch(vencido,/<form/);
  assert.match(views['definir-senha']({...definirSenha,nome:XSS,convidadoPor:XSS}),/Boas-vindas, &lt;img src=x onerror=alert\(1\)&gt;<\/h1><p class="acesso-texto">&lt;img/);
});

test('erro: com a moldura quando há sessão, e só o caminho para o Entrar sem ela',()=>{
  const html=views.erro(tela('erro',erro));
  assert.match(html,/<h1 id="titulo">Sem permissão<\/h1>[^]*<p class="vazio-titulo">O seu papel não permite abrir esta tela\.<\/p><p>Se você precisa desta tela, peça ao admin da gestão para rever o seu papel\.<\/p>/);
  assert.match(html,/<a class="botao" href="\/">Ir para o Resumo<\/a>/);
  assert.match(views.erro(tela('erro',{status:404,mensagem:'Este registro não existe.'})),/<h1 id="titulo">Página não encontrada<\/h1>[^]*Este registro não existe\./);
  assert.match(views.erro(tela('erro',{status:422,mensagem:'Reative a assinatura antes de registrar o pagamento.'})),/<h1 id="titulo">Não foi possível abrir<\/h1>[^]*Reative a assinatura/);
  const sem=views.erro({status:404,mensagem:'Esta página não existe.'});
  assert.match(sem,/<main id="conteudo" class="acesso is-erro">[^]*<h1>Página não encontrada<\/h1><p class="acesso-texto">Esta página não existe\.<\/p><p><a class="botao" href="\/entrar">Ir para o Entrar<\/a>/);
  assert.match(views.erro(tela('erro',{status:403,mensagem:XSS})),/&lt;img src=x/);
});
