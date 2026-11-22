// Registrar pagamento (contrato 6.10 e 7.5): manda o valor, a data, a forma e a observação com a version lida, e mostra
// "Pago. Próximo vencimento: …" com o assinatura.venceEm da resposta. O ?volta= do link (a lista de onde a pessoa veio)
// troca o destino do "Voltar".
import { $, chamar, limparErros, mostrarErros, falha, ocupar, ler, centavos, reais, dia, interno } from './base.js';

const caixa=$('[data-pagamento]'),form=$('form[data-form="pagamento"]',caixa),pago=$('[data-pago]',caixa);
const volta=interno(new URLSearchParams(location.search).get('volta')||'');
if(volta){
  const rotulo=volta==='/'?'Voltar ao Resumo':volta.startsWith('/renovacoes')?'Voltar às Renovações':'Voltar';
  for(const a of [$('.voltar'),$('[data-pago-volta]',pago)].filter(Boolean)){a.href=volta;const t=a.querySelector('span')||a;t.textContent=rotulo;}
}else{const a=$('[data-pago-volta]',pago);if(a)a.textContent='Voltar à ficha do cliente';}

form?.addEventListener('submit',async ev=>{
  ev.preventDefault();limparErros(form);
  const v=ler(form),valor=centavos(v.valorCentavos),erros=[];
  if(valor===null||Number.isNaN(valor)||valor<1)erros.push({campo:'valorCentavos',mensagem:'Informe o valor, como 99,00.'});
  if(!v.pagoEm)erros.push({campo:'pagoEm',mensagem:'Informe a data do pagamento.'});
  if(!v.forma)erros.push({campo:'forma',mensagem:'Escolha a forma de pagamento.'});
  if(erros.length)return mostrarErros(form,erros);
  const solta=ocupar(form.querySelector('[type="submit"]'),'Registrando…');
  const corpo={valorCentavos:valor,pagoEm:v.pagoEm,forma:v.forma,version:Number(v.version)};
  if(v.obs.trim())corpo.obs=v.obs.trim();
  const r=await chamar('POST',`/api/assinaturas/${encodeURIComponent(form.dataset.id)}/pagamentos`,corpo);
  if(!r.ok){solta();return falha(form,r);}
  const vence=dia(r.dados?.assinatura?.venceEm);
  $('[data-pago-vence]',pago).textContent=vence;
  const p=r.dados?.pagamento;
  $('[data-pago-detalhe]',pago).textContent=p?`Pagamento de ${reais(p.valorCentavos)} registrado, referente a ${dia(p.referencia?.de)} a ${dia(p.referencia?.ate)}.`:'';
  form.hidden=true;pago.hidden=false;
  pago.focus();
});
