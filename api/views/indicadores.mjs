import { escape as e } from '../lib/html.mjs';
import { moldura } from './moldura.mjs';
import { reais, numero, plural, dia, tempo, selo, prazo, vazio, icone } from './componentes.mjs';
import { colunas, opostas, linha, barraHorizontal, reaisCurto } from './graficos.mjs';

// Indicadores, bloco Dinheiro (contrato 6.17 e D9 do plano): a evolução do dinheiro em 12 meses, ao lado do Resumo, que é a
// foto do dia. Cada bloco tem o número principal em texto, o "como" que vem pronto do servidor, o gráfico (decorativo) e a
// tabela com os mesmos números, que é o que o leitor de tela lê e o que se lê melhor no celular. Nenhum número é estimado:
// as somas e os saldos daqui saem só dos números que o servidor mandou.

const MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesNome=m=>MES[Number(String(m||'').slice(5,7))-1]||'';
const ano=m=>String(m||'').slice(0,4);
const mesAno=m=>`${mesNome(m)} de ${ano(m)}`;
const soma=(lista,f)=>lista.reduce((t,x)=>t+(Number(f(x))||0),0);
const ddmm=d=>dia(d).slice(0,5);

// Rótulo do eixo x de cada mês: "out", com o ano embaixo no primeiro mês e em janeiro.
const rotuloMes=(m,i)=>[mesNome(m).slice(0,3),i===0||m.slice(5,7)==='01'?ano(m):''];
// Mês na tabela: curto na tela ("out. 2026", com o ano embaixo no celular), por extenso para o leitor de tela, e "até hoje"
// no mês atual.
const celulaMes=m=>`<th scope="row"><span aria-hidden="true">${mesNome(m.mes).slice(0,3)}.<span class="mes-ano"> ${ano(m.mes)}</span></span><span class="sr-only">${mesAno(m.mes)}</span>${m.parcial?'<span class="linha-apoio">até hoje</span>':''}</th>`;
const tituloMes=m=>`${mesAno(m.mes)}${m.parcial?', até hoje':''}`;
// Valor dentro de uma frase: o R$ e o número nunca ficam em linhas diferentes.
const rs=c=>`<span class="sem-quebra">${reais(c)}</span>`;
const comApoio=(valor,apoio)=>`${valor}${apoio?`<span class="linha-apoio">${apoio}</span>`:''}`;

const tabela=(legenda,cabeca,linhas,rodape='',cls='')=>`<div class="tabela-rolagem"><table class="tabela-dados${cls}"><caption class="sr-only">${legenda}</caption><thead><tr>${cabeca.map((c,i)=>`<th scope="col"${i?' class="num"':''}>${c}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody>${rodape?`<tfoot>${rodape}</tfoot>`:''}</table></div>`;
const legenda=itens=>`<ul class="legenda">${itens.map(([cls,texto])=>`<li><span class="legenda-cor ${cls}"></span>${texto}</li>`).join('')}</ul>`;
// O gráfico com a legenda e a nota: tudo decorativo, porque a tabela traz os mesmos números.
const desenho=(svg,{chaves=[],nota=''}={})=>`<div class="grafico-caixa" aria-hidden="true">${chaves.length?legenda(chaves):''}${svg}${nota?`<p class="grafico-nota">${nota}</p>`:''}</div>`;

// Bloco: o título, o número principal e a nota, o "como" e, embaixo, o gráfico e a tabela (lado a lado na tela larga).
// Sem número (as métricas do site ainda não lidas), o bloco fica só com o título, o "como" e o corpo.
function bloco(id,titulo,{numero:n,rotulo,nota='',como,diferenca='',corpo,depois='',largo=true}) {
  return `<section class="indicador${largo?' is-largo':''}" id="${id}" aria-labelledby="${id}-titulo"><div class="indicador-cabeca"><h2 id="${id}-titulo">${titulo}</h2>${n!=null?`<p class="indicador-numero"><strong>${n}</strong>${rotulo?`<span>${rotulo}</span>`:''}</p>`:''}${nota?`<p class="indicador-nota">${nota}</p>`:''}<p class="indicador-como">${e(como||'')}${diferenca?` ${diferenca}`:''}</p></div><div class="indicador-corpo">${corpo}</div>${depois}</section>`;
}

function recebido(r={}) {
  const meses=r.meses||[],atual=meses.at(-1),anterior=meses.at(-2);
  const nota=[atual&&`Em ${mesNome(atual.mes)}${atual.parcial?', até hoje':''}: ${rs(atual.centavos)}.`,anterior&&`Em ${mesNome(anterior.mes)}: ${rs(anterior.centavos)}.`].filter(Boolean).join(' ');
  const pagos=m=>m.pagos||{},estornos=m=>m.estornados||{};
  const svg=colunas(meses.map((m,i)=>({rotulo:rotuloMes(m.mes,i),valor:m.centavos,parcial:m.parcial,dica:{titulo:tituloMes(m),valor:reais(m.centavos),
    nota:`${plural(pagos(m).qtd,'pagamento','pagamentos')}${estornos(m).qtd?` e ${plural(estornos(m).qtd,'estorno','estornos')}`:''}`}})),{formato:reaisCurto,alternar:true});
  const linhas=meses.map(m=>`<tr>${celulaMes(m)}<td class="num"><strong>${reais(m.centavos)}</strong></td><td class="num">${comApoio(reais(pagos(m).centavos),pagos(m).qtd?plural(pagos(m).qtd,'pagamento','pagamentos'):'')}</td><td class="num">${comApoio(reais(estornos(m).centavos),estornos(m).qtd?plural(estornos(m).qtd,'estorno','estornos'):'')}</td></tr>`);
  const rodape=`<tr><th scope="row">12 meses</th><td class="num">${reais(r.total)}</td><td class="num">${reais(soma(meses,m=>pagos(m).centavos))}</td><td class="num">${reais(soma(meses,m=>estornos(m).centavos))}</td></tr>`;
  return bloco('recebido','Recebido por mês',{numero:reais(r.total),rotulo:'em 12 meses',nota,como:r.como,
    diferenca:'Por isso, o mês atual pode ser diferente do Resumo, que tira o pagamento estornado do mês em que ele foi pago.',
    corpo:`${desenho(svg,{chaves:[['is-a','Mês fechado'],['is-a-clara','Mês atual, até hoje']]})}${tabela('Recebido em cada mês: pagamentos menos estornos',['Mês','Recebido','Pagamentos','Estornos'],linhas,rodape)}`});
}

function receitaRecorrente(r={}) {
  const meses=r.meses||[],atual=meses.at(-1),anterior=meses.at(-2);
  const nota=[atual&&`${plural(atual.assinaturas,'assinatura entra','assinaturas entram')} na conta.`,anterior&&`No fim de ${mesNome(anterior.mes)}: ${rs(anterior.centavos)}.`].filter(Boolean).join(' ');
  const svg=linha(meses.map((m,i)=>({rotulo:rotuloMes(m.mes,i),valor:m.centavos,dica:{titulo:m.parcial?`Hoje (${mesNome(m.mes)})`:`Fim de ${mesAno(m.mes)}`,valor:reais(m.centavos),nota:plural(m.assinaturas,'assinatura','assinaturas')}})),{formato:reaisCurto,alternar:true});
  const linhas=meses.map(m=>`<tr>${celulaMes({...m,parcial:false})}<td class="num"><strong>${reais(m.centavos)}</strong>${m.parcial?'<span class="linha-apoio">hoje</span>':''}</td><td class="num">${numero(m.assinaturas)}</td></tr>`);
  return bloco('receita','Receita mensal recorrente',{numero:reais(atual?.centavos),rotulo:'hoje',nota,como:r.como,
    diferenca:'Por isso, pode ser maior que a receita mensal do Resumo, que tira as inadimplentes de hoje.',
    corpo:`${desenho(svg,{nota:'A linha mede o último dia de cada mês; no mês atual, hoje.'})}${tabela('Receita mensal recorrente no fim de cada mês',['Mês','Receita mensal','Assinaturas'],linhas)}`});
}

function movimento(r={}) {
  const meses=r.meses||[],novas=soma(meses,m=>m.novas?.qtd),canceladas=soma(meses,m=>m.canceladas?.qtd),saldo=novas-canceladas;
  const n=`${saldo>0?'+':saldo<0?'−':''}${numero(Math.abs(saldo))}`;
  const nota=`${plural(novas,'nova','novas')} e ${plural(canceladas,'cancelada','canceladas')}. Na receita mensal, ${rs(soma(meses,m=>m.novas?.centavos))} entraram com as novas e ${rs(soma(meses,m=>m.canceladas?.centavos))} saíram com as canceladas.`;
  const svg=opostas(meses.map((m,i)=>({rotulo:rotuloMes(m.mes,i),a:m.novas?.qtd||0,b:m.canceladas?.qtd||0,parcial:m.parcial,
    dica:{titulo:tituloMes(m),valor:`${plural(m.novas?.qtd,'nova','novas')} · ${plural(m.canceladas?.qtd,'cancelada','canceladas')}`,nota:`${reais(m.novas?.centavos)} e ${reais(m.canceladas?.centavos)} por mês`}})),{formato:numero,alternar:true});
  const celula=x=>`<td class="num">${comApoio(numero(x?.qtd),x?.qtd?`${reais(x.centavos)} por mês`:'')}</td>`;
  const linhas=meses.map(m=>`<tr>${celulaMes(m)}${celula(m.novas)}${celula(m.canceladas)}</tr>`);
  const rodape=`<tr><th scope="row">12 meses</th><td class="num">${numero(novas)}</td><td class="num">${numero(canceladas)}</td></tr>`;
  return bloco('movimento','Novas e canceladas',{numero:n,rotulo:`${Math.abs(saldo)===1?'assinatura':'assinaturas'} de saldo em 12 meses`,nota,como:r.como,
    corpo:`${desenho(svg,{chaves:[['is-a','Novas, acima da linha'],['is-b','Canceladas, abaixo'],['is-a-clara','Mês atual, até hoje, em tom mais claro']]})}${tabela('Assinaturas novas e canceladas em cada mês',['Mês','Novas','Canceladas'],linhas,rodape)}`});
}

// Quem vence em cada semana da previsão, com a situação de cada uma.
function vencem(semanas) {
  const total=soma(semanas,s=>(s.itens||[]).length);
  if(!total)return '';
  const grupos=semanas.filter(s=>(s.itens||[]).length).map(s=>`<h3>De ${dia(s.de)} a ${dia(s.ate)}</h3><ul class="vencem-lista">${s.itens.map(it=>`<li class="vence"><p class="vence-quem"><a href="/clientes/${e(it.cliente?.id)}">${e(it.cliente?.nome)}</a><span class="linha-apoio">${e(it.empresa?.nome||'Sem empresa do guia')} · ${e(it.plano?.nome||'Sem plano')}</span></p><p class="vence-prazo">${selo(it.situacao,it.dias)}<span>${prazo(it.dias,it.venceEm)}</span></p><p class="vence-valor">${reais(it.valorCentavos)}</p></li>`).join('')}</ul>`).join('');
  return `<details class="vencem"><summary class="botao-texto">Ver quem vence <span class="contador">${numero(total)}</span></summary>${grupos}</details>`;
}

function previsao(r={}) {
  const semanas=r.semanas||[],total=r.total||{},vencidas=r.atrasadas?.vencidas||{},inadimplentes=r.atrasadas?.inadimplentes||{};
  const atrasadas=Number(vencidas.qtd)+Number(inadimplentes.qtd)>0
    ?`<p class="indicador-atrasadas">${icone('aviso')}<span>Fora da previsão, já venceram e não foram pagas: ${rs(Number(vencidas.centavos)+Number(inadimplentes.centavos))} (${plural(vencidas.qtd,'vencida','vencidas')} dentro da tolerância e ${plural(inadimplentes.qtd,'inadimplente','inadimplentes')}). <a href="/renovacoes">Ver em Renovações <span aria-hidden="true">→</span></a></span></p>`:'';
  const svg=colunas(semanas.map(s=>({rotulo:[ddmm(s.de),`a ${ddmm(s.ate)}`],valor:s.centavos,dica:{titulo:`De ${ddmm(s.de)} a ${ddmm(s.ate)}`,valor:reais(s.centavos),nota:plural(s.qtd,'assinatura','assinaturas')}})),{formato:reaisCurto,largura:.3});
  const linhas=semanas.map(s=>`<tr><th scope="row">${ddmm(s.de)} a ${ddmm(s.ate)}</th><td class="num">${numero(s.qtd)}</td><td class="num"><strong>${reais(s.centavos)}</strong></td></tr>`);
  const rodape=`<tr><th scope="row">30 dias</th><td class="num">${numero(total.qtd)}</td><td class="num">${reais(total.centavos)}</td></tr>`;
  return bloco('previsao','Previsão dos próximos 30 dias',{numero:reais(total.centavos),rotulo:r.de?`de ${dia(r.de)} a ${dia(r.ate)}`:'',
    nota:`${plural(total.qtd,'assinatura vence','assinaturas vencem')} nesse período.`,como:r.como,
    corpo:`${desenho(svg)}${tabela('Previsão de recebimento por semana',['Semana','Assinaturas','Valor'],linhas,rodape)}`,depois:`${atrasadas}${vencem(semanas)}`});
}

function inadimplencia(r={}) {
  const faixas=r.faixas||[],maior=Math.max(0,...faixas.map(f=>Number(f.centavos)||0));
  const nome=f=>f.ate==null?`${numero(f.de)} dias ou mais`:`${numero(f.de)} a ${numero(f.ate)} dias`;
  const linhas=faixas.map(f=>`<tr><th scope="row">${nome(f)}${barraHorizontal(maior?f.centavos/maior:0)}</th><td class="num">${numero(f.qtd)}</td><td class="num"><strong>${reais(f.centavos)}</strong></td></tr>`);
  const nota=Number(r.qtd)?`${plural(r.qtd,'assinatura','assinaturas')} depois da tolerância. <a href="/renovacoes">Ver as vencidas em Renovações <span aria-hidden="true">→</span></a>`:'Nenhuma assinatura inadimplente hoje.';
  return bloco('inadimplencia','Inadimplência por faixa de atraso',{numero:reais(r.centavos),rotulo:'hoje',nota,como:r.como,largo:false,
    corpo:tabela('Inadimplência de hoje por dias de atraso',['Atraso','Assinaturas','Valor'],linhas,'',' com-barras')});
}

function planos(r={}) {
  const itens=r.itens||[],maior=Math.max(0,...itens.map(p=>Number(p.centavos)||0)),somaPlanos=soma(itens,p=>p.centavos);
  const linhas=itens.map(p=>`<tr><th scope="row">${e(p.plano?.nome||'Sem plano')}${barraHorizontal(maior?p.centavos/maior:0)}</th><td class="num">${numero(p.assinaturas)}</td><td class="num"><strong>${reais(p.centavos)}</strong></td></tr>`);
  const arredonda=itens.length&&somaPlanos!==Number(r.mrr)?`<p class="grafico-nota">A soma dos planos fica ${rs(Math.abs(somaPlanos-r.mrr))} ${somaPlanos>r.mrr?'acima':'abaixo'} da receita total, por arredondamento.</p>`:'';
  const corpo=itens.length?`${tabela('Receita mensal por plano',['Plano','Assinaturas','Receita mensal'],linhas,'',' com-barras')}${arredonda}`
    :vazio('Nenhuma assinatura ativa em dia','A receita por plano aparece quando houver assinaturas ativas que não estão inadimplentes.');
  return bloco('planos','Receita por plano',{numero:reais(r.mrr),rotulo:'por mês',nota:`${plural(r.assinaturas,'assinatura','assinaturas')}, com valor médio de ${rs(r.valorMedio)} por mês.`,como:r.como,largo:false,corpo});
}

// Audiência do Guia e Anunciantes (v0.9.0): da cópia das métricas do site, lida uma vez por dia. Número null é o que o site
// ainda não media: a tela diz "sem medição", nunca zero. Antes da primeira leitura (disponivel: false), o bloco diz isso.
const medido=v=>v!==null&&v!==undefined;
const ouSem=(v,f=numero)=>medido(v)?f(v):'<span class="sem-medicao">sem medição</span>';
const lida=r=>r.atualizadaEm?`Atualizada em ${tempo(r.atualizadaEm)}.`:'';
const semMetricas=(id,titulo,r)=>bloco(id,titulo,{como:r.como,largo:false,
  corpo:vazio('Ainda sem as métricas do guia','A gestão lê as métricas do site uma vez por dia, às 05:00. Depois da primeira leitura, os números aparecem aqui.')});
const CANAIS=[['whatsapp','WhatsApp'],['telefone','telefone'],['rota','rota'],['site','site']];
const canais=c=>c?CANAIS.map(([k,nome])=>`${numero(c[k])} ${nome}`).join(' · '):'';
// Lista curta (buscas, bairros, categorias) numa tabela com a barra de cada linha.
function ranking(id,titulo,itens,rotulo,coluna) {
  const maior=Math.max(0,...itens.map(i=>Number(i.vezes)||0));
  const corpo=itens.length?tabela(titulo,[rotulo,'Vezes'],itens.map(i=>`<tr><th scope="row">${e(i[coluna])}${barraHorizontal(maior?i.vezes/maior:0)}</th><td class="num">${numero(i.vezes)}</td></tr>`),'',' com-barras')
    :'<p class="lista-vazia">Nada apareceu 3 vezes ou mais no período.</p>';
  return `<section class="indicador-lista" aria-labelledby="${id}"><h3 id="${id}">${titulo}</h3>${corpo}</section>`;
}

function audiencia(r={}) {
  if(!r.disponivel)return semMetricas('audiencia','Audiência do guia',r);
  const meses=r.meses||[],atual=meses.at(-1)||{},quando=atual.mes?`em ${mesNome(atual.mes)}${atual.parcial?', até hoje':''}`:'';
  const partes=[medido(atual.contatosTotal)?`${plural(atual.contatosTotal,'contato','contatos')} (${canais(atual.contatos)})`:'contatos sem medição',
    medido(atual.buscas)?`${plural(atual.buscas,'busca','buscas')}, ${numero(atual.buscasSemResultado)} sem resultado`:'buscas sem medição'];
  const desde=[r.medidoDesde?.contatos&&`os contatos desde ${dia(r.medidoDesde.contatos)}`,r.medidoDesde?.buscas&&`as buscas desde ${dia(r.medidoDesde.buscas)}`].filter(Boolean);
  const svg=colunas(meses.map((m,i)=>({rotulo:rotuloMes(m.mes,i),valor:medido(m.visitas)?m.visitas:null,parcial:m.parcial,dica:{titulo:tituloMes(m),valor:medido(m.visitas)?plural(m.visitas,'visita','visitas'):'Sem medição',
    nota:medido(m.contatosTotal)?plural(m.contatosTotal,'contato','contatos'):''}})),{formato:numero,inteiro:true,alternar:true});
  const semMedicao=meses.some(m=>!medido(m.visitas));
  const linhas=meses.map(m=>`<tr>${celulaMes(m)}<td class="num">${ouSem(m.visitas)}</td><td class="num">${medido(m.contatosTotal)?comApoio(numero(m.contatosTotal),canais(m.contatos)):ouSem(null)}</td><td class="num">${medido(m.buscas)?comApoio(numero(m.buscas),`${numero(m.buscasSemResultado)} sem resultado`):ouSem(null)}</td></tr>`);
  const listas=`<div class="indicador-listas">${ranking('audiencia-buscas','Buscas mais feitas',r.buscasMaisFeitas||[],'Busca','termo')}${ranking('audiencia-sem-resultado','Buscas sem resultado',r.buscasSemResultado||[],'Busca','termo')}${ranking('audiencia-bairros','Bairros mais procurados',r.bairros||[],'Bairro','bairro')}${ranking('audiencia-categorias','Categorias mais procuradas',(r.categorias||[]).map(c=>({...c,nome:c.nome||c.categoria})),'Categoria','nome')}</div>`;
  return bloco('audiencia','Audiência do guia',{numero:ouSem(atual.visitas),rotulo:medido(atual.visitas)?`${atual.visitas===1?'visita':'visitas'} ${quando}`:quando,
    nota:`${partes.join(' e ')}.`,como:r.como,diferenca:`${lida(r)}${desde.length?` O site mede ${desde.join(', e ')}.`:''}`,
    corpo:`${desenho(svg,{chaves:[['is-a','Mês fechado'],['is-a-clara','Mês atual, até hoje'],...semMedicao?[['is-sem','Sem medição']]:[]]})}${tabela('Visitas, contatos e buscas no guia em cada mês',['Mês','Visitas','Contatos','Buscas'],linhas)}`,depois:listas});
}

// Anunciante: a empresa (leva à ficha do cliente), o cliente, o vencimento e os números dos últimos 30 dias.
const empresaFicha=a=>`<a href="/clientes/${e(a.cliente?.id)}">${e(a.empresa?.nome)}</a>`;
// maior: o maior número de contatos das duas listas, para as barras de "mais" e de "menos" ficarem na mesma escala.
function tabelaAnunciantes(id,titulo,itens,maior) {
  const corpo=itens.length?tabela(titulo,['Empresa','Contatos','Visitas'],itens.map(a=>`<tr><th scope="row">${empresaFicha(a)}<span class="linha-apoio">${e(a.cliente?.nome)}</span>${barraHorizontal(maior?a.contatos30/maior:0)}</th><td class="num">${comApoio(numero(a.contatos30),canais(a.contatos30Canais))}</td><td class="num">${numero(a.visitas30)}</td></tr>`),'',' com-barras')
    :'<p class="lista-vazia">Nenhum anunciante aqui.</p>';
  return `<section class="indicador-lista" aria-labelledby="${id}"><h3 id="${id}">${titulo}</h3>${corpo}</section>`;
}
// Item das listas com o vencimento: a empresa, o cliente, o prazo e, à direita, o que o site mediu.
const itemAnunciante=(a,valor)=>`<li class="vence"><p class="vence-quem">${empresaFicha(a)}<span class="linha-apoio">${e(a.cliente?.nome)}</span></p><p class="vence-prazo">${selo(a.assinatura?.situacao,a.assinatura?.dias)}<span>${prazo(a.assinatura?.dias,a.assinatura?.venceEm)}</span></p><p class="vence-valor">${valor}</p></li>`;
// A empresa que o site não mede, por não estar publicada (v0.14.1): sem número nenhum, nem zero. Sem itens, a seção não aparece.
const listaSemMedicao=itens=>itens.length?`<section class="indicador-lista" aria-labelledby="anunciantes-sem-medicao"><h3 id="anunciantes-sem-medicao">Sem medição <span class="contador">${numero(itens.length)}</span></h3><ul class="vencem-lista">${itens.map(a=>itemAnunciante(a,ouSem(null))).join('')}</ul></section>`:'';
function anunciantes(r={}) {
  if(!r.disponivel)return semMetricas('anunciantes','Anunciantes',r);
  const risco=r.emRisco||[],banners=r.banners||[],k=risco.length;
  const emRisco=`<section class="indicador-lista" aria-labelledby="anunciantes-risco"><h3 id="anunciantes-risco">Em risco <span class="contador">${numero(k)}</span></h3>${k?`<ul class="vencem-lista">${risco.map(a=>itemAnunciante(a,`${plural(a.contatos30,'contato','contatos')}<span class="linha-apoio">${plural(a.visitas30,'visita','visitas')}</span>`)).join('')}</ul>`:'<p class="lista-vazia">Nenhum anunciante vence nos próximos 30 dias com poucos contatos.</p>'}</section>`;
  const maiorBanner=Math.max(0,...banners.map(b=>Number(b.cliques)||0));
  const pctCtr=c=>`${(Number(c||0)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
  const tabBanners=`<section class="indicador-lista" aria-labelledby="anunciantes-banners"><h3 id="anunciantes-banners">Banners</h3>${banners.length?tabela('Banners de anunciantes, do mais clicado para o menos',['Banner','Impressões','Cliques','Cliques por impressão'],banners.map(b=>`<tr><th scope="row">${e(b.titulo)}${b.empresa?`<span class="linha-apoio">${e(b.empresa.nome)}</span>`:''}${barraHorizontal(maiorBanner?b.cliques/maiorBanner:0)}</th><td class="num">${numero(b.impressoes)}</td><td class="num">${numero(b.cliques)}</td><td class="num">${pctCtr(b.ctr)}</td></tr>`),'',' com-barras'):'<p class="lista-vazia">Nenhum banner de anunciante no período.</p>'}</section>`;
  const mais=r.maisContatos||[],menos=r.menosContatos||[],maior=Math.max(0,...[...mais,...menos].map(a=>Number(a.contatos30)||0));
  const corpo=Number(r.base)?`${emRisco}<div class="indicador-listas">${tabelaAnunciantes('anunciantes-mais','Mais contatos em 30 dias',mais,maior)}${tabelaAnunciantes('anunciantes-menos','Menos contatos em 30 dias',menos,maior)}</div>${listaSemMedicao(r.semMedicao||[])}${tabBanners}`
    :`${vazio('Nenhum anunciante com assinatura ativa','Os anunciantes aparecem aqui quando a empresa do guia tem assinatura ativa na gestão.')}${tabBanners}`;
  return bloco('anunciantes','Anunciantes',{numero:numero(r.base),rotulo:Number(r.base)===1?'anunciante com assinatura ativa':'anunciantes com assinatura ativa',
    nota:k?`${numero(k)} ${k===1?'está':'estão'} em risco: ${k===1?'vence':'vencem'} em até 30 dias com poucos contatos.`:'Nenhum em risco agora.',como:r.como,diferenca:lida(r),largo:false,corpo});
}

// Interessados (14.6, v0.13.0): os pedidos do cadastro do site em cada mês, quantos viraram cliente e quantos se perderam, os
// motivos da perda e o tempo até virar cliente. Só números: todo papel com "ver" vê, como os outros blocos. Sem a chave, o
// funil vem null e o bloco (com o atalho dele) não aparece.
const dias=n=>`${Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1})} ${Number(n)===1?'dia':'dias'}`;
function funil(r) {
  const meses=r.meses||[],novos=soma(meses,m=>m.novos),convertidos=soma(meses,m=>m.convertidos),perdidos=soma(meses,m=>m.perdidos);
  const t=r.tempoAteCliente||{},motivos=r.motivosPerda||[];
  const nota=`${plural(convertidos,'virou cliente','viraram cliente')} e ${plural(perdidos,'foi dado como perdido','foram dados como perdidos')}. ${t.medianaDias!=null?`Até virar cliente, a mediana é de ${dias(t.medianaDias)} (${plural(t.convertidos,'convertido','convertidos')}).`:'Ninguém virou cliente nos 12 meses ainda.'}`;
  const svg=colunas(meses.map((m,i)=>({rotulo:rotuloMes(m.mes,i),valor:Number(m.novos)||0,parcial:m.parcial,
    dica:{titulo:tituloMes(m),valor:plural(m.novos,'pedido','pedidos'),nota:`${plural(m.convertidos,'convertido','convertidos')} · ${plural(m.perdidos,'perdido','perdidos')}`}})),{formato:numero,inteiro:true,largura:.4});
  const linhas=meses.map(m=>`<tr>${celulaMes(m)}<td class="num">${numero(m.novos)}</td><td class="num">${numero(m.convertidos)}</td><td class="num">${numero(m.perdidos)}</td></tr>`);
  const rodape=`<tr><th scope="row">12 meses</th><td class="num">${numero(novos)}</td><td class="num">${numero(convertidos)}</td><td class="num">${numero(perdidos)}</td></tr>`;
  const maior=Math.max(0,...motivos.map(x=>Number(x.qtd)||0));
  const listaMotivos=`<section class="indicador-lista" aria-labelledby="funil-motivos"><h3 id="funil-motivos">Por que se perderam</h3>${motivos.length?tabela('Motivos de perda dos interessados em 12 meses, do mais comum para o menos',['Motivo','Perdidos'],motivos.map(x=>`<tr><th scope="row">${e(x.motivo)}${barraHorizontal(maior?x.qtd/maior:0)}</th><td class="num">${numero(x.qtd)}</td></tr>`),'',' com-barras'):vazio('Nenhum perdido nos 12 meses')}</section>`;
  return bloco('funil','Interessados',{numero:numero(novos),rotulo:Number(novos)===1?'pedido do cadastro em 12 meses':'pedidos do cadastro em 12 meses',nota,como:r.como,
    corpo:`${desenho(svg,{chaves:[['is-a','Pedidos do mês'],['is-a-clara','Mês atual, até hoje']]})}${tabela('Pedidos do cadastro, convertidos e perdidos em cada mês',['Mês','Pedidos','Viraram cliente','Perdidos'],linhas,rodape)}`,depois:listaMotivos});
}

const ATALHOS=[['recebido','Recebido'],['receita','Receita recorrente'],['movimento','Novas e canceladas'],['previsao','Previsão'],['inadimplencia','Inadimplência'],['planos','Por plano'],['audiencia','Audiência'],['anunciantes','Anunciantes']];

export function indicadores(vm) {
  const d=vm.dados||{},meses=d.meses||[];
  const periodo=meses.length?`de ${mesAno(meses[0])} a ${mesAno(meses.at(-1))}`:'nos últimos 12 meses';
  const atalhos=`<nav class="abas" aria-label="Ir para um bloco"><ul>${[...ATALHOS,...d.funil?[['funil','Interessados']]:[]].map(([id,texto])=>`<li><a class="aba" href="#${id}">${texto}</a></li>`).join('')}</ul></nav>`;
  const corpo=`${atalhos}<div class="indicadores">${recebido(d.recebido)}${receitaRecorrente(d.mrr)}${movimento(d.movimento)}${previsao(d.previsao)}<div class="indicadores-par">${inadimplencia(d.inadimplencia)}${planos(d.planos)}</div>${audiencia(d.audiencia)}${anunciantes(d.anunciantes)}${d.funil?funil(d.funil):''}</div>`;
  return moldura(vm,{cabeca:{titulo:'Indicadores',texto:`O dinheiro ${periodo}, com os números da gestão, e a audiência do guia, com as métricas do site${d.hoje?`, até ${dia(d.hoje)}`:''}. A foto de hoje está no <a href="/">Resumo</a>.`},corpo});
}

// Peças que a ficha do cliente também usa no desempenho de cada empresa (desempenho.mjs).
export { mesNome, mesAno, ano, rotuloMes, tabela, desenho, ouSem, canais, medido, comApoio };
