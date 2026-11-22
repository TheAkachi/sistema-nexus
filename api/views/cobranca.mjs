import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { reais, valorCampo, numero, plural, dia, selo, prazo, numeroResumo, linhaRenovacao, nomesEtapas, campo, areaTexto, formulario, vazio, abas, paginacao, endereco, POR_CICLO, FORMA, icone } from './componentes.mjs';

// Cobrança (contrato 6.4, 6.5 e 6.10): o Resumo, a fila de Renovações e o Registrar pagamento. O "Cobrar no WhatsApp" (e o
// "Lembrar no WhatsApp") de cada linha é tratado pelo gestao.js; o pagamento salva pelo pagamento.js e mostra o vencimento
// novo no lugar do formulário. v0.14.0: a régua de lembretes (15), com a janela "Lembrar hoje" e o atalho no Resumo.

const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesDe=d=>MESES[Number(String(d||'').slice(5,7))-1]||'';

// Carteira ainda vazia: o primeiro passo, conforme o que o papel pode fazer.
function carteiraVazia(pode) {
  const acoes=[pode.importar&&'<a class="botao" href="/importacao">Importar a carteira</a>',pode.clientes&&`<a class="botao${pode.importar?' secundario':''}" href="/clientes/novo">${icone('mais')}Cadastrar um cliente</a>`].filter(Boolean).join('');
  return vazio('A carteira ainda está vazia','Quando os clientes e as assinaturas entrarem, este Resumo mostra quanto entra por mês e quem cobrar hoje.',acoes?`<p class="vazio-acoes">${acoes}</p>`:'');
}

export function resumo(vm) {
  const d=vm.dados||{},pode=vm.pode||{},itens=d.cobrarHoje||[],total=Number(d.cobrarHojeTotal)||itens.length;
  const ar=d.aRenovar30||{},ina=d.inadimplentes||{};
  const numeros=`<section class="numeros" aria-label="A carteira hoje">${[
    numeroResumo({rotulo:'Receita mensal recorrente',valor:reais(d.mrr),nota:plural(d.ativas,'assinatura ativa','assinaturas ativas'),href:'/clientes'}),
    numeroResumo({rotulo:`Recebido em ${mesDe(d.hoje)}`.trim(),valor:reais(d.recebidoMes),nota:'Pagamentos registrados no mês'}),
    numeroResumo({rotulo:'A renovar em 30 dias',valor:reais(ar.valor),nota:plural(ar.qtd,'assinatura','assinaturas'),href:'/renovacoes?janela=30'}),
    numeroResumo({rotulo:'Inadimplentes',valor:reais(ina.valor),nota:Number(ina.qtd)?`${plural(ina.qtd,'assinatura','assinaturas')} depois da tolerância`:'Nenhuma assinatura depois da tolerância',href:'/renovacoes?janela=vencidas',destaque:Number(ina.qtd)>0})
  ].join('')}</section>`;
  const mais=total>itens.length?`<a href="/renovacoes">Ver as ${numero(total)} em Renovações <span aria-hidden="true">→</span></a>`:'';
  const nomes=nomesEtapas(d.etapas);
  const lista=itens.length?`<ul class="renovacoes">${itens.map(r=>linhaRenovacao(r,{pode,volta:'/',nomes})).join('')}</ul>${mais?`<p class="bloco-mais">${mais}</p>`:''}`
    :!Number(d.ativas)?carteiraVazia(pode)
    :vazio('Ninguém para cobrar hoje','Nenhuma assinatura vencida e nenhuma vencendo nos próximos 7 dias.','<a href="/renovacoes?janela=30">Ver quem vence nos próximos 30 dias <span aria-hidden="true">→</span></a>');
  const cobrar=`<section class="bloco" aria-labelledby="cobrar-hoje"><div class="bloco-cabeca"><h2 id="cobrar-hoje">Cobrar hoje${itens.length?` <span class="contador">${numero(total)}</span>`:''}</h2><p>As vencidas primeiro, e depois as que vencem em até 7 dias.</p></div>${lista}</section>`;
  return moldura(vm,{cabeca:{titulo:'Resumo',texto:d.hoje?`A carteira em ${dia(d.hoje)}.`:''},corpo:`${numeros}${lembrarHoje(d.lembrarHoje)}${cobrar}`});
}
// "Lembrar hoje: N" (15.5): quantos a régua pede para lembrar hoje, levando à janela das Renovações. Sem o lembrarHoje no vm
// (antes da v0.14.0), não aparece.
function lembrarHoje(n) {
  if(n==null)return '';
  const q=Number(n)||0;
  return `<p class="lembrar-hoje${q?' is-pendente':''}"><a href="/renovacoes?janela=lembrar">${icone('lembrete')}<span class="lembrar-hoje-texto"><strong>Lembrar hoje: ${numero(q)}</strong><span>${q?'Quem chegou a uma etapa da régua e ainda não recebeu o lembrete dela.':'Nenhum lembrete da régua para hoje.'}</span></span><span class="lembrar-hoje-seta" aria-hidden="true">→</span></a></p>`;
}

// Renovações: as janelas de 7, 15 e 30 dias se somam (a de 30 contém a de 7), e a contagem de cada uma não depende da
// página. "Lembrar hoje" (15.2) é a lista da régua: cada item mostra a etapa em destaque e sai da lista depois do lembrete
// registrado (gestao.js).
const JANELAS=[['vencidas','Vencidas','vencidas'],['lembrar','Lembrar hoje','lembrar'],['7','Até 7 dias','ate7'],['15','Até 15 dias','ate15'],['30','Até 30 dias','ate30']];
const VAZIA={
  vencidas:['Nenhuma assinatura vencida','Quem está em dia não aparece aqui. As que vencem logo estão nas outras abas.'],
  lembrar:['Ninguém para lembrar hoje','Cada assinatura a vencer aparece aqui uma vez em cada etapa da régua, até o lembrete dela ser registrado.']
};
export function renovacoes(vm) {
  const d=vm.dados||{},pode=vm.pode||{},itens=d.itens||[],cont=d.contagem||{};
  // A janela "Lembrar hoje" só existe com a contagem dela (v0.14.0); sem ela, uma janela desconhecida vira vencidas.
  const janelas=JANELAS.filter(([j])=>j!=='lembrar'||cont.lembrar!=null);
  const janela=janelas.some(([j])=>j===d.janela)?d.janela:'vencidas',lembrar=janela==='lembrar',nomes=nomesEtapas(d.etapas);
  const aqui=endereco('/renovacoes',{janela:janela==='vencidas'?'':janela,page:d.pagina});
  const tabs=abas('Janela das renovações',janelas.map(([j,rotulo,chave])=>({href:endereco('/renovacoes',{janela:j==='vencidas'?'':j}),texto:rotulo,contagem:cont[chave]??0,atual:j===janela})));
  const vaziaTexto=VAZIA[janela]||[`Nenhuma renovação nos próximos ${janela} dias`,'As assinaturas que vencerem nesse prazo aparecem aqui, da mais próxima para a mais distante.'];
  const contagem=lembrar?`<p class="contagem"><span data-lembrar-n>${numero(d.total)}</span> para lembrar hoje, da mais próxima do vencimento para a mais distante</p>`
    :`<p class="contagem">${plural(d.total,'assinatura','assinaturas')}${janela==='vencidas'?', da mais atrasada para a menos':', da mais próxima para a mais distante'}</p>`;
  const lista=itens.length?`${contagem}<ul class="renovacoes"${lembrar?' data-lembrar':''}>${itens.map(r=>linhaRenovacao(r,{pode,volta:aqui,nomes,comEtapa:lembrar})).join('')}</ul>`:vazio(...vaziaTexto);
  const pag=paginacao(d,p=>endereco('/renovacoes',{janela:janela==='vencidas'?'':janela,page:p}));
  const texto=janelas.length>4?'Quem cobrar e quem lembrar: as vencidas, os lembretes da régua de hoje e as que vencem nos próximos 30 dias.':'Quem cobrar: as vencidas e as que vencem nos próximos 30 dias.';
  return moldura(vm,{cabeca:{titulo:'Renovações',texto},corpo:`${tabs}${lista}${pag}`});
}

// Registrar pagamento: o valor, a data (hoje) e a forma já preenchidos pela sugestão; o vencimento novo fica dito antes de
// salvar. Depois de salvar, "Pago. Próximo vencimento: …" toma o lugar do formulário (pagamento.js).
export function pagamento(vm) {
  const d=vm.dados||{},a=d.assinatura||{},cli=d.cliente||a.cliente||{},s=d.sugestao||{},formas=d.formas||Object.keys(FORMA);
  const ficha=`/clientes/${e(cli.id)}`,empresa=a.empresa?.nome||'Sem empresa do guia';
  const dados=`<dl class="ficha-dados is-curta"><div><dt>Valor do ciclo</dt><dd><strong>${reais(a.valorCentavos)}</strong> ${POR_CICLO[a.ciclo]||''}</dd></div><div><dt>Vencimento atual</dt><dd><span class="dd-linha">${selo(a.situacao,a.dias)}<span>${prazo(a.dias,a.venceEm)}</span></span></dd></div></dl>`;
  const formaCampo=`<fieldset class="campo" data-campo="forma"><legend class="rotulo">Forma de pagamento</legend><div class="escolha">${formas.map(f=>`<label><input type="radio" name="forma" value="${e(f)}"${f===s.forma?' checked':''}><span>${e(FORMA[f]||f)}</span></label>`).join('')}</div><p class="campo-erro" id="campo-forma-erro" hidden></p></fieldset>`;
  const corpo=`<input type="hidden" name="version" value="${e(a.version??'')}"><div class="grade">${campo('valorCentavos','Valor pago (R$)',v=>`<input type="text" ${v} value="${e(valorCampo(s.valorCentavos))}" inputmode="decimal" autocomplete="off" maxlength="16" required>`,{id:'pagamento-valor',dica:'O valor da assinatura já vem preenchido. Mude se o cliente pagou outro valor.'})}${campo('pagoEm','Data do pagamento',v=>`<input type="date" ${v} value="${e(s.pagoEm||'')}" max="${e(s.pagoEm||'')}" required>`,{id:'pagamento-data',dica:'Hoje, se o Pix caiu agora. Não pode ser no futuro.'})}</div>${formaCampo}${campo('obs','Observação',areaTexto('',300,2,' placeholder="Opcional. Ex.: comprovante enviado pelo WhatsApp."'),{id:'pagamento-obs'})}`;
  const nota=`O vencimento passa de ${dia(a.venceEm)} para <strong>${dia(s.venceDepois)}</strong>: avança um ciclo a partir do vencimento atual, qualquer que seja o valor pago.`;
  const form=formulario({attrs:`data-form="pagamento" data-id="${e(a.id)}"`,corpo,salvar:'Registrar pagamento',nota});
  const pago=`<section class="pago" data-pago hidden tabindex="-1" aria-labelledby="pago-titulo"><h2 id="pago-titulo">Pago. Próximo vencimento: <span data-pago-vence></span></h2><p data-pago-detalhe></p><p class="vazio-acoes"><a class="botao" href="${ficha}" data-pago-volta>Voltar</a><a class="botao secundario" href="${ficha}">Ver a ficha do cliente</a><a class="botao-texto" href="">Registrar outro pagamento</a></p></section>`;
  const cabeca={titulo:'Registrar pagamento',voltar:[`/clientes/${cli.id}`,cli.nome||'Cliente'],extra:`<p class="cabeca-extra"><span>${e(empresa)} · ${e(a.plano?.nome||'Sem plano')}</span><a href="${ficha}">Ficha de ${e(cli.nome)}</a></p>`};
  return moldura(vm,{cabeca,corpo:`<div class="pagamento" data-pagamento>${dados}${form}${pago}</div>`});
}
