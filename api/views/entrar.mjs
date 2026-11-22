import { escape as e } from '../lib/html.mjs';
import { campo, senha, formulario } from './componentes.mjs';

// Entrar (contrato 4.4 e 6.2) e Definir senha (4.2 e 6.3), sem moldura: só a marca e o cartão do formulário. O entrar.js
// manda cada etapa para a API e recarrega a página, que já vem na etapa seguinte.

const MOTIVO={expirou:'A sua sessão terminou. Entre de novo para continuar de onde parou.',saiu:'Você saiu da gestão.','senha-definida':'Senha definida. Agora entre com o seu e-mail e a senha nova.'};
// Cartão do acesso: a marca e o título à esquerda no computador; no celular, o formulário logo abaixo do título.
const acesso=(titulo,texto,cartao)=>`<main id="conteudo" class="acesso"><div class="acesso-marca"><img src="/assets/logo-nexus.svg" alt="Nexus" width="220" height="56"><p class="acesso-nome">Gestão comercial</p><h1>${titulo}</h1>${texto?`<p class="acesso-texto">${texto}</p>`:''}</div><div class="acesso-cartao">${cartao}</div></main>`;
const codigoCampo=(id,dica)=>campo('codigo','Código de 6 dígitos',a=>`<input type="text" ${a} inputmode="numeric" autocomplete="one-time-code" maxlength="11" spellcheck="false" autocapitalize="off" required>`,{id,dica});
const outraConta=email=>`<p class="acesso-conta">Entrando como <strong>${e(email)}</strong>. <button type="button" class="botao-texto" data-outra-conta>Entrar com outra conta</button></p>`;

const DEMO_ACESSO=`<section class="demo-acesso" aria-label="Contas de demonstração para portfólio"><p class="demo-etiqueta">Acesso demonstrativo (portfólio)</p><p class="demo-texto">Escolha um perfil para entrar com 1 clique:</p><div class="demo-botoes"><button type="button" class="botao secundario demo-btn" data-demo-email="admin@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Admin</strong><span>Acesso completo</span></button><button type="button" class="botao secundario demo-btn" data-demo-email="financeiro@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Financeiro</strong><span>Pagamentos e cobrança</span></button><button type="button" class="botao secundario demo-btn" data-demo-email="comercial@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Comercial</strong><span>Carteira e renovações</span></button><button type="button" class="botao secundario demo-btn" data-demo-email="leitura@nexus.demo" data-demo-senha="NexusDemo2026!"><strong>Leitura</strong><span>Consulta e indicadores</span></button></div></section>`;

function etapaSenha(vm) {
  const aviso=MOTIVO[vm.motivo]?`<p class="flash${vm.motivo==='expirou'?'':' is-ok'}" role="status">${MOTIVO[vm.motivo]}</p>`:'';
  const corpo=`${campo('email','E-mail',a=>`<input type="email" ${a} autocomplete="username" inputmode="email" maxlength="160" spellcheck="false" autocapitalize="off" required>`,{id:'entrar-email'})}${campo('senha','Senha',senha('current-password',' required'),{id:'entrar-senha'})}`;
  return `${aviso}${formulario({attrs:'data-form="login"',corpo,salvar:'Continuar',nota:'Esqueceu a senha? Peça um link novo ao admin da gestão.'})}${vm.demo?DEMO_ACESSO:''}`;
}
function etapaCodigo(vm) {
  const corpo=`${outraConta(vm.email)}${codigoCampo('entrar-codigo','O código que aparece agora no aplicativo autenticador. Sem o celular, use um dos códigos de recuperação (como k7m2q-x9p4t).')}`;
  return formulario({attrs:'data-form="codigo"',corpo,salvar:'Entrar'});
}
// Primeiro acesso: o QR (SVG pronto do servidor, só <svg> e <path>), o link para o próprio celular e a chave para digitar.
// Depois do primeiro código, os códigos de recuperação aparecem uma vez só, no lugar do formulário.
function etapaConfigurar(vm) {
  const c=vm.configurar||{};
  const passos=`<ol class="passos"><li><p><strong>Abra o aplicativo autenticador</strong> no celular (Google Authenticator, Microsoft Authenticator ou outro).</p></li><li><p><strong>Adicione a conta</strong> lendo o QR abaixo. Se estiver no próprio celular, toque em “Abrir no autenticador” ou digite a chave.</p><div class="qr">${c.qrSvg||''}</div><p class="qr-acoes"><a class="botao secundario" href="${e(c.link||'')}">Abrir no autenticador</a></p><dl class="qr-dados"><div><dt>Chave</dt><dd><code class="chave" data-chave>${e(c.chave||'')}</code> <button type="button" class="botao-texto" data-copiar="[data-chave]">Copiar a chave</button></dd></div><div><dt>Conta</dt><dd>${e(c.conta||vm.email)}</dd></div><div><dt>Emissor</dt><dd>${e(c.emissor||'')}</dd></div></dl></li><li><p><strong>Digite o código de 6 dígitos</strong> que o aplicativo mostrar.</p></li></ol>`;
  const form=formulario({attrs:'data-form="configurar"',corpo:`${outraConta(vm.email)}${passos}${codigoCampo('configurar-codigo','O código muda a cada 30 segundos.')}`,salvar:'Ativar e entrar'});
  const codigos=`<section class="recuperacao" data-recuperacao hidden aria-labelledby="recuperacao-titulo" tabindex="-1"><h2 id="recuperacao-titulo">Guarde os códigos de recuperação</h2><p>Cada código vale uma vez e serve para entrar sem o celular. Eles <strong>não aparecem de novo</strong>: anote num lugar seguro, fora deste computador, ou guarde num gerenciador de senhas.</p><ol class="codigos" data-codigos></ol><p class="qr-acoes"><button type="button" class="botao secundario" data-copiar="[data-codigos]">Copiar os códigos</button></p><label class="confirma"><input type="checkbox" data-guardei><span>Guardei os códigos num lugar seguro.</span></label><div class="form-acoes"><button type="button" class="botao" data-ja-guardei disabled>Já guardei</button></div></section>`;
  return `${form}${codigos}`;
}

export function entrar(vm) {
  const etapa=['codigo','configurar'].includes(vm.etapa)?vm.etapa:'senha';
  const [titulo,texto]={senha:['Entrar','Só para a equipe do Nexus.'],codigo:['Confirme o acesso','Falta o código do aplicativo autenticador.'],configurar:['Ative a verificação em duas etapas','No primeiro acesso, ligue a gestão ao aplicativo autenticador do seu celular. É rápido e só uma vez.']}[etapa];
  const corpo=etapa==='codigo'?etapaCodigo(vm):etapa==='configurar'?etapaConfigurar(vm):etapaSenha(vm);
  return acesso(titulo,texto,`<div data-entrar data-etapa="${etapa}" data-next="${e(vm.next||'')}">${corpo}</div>`);
}

export function definirSenha(vm) {
  if(!vm.valido)return acesso('Este link não vale mais','',`<div class="vazio"><p class="vazio-titulo">O link venceu, já foi usado ou está incompleto.</p><p>Peça um link novo ao admin da gestão. O convite vale 72 horas, e o link de senha, 1 hora.</p><a class="botao secundario" href="/entrar">Ir para o Entrar</a></div>`);
  const convite=vm.tipo==='convite';
  const titulo=convite?`Boas-vindas${vm.nome?`, ${e(vm.nome)}`:''}`:'Defina uma senha nova';
  const quem=!vm.convidadoPor||vm.convidadoPor==='Equipe Nexus'?'A equipe Nexus':e(vm.convidadoPor);
  const texto=convite?`${quem} convidou você para a gestão comercial do Nexus. Defina a sua senha para entrar.`:'Escolha a senha que você vai usar daqui em diante. As sessões abertas com a senha antiga serão encerradas.';
  const regras='De 12 a 128 caracteres. Não use o seu e-mail, “nexus”, “gestao” nem sequências como 123456. Uma frase com algumas palavras é fácil de lembrar e difícil de adivinhar.';
  const corpo=`<p class="acesso-conta">Conta: <strong>${e(vm.email)}</strong></p><input type="hidden" name="token" value="${e(vm.token)}">${campo('senha','Senha nova',senha('new-password',' minlength="12" required'),{id:'nova-senha',dica:regras})}${campo('confirmacao','Repita a senha',senha('new-password',' minlength="12" required'),{id:'nova-senha-repetida'})}`;
  return acesso(titulo,texto,`<div data-definir-senha>${formulario({attrs:'data-form="definir-senha"',corpo,salvar:'Definir a senha',nota:convite?'Depois, você entra com o e-mail e esta senha e liga o aplicativo autenticador.':'Depois, entre com o e-mail, a senha nova e o código do autenticador.'})}</div>`);
}
