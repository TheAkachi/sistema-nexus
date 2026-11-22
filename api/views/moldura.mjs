import { escape as e } from '../lib/html.mjs';
import { icone, PAPEL, campo, senha } from './componentes.mjs';

// Moldura das telas com sessão (contrato 6.1): o cabeçalho, o menu (coluna fixa a partir de 1024 px e gaveta abaixo disso),
// os avisos e a área de trabalho. O menu mostra só o que o pode libera; o servidor confere de novo em toda rota.
// O csrf vai no data-csrf da casca, para o gestao.js mandar no X-CSRF-Token de toda escrita.

const GRUPOS=[
  ['Cobrança',[['resumo','/','Resumo'],['indicadores','/indicadores','Indicadores'],['renovacoes','/renovacoes','Renovações']]],
  // Interessados (v0.13.0, 14.5): só com modulos.interessados, que a moldura traz com a chave ligada e a ação clientes.
  ['Carteira',[['clientes','/clientes','Clientes'],['interessados','/interessados','Interessados','clientes','interessados']]],
  ['Administração',[['importacao','/importacao','Importação','importar'],['equipe','/equipe','Equipe','equipe'],['configuracoes','/configuracoes','Configurações','configuracoes'],['auditoria','/auditoria','Auditoria','auditoria']]]
];
// Em que item do menu cada tela fica: a própria (aria-current="page") ou a seção de onde ela sai (aria-current="true").
const SECAO={resumo:'resumo',indicadores:'indicadores',renovacoes:'renovacoes',clientes:'clientes',cliente:'clientes','cliente-form':'clientes','assinatura-form':'clientes',pagamento:'clientes',interessados:'interessados',interessado:'interessados',
  importacao:'importacao','importacao-previa':'importacao',equipe:'equipe',configuracoes:'configuracoes',auditoria:'auditoria'};
const TELA_DO_MENU=new Set(['resumo','indicadores','renovacoes','clientes','interessados','importacao','equipe','configuracoes','auditoria']);

function menu(vm) {
  const pode=vm.pode||{},atual=SECAO[vm.tela]||'',propria=TELA_DO_MENU.has(vm.tela);
  const grupos=GRUPOS.map(([nome,itens],g)=>{
    const vistos=itens.filter(([,,,acao,modulo])=>(!acao||pode[acao])&&(!modulo||vm.modulos?.[modulo]));
    if(!vistos.length)return '';
    return `<div class="menu-grupo"><p class="menu-grupo-nome" id="menu-grupo-${g}">${nome}</p><ul aria-labelledby="menu-grupo-${g}">${vistos.map(([id,href,rotulo])=>`<li><a href="${href}"${id===atual?` aria-current="${propria?'page':'true'}"`:''}>${icone(id)}<span>${rotulo}</span></a></li>`).join('')}</ul></div>`;
  }).join('');
  const u=vm.usuario||{};
  const pessoa=`<div class="pessoa"><p><strong>${e(u.nome||u.email||'')}</strong><span>${e(PAPEL[u.papel]||u.papel||'')}${u.email&&u.nome?` · ${e(u.email)}`:''}</span></p><button type="button" class="botao secundario" data-sair>${icone('sair')}<span>Sair</span></button></div>`;
  return `<nav id="menu" class="menu" aria-label="Gestão"><div class="menu-topo"><p class="menu-titulo">Menu</p><button type="button" class="botao-icone" data-menu-fechar aria-label="Fechar o menu">${icone('fechar')}</button></div><div class="menu-grupos">${grupos}</div>${pessoa}</nav>`;
}

// Avisos da moldura (6.1): o texto vem pronto. O link só aparece quando a pessoa pode abrir a tela de destino.
const DESTINO={'/configuracoes':['configuracoes','Abrir as Configurações'],'/auditoria':['auditoria','Ver na Auditoria']};
function avisos(vm) {
  const lista=(vm.avisos||[]).filter(a=>a?.texto);
  if(!lista.length)return '';
  return `<ul class="avisos">${lista.map(a=>{
    const [acao,rotulo]=DESTINO[a.href]||[],link=a.href&&(!acao||vm.pode?.[acao])?`<a href="${e(a.href)}">${rotulo||'Abrir'} <span aria-hidden="true">→</span></a>`:'';
    return `<li class="aviso is-${e(a.tipo)}">${icone('aviso')}<p>${e(a.texto)}${link?` ${link}`:''}</p></li>`;
  }).join('')}</ul>`;
}

// Confirmação de identidade (contrato 4.6): o gestao.js abre este diálogo quando uma ação sensível responde 403 com
// reautenticar e repete a ação depois da confirmação.
const reautenticar=()=>`<dialog class="dialogo" data-reautenticar aria-labelledby="reautenticar-titulo"><form class="formulario" method="post" data-form="reautenticar" novalidate><h2 id="reautenticar-titulo">Confirme que é você</h2><p class="dialogo-texto">Esta ação pede a sua senha ou um código do autenticador. A confirmação vale por 5 minutos.</p><div class="form-erros" role="alert" tabindex="-1" hidden></div><fieldset class="escolha"><legend class="sr-only">Como confirmar</legend><label><input type="radio" name="modo" value="senha" checked><span>Senha</span></label><label><input type="radio" name="modo" value="codigo"><span>Código do autenticador</span></label></fieldset><div data-modo="senha">${campo('senha','Sua senha',senha('current-password'),{id:'reautenticar-senha'})}</div><div data-modo="codigo" hidden>${campo('codigo','Código de 6 dígitos',a=>`<input type="text" ${a} inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" spellcheck="false">`,{id:'reautenticar-codigo',dica:'O código que aparece agora no aplicativo autenticador.'})}</div><div class="form-acoes"><button type="submit" class="botao">Confirmar</button><button type="button" class="botao secundario" data-cancelar>Cancelar</button></div></form></dialog>`;

// cabeca: {titulo, texto?, voltar?: [href, rotulo], acoes?, extra?}; corpo: o HTML da tela.
export function moldura(vm,{cabeca,corpo}) {
  const voltar=cabeca.voltar?`<a class="voltar" href="${e(cabeca.voltar[0])}">${icone('voltar')}<span>${e(cabeca.voltar[1])}</span></a>`:'';
  const topo=`<header class="topo"><button type="button" class="botao-icone menu-botao" data-menu-abrir aria-controls="menu" aria-expanded="false">${icone('menu')}<span>Menu</span></button><a class="marca" href="/"><img src="/assets/logo-nexus.svg" alt="Nexus" width="220" height="56"><span>Gestão comercial</span></a></header>`;
  const titulo=`<header class="cabeca">${voltar}<div class="cabeca-linha"><div class="cabeca-texto"><h1 id="titulo">${cabeca.titulo}</h1>${cabeca.extra||''}${cabeca.texto?`<p>${cabeca.texto}</p>`:''}</div>${cabeca.acoes?`<div class="cabeca-acoes">${cabeca.acoes}</div>`:''}</div></header>`;
  const principal=`<main id="conteudo" class="principal" tabindex="-1" aria-labelledby="titulo">${titulo}${avisos(vm)}<div class="flash" data-flash role="status" tabindex="-1" hidden></div><p class="sr-only" data-anuncio aria-live="polite"></p><noscript><p class="aviso is-sem-script">A gestão precisa do JavaScript do navegador para salvar.</p></noscript>${corpo}</main>`;
  return `<a class="pular" href="#conteudo">Pular para o conteúdo</a>${topo}<div class="casca" data-csrf="${e(vm.csrf||'')}" data-tela="${e(vm.tela||'')}">${menu(vm)}<div class="menu-fundo" data-menu-fundo hidden></div>${principal}</div>${reautenticar()}`;
}
