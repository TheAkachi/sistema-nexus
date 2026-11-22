import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';

// Erro (contrato 6.16): 403, 404 e os 422 de regra (pagar uma assinatura suspensa, por exemplo), com a moldura quando há
// sessão. Sem sessão, só a marca e o caminho para o Entrar.
const TITULO={403:'Sem permissão',404:'Página não encontrada',422:'Não foi possível abrir'};
const PADRAO={403:'O seu papel não permite abrir esta tela.',404:'Esta página não existe.',422:'Esta ação não vale para este registro agora.'};

export function erro(vm) {
  const d=vm.dados||vm,status=Number(d.status)||404,titulo=TITULO[status]||'Não foi possível abrir',mensagem=e(d.mensagem||PADRAO[status]||'');
  if(!vm.usuario)return `<main id="conteudo" class="acesso is-erro"><div class="acesso-marca"><img src="/assets/logo-nexus.svg" alt="Nexus" width="220" height="56"><p class="acesso-nome">Gestão comercial</p><h1>${titulo}</h1><p class="acesso-texto">${mensagem}</p><p><a class="botao" href="/entrar">Ir para o Entrar</a></p></div></main>`;
  const dica=status===403?'Se você precisa desta tela, peça ao admin da gestão para rever o seu papel.':status===404?'Confira o endereço, ou volte ao Resumo e siga pelo menu.':'Volte à tela anterior e confira a situação do registro.';
  const corpo=`<div class="vazio is-erro"><p class="vazio-titulo">${mensagem}</p><p>${dica}</p><p class="vazio-acoes"><a class="botao" href="/">Ir para o Resumo</a><a class="botao secundario" href="/clientes">Ver os clientes</a></p></div>`;
  return moldura(vm,{cabeca:{titulo},corpo});
}
