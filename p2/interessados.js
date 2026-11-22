// Interessados (contrato 14.4, v0.13.0): o "Buscar agora" da lista, a edição do pedido (só o que mudou, com a version lida)
// e o "Virar cliente", que leva à ficha do cliente novo. Quando dá certo, a página vai para o destino com a confirmação no topo.
import { $, chamar, limparErros, mostrarErros, falha, ocupar, ler, irPara, avisar } from './base.js';

const enc=encodeURIComponent;
const versao=v=>/^\d+$/.test(String(v??''))?Number(v):v;

// Buscar agora: lê na hora os pedidos novos do guia. A resposta diz quantos chegaram, ou o erro da leitura.
$('[data-buscar-leads]')?.addEventListener('click',async ev=>{
  const solta=ocupar(ev.currentTarget,'Buscando…');
  const r=await chamar('POST','/api/leads/buscar',{});
  solta();
  if(!r.ok)return avisar(r.erro,{erro:true});
  const {novos=0,erro=''}=r.dados||{};
  if(erro)return avisar(`A busca não deu certo: ${erro}`,{erro:true});
  if(novos>0)return irPara(location.href,novos===1?'Chegou 1 pedido novo.':`Chegaram ${novos} pedidos novos.`);
  avisar('Nenhum pedido novo desde a última leitura.');
});

// O pedido: o motivo só aparece (e só é pedido) quando a situação é "perdido".
const form=$('form[data-form="lead"]');
if(form){
  const situacao=form.elements.situacao,motivo=form.querySelector('.lead-motivo');
  situacao?.addEventListener('change',()=>{motivo?.classList.toggle('is-oculto',situacao.value!=='perdido');});
  const mudou=()=>{const corpo={};for(const el of form.querySelectorAll('[data-antes]'))if(el.value.trim()!==el.dataset.antes)corpo[el.name]=el.value.trim();return corpo;};
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();limparErros(form);
    const v=ler(form),corpo=mudou(),erros=[];
    if('nome' in corpo&&corpo.nome&&(corpo.nome.length<2||corpo.nome.length>160))erros.push({campo:'nome',mensagem:'Use de 2 a 160 caracteres, ou deixe em branco.'});
    // WhatsApp como em 7.2: vazio, ou o DDD e o número (com ou sem o 55).
    const zap=(corpo.whatsapp??'').replace(/\D/g,'');
    if(corpo.whatsapp&&!(zap.length===10||zap.length===11||/^55\d{10,11}$/.test(zap)))erros.push({campo:'whatsapp',mensagem:'Informe o WhatsApp com DDD, como (21) 98765-4321.'});
    const perdido=(situacao?.value)==='perdido',textoMotivo=(v.motivoPerda||'').trim();
    if(perdido&&(textoMotivo.length<3||textoMotivo.length>200))erros.push({campo:'motivoPerda',mensagem:'Conte por que perdeu, de 3 a 200 caracteres.'});
    if(erros.length)return mostrarErros(form,erros);
    // Saindo do perdido, o motivo não vai: o servidor apaga o motivo e a data.
    if(!perdido)delete corpo.motivoPerda;else if(corpo.situacao==='perdido')corpo.motivoPerda=textoMotivo;
    if('proximaEm' in corpo&&!corpo.proximaEm)corpo.proximaEm=null;
    if(!Object.keys(corpo).length)return avisar('Nada mudou.');
    corpo.version=versao(v.version);
    const solta=ocupar(form.querySelector('[type="submit"]'));
    const r=await chamar('PATCH',`/api/leads/${enc(form.dataset.id)}`,corpo);
    if(r.ok)return irPara(location.href,'Interessado salvo.');
    solta();falha(form,r);
  });
}

// Virar cliente: cria o cliente com o nome e o WhatsApp do pedido. O nome digitado e não salvo não vale: salve antes.
$('[data-virar-cliente]')?.addEventListener('click',async ev=>{
  const b=ev.currentTarget,nome=form?.elements.nome;
  if(form)limparErros(form);
  if(nome&&nome.value.trim()!==nome.dataset.antes)return mostrarErros(form,[{campo:'nome',mensagem:'Salve o nome antes de virar cliente.'}]);
  if(nome&&!nome.dataset.antes)return mostrarErros(form,[{campo:'nome',mensagem:'Complete e salve o nome antes de virar cliente.'}]);
  const solta=ocupar(b,'Criando o cliente…');
  const r=await chamar('POST',`/api/leads/${enc(b.dataset.virarCliente)}/cliente`,{version:versao(b.dataset.version)});
  if(r.ok&&r.dados?.cliente?.id)return irPara(`/clientes/${enc(r.dados.cliente.id)}`,'Pronto: o interessado virou cliente. Agora vincule a empresa do guia e crie a assinatura.');
  solta();
  if(r.status===422&&r.campo==='nome'&&form)return mostrarErros(form,[{campo:'nome',mensagem:r.erro}]);
  avisar(r.erro||'O cliente não foi criado.',{erro:true,recarregar:r.status===409});
});
