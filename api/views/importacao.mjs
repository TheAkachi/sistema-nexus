import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { reais, numero, plural, dia, tempo, whatsapp, campo, formulario, vazio, paginacao, endereco, icone, sr, CICLO, POR_CICLO } from './componentes.mjs';

// Importação (contrato 6.11, 6.12 e 8): o envio do CSV e a lista das importações, e a prévia, onde a equipe confere cada
// linha, escolhe a empresa do guia que faltou, ignora o que não deve entrar e confirma (com a confirmação de identidade)
// ou descarta. Nada é gravado em clientes e assinaturas antes de confirmar. O importacao.js faz as escritas.

export const TIPO={edirectory:'Exportação do eDirectory',planilha:'Planilha de controle'};
const STATUS={previa:['a-vencer','Prévia aberta'],confirmada:['em-dia','Confirmada'],descartada:['cancelada','Descartada'],expirada:['cancelada','Expirada']};
const ACAO={novo:['em-dia','Novo'],atualizar:['a-vencer','Atualizar'],igual:['suspensa','Igual'],ignorar:['cancelada','Ignorada'],erro:['inadimplente','Erro']};
const SITUACAO={ativa:'Ativa',suspensa:'Suspensa',cancelada:'Cancelada'};
const CAMPO={empresa:'empresa',plano:'plano',valorCentavos:'valor',ciclo:'ciclo',venceEm:'vencimento',status:'situação'};
const SEPARADOR={';':'ponto e vírgula',',':'vírgula',tab:'tabulação'};
const CODIFICACAO={'utf-8':'UTF-8','windows-1252':'Windows-1252'};
const marca=([cls,texto])=>`<span class="selo is-${e(cls)}">${e(texto)}</span>`;
const situacaoDe=s=>marca(STATUS[s]||['cancelada',s||'']);

// Resumo de uma importação, numa frase: o que entra e o que fica de fora.
function frase(r={}) {
  const entra=[Number(r.novos)&&plural(r.novos,'novo','novos'),Number(r.atualizados)&&plural(r.atualizados,'atualizado','atualizados')].filter(Boolean);
  const fora=[Number(r.iguais)&&plural(r.iguais,'igual','iguais'),Number(r.ignorados)&&plural(r.ignorados,'ignorado','ignorados'),Number(r.erros)&&`${plural(r.erros,'linha','linhas')} com erro`].filter(Boolean);
  return `${entra.length?entra.join(' e '):'Nenhuma linha entra'}${Number(r.semEmpresa)?` (${plural(r.semEmpresa,'sem empresa do guia','sem empresa do guia')})`:''}${fora.length?`. Ficam de fora: ${fora.join(', ')}`:''}.`;
}

// Envio e lista (6.11) -----------------------------------------------------------------------------------------------

export function importacao(vm) {
  const d=vm.dados||{},itens=d.itens||[];
  const tipos=`<fieldset class="campo" data-campo="tipo"><legend class="rotulo">De onde vem o arquivo</legend><div class="escolha escolha-tipo"><label><input type="radio" name="tipo" value="edirectory" checked><span><strong>Exportação do eDirectory</strong><small>Conteúdo → Exportação → Anúncios, no painel antigo.</small></span></label><label><input type="radio" name="tipo" value="planilha"><span><strong>Planilha de controle</strong><small>A planilha de quem pagou, salva como CSV.</small></span></label></div><p class="campo-erro" id="campo-tipo-erro" hidden></p></fieldset>`;
  const arquivo=campo('arquivo','Arquivo CSV',a=>`<input type="file" ${a} accept=".csv,.txt,text/csv,text/plain" required>`,{id:'importacao-arquivo',dica:'Até 2 MB e 2.000 linhas, em UTF-8 ou Windows-1252, separado por ponto e vírgula, vírgula ou tabulação. A primeira linha é o cabeçalho.'});
  const envio=`<section class="bloco" aria-labelledby="importacao-envio"><h2 id="importacao-envio">Enviar um arquivo</h2>${formulario({attrs:'data-form="importacao"',corpo:`${tipos}${arquivo}`,salvar:'Enviar e ver a prévia',nota:'Primeiro vem a prévia: nada é gravado até você conferir e confirmar. O arquivo não fica guardado, e a prévia vale 24 horas. Reenviar o mesmo arquivo não duplica nada.'})}</section>`;
  const linha=x=>`<tr><td data-rotulo="Enviada">${tempo(x.criadaEm)}${x.criadaPor?.nome?`<span class="linha-apoio">por ${e(x.criadaPor.nome)}</span>`:''}</td><th scope="row">${e(TIPO[x.tipo]||x.tipo)}<span class="linha-apoio">${plural(x.linhas,'linha','linhas')}</span></th><td data-rotulo="Situação">${situacaoDe(x.status)}${x.confirmadaEm?`<span class="linha-apoio">em ${tempo(x.confirmadaEm)}</span>`:''}</td><td data-rotulo="Resumo">${frase(x.resumo)}</td><td data-rotulo="Abrir"><a class="${x.status==='previa'?'botao secundario pequeno':'botao-texto'}" href="/importacao/${e(x.id)}">${x.status==='previa'?'Abrir a prévia':'Ver o resumo'}${sr(` de ${e(TIPO[x.tipo]||x.tipo)} enviada em ${e(dia(String(x.criadaEm||'').slice(0,10)))}`)}</a></td></tr>`;
  const lista=itens.length?`<p class="contagem">${plural(d.total,'importação','importações')}, da mais nova para a mais antiga</p><div class="tabela-caixa"><table class="tabela tabela-importacoes"><thead><tr><th scope="col">Enviada</th><th scope="col">Arquivo</th><th scope="col">Situação</th><th scope="col">Resumo</th><th scope="col"><span class="sr-only">Abrir</span></th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`
    :vazio('Nenhuma importação ainda','Quando você enviar a exportação do eDirectory ou a planilha, a prévia e o resumo de cada envio aparecem aqui.');
  const historico=`<section class="bloco" aria-labelledby="importacao-lista"><h2 id="importacao-lista">Importações</h2>${lista}${paginacao(d,p=>endereco('/importacao',{page:p}))}</section>`;
  return moldura(vm,{cabeca:{titulo:'Importação',texto:'Traga a carteira da exportação do eDirectory ou da planilha de controle do Nexus.'},corpo:`<div class="importacao">${envio}${historico}</div>`});
}

// Prévia (6.12) --------------------------------------------------------------------------------------------------------

const NUMEROS=[['novos','Novos','novo'],['atualizados','Atualizados','atualizar'],['semEmpresa','Sem empresa do guia','sem-empresa'],['iguais','Iguais','igual'],['ignorados','Ignorados','ignorar'],['erros','Com erro','erro']];
// A empresa da linha e o que a equipe pode fazer com ela: usar uma sugestão, buscar outra no guia ou tirar a empresa.
function empresaDaLinha(l,aberta) {
  const n=l.linha;
  const atual=l.empresa?`<p class="linha-empresa">${icone('clientes')}<span>${e(l.empresa.nome)}</span></p>`:`<p class="linha-empresa is-falta">${icone('aviso')}<span>Sem empresa do guia${l.acao==='erro'?'':': entra assim mesmo, e a empresa é vinculada depois, na ficha'}</span></p>`;
  if(!aberta||l.acao==='erro'||l.acao==='igual'&&l.empresa)return atual;
  const sugestoes=!l.empresa&&(l.sugestoes||[]).length?`<div class="sugestoes"><p class="linha-apoio">Parecidas no guia:</p>${l.sugestoes.map(s=>`<button type="button" class="botao secundario pequeno" data-empresa-linha="${n}" data-empresa="${e(s.id)}">Usar ${e(s.nome)}${sr(` na linha ${n}`)}</button>`).join('')}</div>`:'';
  const tirar=l.empresa?`<button type="button" class="botao-texto perigo" data-empresa-linha="${n}" data-empresa="">Tirar a empresa${sr(` da linha ${n}`)}</button>`:'';
  const buscar=`<details class="buscar-empresa" data-buscar-linha="${n}"><summary class="botao-texto">${l.empresa?'Trocar a empresa':'Buscar outra empresa'}${sr(` da linha ${n}`)}</summary><form class="vincular-busca" role="search" data-busca-empresa novalidate><div class="campo"><label for="busca-linha-${n}">Nome da empresa no guia</label><div class="busca-linha"><input type="search" id="busca-linha-${n}" name="q" maxlength="80" autocomplete="off" required><button type="submit" class="botao secundario">Buscar</button></div></div></form><p class="sr-only" data-busca-status aria-live="polite"></p><ul class="empresas-busca" data-resultados></ul></details>`;
  return `${atual}${sugestoes}<div class="linha-acoes-empresa">${buscar}${tirar}</div>`;
}
function linhaPrevia(l,aberta) {
  const n=l.linha,c=l.cliente||{};
  const contato=[c.email,c.whatsapp&&whatsapp(c.whatsapp)].filter(Boolean).map(e).join(' · ');
  const dados=l.acao==='erro'?'':`<dl class="linha-dados"><div><dt>Plano</dt><dd>${l.plano?e(l.plano.nome):'<span class="muted">Sem plano</span>'}</dd></div><div><dt>Valor</dt><dd>${l.valorCentavos!=null?`${reais(l.valorCentavos)} ${POR_CICLO[l.ciclo]||''}`:'—'}</dd></div><div><dt>Ciclo</dt><dd>${e(CICLO[l.ciclo]||l.ciclo||'—')}</dd></div><div><dt>Vencimento</dt><dd>${l.venceEm?dia(l.venceEm):'—'}</dd></div><div><dt>Situação</dt><dd>${e(SITUACAO[l.status]||l.status||'—')}</dd></div></dl>`;
  const mudam=(l.mudancas||[]).length?`<p class="linha-mudam">Muda: ${l.mudancas.map(m=>e(CAMPO[m]||m)).join(', ')}.</p>`:'';
  const aviso=l.aviso?`<p class="linha-aviso">${icone('aviso')}<span>${e(l.aviso)}</span></p>`:'';
  const erro=l.erro?`<p class="linha-erro">${icone('aviso')}<span>${e(l.erro)}</span></p>`:'';
  const ignorar=aberta&&l.acao!=='erro'?`<button type="button" class="botao-texto" data-ignorar-linha="${n}" data-valor="${l.acao==='ignorar'?'false':'true'}">${l.acao==='ignorar'?'Voltar a importar esta linha':'Ignorar esta linha'}${sr(` (linha ${n})`)}</button>`:'';
  return `<li class="linha-importacao is-${e(l.acao)}${!l.empresa&&l.acao!=='erro'?' is-sem-empresa':''}" id="linha-${n}" tabindex="-1" data-acao="${e(l.acao)}"><div class="linha-topo"><p class="linha-numero">Linha ${numero(n)}</p>${marca(ACAO[l.acao]||['suspensa',l.acao])}</div><div class="linha-corpo"><h3>${e(c.nome||'Sem nome no arquivo')}</h3>${contato?`<p class="linha-apoio">${contato}</p>`:''}${l.acao==='erro'?'':empresaDaLinha(l,aberta)}${dados}${mudam}${aviso}${erro}</div>${ignorar?`<div class="linha-rodape">${ignorar}</div>`:''}</li>`;
}

export function importacaoPrevia(vm) {
  const x=vm.dados||{},r=x.resumo||{},a=x.arquivo||{},aberta=x.status==='previa',linhas=x.linhas||[];
  const titulo=aberta?'Prévia da importação':{confirmada:'Importação confirmada',descartada:'Prévia descartada',expirada:'Prévia vencida'}[x.status]||'Importação';
  const arquivo=[plural(a.linhas,'linha','linhas'),a.separador&&`separador ${SEPARADOR[a.separador]||a.separador}`,a.codificacao&&(CODIFICACAO[a.codificacao]||a.codificacao),a.datas&&`datas em ${a.datas}`].filter(Boolean).map(e).join(' · ');
  const extra=`<p class="cabeca-extra">${situacaoDe(x.status)}<span>${e(TIPO[x.tipo]||x.tipo||'')}, enviada em ${tempo(x.criadaEm)}${x.criadaPor?.nome?` por ${e(x.criadaPor.nome)}`:''}</span></p><p class="cabeca-extra"><span>${arquivo}</span>${aberta&&x.expiraEm?`<span>A prévia vale até ${tempo(x.expiraEm)}.</span>`:''}${x.confirmadaEm?`<span>Confirmada em ${tempo(x.confirmadaEm)}.</span>`:''}</p>`;
  const numeros=`<section class="numeros numeros-importacao" aria-label="Resumo da importação">${NUMEROS.map(([k,rotulo,filtro])=>aberta&&linhas.length?`<button type="button" class="numero" data-filtro="${filtro}" aria-pressed="false"><span class="numero-rotulo">${rotulo}</span><strong class="numero-valor">${numero(r[k])}</strong></button>`:`<div class="numero"><span class="numero-rotulo">${rotulo}</span><strong class="numero-valor">${numero(r[k])}</strong></div>`).join('')}</section>`;
  const fechada=!aberta?vazio(x.status==='confirmada'?'Os clientes e as assinaturas foram gravados':x.status==='descartada'?'Nada foi gravado':'A prévia venceu sem ser confirmada',x.status==='confirmada'?'A prévia, com os nomes e os contatos do arquivo, foi apagada ao confirmar. Ficam só estes números.':'A prévia foi apagada, e nada entrou na carteira. Para importar, envie o arquivo de novo.',`<p class="vazio-acoes"><a class="botao${x.status==='confirmada'?' secundario':''}" href="/importacao">${x.status==='confirmada'?'Voltar à Importação':'Enviar o arquivo de novo'}</a>${x.status==='confirmada'?'<a class="botao" href="/clientes">Ver os clientes</a>':''}</p>`):'';
  const filtroAtivo=aberta&&linhas.length?`<p class="filtro-linhas" data-filtro-aviso hidden><span data-filtro-texto></span> <button type="button" class="botao-texto" data-filtro="">Mostrar todas</button></p>`:'';
  const lista=aberta?(linhas.length?`<ol class="linhas-importacao">${linhas.map(l=>linhaPrevia(l,aberta)).join('')}</ol>`:vazio('O arquivo não tem linhas de dados','Confira se a primeira linha é o cabeçalho e se as outras têm os dados.')):'';
  const acoes=aberta?`<section class="importacao-acoes" aria-labelledby="importacao-confirmar"><h2 id="importacao-confirmar" class="sr-only">Confirmar ou descartar</h2><p>${frase(r)}</p><div class="form-acoes"><button type="button" class="botao" data-confirmar-importacao>Confirmar a importação</button><button type="button" class="botao perigo" data-descartar-importacao>Descartar a prévia</button></div><p class="form-nota">Confirmar grava os clientes e as assinaturas de uma vez e manda os planos ao guia. Pede a sua senha ou um código do autenticador.</p></section>`:'';
  return moldura(vm,{cabeca:{titulo,voltar:['/importacao','Importação'],extra},corpo:`<div class="previa-importacao" data-importacao="${e(x.id)}" data-version="${e(x.version??'')}">${numeros}${fechada}${filtroAtivo}${lista}${acoes}</div>`});
}
