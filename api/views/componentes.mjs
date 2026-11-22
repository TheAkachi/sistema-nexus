import { escape as e } from '../lib/html.mjs';

// Peças usadas por mais de uma tela. Tudo que vem do vm passa pelo escape; os textos prontos que uma peça recebe de outra
// (o HTML de um campo, por exemplo) chegam como `html` e entram como estão.

// Formatos (contrato 2.1) ---------------------------------------------------------------------------------------------

// Centavos em reais pt-BR, com espaço comum e o ponto dos milhares: 125000 → "R$ 1.250,00".
export function reais(centavos) {
  const n=Number(centavos);
  if(centavos==null||centavos===''||!Number.isFinite(n))return '—';
  const a=Math.abs(Math.round(n)),inteiro=String(Math.floor(a/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return `${n<0?'-':''}R$ ${inteiro},${String(a%100).padStart(2,'0')}`;
}
// Centavos no campo de valor, sem o "R$": 9900 → "99,00".
export const valorCampo=c=>c==null||c===''?'':reais(c).replace(/^-?R\$ /,'');
export const numero=n=>Number(n||0).toLocaleString('pt-BR');
export const plural=(n,um,varios)=>`${numero(n)} ${Number(n)===1?um:varios}`;
// Dia aaaa-mm-dd em dd/mm/aaaa, sem passar por Date (o fuso não muda a data).
export function dia(v) {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');
  return m?`${m[3]}/${m[2]}/${m[1]}`:'';
}
// Instante ISO no horário de São Paulo: "16/10/2026 às 10:20".
export function instante(v) {
  const d=new Date(v||'');
  if(!v||Number.isNaN(d.getTime()))return '';
  const p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
}
export const tempo=(v,texto=instante(v))=>v?`<time datetime="${e(v)}">${e(texto)}</time>`:'';
// WhatsApp só com dígitos (5521987654321) na máscara brasileira: "(21) 98765-4321".
export function whatsapp(v) {
  const d=String(v||'').replace(/\D/g,''),m=/^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m?`(${m[1]}) ${m[2]}-${m[3]}`:d;
}

export const CICLO={mensal:'Mensal',trimestral:'Trimestral',semestral:'Semestral',anual:'Anual'};
export const POR_CICLO={mensal:'por mês',trimestral:'por trimestre',semestral:'por semestre',anual:'por ano'};
export const FORMA={pix:'Pix',dinheiro:'Dinheiro',cartao:'Cartão',boleto:'Boleto',transferencia:'Transferência','mercado-pago':'Mercado Pago'};
export const PAPEL={admin:'Admin',financeiro:'Financeiro',comercial:'Comercial',leitura:'Leitura'};

// Ícones (traço de 1.6 px, 20 × 20), sempre decorativos: o texto ao lado ou o rótulo do botão diz o que é.
const DESENHOS={
  menu:'M3.5 5.5h13M3.5 10h13M3.5 14.5h13',
  fechar:'M5 5l10 10M15 5L5 15',
  resumo:'M3.5 3.5h5.5v6h-5.5zM11 3.5h5.5v3.5H11zM11 9.5h5.5v7H11zM3.5 12h5.5v4.5h-5.5z',
  indicadores:'M3.5 3.5v13h13M6.5 13l3.2-3.8 2.6 2.2 4.2-5.4',
  renovacoes:'M16.2 7.6A6.6 6.6 0 0 0 4.1 6.4M3.8 12.4a6.6 6.6 0 0 0 12.1 1.2M3.6 3.6v3.2h3.2M16.4 16.4v-3.2h-3.2',
  clientes:'M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 16.5c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6M13 3.4a2.8 2.8 0 0 1 0 5.3M14.6 11.8c1.6.5 2.6 2 2.9 4.2',
  importacao:'M10 3v9M6.5 8.5L10 12l3.5-3.5M3.5 13.5v3h13v-3',
  equipe:'M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 16.5c.6-3.1 2.8-4.8 5.5-4.8s4.9 1.7 5.5 4.8',
  configuracoes:'M4 5.5h7M14 5.5h2M4 10h2M9 10h7M4 14.5h8M15 14.5h1M11 4v3M6 8.5v3M12 13v3',
  auditoria:'M3.6 7.4A7 7 0 1 1 3 10M3 4.4v3h3M10 6.2v4l2.8 1.7',
  sair:'M8 3.5H4.5v13H8M12.5 6.5L16 10l-3.5 3.5M16 10H7.5',
  mais:'M10 4.5v11M4.5 10h11',
  interessados:'M3 11.5l2.4-6.2A1.5 1.5 0 0 1 6.8 4.3h6.4a1.5 1.5 0 0 1 1.4 1l2.4 6.2v3.7a.8.8 0 0 1-.8.8H3.8a.8.8 0 0 1-.8-.8zM3 11.5h4.2l1 2h3.6l1-2H17',atualizar:'M16 10a6 6 0 1 1-1.8-4.3M16 3.8v3.4h-3.4',
  voltar:'M12.5 4.5L7 10l5.5 5.5',
  aviso:'M10 3.5l7 12.5H3zM10 8.5v3.5M10 14.2v.1',
  cadeado:'M5.5 9h9v7.5h-9zM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9',
  lembrete:'M10 3.5a4.5 4.5 0 0 0-4.5 4.5v3L4 13.5h12L14.5 11V8A4.5 4.5 0 0 0 10 3.5zM8.2 16a1.9 1.9 0 0 0 3.6 0',
  whatsapp:'M10 3.2a6.8 6.8 0 0 0-5.9 10.2l-.9 3.4 3.5-.9A6.8 6.8 0 1 0 10 3.2zM7.6 7.3c.2-.4.4-.4.6-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.4.5c.4.8 1.1 1.5 1.9 1.9l.5-.4c.2-.2.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.5c0 .2 0 .4-.4.6-.4.3-1 .5-1.6.4-2-.4-4.1-2.5-4.5-4.5-.1-.6.1-1.2.4-1.6z'
};
export const icone=(nome,cls='')=>`<svg class="icone${cls?` ${cls}`:''}" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="${DESENHOS[nome]||''}"/></svg>`;
export const sr=t=>`<span class="sr-only">${t}</span>`;

// Situação da assinatura (contrato 5.3), sempre com texto: a cor só reforça. Cheia em névoa azul = em dia; contorno azul =
// a vencer; tinta = vencida (é a vez da equipe); vermelho de risco = inadimplente; cinza = parada.
export const SITUACAO={'em-dia':'Ativa','a-vencer':'A vencer',vencida:'Vencida',inadimplente:'Inadimplente',suspensa:'Suspensa',cancelada:'Cancelada','sem-assinatura':'Sem assinatura'};
export function rotuloSituacao(situacao,dias) {
  if(situacao==='a-vencer'&&Number.isFinite(Number(dias))){const d=Number(dias);return d===0?'Vence hoje':d===1?'Vence amanhã':`Vence em ${numero(d)} dias`;}
  return SITUACAO[situacao]||'';
}
export function selo(situacao,dias) {
  const s=situacao||'sem-assinatura',texto=rotuloSituacao(s,dias);
  return texto?`<span class="selo is-${e(s)}">${e(texto)}</span>`:'';
}
// O prazo dito por extenso, ao lado do selo: "Venceu há 5 dias, em 15/10/2026" ou "Vencimento em 24/10/2026".
export function prazo(dias,venceEm) {
  const d=Number(dias),data=tempo(venceEm,dia(venceEm));
  if(!venceEm)return '';
  if(!Number.isFinite(d)||d>=0)return d===0?`Vence hoje, ${data}`:`Vencimento em ${data}`;
  return `${d===-1?'Venceu ontem':`Venceu há ${numero(-d)} dias`}, em ${data}`;
}

// Número do Resumo: o rótulo, o valor grande e uma nota. Com href, o número leva à lista de onde ele sai.
export function numeroResumo({rotulo,valor,nota='',href='',destaque=false}) {
  const dentro=`<span class="numero-rotulo">${e(rotulo)}</span><strong class="numero-valor">${e(valor)}</strong>${nota?`<span class="numero-nota">${e(nota)}</span>`:''}`;
  const cls=`numero${destaque?' is-destaque':''}`;
  return href?`<a class="${cls}" href="${e(href)}">${dentro}</a>`:`<div class="${cls}">${dentro}</div>`;
}

// Miniatura da empresa (48 px, a foto principal do site) ou as iniciais, quando não há foto. Decorativa: o nome vem ao lado.
export function miniatura(empresa,nome='') {
  const base=(empresa?.nome||nome||'').trim(),iniciais=base.split(/\s+/).filter(p=>/^[\p{L}\p{N}]/u.test(p)).slice(0,2).map(p=>p[0].toUpperCase()).join('');
  return empresa?.miniatura?`<img class="miniatura" src="${e(empresa.miniatura)}" alt="" width="48" height="48" loading="lazy" decoding="async">`
    :`<span class="miniatura is-iniciais" aria-hidden="true">${e(iniciais||'?')}</span>`;
}

// Botão do WhatsApp (contrato 7.4): abre o linkWhatsapp numa aba nova e o gestao.js registra o contato ao mesmo tempo.
// Sem link (sem WhatsApp ou sem o "cobrar"), não aparece. O verde é só dos botões que abrem o WhatsApp. O rótulo segue o
// tipo do contato que o servidor registra (7.4): "Lembrar" antes do vencimento e "Cobrar" depois dele.
export function botaoWhatsapp(r,{rotulo=Number(r?.dias)>=0?'Lembrar no WhatsApp':'Cobrar no WhatsApp'}={}) {
  if(!r?.linkWhatsapp)return '';
  const quem=r.cliente?.nome?` ${e(r.cliente.nome)}`:'';
  return `<a class="botao whatsapp" href="${e(r.linkWhatsapp)}" target="_blank" rel="noopener" data-cobrar="${e(r.id)}">${icone('whatsapp')}<span>${e(rotulo)}</span>${sr(`${quem?`:${quem}`:''} (abre o WhatsApp em outra aba)`)}<span class="seta" aria-hidden="true">↗</span></a>`;
}

// Régua de lembretes (contrato 15, v0.14.0): os nomes das etapas vêm do vm (a lista etapas), pelos dias. Sem a lista, ou
// com uma etapa que ela não tem, o nome fica de fora: a tela não inventa nome de etapa.
export const nomesEtapas=etapas=>new Map((etapas||[]).map(x=>[Number(x.dias),String(x.nome??'')]));
export const nomeEtapa=(nomes,dias)=>dias==null||!nomes?'':nomes.get(Number(dias))||'';
// A etapa em destaque na linha: o sino e o nome ("7 dias antes"), com "Etapa da régua" para o leitor de tela.
export function etapaDestaque(nomes,dias) {
  const nome=nomeEtapa(nomes,dias);
  return nome?`<p class="renovacao-etapa"><span class="etapa">${icone('lembrete')}<span>${sr('Etapa da régua: ')}${e(nome)}</span></span></p>`:'';
}

// Último contato da fila: "Cobrado em 16/10/2026 às 10:20 por Bruno"; o lembrete da régua leva a etapa dele ("· 15 dias
// antes"). O gestao.js troca o texto depois de um contato novo.
export function ultimoContato(c,nomes=null) {
  if(!c)return 'Nenhum contato ainda';
  const etapa=c.tipo==='lembrete'?nomeEtapa(nomes,c.etapa):'';
  return `${c.tipo==='lembrete'?'Lembrado':'Cobrado'} em ${tempo(c.em)}${c.por?.nome?` por ${e(c.por.nome)}`:''}${etapa?` · ${e(etapa)}`:''}`;
}

// Linha de renovação (Renovacao, contrato 6.5): quem paga, a empresa, o plano e o valor; o prazo e o último contato; e as
// duas ações da cobrança. No celular vira um cartão, com os botões na largura toda. volta: a lista para onde o pagamento
// volta depois de salvar. nomes: os nomes das etapas da régua (15), para o último contato; comEtapa põe a etapa da
// assinatura em destaque (a janela "Lembrar hoje").
export function linhaRenovacao(r,{pode={},volta='',nomes=null,comEtapa=false}={}) {
  const cliente=r.cliente||{},empresa=r.empresa,id=e(r.id);
  const onde=[empresa?.nome||'Sem empresa do guia',r.plano?.nome||'Sem plano'].map(e).join(' · ');
  const semZap=pode.cobrar&&!r.linkWhatsapp?`<p class="renovacao-falta">${icone('aviso')}<span>Sem WhatsApp cadastrado.${pode.clientes?` <a href="/clientes/${e(cliente.id)}/editar">Cadastrar o WhatsApp<span class="sr-only"> de ${e(cliente.nome)}</span></a>`:''}</span></p>`:'';
  const pagar=pode.pagamentos?`<a class="botao secundario" href="/assinaturas/${id}/pagamento${volta?`?volta=${encodeURIComponent(volta)}`:''}">Registrar pagamento${sr(` de ${e(cliente.nome)}`)}</a>`:'';
  const acoes=[botaoWhatsapp(r),pagar].filter(Boolean).join('');
  return `<li class="renovacao" data-assinatura="${id}"><div class="renovacao-quem">${miniatura(empresa,cliente.nome)}<div><h3><a href="/clientes/${e(cliente.id)}">${e(cliente.nome)}</a></h3><p class="renovacao-onde">${onde}</p><p class="renovacao-valor"><strong>${reais(r.valorCentavos)}</strong> ${POR_CICLO[r.ciclo]||''}</p></div></div><div class="renovacao-prazo">${comEtapa?etapaDestaque(nomes,r.etapa):''}<p class="renovacao-situacao">${selo(r.situacao,r.dias)}<span>${prazo(r.dias,r.venceEm)}</span></p><p class="renovacao-contato" data-ultimo-contato>${ultimoContato(r.ultimoContato,nomes)}</p>${semZap}</div>${acoes?`<div class="renovacao-acoes">${acoes}</div>`:''}</li>`;
}

// Formulários --------------------------------------------------------------------------------------------------------

// Campo com rótulo, dica e o lugar da mensagem de erro, ligados por aria-describedby. controle recebe os atributos
// (id, name e aria-describedby) e devolve o HTML do input, select ou textarea.
export function campo(nome,rotulo,controle,{id=`campo-${nome}`,dica='',largo=false,classe=''}={}) {
  const descr=[dica?`${id}-dica`:'',`${id}-erro`].filter(Boolean).join(' ');
  return `<div class="campo${largo?' is-largo':''}${classe?` ${classe}`:''}" data-campo="${e(nome)}"><label for="${e(id)}">${rotulo}</label>${controle(`id="${e(id)}" name="${e(nome)}" aria-describedby="${descr}"`)}${dica?`<p class="campo-dica" id="${e(id)}-dica">${dica}</p>`:''}<p class="campo-erro" id="${e(id)}-erro" hidden></p></div>`;
}
export const texto=(valor,max,extra='')=>a=>`<input type="text" ${a} value="${e(valor??'')}" maxlength="${max}"${extra}>`;
export const areaTexto=(valor,max,linhas=3,extra='')=>a=>`<textarea ${a} rows="${linhas}" maxlength="${max}"${extra}>${e(valor??'')}</textarea>`;
export const opcoes=(lista,atual)=>lista.map(([v,l])=>`<option value="${e(v)}"${String(v)===String(atual??'')?' selected':''}>${e(l)}</option>`).join('');
export const escolha=(lista,atual,vazio=null,extra='')=>a=>`<select ${a}${extra}>${vazio!=null?`<option value="">${e(vazio)}</option>`:''}${opcoes(lista,atual)}</select>`;
// Senha com o botão "Mostrar" (o gestao.js troca o tipo do campo).
export const senha=(autocomplete,extra='')=>a=>`<div class="senha-caixa"><input type="password" ${a} autocomplete="${autocomplete}" maxlength="128" spellcheck="false" autocapitalize="off"${extra}><button type="button" class="botao secundario pequeno" data-mostrar-senha aria-pressed="false">Mostrar</button></div>`;

// Formulário com um único salvar: os erros no topo (cada um leva ao campo), os campos e a barra de ações, fixa no rodapé
// da tela no celular. attrs vai como está (data-form, data-id, data-version...), já escapado por quem chama. O method="post"
// é defesa: sem JavaScript, o navegador nunca põe os campos (uma senha, por exemplo) na URL.
export function formulario({attrs='',corpo,salvar,nota='',secundarias=''}) {
  return `<form class="formulario" method="post" ${attrs} novalidate><div class="form-erros" role="alert" tabindex="-1" hidden></div>${corpo}${nota?`<p class="form-nota">${nota}</p>`:''}<div class="form-acoes"><button type="submit" class="botao">${salvar}</button>${secundarias}</div></form>`;
}

// Listas -------------------------------------------------------------------------------------------------------------

// Estado vazio útil: o que acontece aqui e, quando houver, o próximo passo.
export const vazio=(titulo,textoApoio='',acao='')=>`<div class="vazio"><p class="vazio-titulo">${titulo}</p>${textoApoio?`<p>${textoApoio}</p>`:''}${acao}</div>`;
// Abas em pílulas, como links (a URL guarda a escolha). itens: [{href, texto, contagem?, atual}].
export const abas=(rotulo,itens)=>`<nav class="abas" aria-label="${e(rotulo)}"><ul>${itens.map(i=>`<li><a class="aba" href="${e(i.href)}"${i.atual?' aria-current="page"':''}>${e(i.texto)}${i.contagem!=null?` <span class="aba-contagem">${numero(i.contagem)}</span>`:''}</a></li>`).join('')}</ul></nav>`;
// Páginas "Anterior" e "Próxima" (lista do contrato 2.2); href(p) monta o endereço de cada página.
export function paginacao(d,href) {
  const p=Number(d?.pagina)||1,n=Math.max(1,Number(d?.paginas)||1);
  if(n<=1&&p<=1)return '';
  const ir=(pg,rotulo,rel)=>`<a class="botao secundario" rel="${rel}" href="${e(href(pg))}">${rotulo}</a>`;
  return `<nav class="paginas" aria-label="Páginas da lista">${p>1?ir(Math.min(p-1,n),'<span aria-hidden="true">←</span> Anterior','prev'):''}<span>Página ${numero(p)} de ${numero(n)}</span>${p<n?ir(p+1,'Próxima <span aria-hidden="true">→</span>','next'):''}</nav>`;
}
// Endereço com a query, sem os filtros vazios nem a página 1.
export function endereco(caminho,params={}) {
  const q=new URLSearchParams();
  for(const [k,v] of Object.entries(params))if(v!==''&&v!=null&&!(k==='page'&&Number(v)<=1))q.set(k,String(v));
  const s=q.toString();
  return `${caminho}${s?`?${s}`:''}`;
}
