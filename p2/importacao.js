// Importação (contrato 8): o envio do CSV como corpo binário e a prévia, onde cada mudança de linha responde com a
// Importacao inteira e a version nova. Depois de cada escrita a página recarrega e volta à linha mexida.
import { $, $$, chamar, limparErros, mostrarErros, ocupar, irPara, avisar, segundoToque, anunciar } from './base.js';

const enc=encodeURIComponent;
const MAX=2*1024*1024;
const TIPOS=new Set(['text/csv','text/plain','application/vnd.ms-excel','application/octet-stream']);

// Envio ------------------------------------------------------------------------------------------------------------------
const envio=$('form[data-form="importacao"]');
envio?.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(envio);
  const tipo=envio.elements.tipo.value,arquivo=envio.elements.arquivo.files?.[0],erros=[];
  if(!tipo)erros.push({campo:'tipo',mensagem:'Escolha de onde vem o arquivo.'});
  if(!arquivo)erros.push({campo:'arquivo',mensagem:'Escolha o arquivo CSV.'});
  else if(arquivo.size>MAX)erros.push({campo:'arquivo',mensagem:'O arquivo pode ter até 2 MB.'});
  else if(!arquivo.size)erros.push({campo:'arquivo',mensagem:'O arquivo está vazio.'});
  if(erros.length)return mostrarErros(envio,erros);
  const solta=ocupar(envio.querySelector('[type="submit"]'),'Lendo o arquivo…');
  const r=await chamar('POST',`/api/importacoes?tipo=${enc(tipo)}`,arquivo,{bruto:true,tipo:TIPOS.has(arquivo.type)?arquivo.type:'text/csv'});
  if(r.ok)return irPara(`/importacao/${enc(r.dados.id)}`,r.status===201?'Prévia pronta. Confira as linhas antes de confirmar: nada foi gravado ainda.':'Este arquivo já tinha uma prévia aberta. Ela continua aqui, com o que você já tinha resolvido.');
  solta();
  mostrarErros(envio,[{campo:['arquivo','tipo'].includes(r.campo)?r.campo:'',mensagem:r.erro}]);
});

// Prévia -----------------------------------------------------------------------------------------------------------------
const previa=$('[data-importacao]');
const id=previa?.dataset.importacao,versao=()=>Number(previa?.dataset.version);
// PATCH de uma linha: a empresa (o id do guia ou null) ou o ignorar. Dá certo: recarrega e volta à linha.
async function mudarLinha(botao,n,corpo,mensagem) {
  const solta=ocupar(botao,'Salvando…');
  const r=await chamar('PATCH',`/api/importacoes/${enc(id)}/linhas/${enc(n)}`,{...corpo,version:versao()});
  if(r.ok)return irPara(location.href,mensagem,{alvo:`linha-${n}`});
  solta();avisar(`Linha ${n}: ${r.erro}`,{erro:true,recarregar:r.status===409});
}
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-empresa-linha]');
  if(!b||!previa)return;
  const n=b.dataset.empresaLinha,empresa=b.dataset.empresa||null;
  mudarLinha(b,n,{empresa},empresa?`Linha ${n}: empresa escolhida.`:`Linha ${n}: entra sem empresa do guia.`);
});
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-ignorar-linha]');
  if(!b||!previa)return;
  const n=b.dataset.ignorarLinha,ignorar=b.dataset.valor==='true';
  mudarLinha(b,n,{ignorar},ignorar?`Linha ${n}: ignorada. Ela não entra na carteira.`:`Linha ${n}: volta a entrar na importação.`);
});

// Buscar outra empresa no guia, para uma linha (a mesma busca do vínculo na ficha).
for(const caixa of $$('[data-buscar-linha]')){
  const n=caixa.dataset.buscarLinha,busca=$('[data-busca-empresa]',caixa),lista=$('[data-resultados]',caixa),status=$('[data-busca-status]',caixa);
  caixa.addEventListener('toggle',()=>{if(caixa.open)busca.elements.q.focus();});
  busca.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const q=busca.elements.q.value.trim();if(!q)return busca.elements.q.focus();
    lista.replaceChildren();status.textContent='Buscando…';
    const r=await chamar('GET',`/api/empresas-site?q=${enc(q)}`);
    const t=(tag,texto,cls)=>Object.assign(document.createElement(tag),{textContent:texto,...(cls?{className:cls}:{})});
    if(!r.ok){status.textContent='';lista.append(t('li',r.erro,'busca-vazia'));return;}
    const itens=r.dados?.itens||[];
    if(!itens.length){status.textContent='Nenhuma empresa encontrada.';lista.append(t('li','Nenhuma empresa do guia com esse nome.','busca-vazia'));return;}
    lista.replaceChildren(...itens.map(m=>{
      const li=t('li','','empresa');const info=document.createElement('div');
      info.append(t('p',m.nome,'empresa-nome'),t('p',[m.bairro,m.cliente?`já é do cliente ${m.cliente.nome}`:''].filter(Boolean).join(' · '),'empresa-apoio'));
      const acoes=t('div','','empresa-acoes'),b=t('button','Usar','botao secundario pequeno');b.type='button';
      b.dataset.empresaLinha=n;b.dataset.empresa=m.id;b.append(t('span',` ${m.nome} na linha ${n}`,'sr-only'));
      acoes.append(b);li.append(info,acoes);return li;
    }));
    status.textContent=`${itens.length} ${itens.length===1?'empresa encontrada':'empresas encontradas'}.`;
  });
}

// Filtro das linhas pelos números do resumo (sem JavaScript, todas aparecem).
const ROTULO={novo:'os novos',atualizar:'os atualizados','sem-empresa':'as sem empresa do guia',igual:'os iguais',ignorar:'os ignorados',erro:'as linhas com erro'};
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-filtro]');
  if(!b||!previa)return;
  const filtro=b.getAttribute('aria-pressed')==='true'?'':b.dataset.filtro,linhas=$$('.linha-importacao');
  for(const x of $$('.numeros-importacao [data-filtro]'))x.setAttribute('aria-pressed',String(x.dataset.filtro===filtro&&!!filtro));
  let vistas=0;
  for(const l of linhas){const ve=!filtro||(filtro==='sem-empresa'?l.classList.contains('is-sem-empresa'):l.dataset.acao===filtro);l.hidden=!ve;if(ve)vistas++;}
  const aviso=$('[data-filtro-aviso]');
  if(aviso){aviso.hidden=!filtro;$('[data-filtro-texto]',aviso).textContent=filtro?`Mostrando ${ROTULO[filtro]}: ${vistas} de ${linhas.length} linhas.`:'';}
  anunciar(filtro?`${vistas} linhas mostradas.`:'Todas as linhas mostradas.');
});

// Confirmar (segundo toque e a confirmação de identidade) e descartar (segundo toque).
$('[data-confirmar-importacao]')?.addEventListener('click',async ev=>{
  const b=ev.currentTarget;
  if(!segundoToque(b,'Toque de novo para gravar'))return;
  const solta=ocupar(b,'Gravando…');
  const r=await chamar('POST',`/api/importacoes/${enc(id)}/confirmar`,{version:versao()});
  if(r.ok)return irPara(location.href,'Importação confirmada. Os clientes e as assinaturas estão na carteira, e os planos vão para o guia em instantes.');
  solta();avisar(r.erro,{erro:true,recarregar:r.status===409});
});
$('[data-descartar-importacao]')?.addEventListener('click',async ev=>{
  const b=ev.currentTarget;
  if(!segundoToque(b,'Toque de novo para descartar'))return;
  const solta=ocupar(b,'Descartando…');
  const r=await chamar('DELETE',`/api/importacoes/${enc(id)}`);
  if(r.ok)return irPara('/importacao','Prévia descartada. Nada foi gravado.');
  solta();avisar(r.erro,{erro:true,recarregar:r.status===409});
});
