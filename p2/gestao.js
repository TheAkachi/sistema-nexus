// Moldura das telas com sessão: o menu em gaveta abaixo de 1024 px, o "Sair", a confirmação guardada da página anterior e
// o "Cobrar no WhatsApp" (contrato 7.4), que vale em toda tela que mostra a linha de renovação.
import { $, $$, chamar, avisar, avisoGuardado, sair, anunciar, irPara } from './base.js';

document.documentElement.classList.add('js');

// Gaveta: abre pelo botão Menu, fecha pelo X, pelo fundo, pelo Esc e ao escolher um item. Aberta, o resto da página fica
// inerte (o Tab não sai dela) e o foco volta ao botão quando ela fecha.
const menu=$('#menu'),abrir=$('[data-menu-abrir]'),fechar=$('[data-menu-fechar]'),fundo=$('[data-menu-fundo]');
const estreita=matchMedia('(max-width: 1023.98px)');
const resto=()=>[$('.pular'),$('.topo'),$('#conteudo')].filter(Boolean);
function abrirMenu() {
  if(!menu)return;
  menu.classList.add('is-aberto');document.documentElement.classList.add('menu-aberto');
  abrir?.setAttribute('aria-expanded','true');if(fundo)fundo.hidden=false;
  for(const el of resto())el.inert=true;
  ($('a[aria-current]',menu)||$('a',menu))?.focus();
}
function fecharMenu({foco=true}={}) {
  if(!menu?.classList.contains('is-aberto'))return;
  menu.classList.remove('is-aberto');document.documentElement.classList.remove('menu-aberto');
  abrir?.setAttribute('aria-expanded','false');if(fundo)fundo.hidden=true;
  for(const el of resto())el.inert=false;
  if(foco)abrir?.focus();
}
abrir?.addEventListener('click',()=>menu?.classList.contains('is-aberto')?fecharMenu():abrirMenu());
fechar?.addEventListener('click',()=>fecharMenu());
fundo?.addEventListener('click',()=>fecharMenu());
menu?.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&estreita.matches){ev.stopPropagation();fecharMenu();}});
menu?.addEventListener('click',ev=>{if(ev.target.closest('a')&&estreita.matches)fecharMenu({foco:false});});
estreita.addEventListener('change',()=>fecharMenu({foco:false}));

// Sair: encerra a sessão (com o CSRF) e vai para o Entrar.
for(const b of $$('[data-sair]'))b.addEventListener('click',async()=>{
  b.disabled=true;
  const r=await chamar('POST','/api/auth/logout',{});
  if(r.ok||r.status===401)return sair('/entrar?motivo=saiu');
  b.disabled=false;avisar(r.erro,{erro:true});
});

// A confirmação que a página anterior deixou ("Cliente salvo.", "Pago. Próximo vencimento: …").
const guardado=avisoGuardado();
// Com alvo, a página volta ao elemento mexido (a linha da prévia) e o foco fica nele; o aviso é lido pela região de status.
if(guardado){
  const alvo=guardado.alvo&&document.getElementById(guardado.alvo);
  avisar(guardado.mensagem,{erro:guardado.erro,foco:!alvo});
  if(alvo){alvo.scrollIntoView({block:'center'});alvo.focus({preventScroll:true});}
}

// Cobrar (e Lembrar) no WhatsApp: o link abre na aba nova pelo próprio navegador (o toque é da pessoa) e, ao mesmo tempo,
// o contato é registrado. Se o registro falhar, a mensagem já abriu do mesmo jeito, e a tela avisa.
document.addEventListener('click',async ev=>{
  const link=ev.target.closest('a[data-cobrar]');
  if(!link||ev.button>0)return;
  const linha=link.closest('[data-assinatura]'),contato=linha&&$('[data-ultimo-contato]',linha);
  const r=await chamar('POST',`/api/assinaturas/${encodeURIComponent(link.dataset.cobrar)}/contatos`,{});
  if(!r.ok)return avisar(`A mensagem abriu no WhatsApp, mas o contato não foi registrado: ${r.erro}`,{erro:true,foco:false});
  const lembrete=r.dados?.tipo==='lembrete';
  if(linha?.parentElement?.matches('[data-lembrar]'))return saiDoLembrar(linha);
  if(contato)contato.textContent=`${lembrete?'Lembrado':'Cobrado'} agora${r.dados?.por?.nome?` por ${r.dados.por.nome}`:''}`;
  anunciar(lembrete?'Lembrete registrado.':'Contato registrado.');
});

// "Lembrar hoje" (contrato 15.2): o lembrete registrado tira a assinatura da lista. O foco vai para o próximo item (ou o
// anterior), e a contagem da aba e a da lista acompanham. A última da página recarrega a lista, que já vem certa do servidor
// (a próxima página, ou o "Ninguém para lembrar hoje").
function saiDoLembrar(linha) {
  const nome=$('h3',linha)?.textContent?.trim()||'A assinatura';
  const vizinha=linha.nextElementSibling||linha.previousElementSibling;
  if(!vizinha)return irPara(location.href,`Lembrete registrado. ${nome} saiu de "Lembrar hoje".`);
  linha.remove();
  const menos=el=>{if(!el)return;const n=Number(String(el.textContent).replace(/\D/g,''));if(Number.isFinite(n)&&n>0)el.textContent=(n-1).toLocaleString('pt-BR');};
  menos($('[data-lembrar-n]'));menos($('.abas a[aria-current] .aba-contagem'));
  $('h3 a',vizinha)?.focus();
  anunciar(`Lembrete registrado. ${nome} saiu de "Lembrar hoje".`);
}
