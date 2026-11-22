import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { plural, dia, tempo, whatsapp, campo, texto, areaTexto, escolha, formulario, vazio, abas, paginacao, endereco, icone, sr } from './componentes.mjs';

// Interessados (contrato 14, v0.13.0): os pedidos do cadastro do site, os leads, para a equipe completar, acompanhar e virar
// cliente. O código é o que a pessoa manda no fim da mensagem do WhatsApp ("Pedido A7K3"), e é por ele que a busca acha o
// pedido. As escritas saem pelo interessados.js, com a version lida. Desligada a chave, as páginas nem existem (404).

export const SITUACAO_LEAD={novo:'Novo','em-conversa':'Em conversa',proposta:'Proposta enviada',perdido:'Perdido',cliente:'Virou cliente'};
const EDITAVEIS=['novo','em-conversa','proposta','perdido'];
const seloLead=s=>`<span class="selo is-lead-${e(s)}">${e(SITUACAO_LEAD[s]||s||'')}</span>`;
const nomeOu=x=>x.nome?e(x.nome):'<span class="muted">Sem nome ainda</span>';
const proxima=x=>x.proximaAcao?`${e(x.proximaAcao)}${x.proximaEm?`<span class="linha-apoio">${dia(x.proximaEm)}</span>`:''}`:x.proximaEm?dia(x.proximaEm):'<span class="muted">—</span>';

// A última leitura dos pedidos do site (14.4, leitura): quando deu certo e, se a última tentativa falhou, o erro.
function leitura(l={}) {
  const certa=l.lidoEm?`Última leitura dos pedidos do guia: ${tempo(l.lidoEm)}.`:'A gestão ainda não leu os pedidos do guia nenhuma vez.';
  const falhou=l.erro?`<p class="leitura-erro">${icone('aviso')}<span>A última tentativa${l.tentadoEm?`, em ${tempo(l.tentadoEm)},`:''} falhou: ${e(l.erro)}</span></p>`:'';
  return `<div class="leitura"><p>${certa} A gestão lê uma vez por dia, de manhã; "Buscar agora" lê na hora.</p>${falhou}</div>`;
}

export function interessados(vm) {
  const d=vm.dados||{},f=vm.filtros||{},itens=d.itens||[];
  const busca={q:f.q||''};
  const chips=abas('Situação dos interessados',[{href:endereco('/interessados',busca),texto:'Todos',atual:!f.situacao},
    ...Object.entries(SITUACAO_LEAD).map(([s,t])=>({href:endereco('/interessados',{...busca,situacao:s}),texto:t,atual:f.situacao===s}))]);
  const filtros=`<form class="filtros" method="get" action="/interessados" role="search" aria-label="Buscar interessados">${f.situacao?`<input type="hidden" name="situacao" value="${e(f.situacao)}">`:''}<div class="campo filtros-busca"><label for="filtro-q">Código do pedido, nome ou WhatsApp</label><input type="search" id="filtro-q" name="q" value="${e(busca.q)}" maxlength="80" autocomplete="off" aria-describedby="filtro-q-dica"><p class="campo-dica" id="filtro-q-dica">O código vem no fim da mensagem do WhatsApp, como “Pedido A7K3”.</p></div><div class="filtros-acoes"><button type="submit" class="botao secundario">Buscar</button>${f.q||f.situacao?'<a class="botao-texto" href="/interessados">Limpar a busca</a>':''}</div></form>`;
  const linha=x=>`<tr><th scope="row"><a href="/interessados/${e(x.id)}"><span class="codigo-pedido">${e(x.codigo)}</span>${sr(`: pedido de ${dia(String(x.pedidoEm||'').slice(0,10))}`)}</a></th><td data-rotulo="Nome">${nomeOu(x)}</td><td data-rotulo="WhatsApp">${x.whatsapp?e(whatsapp(x.whatsapp)):'<span class="muted">—</span>'}</td><td data-rotulo="Situação">${seloLead(x.situacao)}</td><td data-rotulo="Próxima ação">${proxima(x)}</td><td data-rotulo="Pedido em">${tempo(x.pedidoEm)}</td></tr>`;
  const comFiltro=f.q||f.situacao;
  const lista=itens.length?`<p class="contagem">${plural(d.total,'interessado','interessados')}</p><div class="tabela-caixa"><table class="tabela tabela-clientes tabela-interessados"><thead><tr><th scope="col">Pedido</th><th scope="col">Nome</th><th scope="col">WhatsApp</th><th scope="col">Situação</th><th scope="col">Próxima ação</th><th scope="col">Pedido em</th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`
    :comFiltro?vazio('Nenhum interessado com essa busca','Confira o código como veio no WhatsApp, ou limpe a busca para ver todos.','<a class="botao secundario" href="/interessados">Limpar a busca</a>')
    :vazio('Nenhum interessado ainda','Quem preenche o cadastro do guia aparece aqui, com o código que manda no WhatsApp.');
  const pag=paginacao(d,p=>endereco('/interessados',{...busca,situacao:f.situacao,page:p}));
  const acoes=`<button type="button" class="botao secundario" data-buscar-leads>${icone('atualizar')}Buscar agora</button>`;
  return moldura(vm,{cabeca:{titulo:'Interessados',texto:'Quem pediu para anunciar pelo cadastro do guia. Complete o nome e o WhatsApp quando a pessoa escrever, acompanhe a conversa e, fechado o plano, vire o pedido em cliente.',acoes},corpo:`${leitura(d.leitura)}${filtros}${chips}${lista}${pag}`});
}

// O pedido: o texto que a pessoa mandou, os dados para completar, a situação, a próxima ação e as notas, e o "Virar cliente".
export function interessado(vm) {
  const x=vm.dados||{},cliente=x.situacao==='cliente'||Boolean(x.cliente);
  const pedido=`<section class="bloco" aria-labelledby="lead-pedido"><h2 id="lead-pedido">O pedido</h2><p class="pedido-meta">Feito no guia em ${tempo(x.pedidoEm)}${x.recebidoEm?` · chegou à gestão em ${tempo(x.recebidoEm)}`:''}${x.origem?` · veio de <span class="codigo-pedido">${e(x.origem)}</span>`:''}</p><p class="balao pedido-texto">${e(x.texto||'')}</p></section>`;
  const situacao=cliente?`<div class="campo"><p class="rotulo">Situação</p><p>${seloLead('cliente')}${x.virouClienteEm?` <span class="muted">em ${tempo(x.virouClienteEm)}</span>`:''}</p></div>`
    :campo('situacao','Situação',escolha(EDITAVEIS.map(s=>[s,SITUACAO_LEAD[s]]),x.situacao,null,` data-antes="${e(x.situacao)}"`),{id:'lead-situacao'});
  const motivo=cliente?'':campo('motivoPerda','Por que perdeu',texto(x.motivoPerda,200,` minlength="3" data-antes="${e(x.motivoPerda||'')}"`),{id:'lead-motivo',dica:'De 3 a 200 caracteres. Os motivos aparecem juntos no funil dos Indicadores.',classe:`lead-motivo${x.situacao==='perdido'?'':' is-oculto'}`});
  const corpo=`<input type="hidden" name="version" value="${e(x.version??'')}"><fieldset class="secao-form"><legend>Quem pediu</legend><p class="secao-texto">O pedido chega sem nome nem número: complete quando a pessoa escrever no WhatsApp.</p><div class="grade">${campo('nome','Nome',texto(x.nome,160,` autocomplete="off" data-antes="${e(x.nome||'')}"`),{id:'lead-nome',dica:'Quem escreveu, ou o nome da empresa. É o nome do cliente ao virar cliente.'})}${campo('whatsapp','WhatsApp',a=>`<input type="tel" ${a} value="${e(x.whatsapp?whatsapp(x.whatsapp):'')}" inputmode="tel" maxlength="20" autocomplete="off" placeholder="(21) 98765-4321" data-antes="${e(x.whatsapp?whatsapp(x.whatsapp):'')}">`,{id:'lead-whatsapp',dica:'Com DDD.'})}</div></fieldset><fieldset class="secao-form"><legend>Acompanhamento</legend><div class="grade">${situacao}${motivo}${campo('proximaAcao','Próxima ação',texto(x.proximaAcao,200,` autocomplete="off" placeholder="Ex.: Mandar a tabela de planos" data-antes="${e(x.proximaAcao||'')}"`),{id:'lead-proxima'})}${campo('proximaEm','Quando',a=>`<input type="date" ${a} value="${e(x.proximaEm||'')}" data-antes="${e(x.proximaEm||'')}">`,{id:'lead-quando'})}${campo('notas','Notas',areaTexto(x.notas,2000,4,` data-antes="${e(x.notas||'')}"`),{id:'lead-notas',largo:true,dica:'Só para a equipe. Até 2.000 caracteres.'})}</div></fieldset>`;
  const form=formulario({attrs:`data-form="lead" data-id="${e(x.id)}"`,corpo,salvar:'Salvar o interessado'});
  const virar=cliente
    ?`<section class="secao-form" aria-labelledby="lead-cliente"><h2 id="lead-cliente">Já é cliente</h2><p>Este pedido virou cliente${x.virouClienteEm?` em ${tempo(x.virouClienteEm)}`:''}. Vincule a empresa do guia e cuide da assinatura na ficha.</p>${x.cliente?.id?`<p><a class="botao secundario" href="/clientes/${e(x.cliente.id)}">Ver a ficha de ${e(x.cliente.nome)}</a></p>`:''}</section>`
    :`<section class="secao-form" aria-labelledby="lead-virar"><h2 id="lead-virar">Virar cliente</h2><p>Fechado o plano, crie o cliente com o nome e o WhatsApp deste pedido. A ficha dele abre em seguida, para vincular a empresa do guia e criar a assinatura.</p>${x.nome?'':'<p class="renovacao-falta">'+icone('aviso')+'<span>Complete e salve o nome antes.</span></p>'}<div><button type="button" class="botao" data-virar-cliente="${e(x.id)}" data-version="${e(x.version)}">Virar cliente</button></div></section>`;
  const extra=`<p class="cabeca-extra">${seloLead(x.situacao)}</p>`;
  return moldura(vm,{cabeca:{titulo:`Pedido ${e(x.codigo||'')}`,voltar:['/interessados','Interessados'],extra},corpo:`<div class="ficha interessado">${pedido}<div class="formulario-pagina">${form}${virar}</div></div>`});
}
