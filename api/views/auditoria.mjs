import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { reais, dia, instante, tempo, plural, vazio, paginacao, endereco, CICLO, FORMA, PAPEL } from './componentes.mjs';

// Auditoria (contrato 4.8 e 6.15): quem fez o quê e quando, com o antes e o depois, só para o admin. Os filtros são um
// formulário GET (a URL guarda a busca), e o histórico de um registro vem pelo ?recurso=<id>.

// O nome de cada ação (4.8, 7.5 e 9.3). A que não está aqui aparece com o código, sem os traços.
export const ACAO={
  login:'Entrou',login_falha:'Senha errada no login',login_bloqueado:'Conta bloqueada por tentativas',codigo_falha:'Código do 2FA errado',codigo_recuperacao_usado:'Entrou com um código de recuperação',
  '2fa_configurado':'Configurou o 2FA','2fa_redefinido':'Redefiniu o 2FA de alguém',logout:'Saiu',senha_definida:'Definiu a senha pelo link',
  reautenticacao:'Confirmou a identidade',reautenticacao_falha:'Errou a confirmação de identidade',
  membro_convidado:'Convidou para a equipe',membro_editado:'Mudou nome, papel ou acesso',link_senha_gerado:'Gerou um link de senha',
  admin_cli:'Admin criado pelo CLI',link_senha_cli:'Link de senha gerado pelo CLI','2fa_redefinido_cli':'2FA redefinido pelo CLI',
  cliente_criado:'Cadastrou um cliente',cliente_editado:'Editou um cliente',empresa_vinculada:'Vinculou uma empresa do guia',empresa_desvinculada:'Desvinculou uma empresa do guia',
  assinatura_criada:'Criou uma assinatura',assinatura_editada:'Editou uma assinatura',assinatura_suspensa:'Suspendeu uma assinatura',assinatura_reativada:'Reativou uma assinatura',assinatura_cancelada:'Cancelou uma assinatura',
  pagamento_registrado:'Registrou um pagamento',pagamento_estornado:'Estornou um pagamento',cobranca_registrada:'Cobrou pelo WhatsApp',
  configuracoes_editadas:'Mudou as Configurações',importacao_enviada:'Enviou um arquivo para importar',importacao_confirmada:'Confirmou uma importação',importacao_descartada:'Descartou uma prévia de importação',
  plano_enviado:'Plano enviado ao guia',sincronizacao_conferida:'Conferência diária com o guia'
};
export const nomeAcao=a=>ACAO[a]||String(a||'').replace(/[_.:-]+/g,' ').trim();
const TIPO={usuario:'Conta da equipe',cliente:'Cliente',assinatura:'Assinatura',empresa:'Empresa do guia',configuracoes:'Configurações',importacao:'Importação'};
const CAMPO={nome:'Nome',email:'E-mail',papel:'Papel',desativado:'Desativada',responsavel:'Responsável',whatsapp:'WhatsApp',notas:'Notas',status:'Situação',empresa:'Empresa',plano:'Plano',
  valorCentavos:'Valor',ciclo:'Ciclo',inicio:'Início',venceEm:'Vencimento',motivo:'Motivo',canceladaEm:'Cancelada em',forma:'Forma',pagoEm:'Pago em',obs:'Observação',
  chavePix:'Chave Pix',modeloMensagem:'Modelo da mensagem',toleranciaDias:'Tolerância (dias)',gerida:'Gerida pela gestão',assinatura:'Assinatura',tipo:'Tipo',alterado:'O guia mudou'};
// Valores do antes e do depois, formatados pelo nome do campo (dinheiro, dia, instante, papel, ciclo e forma).
function valor(k,v) {
  if(v==null||v==='')return '<span class="muted">—</span>';
  if(typeof v==='boolean')return v?'Sim':'Não';
  if(/Centavos$/.test(k)&&Number.isFinite(Number(v)))return reais(v);
  if(k==='papel')return e(PAPEL[v]||v);
  if(k==='ciclo')return e(CICLO[v]||v);
  if(k==='forma')return e(FORMA[v]||v);
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return dia(v);
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v))return e(instante(v));
  const t=typeof v==='object'?JSON.stringify(v):String(v);
  return e(t.length>200?`${t.slice(0,197)}…`:t);
}
function mudancas(x) {
  const antes=x.antes&&typeof x.antes==='object'?x.antes:{},depois=x.depois&&typeof x.depois==='object'?x.depois:{};
  const chaves=[...new Set([...Object.keys(antes),...Object.keys(depois)])];
  if(!chaves.length)return '<span class="muted">—</span>';
  const linha=k=>{const temAntes=k in antes,temDepois=k in depois;
    return `<div><dt>${e(CAMPO[k]||k)}</dt><dd>${temAntes?`<span class="audit-antes">${valor(k,antes[k])}</span>`:''}${temAntes&&temDepois?' <span aria-hidden="true">→</span><span class="sr-only"> passou a </span> ':''}${temDepois?`<span class="audit-depois">${valor(k,depois[k])}</span>`:''}</dd></div>`;};
  return `<details class="audit-mudanca"><summary class="botao-texto">${plural(chaves.length,'campo','campos')}</summary><dl>${chaves.map(linha).join('')}</dl>${x.ip?`<p class="muted">IP ${e(x.ip)}</p>`:''}</details>`;
}
const HREF={cliente:id=>`/clientes/${encodeURIComponent(id)}`,assinatura:id=>`/assinaturas/${encodeURIComponent(id)}`,configuracoes:()=>'/configuracoes',usuario:id=>`/equipe#membro-${encodeURIComponent(id)}`};
function recurso(r) {
  if(!r?.id&&!r?.tipo)return '<span class="muted">—</span>';
  const tipo=e(TIPO[r.tipo]||r.tipo||''),abrir=HREF[r.tipo]&&r.tipo!=='usuario'?HREF[r.tipo](r.id):'';
  const id=r.tipo==='configuracoes'?'':`<span class="audit-id">${e(r.id)}</span>`;
  return `<span class="audit-recurso">${abrir?`<a href="${e(abrir)}">${tipo}</a>`:tipo}${id}${r.id&&r.tipo!=='configuracoes'?`<a class="audit-historico" href="${e(endereco('/auditoria',{recurso:r.id}))}">Histórico</a>`:''}</span>`;
}

export function auditoria(vm) {
  const d=vm.dados||{},f=vm.filtros||{},itens=d.itens||[],o=d.opcoes||{};
  const sel=(v,a)=>String(v)===String(a??'')?' selected':'';
  const acoes=[...(o.acoes||[])].sort((a,b)=>nomeAcao(a).localeCompare(nomeAcao(b),'pt-BR')).map(a=>`<option value="${e(a)}"${sel(a,f.acao)}>${e(nomeAcao(a))}</option>`).join('');
  const pessoas=`<option value="sistema"${sel('sistema',f.usuario)}>Sistema (CLI, rotina e fila)</option>${(o.pessoas||[]).map(p=>`<option value="${e(p.id)}"${sel(p.id,f.usuario)}>${e(p.nome)}</option>`).join('')}`;
  const ativos=['acao','usuario','recurso','de','ate','q'].some(k=>f[k]);
  const filtros=`<form class="filtros filtros-auditoria" method="get" action="/auditoria" role="search" aria-label="Filtrar a auditoria">${f.recurso?`<input type="hidden" name="recurso" value="${e(f.recurso)}">`:''}<div class="campo"><label for="filtro-acao">Ação</label><select id="filtro-acao" name="acao"><option value="">Todas</option>${acoes}</select></div><div class="campo"><label for="filtro-usuario">Quem</label><select id="filtro-usuario" name="usuario"><option value="">Todos</option>${pessoas}</select></div><div class="campo"><label for="filtro-de">De</label><input type="date" id="filtro-de" name="de" value="${e(f.de||'')}"></div><div class="campo"><label for="filtro-ate">Até</label><input type="date" id="filtro-ate" name="ate" value="${e(f.ate||'')}"></div><div class="campo filtros-busca"><label for="filtro-q">Buscar no id do registro ou na ação</label><input type="search" id="filtro-q" name="q" value="${e(f.q||'')}" maxlength="80" autocomplete="off"></div><div class="filtros-acoes"><button type="submit" class="botao secundario">Filtrar</button>${ativos?'<a class="botao-texto" href="/auditoria">Limpar os filtros</a>':''}</div></form>`;
  const historico=f.recurso?`<p class="aviso">Histórico de um registro: <code>${e(f.recurso)}</code>. <a href="${e(endereco('/auditoria',{...f,recurso:'',page:''}))}">Ver tudo</a></p>`:'';
  const quem=x=>x.por?`${e(x.por.nome||x.por.email)}${x.por.nome&&x.por.email?`<span class="linha-apoio">${e(x.por.email)}</span>`:''}`:'<span class="muted">Sistema</span>';
  const linha=x=>`<tr><td data-rotulo="Quando">${tempo(x.em)}</td><th scope="row">${e(nomeAcao(x.acao))}<span class="linha-apoio">${e(x.acao)}</span></th><td data-rotulo="Quem">${quem(x)}</td><td data-rotulo="Registro">${recurso(x.recurso)}</td><td data-rotulo="O que mudou">${mudancas(x)}</td></tr>`;
  const lista=itens.length?`<p class="contagem">${plural(d.total,'registro','registros')}, do mais novo para o mais antigo</p><div class="tabela-caixa"><table class="tabela tabela-auditoria"><thead><tr><th scope="col">Quando</th><th scope="col">Ação</th><th scope="col">Quem</th><th scope="col">Registro</th><th scope="col">O que mudou</th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`
    :vazio(ativos?'Nenhum registro com esses filtros':'Nenhum registro ainda',ativos?'Mude ou limpe os filtros.':'Cada login, mudança e pagamento entra aqui, com quem fez e quando.');
  const pag=paginacao(d,p=>endereco('/auditoria',{...f,page:p}));
  return moldura(vm,{cabeca:{titulo:'Auditoria',texto:'Quem fez o quê, e quando, com o antes e o depois. Nada aqui pode ser apagado.'},corpo:`${filtros}${historico}${lista}${pag}`});
}
