// Entrar em duas etapas (contrato 4.4) e definir a senha pelo link (4.2). Cada etapa chama a API e recarrega o /entrar,
// que já vem na etapa seguinte; depois do código, vai para o next. Os códigos de recuperação aparecem uma vez só.
import { $, chamar, limparErros, mostrarErros, ocupar, ler, interno } from './base.js';

const raiz=$('[data-entrar]'),next=interno(raiz?.dataset.next||'')||'/';
const recarregar=()=>location.assign(`/entrar${raiz?.dataset.next?`?${new URLSearchParams({next:raiz.dataset.next})}`:''}`);
// O código do autenticador aceita espaços (alguns apps mostram "123 456"); o de recuperação vai como foi digitado.
const codigo=v=>{const t=String(v||'').trim();return /^[\d\s]+$/.test(t)?t.replace(/\s/g,''):t;};
const vazios=(form,campos)=>campos.filter(([n])=>!String(form.elements[n]?.value||'').trim()).map(([campo,mensagem])=>({campo,mensagem}));

async function enviar(form,url,corpo,{depois,texto='Entrando…'}) {
  limparErros(form);
  const solta=ocupar(form.querySelector('[type="submit"]'),texto);
  const r=await chamar('POST',url,corpo);
  if(!r.ok){
    solta();
    // O login pendente morreu (expirou ou passou das tentativas): volta para a senha, com o aviso.
    if(r.status===401&&url!=='/api/auth/login'){mostrarErros(form,[{campo:'',mensagem:r.erro}]);setTimeout(recarregar,2500);return;}
    if(r.status===409)return recarregar();
    return mostrarErros(form,[{campo:r.campo,mensagem:r.erro}]);
  }
  depois(r.dados||{});
}

const login=$('form[data-form="login"]');
login?.addEventListener('submit',ev=>{
  ev.preventDefault();
  const erros=vazios(login,[['email','Digite o seu e-mail.'],['senha','Digite a sua senha.']]);
  if(erros.length)return mostrarErros(login,erros);
  const v=ler(login);
  enviar(login,'/api/auth/login',{email:v.email.trim(),senha:v.senha},{texto:'Conferindo…',depois:d=>{
    if(d.etapa==='sessao')return location.assign(next);
    recarregar();
  }});
});
document.querySelectorAll('[data-demo-email]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(!login)return;
    login.elements.email.value=btn.dataset.demoEmail||'';
    login.elements.senha.value=btn.dataset.demoSenha||'';
    login.requestSubmit();
  });
});

const etapaCodigo=$('form[data-form="codigo"]');
etapaCodigo?.addEventListener('submit',ev=>{
  ev.preventDefault();
  const erros=vazios(etapaCodigo,[['codigo','Digite o código do autenticador ou um código de recuperação.']]);
  if(erros.length)return mostrarErros(etapaCodigo,erros);
  enviar(etapaCodigo,'/api/auth/codigo',{codigo:codigo(etapaCodigo.elements.codigo.value)},{depois:d=>{
    if(d.recuperacao){
      try{sessionStorage.setItem('gestao-aviso',JSON.stringify({mensagem:`Você entrou com um código de recuperação. ${d.recuperacao.restantes===1?'Resta 1 código':`Restam ${d.recuperacao.restantes} códigos`}. Quando acabarem, peça ao admin para redefinir o seu 2FA.`,erro:false}));}catch{/* segue sem o aviso */}
    }
    location.assign(next);
  }});
});

// Primeiro acesso: depois do código certo, a sessão já existe; os códigos de recuperação tomam o lugar do formulário e a
// página só sai depois do "Já guardei".
const configurar=$('form[data-form="configurar"]'),painel=$('[data-recuperacao]');
let guardando=false;
configurar?.addEventListener('submit',ev=>{
  ev.preventDefault();
  const erros=vazios(configurar,[['codigo','Digite o código de 6 dígitos do aplicativo.']]);
  if(erros.length)return mostrarErros(configurar,erros);
  enviar(configurar,'/api/auth/2fa',{codigo:codigo(configurar.elements.codigo.value)},{texto:'Ativando…',depois:d=>{
    const lista=$('[data-codigos]',painel);
    lista.replaceChildren(...(d.codigosRecuperacao||[]).map(c=>Object.assign(document.createElement('li'),{textContent:c})));
    configurar.hidden=true;painel.hidden=false;guardando=true;painel.focus();
  }});
});
$('[data-guardei]')?.addEventListener('change',ev=>{$('[data-ja-guardei]').disabled=!ev.target.checked;});
$('[data-ja-guardei]')?.addEventListener('click',()=>{guardando=false;location.assign(next);});
addEventListener('beforeunload',ev=>{if(guardando)ev.preventDefault();});

// "Entrar com outra conta": cancela o login pendente (logout sem sessão) e volta para a senha.
$('[data-outra-conta]')?.addEventListener('click',async ev=>{
  ev.target.disabled=true;
  await chamar('POST','/api/auth/logout',{});
  recarregar();
});

// Definir a senha: as duas iguais e com o tamanho mínimo antes de mandar; o resto (senha fácil) o servidor confere.
const definir=$('form[data-form="definir-senha"]');
definir?.addEventListener('submit',ev=>{
  ev.preventDefault();limparErros(definir);
  const v=ler(definir),erros=[];
  if(v.senha.length<12)erros.push({campo:'senha',mensagem:'Use pelo menos 12 caracteres.'});
  else if(v.senha.length>128)erros.push({campo:'senha',mensagem:'Use até 128 caracteres.'});
  if(v.confirmacao!==v.senha)erros.push({campo:'confirmacao',mensagem:'As duas senhas não são iguais.'});
  if(erros.length)return mostrarErros(definir,erros);
  enviar(definir,'/api/auth/senha',{token:v.token,senha:v.senha},{texto:'Salvando…',depois:()=>location.assign('/entrar?motivo=senha-definida')});
});
