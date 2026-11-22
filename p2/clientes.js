// Carteira (contrato 6.7 a 6.9 e 7.5): a ficha do cliente (vincular e desvincular empresas do guia, estornar pagamentos e
// registrar o envio do relatório do mês),
// o formulário do cliente e o da assinatura. Toda escrita leva a version lida; quando dá certo, a página vai para a ficha
// (ou recarrega) com a confirmação no topo.
import { $, $$, chamar, limparErros, mostrarErros, falha, ocupar, ler, centavos, reais, irPara, avisar, segundoToque, anunciar } from './base.js';

const enc=encodeURIComponent;
const versao=v=>/^\d+$/.test(String(v??''))?Number(v):v;
const ficha=$('[data-ficha]');

// Ficha: vincular empresa do guia ---------------------------------------------------------------------------------------
const caixaVinculo=$('[data-vincular]');
if(caixaVinculo){
  const busca=$('[data-busca-empresa]',caixaVinculo),lista=$('[data-resultados]',caixaVinculo),status=$('[data-busca-status]',caixaVinculo),cliente=caixaVinculo.dataset.cliente;
  const item=m=>{
    const li=document.createElement('li');li.className='empresa';
    const img=m.miniatura?Object.assign(document.createElement('img'),{className:'miniatura',src:m.miniatura,alt:'',width:48,height:48,loading:'lazy'}):Object.assign(document.createElement('span'),{className:'miniatura is-iniciais',textContent:(m.nome||'?').split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase()});
    if(!m.miniatura)img.setAttribute('aria-hidden','true');
    const info=document.createElement('div');
    // O plano vem como {id, nome} (v0.8.1); um plano que o site não lista vem com o id no lugar do nome.
    const plano=m.plano&&typeof m.plano==='object'?m.plano.nome||m.plano.id:m.plano;
    info.append(Object.assign(document.createElement('p'),{className:'empresa-nome',textContent:m.nome}),Object.assign(document.createElement('p'),{className:'empresa-apoio',textContent:[m.bairro,plano?`plano ${plano}`:''].filter(Boolean).join(' · ')}));
    const acoes=document.createElement('div');acoes.className='empresa-acoes';
    if(m.cliente){
      acoes.append(Object.assign(document.createElement('p'),{className:'empresa-apoio',textContent:m.cliente.id===cliente?'Já vinculada a este cliente':`Já é do cliente ${m.cliente.nome}`}));
    }else{
      const b=Object.assign(document.createElement('button'),{type:'button',className:'botao secundario pequeno',textContent:'Vincular'});
      b.append(Object.assign(document.createElement('span'),{className:'sr-only',textContent:` ${m.nome}`}));
      b.addEventListener('click',async()=>{
        const solta=ocupar(b,'Vinculando…');
        const r=await chamar('POST',`/api/clientes/${enc(cliente)}/empresas/${enc(m.id)}`,{});
        if(r.ok)return irPara(location.href,`${m.nome} vinculada ao cliente.`);
        solta();avisar(r.erro,{erro:true});
      });
      acoes.append(b);
    }
    li.append(img,info,acoes);return li;
  };
  busca.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const q=busca.elements.q.value.trim();
    if(!q){busca.elements.q.focus();return;}
    lista.replaceChildren();lista.setAttribute('aria-busy','true');status.textContent='Buscando…';
    const r=await chamar('GET',`/api/empresas-site?q=${enc(q)}`);
    lista.removeAttribute('aria-busy');
    if(!r.ok){status.textContent=r.erro;const li=Object.assign(document.createElement('li'),{className:'busca-vazia',textContent:r.erro});lista.append(li);return;}
    const itens=r.dados?.itens||[],total=Math.max(Number(r.dados?.total)||0,itens.length);
    if(!itens.length){lista.append(Object.assign(document.createElement('li'),{className:'busca-vazia',textContent:'Nenhuma empresa do guia com esse nome. Confira a grafia, ou se a empresa já está cadastrada no guia.'}));status.textContent='Nenhuma empresa encontrada.';return;}
    lista.replaceChildren(...itens.map(item));
    // A busca traz uma página (20 empresas): com mais, a tela diz quantas são e pede um nome mais completo.
    const mais=total>itens.length?`Mostrando ${itens.length} de ${total}. Escreva mais do nome para achar a empresa.`:'';
    if(mais)lista.append(Object.assign(document.createElement('li'),{className:'busca-vazia',textContent:mais}));
    status.textContent=`${total} ${total===1?'empresa encontrada':'empresas encontradas'}.${mais?` ${mais}`:''}`;
  });
  caixaVinculo.addEventListener('toggle',()=>{if(caixaVinculo.open)busca.elements.q.focus();});
}

// Ficha: desvincular (segundo toque) e estornar (com motivo e a confirmação de identidade) ---------------------------------
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-desvincular]');
  if(!b||!ficha)return;
  if(!segundoToque(b,'Toque de novo para desvincular'))return;
  const solta=ocupar(b,'Desvinculando…');
  const r=await chamar('DELETE',`/api/clientes/${enc(ficha.dataset.ficha)}/empresas/${enc(b.dataset.desvincular)}`);
  if(r.ok)return irPara(location.href,'Empresa desvinculada. O guia volta a decidir o plano dela.');
  solta();avisar(r.erro,{erro:true});
});
for(const form of $$('form[data-form="estorno"]'))form.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(form);
  const motivo=form.elements.motivo.value.trim();
  if(motivo.length<3)return mostrarErros(form,[{campo:'motivo',mensagem:'Conte o motivo em poucas palavras.'}]);
  const solta=ocupar(form.querySelector('[type="submit"]'),'Estornando…');
  const r=await chamar('POST',`/api/pagamentos/${enc(form.dataset.id)}/estornar`,{motivo});
  if(r.ok){const d=r.dados?.assinatura;return irPara(location.href,`Pagamento estornado.${d?.venceEm?` O vencimento voltou para ${d.venceEm.split('-').reverse().join('/')}.`:''}`);}
  solta();falha(form,r);
});

// Ficha: enviar o relatório do mês (7.4, v0.11.0). Como na cobrança, o link abre o WhatsApp na aba nova pelo próprio
// navegador (o toque é da pessoa) e, ao mesmo tempo, o envio é registrado. Se o registro falhar, a mensagem já abriu do
// mesmo jeito, e a tela avisa. O envio aparece na linha do tempo quando a ficha recarrega.
document.addEventListener('click',async ev=>{
  const link=ev.target.closest('a[data-enviar-relatorio]');
  if(!link||ev.button>0||!ficha)return;
  const envio=$('[data-ultimo-envio]',link.closest('.empresa'));
  const r=await chamar('POST',`/api/clientes/${enc(ficha.dataset.ficha)}/empresas/${enc(link.dataset.enviarRelatorio)}/relatorios`,{mes:link.dataset.mes});
  if(r.ok){
    if(envio)envio.textContent=`Relatório enviado agora${r.dados?.por?.nome?` por ${r.dados.por.nome}`:''}`;
    anunciar('Envio do relatório registrado.');
  }else avisar(`A simulação da mensagem abriu, mas o envio do relatório não foi registrado: ${r.erro}`,{erro:true,foco:false});
});

// Cliente: criar, editar, encerrar e reabrir ----------------------------------------------------------------------------
const formCliente=$('form[data-form="cliente"]');
formCliente?.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(formCliente);
  const v=ler(formCliente),novo='novo' in formCliente.dataset;
  if(v.nome.trim().length<2)return mostrarErros(formCliente,[{campo:'nome',mensagem:'Informe o nome do cliente.'}]);
  const corpo={nome:v.nome.trim(),responsavel:v.responsavel.trim(),whatsapp:v.whatsapp.trim(),email:v.email.trim(),notas:v.notas.trim()};
  if(!novo)corpo.version=versao(v.version);
  const solta=ocupar(formCliente.querySelector('[type="submit"]'));
  const r=novo?await chamar('POST','/api/clientes',corpo):await chamar('PATCH',`/api/clientes/${enc(formCliente.dataset.id)}`,corpo);
  if(r.ok)return irPara(`/clientes/${enc(r.dados.id)}`,novo?'Cliente cadastrado. Agora vincule as empresas do guia.':'Cliente salvo.');
  solta();falha(formCliente,r);
});
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-situacao-cliente]');
  if(!b)return;
  const encerrar=b.dataset.situacaoCliente==='encerrado';
  if(encerrar&&!segundoToque(b,'Toque de novo para encerrar'))return;
  const solta=ocupar(b,encerrar?'Encerrando…':'Reabrindo…');
  const r=await chamar('PATCH',`/api/clientes/${enc(b.dataset.id)}`,{status:b.dataset.situacaoCliente,version:versao(b.dataset.version)});
  if(r.ok)return irPara(`/clientes/${enc(b.dataset.id)}`,encerrar?'Cliente encerrado.':'Cliente reaberto.');
  solta();avisar(r.erro,{erro:true,recarregar:r.status===409});
});

// Assinatura: criar e editar, com o preço do plano e o vencimento sugeridos ---------------------------------------------
const formAssinatura=$('form[data-form="assinatura"]');
if(formAssinatura){
  const f=formAssinatura.elements,nova='novo' in formAssinatura.dataset;
  let sugerido=null;
  // Escolher o plano sugere o preço dele, quando o valor está vazio ou ainda é o que a tela sugeriu.
  f.plano?.addEventListener('change',()=>{
    const preco=f.plano.selectedOptions[0]?.dataset.preco;
    if(!preco)return;
    const atual=centavos(f.valorCentavos.value);
    if(f.valorCentavos.value.trim()===''||atual===sugerido){f.valorCentavos.value=reais(Number(preco)).replace('R$ ','');sugerido=Number(preco);anunciar(`Valor sugerido: ${reais(Number(preco))}.`);}
  });
  // Na criação, o vencimento sugerido é o início mais um ciclo (o mesmo dia; no mês sem esse dia, o último).
  const MESES={mensal:1,trimestral:3,semestral:6,anual:12};
  const somar=(d,m)=>{const [a,mes,dd]=d.split('-').map(Number),t=a*12+mes-1+m,ano=Math.floor(t/12),mm=t-ano*12+1,ult=new Date(Date.UTC(ano,mm,0)).getUTCDate();return `${ano}-${String(mm).padStart(2,'0')}-${String(Math.min(dd,ult)).padStart(2,'0')}`;};
  let venceSugerido='';
  const sugerirVencimento=()=>{
    if(!nova||!f.inicio.value)return;
    if(f.venceEm.value&&f.venceEm.value!==venceSugerido)return;
    venceSugerido=somar(f.inicio.value,MESES[f.ciclo.value]||1);f.venceEm.value=venceSugerido;
  };
  f.inicio?.addEventListener('change',sugerirVencimento);f.ciclo?.addEventListener('change',sugerirVencimento);
  formAssinatura.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(formAssinatura);
    const v=ler(formAssinatura),erros=[],valor=centavos(v.valorCentavos);
    const editaveis=$$('[data-antes]',formAssinatura).filter(el=>!el.disabled);
    if(nova||editaveis.some(el=>el.name!=='notas')){
      if(!v.plano)erros.push({campo:'plano',mensagem:'Escolha um plano do guia.'});
      if(valor===null||Number.isNaN(valor))erros.push({campo:'valorCentavos',mensagem:'Informe o valor, como 99,00.'});
      if(!v.inicio)erros.push({campo:'inicio',mensagem:'Informe o início.'});
      if(!v.venceEm)erros.push({campo:'venceEm',mensagem:'Informe o vencimento.'});
      else if(v.inicio&&v.venceEm<v.inicio)erros.push({campo:'venceEm',mensagem:'O vencimento não pode ser antes do início.'});
    }
    if(erros.length)return mostrarErros(formAssinatura,erros);
    const corpo={};
    const campos={empresa:v.empresa||null,plano:v.plano,valorCentavos:valor,ciclo:v.ciclo,inicio:v.inicio,venceEm:v.venceEm,notas:(v.notas||'').trim()};
    if(nova){Object.assign(corpo,{cliente:v.cliente,...campos});if(!corpo.empresa)delete corpo.empresa;if(!corpo.notas)delete corpo.notas;}
    else{
      // Na edição, só os campos que mudaram (a cancelada só aceita as notas).
      for(const el of editaveis){
        const antes=el.dataset.antes,agora=el.name==='valorCentavos'?valor:el.name==='empresa'?(el.value||null):el.value.trim?.()??el.value;
        const mudou=el.name==='valorCentavos'?centavos(antes)!==valor:String(antes)!==String(agora??'');
        if(mudou)corpo[el.name]=campos[el.name];
      }
      if(!Object.keys(corpo).length)return avisar('Nada mudou desde que você abriu.');
      corpo.version=versao(v.version);
    }
    const solta=ocupar(formAssinatura.querySelector('[type="submit"]'));
    const r=nova?await chamar('POST','/api/assinaturas',corpo):await chamar('PATCH',`/api/assinaturas/${enc(formAssinatura.dataset.id)}`,corpo);
    if(r.ok)return irPara(`/clientes/${enc(formAssinatura.dataset.cliente)}`,nova?'Assinatura criada. O plano vai para o guia em instantes.':'Assinatura salva.');
    solta();falha(formAssinatura,r);
  });
}

// Assinatura: suspender, reativar e cancelar (com o motivo e o segundo toque) -------------------------------------------
const acaoSituacao=async(botao,url,corpo,mensagem,form)=>{
  const solta=ocupar(botao,'Salvando…');
  const r=await chamar('POST',url,corpo);
  if(r.ok)return irPara(location.href,mensagem);
  solta();form?falha(form,r):avisar(r.erro,{erro:true,recarregar:r.status===409});
};
$('form[data-form="suspender"]')?.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.currentTarget,motivo=form.elements.motivo.value.trim();
  acaoSituacao(form.querySelector('[type="submit"]'),`/api/assinaturas/${enc(form.dataset.id)}/suspender`,{...(motivo?{motivo}:{}),version:versao(form.dataset.version)},'Assinatura suspensa. O plano pago sai do guia em instantes.',form);
});
$('[data-reativar]')?.addEventListener('click',ev=>{
  const b=ev.currentTarget;
  acaoSituacao(b,`/api/assinaturas/${enc(b.dataset.reativar)}/reativar`,{version:versao(b.dataset.version)},'Assinatura reativada. O vencimento continua o mesmo.');
});
$('form[data-form="cancelar"]')?.addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.currentTarget,botao=form.querySelector('[type="submit"]');limparErros(form);
  const motivo=form.elements.motivo.value.trim(),data=form.elements.canceladaEm.value;
  if(motivo.length<3)return mostrarErros(form,[{campo:'motivo',mensagem:'Conte o motivo em poucas palavras.'}]);
  if(!segundoToque(botao,'Toque de novo para cancelar'))return;
  acaoSituacao(botao,`/api/assinaturas/${enc(form.dataset.id)}/cancelar`,{motivo,...(data?{canceladaEm:data}:{}),version:versao(form.dataset.version)},'Assinatura cancelada.',form);
});
