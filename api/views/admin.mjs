import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { instante, tempo, whatsapp, campo, texto, areaTexto, escolha, formulario, vazio, icone, sr, PAPEL } from './componentes.mjs';

// Administração (contrato 6.13, 6.14, 7.3 e 7.6): a Equipe e as Configurações. Mudar o papel, gerar o link de senha,
// redefinir o 2FA e mudar a chave Pix pedem a confirmação de identidade (4.6), que o base.js abre quando a API pede.

// Equipe -----------------------------------------------------------------------------------------------------------------

// O que cada papel faz, pela tabela 3.1 do contrato.
const PAPEIS=[['admin','Tudo, inclusive a importação, a Equipe, as Configurações e a Auditoria.'],['financeiro','Assinaturas, pagamentos e estornos, e a cobrança no WhatsApp.'],
  ['comercial','Clientes e empresas do guia, assinaturas e a cobrança no WhatsApp.'],['leitura','Vê o Resumo, as Renovações e os clientes, sem mudar nada.']];
const opcoesPapel=PAPEIS.map(([p])=>[p,PAPEL[p]]);
const ajudaPapeis=`<dl class="papeis">${PAPEIS.map(([p,t])=>`<div><dt>${PAPEL[p]}</dt><dd>${t}</dd></div>`).join('')}</dl>`;

function membro(m,eu) {
  const id=e(m.id),proprio=m.id===eu,nome=e(m.nome||m.email);
  const situacao=m.desativado?'<span class="selo">Desativada</span>':m.convitePendente?`<span class="selo is-a-vencer">${m.convitePendente.vencido?'Convite vencido':'Convite enviado'}</span>`:'<span class="selo is-em-dia">Ativa</span>';
  const dois=m.convitePendente?(m.convitePendente.vencido?`O convite venceu em ${tempo(m.convitePendente.expira)}. Gere um link novo.`:`Convite vale até ${tempo(m.convitePendente.expira)}.`)
    :m.doisFatores?'Verificação em duas etapas ativa.':'Ainda não configurou a verificação em duas etapas.';
  const acesso=m.ultimoAcesso?`Último acesso em ${tempo(m.ultimoAcesso)}.`:'Ainda não entrou.';
  const editar=`<details class="acao"><summary class="botao-texto">Editar${sr(` ${nome}`)}</summary>${formulario({attrs:`data-form="membro" data-id="${id}" data-version="${e(m.version)}"`,corpo:`<div class="grade">${campo('nome','Nome',texto(m.nome,120,` required data-antes="${e(m.nome)}"`),{id:`membro-${id}-nome`})}${proprio?`<div class="campo"><p class="rotulo">Papel</p><p>${e(PAPEL[m.papel]||m.papel)} <span class="muted">(você não muda o próprio papel)</span></p></div>`:campo('papel','Papel',escolha(opcoesPapel,m.papel,null,` data-antes="${e(m.papel)}"`),{id:`membro-${id}-papel`,dica:'Mudar o papel pede a confirmação da sua senha ou de um código.'})}</div>`,salvar:'Salvar'})}</details>`;
  const outras=proprio?'':[
    !m.desativado&&`<button type="button" class="botao-texto" data-link-senha="${id}">${m.convitePendente?'Gerar um convite novo':'Gerar link de senha'}${sr(` para ${nome}`)}</button>`,
    !m.desativado&&m.doisFatores&&`<button type="button" class="botao-texto perigo" data-redefinir-2fa="${id}" data-version="${e(m.version)}">Redefinir o 2FA${sr(` de ${nome}`)}</button>`,
    `<button type="button" class="botao-texto perigo" data-desativar="${id}" data-version="${e(m.version)}" data-valor="${m.desativado?'false':'true'}">${m.desativado?'Reativar a conta':'Desativar a conta'}${sr(` de ${nome}`)}</button>`
  ].filter(Boolean).join('');
  return `<li class="membro${m.desativado?' is-desativado':''}" id="membro-${id}"><div class="membro-quem"><p class="membro-nome">${nome}${proprio?' <span class="muted">(você)</span>':''}</p><p class="membro-apoio">${e(m.email)} · ${e(PAPEL[m.papel]||m.papel)}</p></div><div class="membro-estado"><p>${situacao}</p><p class="membro-apoio">${dois} ${acesso}</p></div><div class="membro-acoes">${editar}${outras}</div><div class="link-resultado" data-link-resultado="${id}" hidden></div></li>`;
}
export function equipe(vm) {
  const itens=vm.dados?.itens||[],eu=vm.usuario?.id;
  const convidar=`<details class="vincular" id="convidar"><summary class="botao">${icone('mais')}Convidar alguém</summary>${formulario({attrs:'data-form="convite"',corpo:`<div class="grade">${campo('nome','Nome',texto('',120,' required autocomplete="off"'),{id:'convite-nome'})}${campo('email','E-mail',v=>`<input type="email" ${v} maxlength="160" inputmode="email" autocomplete="off" spellcheck="false" autocapitalize="off" required>`,{id:'convite-email',dica:'É o login da pessoa na gestão.'})}${campo('papel','Papel',escolha(opcoesPapel,'comercial'),{id:'convite-papel'})}</div>${ajudaPapeis}`,salvar:'Criar o convite',nota:'A gestão não manda e-mail: o link do convite aparece aqui, para você mandar pelo WhatsApp. Ele vale 72 horas.'})}</details><div class="link-resultado" data-link-resultado="convite" hidden></div>`;
  const lista=itens.length?`<ul class="membros">${itens.map(m=>membro(m,eu)).join('')}</ul>`:vazio('Ninguém na equipe ainda');
  return moldura(vm,{cabeca:{titulo:'Equipe',texto:'Quem entra na gestão e o que cada um pode fazer.'},corpo:`<div class="equipe">${convidar}${lista}</div>`});
}

// Configurações --------------------------------------------------------------------------------------------------------

// A mesma troca do servidor (contrato 7.3): só as variáveis da lista; o que está entre chaves e não é variável fica como
// está. Na pré-visualização, a chave Pix é a do campo (vazia, como sai sem ela) e as demais vêm dos exemplos.
// semDesempenho: a prévia de quando a {desempenho} fica vazia (7.3), que sai junto com o espaço antes dela ou, sem ele, com o
// espaço depois. O p2/admin.js faz o mesmo no navegador.
// extra troca o exemplo de uma variável (o {prazo} do lembrete, que ainda não venceu).
export function previa(modelo,variaveis,chavePix,{semDesempenho=false,extra={}}={}) {
  const chaves=new Set((variaveis||[]).map(v=>v.chave));
  const valores={...Object.fromEntries((variaveis||[]).map(v=>[v.chave,v.chave==='chave_pix'?chavePix??'':v.exemplo])),...Object.fromEntries(Object.entries(extra).filter(([k])=>chaves.has(k)))};
  let texto=String(modelo||'');
  if('desempenho' in valores&&(semDesempenho||!valores.desempenho)){valores.desempenho='';texto=texto.replace(/ \{desempenho\}|\{desempenho\} ?/g,'');}
  return texto.replace(/\{(\w+)\}/g,(m,k)=>k in valores?String(valores[k]??''):m);
}
// A escolha da prévia "com a frase do desempenho" ou "sem ela": só quando a variável existe, e escondida enquanto o modelo
// não a usa. nome: o do grupo de opções, um por modelo.
const opcaoDesempenho=(variaveis,modelo,nome='previaDesempenho')=>(variaveis||[]).some(v=>v.chave==='desempenho')
  ?`<fieldset class="escolha previa-opcao" data-previa-desempenho${/\{desempenho\}/.test(modelo||'')?'':' hidden'}><legend class="sr-only">Na prévia, o desempenho no guia</legend><label><input type="radio" name="${nome}" value="com" checked><span>Com a frase do desempenho</span></label><label><input type="radio" name="${nome}" value="sem"><span>Sem a frase (empresa sem medição ou sem visitas)</span></label></fieldset>`:'';
// As pílulas que inserem a variável no modelo e a legenda do que cada uma mostra. O admin.js liga cada grupo ao modelo do
// mesmo bloco (a cobrança ou o relatório).
const pilulas=(variaveis,rotulo)=>`<div class="variaveis" role="group" aria-label="${rotulo}">${variaveis.map(v=>`<button type="button" class="aba" data-variavel="${e(v.chave)}" title="${e(v.descricao)}">{${e(v.chave)}}<span class="sr-only">: ${e(v.descricao)}</span></button>`).join('')}</div>`;
const legendaVariaveis=variaveis=>`<details class="legenda"><summary class="botao-texto">O que cada variável mostra</summary><dl class="papeis">${variaveis.map(v=>`<div><dt>{${e(v.chave)}}</dt><dd>${e(v.descricao)}. Ex.: ${e(v.exemplo)}</dd></div>`).join('')}</dl></details>`;
// A mensagem do relatório do mês (6.14 e 7.3, v0.11.0): o modelo próprio, com as variáveis dele e a prévia pela mesma regra.
function modeloRelatorio(c) {
  const vr=c.variaveisRelatorio||[];
  if(!vr.length)return '';
  const exemplos=e(JSON.stringify(Object.fromEntries(vr.map(v=>[v.chave,v.exemplo]))));
  return `<fieldset class="secao-form" data-modelo-relatorio data-variaveis="${e(vr.map(v=>v.chave).join(','))}" data-exemplos="${exemplos}"><legend>Mensagem do relatório do mês</legend><p class="secao-texto">Vai pelo WhatsApp do cliente quando alguém toca em "Enviar o relatório" na ficha. O {link} leva à página do relatório no painel do guia, que pede o login do cliente.</p>${campo('modeloRelatorio','Modelo da mensagem do relatório',areaTexto(c.modeloRelatorio,1000,5,` required minlength="20" data-antes="${e(c.modeloRelatorio)}"`),{id:'config-relatorio',dica:'De 20 a 1.000 caracteres, com o {link} pelo menos uma vez.',largo:true})}${pilulas(vr,'Inserir uma variável na mensagem do relatório')}${legendaVariaveis(vr)}<div class="previa" aria-labelledby="previa-relatorio-titulo"><p class="previa-titulo" id="previa-relatorio-titulo">Como a mensagem do relatório chega, com um cliente de exemplo</p><p class="balao" data-previa aria-live="polite">${e(previa(c.modeloRelatorio,vr,''))}</p>${opcaoDesempenho(vr,c.modeloRelatorio,'previaDesempenhoRelatorio')}</div></fieldset>`;
}
// As mensagens dos lembretes da régua (15.4, v0.14.0): um modelo opcional por etapa, na ordem de etapas. Cada etapa abre e
// fecha, com o estado no resumo ("Mensagem própria" ou "Usa a mensagem de cobrança"), as pílulas e a prévia dela. Vazia, a
// prévia mostra a mensagem de cobrança, que é a que sai. O {prazo} da prévia segue 7.3 para quem ainda não venceu: "vence
// hoje" na etapa do dia e "vence em" + o exemplo do {vencimento} nas outras.
const prazoLembrete=(dias,variaveis)=>{const venc=(variaveis||[]).find(v=>v.chave==='vencimento')?.exemplo||'';return Number(dias)===0?'vence hoje':`vence em ${venc}`.trim();};
const ESTADO_ETAPA=['Usa a mensagem de cobrança','Mensagem própria'];
function modelosLembrete(c,variaveis) {
  const etapas=c.etapas||[],m=c.modelosLembrete||{};
  if(!etapas.length)return '';
  const itens=etapas.map(x=>{
    const k=String(x.dias),valor=String(m[k]??''),nome=e(x.nome),id=`config-lembrete-${e(k)}`,extra={prazo:prazoLembrete(x.dias,variaveis)};
    const proprio=Boolean(valor.trim()),texto=previa(proprio?valor:c.modeloMensagem,variaveis,c.chavePix,{extra});
    const area=campo(`modelosLembrete.${k}`,`Mensagem da etapa: ${nome}`,areaTexto(valor,1000,5,` placeholder="Vazio: usa a mensagem de cobrança." data-antes="${e(valor)}" data-etapa="${e(k)}"`),{id,dica:'Opcional. De 20 a 1.000 caracteres, com as mesmas variáveis da cobrança.',largo:true});
    return `<details class="etapa-modelo" data-modelo-bloco data-etapa-bloco="${e(k)}" data-prazo="${e(extra.prazo)}"${proprio?' open':''}><summary><span class="etapa-modelo-nome">${icone('lembrete')}<span>${nome}</span></span><span class="etapa-modelo-estado${proprio?' is-proprio':''}" data-estado-etapa>${ESTADO_ETAPA[proprio?1:0]}</span></summary><div class="etapa-modelo-corpo">${area}${pilulas(variaveis,`Inserir uma variável na mensagem da etapa: ${nome}`)}<div class="previa" aria-labelledby="${id}-previa-titulo"><p class="previa-titulo" id="${id}-previa-titulo">Como o lembrete chega, com um cliente de exemplo</p><p class="previa-origem" data-previa-origem${proprio?' hidden':''}>Esta etapa não tem mensagem própria: sai a mensagem de cobrança.</p><p class="balao" data-previa aria-live="polite">${e(texto)}</p>${opcaoDesempenho(variaveis,proprio?valor:c.modeloMensagem,`previaDesempenho-${k}`)}</div></div></details>`;
  }).join('');
  return `<fieldset class="secao-form" data-modelos-lembrete data-estados="${e(JSON.stringify(ESTADO_ETAPA))}"><legend>Mensagens dos lembretes</legend><p class="secao-texto">Cada etapa da régua de lembretes pode ter a sua mensagem. Sem ela, o lembrete da etapa usa a mensagem de cobrança.</p><div class="etapas-modelos">${itens}</div></fieldset>`;
}
export function configuracoes(vm) {
  const c=vm.dados||{},variaveis=c.variaveis||[];
  const chips=pilulas(variaveis,'Inserir uma variável no modelo');
  const legenda=legendaVariaveis(variaveis);
  const corpo=`<input type="hidden" name="version" value="${e(c.version??'')}"><fieldset class="secao-form"><legend>Como o afiliado paga</legend><p class="secao-texto">A chave Pix e o WhatsApp do atendimento aparecem na "Minha assinatura", no painel do afiliado no guia. Mudar um dos dois pede a confirmação da sua senha ou de um código e atualiza a "Minha assinatura" de todas as empresas com assinatura.</p><div class="grade">${campo('chavePix','Chave Pix',texto(c.chavePix,77,` autocomplete="off" spellcheck="false" autocapitalize="off" data-antes="${e(c.chavePix)}"`),{id:'config-pix',dica:'Também vai na mensagem de cobrança: e-mail, telefone, CNPJ ou chave aleatória.'})}${campo('whatsappAtendimento','WhatsApp do atendimento',v=>`<input type="tel" ${v} value="${e(c.whatsappAtendimento?whatsapp(c.whatsappAtendimento):'')}" inputmode="tel" maxlength="20" autocomplete="off" placeholder="(21) 98765-4321" data-antes="${e(c.whatsappAtendimento?whatsapp(c.whatsappAtendimento):'')}">`,{id:'config-whatsapp',dica:'O número do Nexus com quem o afiliado fala sobre o pagamento. Com DDD.'})}</div></fieldset><fieldset class="secao-form"><legend>Mensagem de cobrança</legend>${campo('modeloMensagem','Modelo da mensagem',areaTexto(c.modeloMensagem,1000,6,` required minlength="20" data-antes="${e(c.modeloMensagem)}"`),{id:'config-modelo',dica:'De 20 a 1.000 caracteres. As palavras entre chaves viram os dados de cada cliente.',largo:true})}${chips}${legenda}<div class="previa" aria-labelledby="previa-titulo"><p class="previa-titulo" id="previa-titulo">Como a mensagem chega, com um cliente de exemplo</p><p class="balao" data-previa aria-live="polite">${e(previa(c.modeloMensagem,variaveis,c.chavePix))}</p>${opcaoDesempenho(variaveis,c.modeloMensagem)}</div></fieldset>${modelosLembrete(c,variaveis)}${modeloRelatorio(c)}<fieldset class="secao-form"><legend>Tolerância</legend>${campo('toleranciaDias','Dias de tolerância depois do vencimento',v=>`<input type="number" ${v} value="${e(c.toleranciaDias??10)}" min="0" max="60" step="1" inputmode="numeric" required data-antes="${e(c.toleranciaDias??'')}">`,{id:'config-tolerancia',dica:'Até aqui, a assinatura vencida continua com o plano no guia. Depois, vira inadimplente e o plano pago sai do guia na rotina do dia seguinte. De 0 a 60 dias.'})}</fieldset>`;
  const atualizado=c.atualizadoEm?`Atualizado em ${tempo(c.atualizadoEm)}${c.atualizadoPor?.nome?` por ${e(c.atualizadoPor.nome)}`:''}.`:'Ainda com os valores da instalação.';
  const form=formulario({attrs:`data-form="configuracoes" data-variaveis="${e(variaveis.map(v=>v.chave).join(','))}"`,corpo,salvar:'Salvar as configurações',nota:atualizado});
  const sobre=`Só os dados do negócio: a chave Pix, o WhatsApp do atendimento, a mensagem de cobrança,${c.etapas?.length?' as dos lembretes,':''} a do relatório do mês e a tolerância.`;
  return moldura(vm,{cabeca:{titulo:'Configurações',texto:sobre},corpo:`<div class="formulario-pagina configuracoes" data-exemplos="${e(JSON.stringify(Object.fromEntries(variaveis.map(v=>[v.chave,v.exemplo]))))}">${form}</div>`});
}
