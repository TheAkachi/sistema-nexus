import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { blocoDesempenho } from './desempenho.mjs';
import { mesAno } from './indicadores.mjs';
import { reais, valorCampo, numero, plural, dia, instante, tempo, whatsapp, selo, prazo, miniatura, nomesEtapas, nomeEtapa, campo, texto, areaTexto, escolha, formulario, vazio, abas, paginacao, endereco, icone, sr, SITUACAO, CICLO, POR_CICLO, FORMA } from './componentes.mjs';

// Carteira (contrato 6.6 a 6.9): a lista de clientes, a ficha (dados, empresas do guia, assinaturas e a linha do tempo),
// o formulário do cliente e o da assinatura. As escritas saem pelo clientes.js, com a version lida.

// Lista de clientes ---------------------------------------------------------------------------------------------------

const SITUACOES_FILTRO=['inadimplente','vencida','a-vencer','em-dia','suspensa','cancelada','sem-assinatura'];
export function clientes(vm) {
  const d=vm.dados||{},f=vm.filtros||{},pode=vm.pode||{},itens=d.itens||[];
  const busca={q:f.q||'',status:f.status||''};
  const chips=abas('Situação das assinaturas',[{href:endereco('/clientes',busca),texto:'Todas',atual:!f.situacao},
    ...SITUACOES_FILTRO.map(s=>({href:endereco('/clientes',{...busca,situacao:s}),texto:SITUACAO[s],atual:f.situacao===s}))]);
  const filtros=`<form class="filtros" method="get" action="/clientes" role="search" aria-label="Buscar clientes">${f.situacao?`<input type="hidden" name="situacao" value="${e(f.situacao)}">`:''}<div class="campo filtros-busca"><label for="filtro-q">Nome, empresa, e-mail ou WhatsApp</label><input type="search" id="filtro-q" name="q" value="${e(busca.q)}" maxlength="80" autocomplete="off"></div><div class="campo"><label for="filtro-status">Clientes</label><select id="filtro-status" name="status"><option value="">Todos</option><option value="ativo"${busca.status==='ativo'?' selected':''}>Ativos</option><option value="encerrado"${busca.status==='encerrado'?' selected':''}>Encerrados</option></select></div><div class="filtros-acoes"><button type="submit" class="botao secundario">Buscar</button>${f.q||f.status||f.situacao?'<a class="botao-texto" href="/clientes">Limpar a busca</a>':''}</div></form>`;
  const linha=x=>`<tr><th scope="row"><a href="/clientes/${e(x.id)}">${e(x.nome)}</a>${x.status==='encerrado'?' <span class="selo">Encerrado</span>':''}${x.responsavel?`<span class="linha-apoio">${e(x.responsavel)}</span>`:''}</th><td data-rotulo="WhatsApp">${x.whatsapp?e(whatsapp(x.whatsapp)):'<span class="muted">—</span>'}</td><td class="num" data-rotulo="Empresas">${numero(x.empresas)}</td><td data-rotulo="Plano principal">${x.planoPrincipal?e(x.planoPrincipal.nome):'<span class="muted">—</span>'}</td><td data-rotulo="Situação">${selo(x.situacao||'sem-assinatura')}</td></tr>`;
  const comFiltro=f.q||f.status||f.situacao;
  const lista=itens.length?`<p class="contagem">${plural(d.total,'cliente','clientes')}</p><div class="tabela-caixa"><table class="tabela tabela-clientes"><thead><tr><th scope="col">Cliente</th><th scope="col">WhatsApp</th><th scope="col" class="num">Empresas</th><th scope="col">Plano principal</th><th scope="col">Situação</th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`
    :comFiltro?vazio('Nenhum cliente com essa busca','Confira o que foi digitado, ou limpe a busca para ver todos.','<a class="botao secundario" href="/clientes">Limpar a busca</a>')
    :vazio('Nenhum cliente ainda','Cada cliente é quem paga: uma pessoa ou empresa, com uma ou mais empresas do guia.',pode.clientes?`<p class="vazio-acoes"><a class="botao" href="/clientes/novo">${icone('mais')}Cadastrar um cliente</a>${pode.importar?'<a class="botao secundario" href="/importacao">Importar a carteira</a>':''}</p>`:'');
  const pag=paginacao(d,p=>endereco('/clientes',{...busca,situacao:f.situacao,page:p}));
  const acoes=pode.clientes?`<a class="botao" href="/clientes/novo">${icone('mais')}Novo cliente</a>`:'';
  return moldura(vm,{cabeca:{titulo:'Clientes',texto:'Quem paga, as empresas do guia de cada um e a situação das assinaturas.',acoes},corpo:`${filtros}${chips}${lista}${pag}`});
}

// Ficha do cliente ----------------------------------------------------------------------------------------------------

const SYNC={ok:'No guia: atualizado',pendente:'No guia: esperando o envio',falhou:'No guia: o envio falhou','sem-empresa':'No guia: sem empresa vinculada'};
function sincronizacao(s) {
  if(!s)return '';
  const quando=s.estado==='ok'&&s.em?` em ${tempo(s.em)}`:'';
  return `<p class="sync is-${e(s.estado)}">${e(SYNC[s.estado]||'')}${quando}${s.estado==='falhou'&&s.erro?`: ${e(s.erro)}`:''}</p>`;
}
function cartaoAssinatura(a,{pode,clienteAtivo}) {
  const id=e(a.id),empresa=a.empresa;
  const semEmpresa=!empresa?`<p class="renovacao-falta">${icone('aviso')}<span>Sem empresa do guia. Vincule a empresa nas Empresas do guia e depois edite a assinatura.</span></p>`:'';
  const pagar=pode.pagamentos&&a.status==='ativa'?`<a class="botao secundario" href="/assinaturas/${id}/pagamento">Registrar pagamento${sr(` de ${e(empresa?.nome||a.plano?.nome||'')}`)}</a>`:'';
  const editar=pode.assinaturas?`<a class="botao-texto" href="/assinaturas/${id}">Editar a assinatura${sr(` de ${e(empresa?.nome||'')}`)}</a>`:'';
  const situacao=a.status==='cancelada'?`Cancelada em ${dia(a.canceladaEm)}${a.motivo?`: ${e(a.motivo)}`:''}`:a.status==='suspensa'?`Suspensa${a.suspensaEm?` em ${dia(a.suspensaEm)}`:''}${a.motivo?`: ${e(a.motivo)}`:''}`:prazo(a.dias,a.venceEm);
  return `<li class="renovacao assinatura is-${e(a.status)}"><div class="renovacao-quem">${miniatura(empresa,a.cliente?.nome||'?')}<div><h3>${e(empresa?.nome||'Sem empresa do guia')}</h3><p class="renovacao-onde">${e(a.plano?.nome||'Sem plano')} · ${e(CICLO[a.ciclo]||'')} · desde ${dia(a.inicio)}</p><p class="renovacao-valor"><strong>${reais(a.valorCentavos)}</strong> ${POR_CICLO[a.ciclo]||''}</p></div></div><div class="renovacao-prazo"><p>${selo(a.situacao,a.dias)}<span>${situacao}</span></p>${sincronizacao(a.sincronizacao)}${a.notas?`<p class="nota-livre">${e(a.notas)}</p>`:''}${semEmpresa}</div>${pagar||editar?`<div class="renovacao-acoes">${pagar}${editar}</div>`:''}</li>`;
}
// Linha do tempo (6.7): pagamentos, estornos, contatos e relatórios enviados, do mais novo para o mais antigo. O estorno de
// um pagamento fica no próprio pagamento, com o motivo e a confirmação de identidade (4.6). O relatório (v0.11.0) é da
// empresa, sem assinatura. O lembrete da régua (v0.14.0) diz a etapa, com o nome que vem do vm (etapas).
function acontecimento(t,{pode,nomes}) {
  const quem=t.por?.nome?` por ${e(t.por.nome)}`:'',de=[t.assinatura?.empresa,t.assinatura?.plano].filter(Boolean).map(e).join(' · ');
  if(t.tipo==='relatorio'){const mes=t.contato?.mes;return `<li class="evento is-relatorio"><p class="evento-titulo">${mes?`Relatório de ${e(mesAno(mes))}`:'Relatório do mês'} pelo WhatsApp</p>${t.empresa?.nome?`<p>${e(t.empresa.nome)}</p>`:''}<p class="evento-quando">${tempo(t.em)}${quem}</p></li>`;}
  if(t.tipo==='contato'){const c=t.contato||{},etapa=c.tipo==='lembrete'?nomeEtapa(nomes,c.etapa):'';return `<li class="evento is-contato"><p class="evento-titulo">${c.tipo==='lembrete'?'Lembrete':'Cobrança'} pelo WhatsApp${etapa?` · ${e(etapa)}`:''}</p><p>${de}${c.venceEm?` · vencimento de ${dia(c.venceEm)}`:''}</p><p class="evento-quando">${tempo(t.em)}${quem}</p></li>`;}
  const p=t.pagamento||{};
  if(t.tipo==='estorno')return `<li class="evento is-estorno"><p class="evento-titulo">Estorno de ${reais(p.valorCentavos)}</p><p>${de}${p.estorno?.motivo?` · ${e(p.estorno.motivo)}`:''}</p><p class="evento-quando">${tempo(t.em)}${quem}</p></li>`;
  const estornado=p.estorno?`<p class="evento-estornado"><span class="selo">Estornado</span> em ${tempo(p.estorno.em)}${p.estorno.por?.nome?` por ${e(p.estorno.por.nome)}`:''}</p>`:'';
  const estornar=pode.pagamentos&&!p.estorno?`<details class="estornar"><summary class="botao-texto perigo">Estornar${sr(` o pagamento de ${reais(p.valorCentavos)} de ${dia(p.pagoEm)}`)}</summary>${formulario({attrs:`data-form="estorno" data-id="${e(p.id)}"`,corpo:campo('motivo','Por que estornar',areaTexto('',300,2,' required minlength="3"'),{id:`estorno-${e(p.id)}`,dica:'O vencimento volta um ciclo. O pagamento não é apagado: fica marcado como estornado, com o motivo.'}),salvar:'Estornar o pagamento'})}</details>`:'';
  return `<li class="evento is-pagamento${p.estorno?' is-estornado':''}"><p class="evento-titulo">Pagamento de ${reais(p.valorCentavos)} · ${e(FORMA[p.forma]||p.forma||'')}</p><p>${de} · referente a ${dia(p.referencia?.de)} a ${dia(p.referencia?.ate)} · pago em ${dia(p.pagoEm)}</p>${p.obs?`<p class="nota-livre">${e(p.obs)}</p>`:''}<p class="evento-quando">Registrado em ${tempo(t.em)}${quem}</p>${estornado}${estornar}</li>`;
}
// Relatório do mês (6.7 e 7.4, v0.11.0), por empresa vinculada: o "Enviar o relatório de <mês>" abre o WhatsApp do cliente
// com o link da página do relatório no guia, e o clientes.js registra o envio; o último envio; e o "Ver o relatório", que
// abre o guia e pede login. Sem o linkWhatsapp, quem não cobra não vê o botão, e quem cobra o vê desligado, com o motivo.
function relatorioEmpresa(r,m,x,pode) {
  if(!r)return '';
  const rotulo=e(x.relatorio.rotulo||''),nome=e(m.nome);
  const envio=r.ultimoEnvio?`Relatório de ${rotulo} enviado em ${tempo(r.ultimoEnvio.em)}${r.ultimoEnvio.por?.nome?` por ${e(r.ultimoEnvio.por.nome)}`:''}`:`O relatório de ${rotulo} ainda não foi enviado`;
  const motivo=!x.whatsapp?`Sem WhatsApp cadastrado.${pode.clientes?` <a href="/clientes/${e(x.id)}/editar">Cadastrar o WhatsApp</a>`:''}`:'O endereço do relatório no guia ainda não está disponível.';
  const botao=r.linkWhatsapp?`<a class="botao whatsapp" href="${e(r.linkWhatsapp)}" target="_blank" rel="noopener" data-enviar-relatorio="${e(m.id)}" data-mes="${e(x.relatorio.mes)}">${icone('whatsapp')}<span>Enviar o relatório de ${rotulo}</span>${sr(`: ${nome} (abre o WhatsApp em outra aba)`)}<span class="seta" aria-hidden="true">↗</span></a>`
    :pode.cobrar?`<button type="button" class="botao whatsapp" disabled>${icone('whatsapp')}<span>Enviar o relatório de ${rotulo}</span>${sr(`: ${nome}`)}</button><p class="renovacao-falta">${icone('aviso')}<span>${motivo}</span></p>`:'';
  const ver=r.url?`<a class="botao-texto" href="${e(r.url)}" target="_blank" rel="noopener">Ver o relatório${sr(` de ${rotulo}: ${nome} (abre o guia em outra aba e pede login)`)} <span aria-hidden="true">↗</span></a>`:'';
  return `<div class="empresa-relatorio"><p class="empresa-relatorio-envio" data-ultimo-envio>${envio}</p>${botao||ver?`<div class="empresa-relatorio-acoes">${botao}${ver}</div>`:''}</div>`;
}
function vincular(vm,ficha) {
  return `<details class="vincular" data-vincular data-cliente="${e(ficha.id)}"><summary class="botao secundario">${icone('mais')}Vincular empresa do guia</summary><form class="vincular-busca" role="search" data-busca-empresa novalidate><div class="campo"><label for="busca-empresa">Buscar a empresa no guia</label><div class="busca-linha"><input type="search" id="busca-empresa" name="q" maxlength="80" autocomplete="off" required><button type="submit" class="botao secundario">Buscar</button></div></div></form><p class="sr-only" data-busca-status aria-live="polite"></p><ul class="empresas-busca" data-resultados></ul></details>`;
}

export function cliente(vm) {
  const x=vm.dados||{},pode=vm.pode||{},ativo=x.status!=='encerrado';
  const empresas=x.empresas||[],assinaturas=x.assinaturas||[],tempoLinha=x.linhaDoTempo||[];
  const dados=`<section class="bloco" aria-labelledby="ficha-dados"><h2 id="ficha-dados" class="sr-only">Dados do cliente</h2><dl class="ficha-dados"><div><dt>Responsável</dt><dd>${e(x.responsavel||'—')}</dd></div><div><dt>WhatsApp</dt><dd>${x.whatsapp?e(whatsapp(x.whatsapp)):'<span class="muted">Sem WhatsApp</span>'}</dd></div><div><dt>E-mail</dt><dd>${x.email?`<a href="mailto:${e(x.email)}">${e(x.email)}</a>`:'—'}</dd></div><div><dt>Cliente desde</dt><dd>${e(instante(x.criadoEm).slice(0,10))}</dd></div>${x.notas?`<div class="is-largo"><dt>Notas</dt><dd class="nota-livre">${e(x.notas)}</dd></div>`:''}</dl></section>`;
  const relatorios=new Map((x.relatorio?.empresas||[]).map(r=>[r.id,r]));
  const notaRelatorio=relatorios.size?'<p class="bloco-nota">O relatório do mês é uma página do painel do guia: o cliente abre com o login dele, numa conta com acesso à empresa.</p>':'';
  // Acessos ao painel (6.7, v0.12.0): o endereço da lista de acessos do admin do site, já na empresa. A gestão não convida:
  // a equipe do site convida lá, com o login dela.
  const acessos=m=>m.acessosUrl?`<a class="botao-texto" href="${e(m.acessosUrl)}" target="_blank" rel="noopener">Acessos ao painel${sr(`: ${e(m.nome)} (abre o admin do guia em outra aba e pede o login da equipe do site)`)} <span aria-hidden="true">↗</span></a>`:'';
  const notaAcessos=empresas.some(m=>m.acessosUrl)?'<p class="bloco-nota">"Acessos ao painel" abre o admin do guia em outra aba, com o login da equipe do site: é lá que se convida o cliente para o painel do anunciante.</p>':'';
  const listaEmpresas=empresas.length?`<ul class="empresas">${empresas.map(m=>`<li class="empresa" data-empresa="${e(m.id)}">${miniatura(m)}<div><p class="empresa-nome">${e(m.nome)}</p><p class="empresa-apoio">${e(m.bairro||'')}${m.bairro?' · ':''}vinculada em ${e(instante(m.vinculadaEm).slice(0,10))}</p></div><div class="empresa-acoes">${m.url?`<a class="botao-texto" href="${e(m.url)}" target="_blank" rel="noopener">Ver no guia${sr(`: ${e(m.nome)} (abre em outra aba)`)} <span aria-hidden="true">↗</span></a>`:''}${acessos(m)}${pode.clientes?`<button type="button" class="botao-texto perigo" data-desvincular="${e(m.id)}">Desvincular${sr(` ${e(m.nome)}`)}</button>`:''}</div>${relatorioEmpresa(relatorios.get(m.id),m,x,pode)}</li>`).join('')}</ul>${notaRelatorio}${notaAcessos}`
    :vazio('Nenhuma empresa do guia vinculada','Vincule as empresas (ou as unidades da rede) que este cliente paga. Assim o plano dele aparece no guia.');
  const blocoEmpresas=`<section class="bloco" aria-labelledby="ficha-empresas"><div class="bloco-cabeca"><h2 id="ficha-empresas">Empresas do guia${empresas.length?` <span class="contador">${numero(empresas.length)}</span>`:''}</h2>${pode.clientes&&ativo?vincular(vm,x):''}</div>${listaEmpresas}</section>`;
  const nova=pode.assinaturas&&ativo?`<a class="botao secundario" href="/assinaturas/nova?cliente=${e(x.id)}">${icone('mais')}Nova assinatura</a>`:'';
  const listaAssinaturas=assinaturas.length?`<ul class="renovacoes assinaturas">${assinaturas.map(a=>cartaoAssinatura(a,{pode,clienteAtivo:ativo})).join('')}</ul>`:vazio('Nenhuma assinatura','A assinatura diz o plano, o valor, o ciclo e o vencimento de uma empresa do guia.');
  const blocoAssinaturas=`<section class="bloco" aria-labelledby="ficha-assinaturas"><div class="bloco-cabeca"><h2 id="ficha-assinaturas">Assinaturas</h2>${nova}</div>${listaAssinaturas}</section>`;
  const nomes=nomesEtapas(x.etapas);
  const linha=tempoLinha.length?`<ol class="linha-tempo">${tempoLinha.map(t=>acontecimento(t,{pode,nomes})).join('')}</ol>`:vazio('Nenhum pagamento nem contato ainda','Os pagamentos registrados, os estornos, as cobranças pelo WhatsApp e os relatórios enviados aparecem aqui, do mais novo para o mais antigo.');
  const blocoTempo=`<section class="bloco" aria-labelledby="ficha-tempo"><h2 id="ficha-tempo">Pagamentos e contatos</h2>${linha}</section>`;
  const extra=x.status==='encerrado'?'<p class="cabeca-extra"><span class="selo">Encerrado</span><span>Para criar uma assinatura, reabra o cliente.</span></p>':'';
  // O histórico do cliente na auditoria (6.15), só para quem lê a auditoria.
  const acoes=[pode.auditoria&&`<a class="botao-texto" href="/auditoria?recurso=${e(encodeURIComponent(x.id))}">Ver na auditoria</a>`,pode.clientes&&`<a class="botao secundario" href="/clientes/${e(x.id)}/editar">Editar o cliente</a>`].filter(Boolean).join('');
  return moldura(vm,{cabeca:{titulo:e(x.nome),voltar:['/clientes','Clientes'],extra,acoes},corpo:`<div class="ficha" data-ficha="${e(x.id)}">${dados}${blocoAssinaturas}${blocoEmpresas}${blocoDesempenho(x.desempenho)}${blocoTempo}</div>`});
}

// Cliente: criar e editar (6.8) ---------------------------------------------------------------------------------------

export function clienteForm(vm) {
  const x=vm.dados?.cliente,novo=!x,c=x||{};
  const corpo=`<input type="hidden" name="version" value="${e(c.version??'')}"><div class="grade">${campo('nome','Nome do cliente',texto(c.nome,160,' required minlength="2" autocomplete="off"'),{id:'cliente-nome',dica:'Quem paga: a pessoa ou a empresa. Ex.: Clínica Vida Plena.'})}${campo('responsavel','Responsável',texto(c.responsavel,120,' autocomplete="off"'),{id:'cliente-responsavel',dica:'Opcional. Com quem o Nexus fala; entra no começo da mensagem de cobrança.'})}${campo('whatsapp','WhatsApp',v=>`<input type="tel" ${v} value="${e(c.whatsapp?whatsapp(c.whatsapp):'')}" inputmode="tel" maxlength="20" autocomplete="off" placeholder="(21) 98765-4321">`,{id:'cliente-whatsapp',dica:'Com DDD. É para onde vai a cobrança.'})}${campo('email','E-mail',v=>`<input type="email" ${v} value="${e(c.email||'')}" inputmode="email" maxlength="160" autocomplete="off" spellcheck="false" autocapitalize="off">`,{id:'cliente-email',dica:'Opcional.'})}${campo('notas','Notas',areaTexto(c.notas,2000,4,' placeholder="Opcional. Ex.: prefere ser chamada pelo WhatsApp depois das 14h."'),{id:'cliente-notas',largo:true})}</div>`;
  const form=formulario({attrs:`data-form="cliente"${novo?' data-novo':` data-id="${e(c.id)}"`}`,corpo,salvar:novo?'Cadastrar cliente':'Salvar o cliente',nota:novo?'Depois de cadastrar, vincule as empresas do guia e crie a assinatura na ficha.':''});
  const situacao=novo?'':c.status==='encerrado'
    ?`<section class="secao-form acao-seria" aria-labelledby="cliente-situacao"><h2 id="cliente-situacao">Cliente encerrado</h2><p>Reabra o cliente para criar uma assinatura nova.</p><div><button type="button" class="botao secundario" data-situacao-cliente="ativo" data-id="${e(c.id)}" data-version="${e(c.version)}">Reabrir o cliente</button></div></section>`
    :`<section class="secao-form acao-seria" aria-labelledby="cliente-situacao"><h2 id="cliente-situacao">Encerrar o cliente</h2><p>Quando o cliente deixa o Nexus, encerre. Antes, cancele as assinaturas dele. O cliente não é apagado: a ficha e o histórico ficam.</p><div><button type="button" class="botao perigo" data-situacao-cliente="encerrado" data-id="${e(c.id)}" data-version="${e(c.version)}">Encerrar o cliente</button></div></section>`;
  const voltar=novo?['/clientes','Clientes']:[`/clientes/${c.id}`,c.nome];
  return moldura(vm,{cabeca:{titulo:novo?'Novo cliente':`Editar ${e(c.nome)}`,voltar},corpo:`<div class="formulario-pagina">${form}${situacao}</div>`});
}

// Assinatura: criar e editar (6.9) ------------------------------------------------------------------------------------

function acoesAssinatura(a) {
  const id=e(a.id),v=e(a.version);
  if(a.status==='cancelada')return `<section class="secao-form" aria-labelledby="assinatura-situacao"><h2 id="assinatura-situacao">Assinatura cancelada</h2><p>Cancelada em ${dia(a.canceladaEm)}${a.motivo?`: ${e(a.motivo)}`:''}. Cancelar não tem volta: para retomar, crie uma assinatura nova na ficha do cliente.</p></section>`;
  const suspender=a.status==='ativa'?`<details class="acao"><summary class="botao secundario">Suspender</summary>${formulario({attrs:`data-form="suspender" data-id="${id}" data-version="${v}"`,corpo:campo('motivo','Motivo da suspensão',areaTexto('',300,2),{id:'suspender-motivo',dica:'Opcional. A empresa continua no guia, sem o plano pago, até a reativação.'}),salvar:'Suspender a assinatura'})}</details>`
    :`<button type="button" class="botao secundario" data-reativar="${id}" data-version="${v}">Reativar</button>`;
  const cancelar=`<details class="acao"><summary class="botao perigo">Cancelar a assinatura</summary>${formulario({attrs:`data-form="cancelar" data-id="${id}" data-version="${v}"`,corpo:`${campo('motivo','Motivo do cancelamento',areaTexto('',300,2,' required minlength="3"'),{id:'cancelar-motivo'})}${campo('canceladaEm','Data do cancelamento',x=>`<input type="date" ${x} min="${e(a.inicio||'')}">`,{id:'cancelar-data',dica:'Em branco, vale hoje.'})}`,salvar:'Cancelar a assinatura',nota:'Cancelar não tem volta. A empresa continua no guia, sem o plano pago.'})}</details>`;
  return `<section class="secao-form acao-seria" aria-labelledby="assinatura-situacao"><h2 id="assinatura-situacao">Situação da assinatura</h2><p>${a.status==='suspensa'?'Suspensa: a cobrança e o plano pago param até a reativação. O vencimento continua o mesmo.':'Suspenda quando a cobrança precisa parar por um tempo. Cancele quando o cliente sai do plano.'}</p><div class="acoes-situacao">${suspender}${cancelar}</div></section>`;
}
export function assinaturaForm(vm) {
  const d=vm.dados||{},a=d.assinatura,nova=!a,x=a||{},cli=d.cliente||{},planos=d.planos||[],ciclos=d.ciclos||Object.keys(CICLO);
  const cancelada=x.status==='cancelada',dis=cancelada?' disabled':'';
  const empresas=(cli.empresas||[]).map(m=>[m.id,m.nome]);
  const antes=v=>` data-antes="${e(v??'')}"`;
  const planoAtual=x.plano?.id||'';
  const opcoesPlano=planos.map(p=>`<option value="${e(p.id)}" data-preco="${e(p.precoCentavos??'')}"${p.id===planoAtual?' selected':''}>${e(p.nome)}${p.precoCentavos!=null?` · ${reais(p.precoCentavos)} por mês`:''}</option>`).join('');
  // Lista vazia sem o aviso site-fora: o guia respondeu e não tem plano ativo. Com o aviso, o texto dele já diz que não há
  // cópia dos planos (v0.8.1), e a tela não repete.
  const siteFora=(vm.avisos||[]).some(av=>av?.tipo==='site-fora');
  const semPlanos=planos.length||siteFora?'':`<p class="aviso">${icone('aviso')}<span>O guia ainda não tem nenhum plano ativo. Cadastre os planos no admin do site para criar a assinatura.</span></p>`;
  const corpo=`<input type="hidden" name="version" value="${e(x.version??'')}"><input type="hidden" name="cliente" value="${e(cli.id)}">${semPlanos}<div class="grade">${campo('empresa','Empresa do guia',escolha(empresas,x.empresa?.id??(empresas.length===1?empresas[0][0]:''),'Sem empresa por enquanto',`${antes(x.empresa?.id)}${dis}`),{id:'assinatura-empresa',dica:empresas.length?'Só as empresas vinculadas a este cliente. Cada empresa tem uma assinatura.':'Este cliente ainda não tem empresa do guia. Vincule na ficha para o plano aparecer no guia.'})}${campo('plano','Plano',v=>`<select ${v}${antes(planoAtual)}${dis} required><option value="">Escolha o plano</option>${opcoesPlano}</select>`,{id:'assinatura-plano',dica:'Os planos do guia. Escolher um plano sugere o preço dele como valor.'})}${campo('valorCentavos','Valor de um ciclo (R$)',v=>`<input type="text" ${v} value="${e(valorCampo(x.valorCentavos))}" inputmode="decimal" autocomplete="off" maxlength="16" required${antes(valorCampo(x.valorCentavos))}${dis}>`,{id:'assinatura-valor',dica:'O valor cobrado a cada ciclo. No trimestral, o valor dos três meses.'})}${campo('ciclo','Ciclo',escolha(ciclos.map(c=>[c,CICLO[c]||c]),x.ciclo||'mensal',null,`${antes(x.ciclo)}${dis}`),{id:'assinatura-ciclo'})}${campo('inicio','Início',v=>`<input type="date" ${v} value="${e(x.inicio||'')}" required${antes(x.inicio)}${dis}>`,{id:'assinatura-inicio'})}${campo('venceEm','Vencimento',v=>`<input type="date" ${v} value="${e(x.venceEm||'')}" required${antes(x.venceEm)}${dis}>`,{id:'assinatura-vence',dica:nova?'O próximo vencimento. Ao escolher o início e o ciclo, a tela sugere o início mais um ciclo.':'Mudar o vencimento muda também o dia de vencimento dos próximos ciclos.'})}${campo('notas','Notas',areaTexto(x.notas,2000,3,`${antes(x.notas)} placeholder="Opcional. Ex.: bônus Nexus Destaque combinado."`),{id:'assinatura-notas',largo:true})}</div>`;
  const nota=cancelada?'A assinatura cancelada só aceita mudança nas notas.':nova?'A assinatura nasce ativa, e o plano vai para o guia logo depois de salvar.':'';
  const form=formulario({attrs:`data-form="assinatura"${nova?' data-novo':` data-id="${e(x.id)}"`} data-cliente="${e(cli.id)}"`,corpo,salvar:nova?'Criar a assinatura':'Salvar a assinatura',nota});
  const extra=`<p class="cabeca-extra"><span>${e(cli.nome)}</span>${nova?'':`${selo(x.situacao,x.dias)}${x.venceEm&&!['suspensa','cancelada'].includes(x.status)?`<span>${prazo(x.dias,x.venceEm)}</span>`:''}`}</p>`;
  const historico=!nova&&vm.pode?.auditoria?`<p class="historico"><a href="/auditoria?recurso=${e(encodeURIComponent(x.id))}">Ver esta assinatura na auditoria <span aria-hidden="true">→</span></a></p>`:'';
  const sync=nova?'':`${sincronizacao(x.sincronizacao)}${historico}`;
  return moldura(vm,{cabeca:{titulo:nova?'Nova assinatura':e(x.empresa?.nome||'Assinatura'),voltar:[`/clientes/${cli.id}`,cli.nome||'Cliente'],extra},corpo:`<div class="formulario-pagina">${sync}${form}${nova?'':acoesAssinatura(x)}</div>`});
}
