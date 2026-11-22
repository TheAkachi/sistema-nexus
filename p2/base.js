// Peças do navegador usadas por todas as telas: a chamada à API (com o CSRF, a sessão expirada e a confirmação de
// identidade do contrato 4.6), os erros de formulário, a confirmação no topo e o botão ocupado. Nada fica em localStorage:
// só a mensagem de confirmação passa pelo sessionStorage, de uma página para a seguinte.

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const casca=()=>$('[data-csrf]');
const CHAVE='gestao-aviso';
const PADRAO={0:'Sem conexão. Confira a internet e tente de novo.',403:'O seu papel não permite esta ação.',404:'Este registro não existe mais. Recarregue a página.',413:'O arquivo é grande demais.',429:'Muitas tentativas. Tente de novo em alguns minutos.',500:'Falha interna. Tente de novo em instantes.',503:'O guia não respondeu. Tente de novo em instantes.'};

// Reais digitados ("1.234,56", "99", "49,9" ou "49.90") em centavos; vazio é null, e o que não é número, NaN.
export function centavos(v) {
  let t=String(v??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
  if(!t)return null;
  if(/^\d+\.\d{1,2}$/.test(t))t=t.replace('.',',');
  if(!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t))return NaN;
  const [inteiro,fracao='']=t.replace(/\./g,'').split(',');
  return Number(inteiro)*100+Number(fracao.padEnd(2,'0'));
}
export function reais(c) {
  const a=Math.abs(Math.round(Number(c)||0));
  return `R$ ${String(Math.floor(a/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')},${String(a%100).padStart(2,'0')}`;
}
export const dia=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');return m?`${m[3]}/${m[2]}/${m[1]}`:'';};
// Caminho interno para voltar (o ?volta= dos links), nunca outro site.
export const interno=v=>typeof v==='string'&&/^\/(?![/\\])[^\s\\\x00-\x1f\x7f]*$/.test(v)&&!v.startsWith('/entrar')?v:'';

// Confirmação de identidade: abre o diálogo e resolve true quando a senha ou o código foram aceitos.
function confirmarIdentidade() {
  const dialogo=$('[data-reautenticar]');
  if(!dialogo)return Promise.resolve(false);
  const form=$('form',dialogo);
  form.reset();limparErros(form);trocarModo(form);
  return new Promise(resolve=>{
    let feito=false;
    const fim=ok=>{if(feito)return;feito=true;form.removeEventListener('submit',enviar);form.removeEventListener('change',trocar);$('[data-cancelar]',form).removeEventListener('click',cancelar);dialogo.removeEventListener('close',fechou);if(dialogo.open)dialogo.close();resolve(ok);};
    const trocar=()=>trocarModo(form),cancelar=()=>fim(false),fechou=()=>fim(false);
    async function enviar(ev) {
      ev.preventDefault();limparErros(form);
      const modo=form.elements.modo.value,valor=form.elements[modo].value.trim();
      if(!valor)return mostrarErros(form,[{campo:modo,mensagem:modo==='senha'?'Digite a sua senha.':'Digite o código de 6 dígitos.'}]);
      const solta=ocupar(form.querySelector('[type="submit"]'),'Confirmando…');
      const r=await chamar('POST','/api/auth/confirmar',{[modo]:valor},{confirmar:false});
      solta();
      if(r.ok)return fim(true);
      mostrarErros(form,[{campo:r.campo||modo,mensagem:r.erro}]);
    }
    form.addEventListener('submit',enviar);form.addEventListener('change',trocar);$('[data-cancelar]',form).addEventListener('click',cancelar);dialogo.addEventListener('close',fechou);
    dialogo.showModal();$('input:not([type="radio"]):not([hidden])',$('[data-modo]:not([hidden])',form))?.focus();
  });
}
function trocarModo(form) {
  const modo=form.elements.modo?.value||'senha';
  for(const bloco of $$('[data-modo]',form))bloco.hidden=bloco.dataset.modo!==modo;
}

// Chamada à API (contrato 2.3). Devolve {ok, status, dados, erro, campo}. Com sessão (a casca na página), o 401 leva ao
// Entrar com o caminho de volta, e o 403 com reautenticar pede a confirmação e repete a ação uma vez.
export async function chamar(metodo,url,corpo,{confirmar=true,tipo='application/json',bruto=false}={}) {
  const headers={Accept:'application/json'},token=casca()?.dataset.csrf;
  if(metodo!=='GET'){headers['Content-Type']=tipo;if(token)headers['X-CSRF-Token']=token;}
  let r;
  try{r=await fetch(url,{method:metodo,headers,credentials:'same-origin',body:metodo==='GET'?undefined:bruto?corpo:JSON.stringify(corpo??{})});}
  catch{return {ok:false,status:0,dados:null,erro:PADRAO[0],campo:''};}
  let dados=null;try{dados=await r.json();}catch{/* sem corpo JSON */}
  if(r.status===401&&casca()){
    sair(`/entrar?${new URLSearchParams({next:location.pathname+location.search,motivo:'expirou'})}`);
    return new Promise(()=>{});
  }
  if(r.status===403&&dados?.reautenticar&&confirmar){
    if(await confirmarIdentidade())return chamar(metodo,url,corpo,{confirmar:false,tipo,bruto});
    return {ok:false,status:403,dados,erro:'Ação cancelada: a confirmação de identidade não foi feita.',campo:'',cancelada:true};
  }
  return {ok:r.ok,status:r.status,dados,erro:dados?.erro||PADRAO[r.status]||PADRAO[500],campo:dados?.campo||''};
}

export function sair(url){location.assign(url);}
// Vai para a página (ou recarrega a mesma) com a confirmação para mostrar no topo depois do carregamento.
// alvo: o id do elemento para onde a página volta depois de carregar (a linha mexida da prévia, por exemplo).
export function irPara(url,mensagem,{erro=false,alvo=""}={}) {
  try{if(mensagem)sessionStorage.setItem(CHAVE,JSON.stringify({mensagem,erro,alvo}));}catch{/* sem armazenamento: segue sem o aviso */}
  const destino=new URL(url,location.href);destino.hash='';
  if(destino.href===location.href.replace(/#.*$/,''))location.reload();else location.assign(destino.href);
}
export function avisoGuardado() {
  try{const g=JSON.parse(sessionStorage.getItem(CHAVE)||'null');sessionStorage.removeItem(CHAVE);return g;}catch{return null;}
}

// Confirmação no topo da tela (role="status"). A de erro pode trazer o "Recarregar" (409: outra pessoa salvou antes).
export function avisar(mensagem,{erro=false,recarregar=false,foco=true}={}) {
  const caixa=$('[data-flash]');
  if(!caixa)return;
  caixa.className=`flash${erro?' is-erro':''}`;
  const t=document.createElement('span');t.textContent=mensagem;caixa.replaceChildren(t);
  if(recarregar){const b=document.createElement('button');b.type='button';b.className='botao secundario pequeno';b.textContent='Recarregar';b.addEventListener('click',()=>location.reload());caixa.append(b);}
  caixa.hidden=false;
  if(foco)caixa.focus();
}
export function anunciar(t) {
  const a=$('[data-anuncio]');
  if(!a)return;
  a.textContent='';setTimeout(()=>{a.textContent=t;},60);
}

// Erros de formulário: a caixa no topo (cada item leva ao campo) e a mensagem embaixo do campo, com aria-invalid.
export function limparErros(form) {
  const caixa=$('.form-erros',form);if(caixa){caixa.hidden=true;caixa.replaceChildren();}
  for(const el of $$('[aria-invalid="true"]',form))el.removeAttribute('aria-invalid');
  for(const p of $$('.campo-erro',form)){p.hidden=true;p.textContent='';}
}
export function mostrarErros(form,erros) {
  const caixa=$('.form-erros',form),itens=[];
  let primeiro=null;
  for(const {campo,mensagem} of erros) {
    const bloco=campo&&$(`[data-campo="${CSS.escape(campo)}"]`,form),el=bloco&&$('input:not([type="hidden"]),select,textarea',bloco);
    if(bloco&&el){
      // O campo dentro de um bloco fechado (uma etapa da régua nas Configurações) abre, para o erro e o foco chegarem a ele.
      for(let d=el.closest('details:not([open])');d;d=d.parentElement?.closest('details:not([open])'))d.open=true;
      el.setAttribute('aria-invalid','true');
      const p=$('.campo-erro',bloco);if(p){p.textContent=mensagem;p.hidden=false;}
      primeiro||=el;
      itens.push({mensagem,id:el.id});
    }else itens.push({mensagem,id:''});
  }
  // Um erro só, sem campo (o login errado, por exemplo): a mensagem e nada mais. Vários: a lista, cada um levando ao campo.
  if(caixa&&(itens.length>1||!primeiro)){
    if(itens.length===1)caixa.replaceChildren(Object.assign(document.createElement('p'),{textContent:itens[0].mensagem}));
    else{
      const ul=document.createElement('ul');
      for(const i of itens){const li=document.createElement('li');if(i.id){const a=document.createElement('a');a.href=`#${i.id}`;a.textContent=i.mensagem;li.append(a);}else li.textContent=i.mensagem;ul.append(li);}
      caixa.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Confira os campos:'}),ul);
    }
    caixa.hidden=false;
  }
  (primeiro&&itens.length===1?primeiro:caixa)?.focus();
}
// Resposta de erro de um formulário: 422 marca o campo, 409 pede para recarregar e o resto vai para o topo do formulário.
export function falha(form,r) {
  if(r.cancelada)return avisar(r.erro,{erro:true});
  if(r.status===409&&!r.campo)return avisar(r.erro,{erro:true,recarregar:true});
  mostrarErros(form,[{campo:r.campo,mensagem:r.erro}]);
}

// Botão ocupado ("Salvando…") enquanto a chamada não volta; devolve a função que solta o botão.
export function ocupar(botao,texto='Salvando…') {
  if(!botao)return ()=>{};
  const antes=botao.innerHTML;
  botao.disabled=true;botao.setAttribute('aria-busy','true');botao.textContent=texto;
  return ()=>{botao.disabled=false;botao.removeAttribute('aria-busy');botao.innerHTML=antes;};
}

// Ação séria (cancelar, estornar, desativar): o primeiro toque troca o rótulo do próprio botão pela confirmação, que volta
// ao normal quando o foco sai dele, sem prazo. Devolve true no segundo toque.
export function segundoToque(botao,rotulo) {
  if(botao.dataset.confirmar)return true;
  const antes=botao.innerHTML,contexto=$$('.sr-only',botao).map(s=>s.cloneNode(true));
  botao.dataset.confirmar='1';
  const t=document.createElement('span');t.textContent=rotulo;botao.replaceChildren(t,...contexto);
  anunciar(`${rotulo}. Toque de novo para confirmar.`);
  botao.addEventListener('blur',()=>{if(botao.isConnected&&botao.dataset.confirmar){delete botao.dataset.confirmar;botao.innerHTML=antes;}},{once:true});
  return false;
}

// Valores de um formulário pelo nome (os checkboxes viram true ou false).
export function ler(form) {
  const v={};
  for(const el of form.elements){
    if(!el.name||el.disabled||el.type==='submit'||el.type==='button')continue;
    if(el.type==='checkbox')v[el.name]=el.checked;
    else if(el.type==='radio'){if(el.checked)v[el.name]=el.value;}
    else v[el.name]=el.value;
  }
  return v;
}

// "Mostrar" a senha e "Copiar" um texto da página.
document.addEventListener('click',async ev=>{
  const mostrar=ev.target.closest('[data-mostrar-senha]');
  if(mostrar){
    const campo=mostrar.closest('.senha-caixa')?.querySelector('input');if(!campo)return;
    const ver=campo.type==='password';campo.type=ver?'text':'password';
    mostrar.textContent=ver?'Ocultar':'Mostrar';mostrar.setAttribute('aria-pressed',String(ver));
    return;
  }
  const copiar=ev.target.closest('[data-copiar]');
  if(copiar){
    const alvo=$(copiar.dataset.copiar);if(!alvo)return;
    const textoAlvo=alvo.matches('ol,ul')?$$('li',alvo).map(li=>li.textContent.trim()).join('\n'):alvo.textContent.trim();
    try{await navigator.clipboard.writeText(textoAlvo);const antes=copiar.textContent;copiar.textContent='Copiado';anunciar('Copiado.');setTimeout(()=>{copiar.textContent=antes;},2000);}
    catch{anunciar('Não deu para copiar. Selecione o texto e copie à mão.');}
  }
});
