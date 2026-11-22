// Administração (contrato 7.3 e 7.6): a Equipe (convidar, editar, desativar, link de senha e redefinir o 2FA) e as
// Configurações (só os campos que mudaram, com a pré-visualização da mensagem montada no navegador pela regra do servidor).
// O link do convite e o de senha aparecem só na tela, para mandar pelo WhatsApp: não ficam guardados no navegador.
import { $, $$, chamar, limparErros, mostrarErros, falha, ocupar, ler, irPara, avisar, segundoToque, anunciar } from './base.js';

const enc=encodeURIComponent;
const versao=v=>/^\d+$/.test(String(v??''))?Number(v):v;
const quando=v=>{const d=new Date(v||'');return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(', ',' às ');};

// O link de uso único: o endereço num campo só de leitura, "Copiar o link" e "Mandar pelo WhatsApp".
function mostrarLink(caixa,{link,expira,tipo,nome}) {
  const t=(tag,texto,cls)=>Object.assign(document.createElement(tag),{textContent:texto,...(cls?{className:cls}:{})});
  const titulo=t('p',`${tipo==='senha'?'Link de senha':'Convite'}${nome?` de ${nome}`:''}: vale até ${quando(expira)}. Ele funciona uma vez só, e um link novo desfaz os anteriores.`,'link-titulo');
  const id=`link-${Math.random().toString(36).slice(2)}`;
  const rotulo=Object.assign(t('label','Link'),{htmlFor:id});
  const campo=Object.assign(document.createElement('input'),{type:'text',readOnly:true,value:link,id});
  campo.addEventListener('focus',()=>campo.select());
  const copiar=t('button','Copiar o link','botao secundario');copiar.type='button';
  copiar.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);copiar.textContent='Copiado';anunciar('Link copiado.');}catch{campo.select();anunciar('Selecione o link e copie à mão.');}});
  const zap=Object.assign(t('a','Mandar pelo WhatsApp ↗','botao whatsapp'),{href:`https://wa.me/?text=${enc(`Gestão Nexus: ${link}`)}`,target:'_blank',rel:'noopener'});
  const linha=document.createElement('div');linha.className='link-linha';linha.append(campo,copiar);
  const acoes=document.createElement('div');acoes.className='vazio-acoes';acoes.append(zap);
  caixa.replaceChildren(titulo,rotulo,linha,acoes);caixa.hidden=false;caixa.tabIndex=-1;caixa.focus();
}

// Convidar: o e-mail, o nome e o papel; a resposta traz o link do convite.
const convite=$('form[data-form="convite"]');
convite?.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(convite);
  const v=ler(convite),erros=[];
  if(!v.nome.trim())erros.push({campo:'nome',mensagem:'Informe o nome.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))erros.push({campo:'email',mensagem:'Informe um e-mail válido.'});
  if(erros.length)return mostrarErros(convite,erros);
  const solta=ocupar(convite.querySelector('[type="submit"]'),'Criando…');
  const r=await chamar('POST','/api/equipe',{email:v.email.trim(),nome:v.nome.trim(),papel:v.papel});
  solta();
  if(!r.ok)return falha(convite,r);
  convite.reset();convite.closest('details').open=false;
  mostrarLink($('[data-link-resultado="convite"]'),{link:r.dados.link,expira:r.dados.expira,tipo:'convite',nome:r.dados.membro?.nome});
  avisar(`Convite criado para ${r.dados.membro?.nome||v.nome}. Copie o link e mande pelo WhatsApp; ele aparece na lista quando você recarregar.`,{foco:false});
});

// Editar nome e papel: só o que mudou (a presença do papel já pede a confirmação de identidade).
for(const form of $$('form[data-form="membro"]'))form.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(form);
  const corpo={};
  for(const el of $$('[data-antes]',form))if(el.value.trim()!==el.dataset.antes)corpo[el.name]=el.value.trim();
  if('nome' in corpo&&!corpo.nome)return mostrarErros(form,[{campo:'nome',mensagem:'Informe o nome.'}]);
  if(!Object.keys(corpo).length)return avisar('Nada mudou.');
  corpo.version=versao(form.dataset.version);
  const solta=ocupar(form.querySelector('[type="submit"]'));
  const r=await chamar('PATCH',`/api/equipe/${enc(form.dataset.id)}`,corpo);
  if(r.ok)return irPara(location.href,corpo.papel?'Papel salvo. Vale a partir da próxima tela que a pessoa abrir.':'Nome salvo.');
  solta();falha(form,r);
});

document.addEventListener('click',async ev=>{
  // Desativar e reativar: desativar pede o segundo toque e encerra as sessões da pessoa.
  const desativar=ev.target.closest('[data-desativar]');
  if(desativar){
    const valor=desativar.dataset.valor==='true';
    if(valor&&!segundoToque(desativar,'Toque de novo para desativar'))return;
    const solta=ocupar(desativar,valor?'Desativando…':'Reativando…');
    const r=await chamar('PATCH',`/api/equipe/${enc(desativar.dataset.desativar)}`,{desativado:valor,version:versao(desativar.dataset.version)});
    if(r.ok)return irPara(location.href,valor?'Conta desativada. As sessões dela foram encerradas.':'Conta reativada, com a mesma senha e o mesmo 2FA.');
    solta();return avisar(r.erro,{erro:true,recarregar:r.status===409});
  }
  // Link de senha (ou convite novo, para quem ainda não definiu a senha).
  const link=ev.target.closest('[data-link-senha]');
  if(link){
    const solta=ocupar(link,'Gerando…');
    const r=await chamar('POST',`/api/equipe/${enc(link.dataset.linkSenha)}/link-senha`,{});
    solta();
    if(!r.ok)return avisar(r.erro,{erro:true});
    const nome=link.closest('.membro')?.querySelector('.membro-nome')?.firstChild?.textContent?.trim();
    return mostrarLink($(`[data-link-resultado="${CSS.escape(link.dataset.linkSenha)}"]`),{...r.dados,nome});
  }
  // Redefinir o 2FA: segundo toque; a pessoa configura de novo no próximo login.
  const zerar=ev.target.closest('[data-redefinir-2fa]');
  if(zerar){
    if(!segundoToque(zerar,'Toque de novo para redefinir o 2FA'))return;
    const solta=ocupar(zerar,'Redefinindo…');
    const r=await chamar('POST',`/api/equipe/${enc(zerar.dataset.redefinir2fa)}/redefinir-2fa`,{version:versao(zerar.dataset.version)});
    if(r.ok)return irPara(location.href,'2FA redefinido. As sessões da pessoa foram encerradas, e ela configura o autenticador de novo no próximo login.');
    solta();avisar(r.erro,{erro:true,recarregar:r.status===409});
  }
});

// Configurações: a pré-visualização ao vivo e o salvar só do que mudou -------------------------------------------------
const config=$('form[data-form="configuracoes"]');
// Um modelo com as pílulas e a prévia do mesmo bloco (a cobrança, uma etapa da régua ou o relatório do mês). Como no
// servidor (7.3): só as variáveis da lista; a {desempenho} vazia sai junto com o espaço antes dela ou, sem ele, com o espaço
// depois. A escolha "sem a frase" mostra a mensagem de quem não tem medição; ela só aparece quando o modelo usa a variável.
// fonte: o texto que a prévia mostra (a etapa sem mensagem própria mostra a de cobrança); depois: o que mais acompanha.
function editor(modelo,{chaves,exemplos,extra=()=>({}),fonte=()=>modelo.value,depois=()=>{}}) {
  const bloco=modelo.closest('[data-modelo-bloco]')||modelo.closest('fieldset'),balao=$('[data-previa]',bloco),opcao=$('[data-previa-desempenho]',bloco);
  const preencher=()=>{
    const valores={...exemplos,...extra()},original=fonte();let texto=original;
    if(chaves.has('desempenho')&&(opcao?.querySelector('input:checked')?.value==='sem'||!valores.desempenho)){valores.desempenho='';texto=texto.replace(/ \{desempenho\}|\{desempenho\} ?/g,'');}
    balao.textContent=texto.replace(/\{(\w+)\}/g,(m,k)=>chaves.has(k)&&k in valores?String(valores[k]??''):m);
    if(opcao)opcao.hidden=!/\{desempenho\}/.test(original);
    depois();
  };
  modelo.addEventListener('input',preencher);opcao?.addEventListener('change',preencher);
  // As pílulas das variáveis inserem a variável onde está o cursor do modelo.
  for(const b of $$('[data-variavel]',bloco))b.addEventListener('click',()=>{
    const v=`{${b.dataset.variavel}}`,ini=modelo.selectionStart??modelo.value.length,fim=modelo.selectionEnd??ini;
    modelo.setRangeText(v,ini,fim,'end');modelo.focus();preencher();anunciar(`${v} inserida no modelo.`);
  });
  return preencher;
}
const desconhecida=(t,chaves)=>[...t.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).find(k=>!chaves.has(k));
if(config){
  const chaves=new Set((config.dataset.variaveis||'').split(',').filter(Boolean));
  let exemplos={};try{exemplos=JSON.parse(config.closest('[data-exemplos]').dataset.exemplos||'{}');}catch{/* sem exemplos */}
  const modelo=config.elements.modeloMensagem,pix=config.elements.chavePix;
  // Na cobrança, a chave Pix da prévia é a do campo, como sai sem ela.
  pix.addEventListener('input',editor(modelo,{chaves,exemplos,extra:()=>({chave_pix:pix.value.trim()})}));
  // As mensagens das etapas da régua (15.4, v0.14.0): vazia, a etapa mostra a de cobrança, e a prévia acompanha também o
  // modelo de cobrança e a chave Pix. O resumo de cada etapa diz se ela tem mensagem própria.
  const blocoRegua=$('[data-modelos-lembrete]',config);
  let estados=['',''];try{estados=JSON.parse(blocoRegua?.dataset.estados||'[]');}catch{/* sem os textos: o resumo fica como veio */}
  const etapas=$$('textarea[data-etapa]',config);
  for(const area of etapas) {
    const bloco=area.closest('[data-modelo-bloco]'),estado=$('[data-estado-etapa]',bloco),origem=$('[data-previa-origem]',bloco);
    const preencher=editor(area,{chaves,exemplos,extra:()=>({chave_pix:pix.value.trim(),prazo:bloco.dataset.prazo}),fonte:()=>area.value.trim()?area.value:modelo.value,
      depois:()=>{const proprio=Boolean(area.value.trim());if(origem)origem.hidden=proprio;if(estado&&estados[1]){estado.textContent=estados[proprio?1:0];estado.classList.toggle('is-proprio',proprio);}}});
    modelo.addEventListener('input',preencher);pix.addEventListener('input',preencher);
  }
  // O relatório do mês (v0.11.0): as variáveis e os exemplos vêm no próprio bloco.
  const blocoRelatorio=$('[data-modelo-relatorio]',config),relatorio=config.elements.modeloRelatorio;
  const chavesRelatorio=new Set((blocoRelatorio?.dataset.variaveis||'').split(',').filter(Boolean));
  if(blocoRelatorio&&relatorio){let ex={};try{ex=JSON.parse(blocoRelatorio.dataset.exemplos||'{}');}catch{/* sem exemplos */}editor(relatorio,{chaves:chavesRelatorio,exemplos:ex});}
  config.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(config);
    const v=ler(config),erros=[],t=v.modeloMensagem;
    if(t.length<20||t.length>1000)erros.push({campo:'modeloMensagem',mensagem:'Use de 20 a 1.000 caracteres.'});
    const estranha=desconhecida(t,chaves);
    if(estranha)erros.push({campo:'modeloMensagem',mensagem:`Variável desconhecida: {${estranha}}.`});
    // O modelo do relatório: de 20 a 1.000 caracteres, só com as variáveis dele e com o {link}, que leva ao relatório.
    const tr=relatorio?v.modeloRelatorio:'',estranhaRelatorio=relatorio&&desconhecida(tr,chavesRelatorio);
    if(relatorio&&(tr.length<20||tr.length>1000))erros.push({campo:'modeloRelatorio',mensagem:'Use de 20 a 1.000 caracteres.'});
    else if(estranhaRelatorio)erros.push({campo:'modeloRelatorio',mensagem:`Variável desconhecida: {${estranhaRelatorio}}.`});
    else if(relatorio&&chavesRelatorio.has('link')&&!/\{link\}/.test(tr))erros.push({campo:'modeloRelatorio',mensagem:'Ponha o {link} na mensagem: é por ele que o cliente abre o relatório.'});
    if(/[\r\n]/.test(v.chavePix)||v.chavePix.trim().length>77)erros.push({campo:'chavePix',mensagem:'Use até 77 caracteres, numa linha só.'});
    // WhatsApp como em 7.2: vazio, ou o DDD e o número (com ou sem o 55); a API confere de novo e guarda só os dígitos.
    const zap=v.whatsappAtendimento.trim(),digitos=zap.replace(/\D/g,'');
    if(zap&&(!/^\+?[\d\s().-]+$/.test(zap)||!(digitos.length===10||digitos.length===11||/^55\d{10,11}$/.test(digitos))))erros.push({campo:'whatsappAtendimento',mensagem:'Informe o WhatsApp com DDD, como (21) 98765-4321.'});
    const dias=Number(v.toleranciaDias);
    if(!Number.isInteger(dias)||dias<0||dias>60)erros.push({campo:'toleranciaDias',mensagem:'Use de 0 a 60 dias.'});
    // As etapas: vazia tira a mensagem própria; com texto, as mesmas regras do modelo de cobrança (7.2).
    const lembretes={};
    for(const area of etapas) {
      const te=area.value.trim(),campo=area.name,estranhaEtapa=desconhecida(te,chaves);
      if(te&&(te.length<20||te.length>1000))erros.push({campo,mensagem:'Use de 20 a 1.000 caracteres.'});
      else if(estranhaEtapa)erros.push({campo,mensagem:`Variável desconhecida: {${estranhaEtapa}}.`});
      else if(te!==area.dataset.antes)lembretes[area.dataset.etapa]=te;
    }
    if(erros.length)return mostrarErros(config,erros);
    const corpo={};
    if(v.chavePix.trim()!==pix.dataset.antes)corpo.chavePix=v.chavePix.trim();
    if(zap!==config.elements.whatsappAtendimento.dataset.antes)corpo.whatsappAtendimento=zap;
    if(t!==modelo.dataset.antes)corpo.modeloMensagem=t;
    if(relatorio&&tr!==relatorio.dataset.antes)corpo.modeloRelatorio=tr;
    if(String(dias)!==config.elements.toleranciaDias.dataset.antes)corpo.toleranciaDias=dias;
    if(Object.keys(lembretes).length)corpo.modelosLembrete=lembretes;
    if(!Object.keys(corpo).length)return avisar('Nada mudou.');
    corpo.version=versao(v.version);
    const solta=ocupar(config.querySelector('[type="submit"]'));
    const r=await chamar('PATCH','/api/configuracoes',corpo);
    const salvo='chavePix' in corpo||'whatsappAtendimento' in corpo?'Configurações salvas. A "Minha assinatura" das empresas no guia é atualizada em seguida.'
      :'modeloRelatorio' in corpo&&!('modeloMensagem' in corpo)?'Configurações salvas. Os próximos relatórios do mês já saem com essa mensagem.'
      :'modelosLembrete' in corpo&&!('modeloMensagem' in corpo)?'Configurações salvas. Os próximos lembretes da régua já saem com essas mensagens.':'Configurações salvas. As próximas mensagens de cobrança já saem assim.';
    if(r.ok)return irPara(location.href,salvo);
    solta();falha(config,r);
  });
}
