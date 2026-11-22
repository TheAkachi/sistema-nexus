import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { tela, comPapel, resumo, renovacoes, configuracoes, ficha, configuracoesRegua, renovacoesLembrar } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/regua-lembretes (contrato 15, v0.14.0): a janela "Lembrar hoje" das Renovações, o "Lembrar hoje: N" do Resumo, as
// mensagens das etapas nas Configurações e a etapa do lembrete na ficha, a partir dos exemplos da seção 15.
const XSS='<img src=x onerror=alert(1)>';
const linhas=html=>(html.match(/<li class="renovacao"/g)||[]).length;
const lembrar=(dados=renovacoesLembrar,papel)=>{const vm=tela('renovacoes',dados,{filtros:{janela:'lembrar',page:'1'}});return views.renovacoes(papel?comPapel(vm,papel):vm);};
const regua=(extra={})=>({...configuracoes,...configuracoesRegua,...extra});

test('lembrar hoje: a aba depois das vencidas, a contagem, a etapa em destaque e o último contato com a etapa dele',()=>{
  const html=lembrar();
  assert.match(html,/<li><a class="aba" href="\/renovacoes">Vencidas <span class="aba-contagem">2<\/span><\/a><\/li><li><a class="aba" href="\/renovacoes\?janela=lembrar" aria-current="page">Lembrar hoje <span class="aba-contagem">2<\/span><\/a><\/li><li><a class="aba" href="\/renovacoes\?janela=7">Até 7 dias/);
  assert.match(html,/<h1 id="titulo">Renovações<\/h1><p>Quem cobrar e quem lembrar: as vencidas, os lembretes da régua de hoje e as que vencem nos próximos 30 dias\.<\/p>/);
  assert.match(html,/<p class="contagem"><span data-lembrar-n>2<\/span> para lembrar hoje, da mais próxima do vencimento para a mais distante<\/p><ul class="renovacoes" data-lembrar>/);
  assert.equal(linhas(html),2);
  assert.ok(html.indexOf('Padaria Pão Dourado')<html.indexOf('Clínica Vida Plena'),'na ordem do vm');
  // A etapa em destaque, com o nome que vem de etapas, antes do selo com o prazo.
  assert.match(html,/<div class="renovacao-prazo"><p class="renovacao-etapa"><span class="etapa"><svg class="icone"[^]*?<\/svg><span><span class="sr-only">Etapa da régua: <\/span>7 dias antes<\/span><\/span><\/p><p class="renovacao-situacao"><span class="selo is-a-vencer">Vence em 4 dias<\/span>/);
  assert.match(html,/<span class="sr-only">Etapa da régua: <\/span>30 dias antes<\/span>[^]*<span class="selo is-a-vencer">Vence em 26 dias<\/span>/);
  assert.match(html,/<p class="renovacao-contato" data-ultimo-contato>Lembrado em <time datetime="2026-10-09T14:05:00\.000Z">09\/10\/2026 às 11:05<\/time> por Bruno · 15 dias antes<\/p>/);
  assert.match(html,/<p class="renovacao-contato" data-ultimo-contato>Nenhum contato ainda<\/p>/);
  // O botão abre o WhatsApp e o gestao.js registra (data-cobrar), como na cobrança; antes do vencimento, "Lembrar".
  assert.equal((html.match(/data-cobrar=/g)||[]).length,2);
  assert.equal((html.match(/<span>Lembrar no WhatsApp<\/span>/g)||[]).length,2);
  assert.doesNotMatch(html,/Cobrar no WhatsApp/);
  assert.match(html,/pagamento\?volta=%2Frenovacoes%3Fjanela%3Dlembrar"/,'o pagamento volta ao Lembrar hoje');
  semInline(renderPage({title:'Renovações | Gestão Nexus',status:200,view:'renovacoes',vm:tela('renovacoes',renovacoesLembrar,{filtros:{janela:'lembrar',page:'1'}})}));
});

test('lembrar hoje: vazia, sem WhatsApp, o leitura, as outras janelas e o vm de antes da régua',()=>{
  assert.match(lembrar({...renovacoesLembrar,itens:[],total:0,contagem:{...renovacoesLembrar.contagem,lembrar:0}}),/<p class="vazio-titulo">Ninguém para lembrar hoje<\/p><p>Cada assinatura a vencer aparece aqui uma vez em cada etapa da régua, até o lembrete dela ser registrado\.<\/p>/);
  const semZap=lembrar({...renovacoesLembrar,itens:[{...renovacoesLembrar.itens[0],linkWhatsapp:null}],total:1});
  assert.match(semZap,/<p class="renovacao-falta">[^]*Sem WhatsApp cadastrado\. <a href="\/clientes\/1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52\/editar">Cadastrar o WhatsApp/);
  assert.doesNotMatch(semZap,/data-cobrar/);
  const leitura=lembrar({...renovacoesLembrar,itens:renovacoesLembrar.itens.map(r=>({...r,linkWhatsapp:null}))},'leitura');
  assert.doesNotMatch(leitura,/data-cobrar|Registrar pagamento|Sem WhatsApp/);
  assert.match(leitura,/7 dias antes<\/span><\/span><\/p>/,'o leitura vê a lista e a etapa');
  // Nas janelas de 7, 15 e 30 dias a etapa não vem em destaque, mas o último contato diz a etapa dele.
  const sete=views.renovacoes(tela('renovacoes',{...renovacoesLembrar,janela:'7',itens:[renovacoesLembrar.itens[0]],total:1}));
  assert.match(sete,/<a class="aba" href="\/renovacoes\?janela=7" aria-current="page">/);
  assert.doesNotMatch(sete,/renovacao-etapa|data-lembrar/);
  assert.match(sete,/<p class="contagem">1 assinatura, da mais próxima para a mais distante<\/p><ul class="renovacoes">/);
  assert.match(sete,/por Bruno · 15 dias antes<\/p>/);
  // As vencidas continuam com o "Cobrar no WhatsApp".
  const vencidas=views.renovacoes(tela('renovacoes',{...renovacoes,contagem:renovacoesLembrar.contagem,etapas:renovacoesLembrar.etapas}));
  assert.equal((vencidas.match(/<span>Cobrar no WhatsApp<\/span>/g)||[]).length,2);
  assert.match(vencidas,/Cobrado em <time datetime="2026-10-16T13:20:00\.000Z">16\/10\/2026 às 10:20<\/time> por Bruno<\/p>/,'a cobrança não tem etapa');
  // Sem a contagem.lembrar (antes da v0.14.0): sem a aba, e a janela lembrar vira vencidas.
  const antes=views.renovacoes(tela('renovacoes',{...renovacoes,janela:'lembrar'}));
  assert.doesNotMatch(antes,/Lembrar hoje/);
  assert.match(antes,/aria-current="page">Vencidas/);
  assert.match(antes,/<p>Quem cobrar: as vencidas e as que vencem nos próximos 30 dias\.<\/p>/);
  // Etapa que a lista não tem, ou sem a lista: o nome fica de fora.
  const semNome=lembrar({...renovacoesLembrar,etapas:undefined});
  assert.doesNotMatch(semNome,/renovacao-etapa|· 15 dias antes/);
  assert.match(semNome,/por Bruno<\/p>/);
});

test('resumo: "Lembrar hoje: N" entre os números e o "Cobrar hoje", levando à janela',()=>{
  const html=views.resumo(tela('resumo',{...resumo,lembrarHoje:2}));
  assert.match(html,/<\/section><p class="lembrar-hoje is-pendente"><a href="\/renovacoes\?janela=lembrar"><svg class="icone"[^]*?<\/svg><span class="lembrar-hoje-texto"><strong>Lembrar hoje: 2<\/strong><span>Quem chegou a uma etapa da régua e ainda não recebeu o lembrete dela\.<\/span><\/span><span class="lembrar-hoje-seta" aria-hidden="true">→<\/span><\/a><\/p><section class="bloco" aria-labelledby="cobrar-hoje">/);
  const zero=views.resumo(tela('resumo',{...resumo,lembrarHoje:0}));
  assert.match(zero,/<p class="lembrar-hoje"><a href="\/renovacoes\?janela=lembrar">[^]*<strong>Lembrar hoje: 0<\/strong><span>Nenhum lembrete da régua para hoje\.<\/span>/);
  assert.match(views.resumo(tela('resumo',{...resumo,lembrarHoje:1234})),/<strong>Lembrar hoje: 1\.234<\/strong>/);
  assert.doesNotMatch(views.resumo(tela('resumo',resumo)),/lembrar-hoje/,'sem o lembrarHoje no vm, não aparece');
  // O "Cobrar hoje" do Resumo: "Lembrar" na que vence em 4 dias e "Cobrar" nas vencidas.
  assert.equal((html.match(/<span>Cobrar no WhatsApp<\/span>/g)||[]).length,2);
  assert.equal((html.match(/<span>Lembrar no WhatsApp<\/span>/g)||[]).length,1);
  // Com etapas no Resumo (6.4, a696688), o último contato do lembrete diz a etapa; a etapa não fica em destaque ali.
  const lembrada={...resumo.cobrarHoje[2],etapa:7,ultimoContato:{em:'2026-10-09T14:05:00.000Z',por:{id:'c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67',nome:'Bruno'},tipo:'lembrete',etapa:15}};
  const comEtapas=views.resumo(tela('resumo',{...resumo,lembrarHoje:2,etapas:configuracoesRegua.etapas,cobrarHoje:[...resumo.cobrarHoje.slice(0,2),lembrada]}));
  assert.match(comEtapas,/<p class="renovacao-contato" data-ultimo-contato>Lembrado em <time datetime="2026-10-09T14:05:00\.000Z">09\/10\/2026 às 11:05<\/time> por Bruno · 15 dias antes<\/p>/);
  assert.match(comEtapas,/Cobrado em <time datetime="2026-10-16T13:20:00\.000Z">16\/10\/2026 às 10:20<\/time> por Bruno<\/p>/,'a cobrança continua sem etapa');
  assert.doesNotMatch(comEtapas,/renovacao-etapa/);
  semInline(renderPage({title:'Resumo | Gestão Nexus',status:200,view:'resumo',vm:tela('resumo',{...resumo,lembrarHoje:2})}));
});

test('configurações: uma mensagem opcional por etapa, na ordem de etapas, com a prévia e o estado de cada uma',()=>{
  const html=views.configuracoes(tela('configuracoes',regua()));
  assert.match(html,/<p>Só os dados do negócio: a chave Pix, o WhatsApp do atendimento, a mensagem de cobrança, as dos lembretes, a do relatório do mês e a tolerância\.<\/p>/);
  // Depois da mensagem de cobrança e antes da do relatório.
  assert.ok(html.indexOf('<legend>Mensagem de cobrança</legend>')<html.indexOf('<legend>Mensagens dos lembretes</legend>')&&html.indexOf('<legend>Mensagens dos lembretes</legend>')<html.indexOf('<legend>Mensagem do relatório do mês</legend>'));
  assert.match(html,/<fieldset class="secao-form" data-modelos-lembrete data-estados="\[&quot;Usa a mensagem de cobrança&quot;,&quot;Mensagem própria&quot;\]"><legend>Mensagens dos lembretes<\/legend><p class="secao-texto">Cada etapa da régua de lembretes pode ter a sua mensagem\. Sem ela, o lembrete da etapa usa a mensagem de cobrança\.<\/p>/);
  assert.deepEqual([...html.matchAll(/data-etapa-bloco="(\d+)"/g)].map(m=>m[1]),['30','15','7','1','0'],'na ordem de etapas, não na do JSON');
  assert.doesNotMatch(html,/<details class="etapa-modelo"[^>]* open>/,'todas fechadas sem mensagem própria');
  assert.equal((html.match(/data-estado-etapa>Usa a mensagem de cobrança</g)||[]).length,5);
  assert.match(html,/<summary><span class="etapa-modelo-nome"><svg class="icone"[^]*?<\/svg><span>30 dias antes<\/span><\/span><span class="etapa-modelo-estado" data-estado-etapa>Usa a mensagem de cobrança<\/span><\/summary>/);
  // O campo: o nome e o data-campo são os do 422 (modelosLembrete.<dias>), vazio e opcional.
  assert.match(html,/<div class="campo is-largo" data-campo="modelosLembrete\.30"><label for="config-lembrete-30">Mensagem da etapa: 30 dias antes<\/label><textarea id="config-lembrete-30" name="modelosLembrete\.30" aria-describedby="config-lembrete-30-dica config-lembrete-30-erro" rows="5" maxlength="1000" placeholder="Vazio: usa a mensagem de cobrança\." data-antes="" data-etapa="30"><\/textarea><p class="campo-dica" id="config-lembrete-30-dica">Opcional\. De 20 a 1\.000 caracteres, com as mesmas variáveis da cobrança\.<\/p>/);
  assert.doesNotMatch(html.slice(html.indexOf('data-modelos-lembrete'),html.indexOf('data-modelo-relatorio')),/required/);
  assert.equal((html.match(/aria-label="Inserir uma variável na mensagem da etapa: /g)||[]).length,5);
  // Vazia, a prévia é a mensagem de cobrança, com o {prazo} de quem ainda não venceu.
  assert.match(html,/data-etapa-bloco="30" data-prazo="vence em 15\/10\/2026">[^]*?<p class="previa-origem" data-previa-origem>Esta etapa não tem mensagem própria: sai a mensagem de cobrança\.<\/p><p class="balao" data-previa aria-live="polite">Olá, Marina Souza! Aqui é do Nexus\. A assinatura do plano Premium da Clínica Vida Plena · Centro vence em 15\/10\/2026, no valor de R\$ 99,00\./);
  assert.match(html,/data-etapa-bloco="0" data-prazo="vence hoje">[^]*?<p class="balao" data-previa aria-live="polite">[^<]*Clínica Vida Plena · Centro vence hoje, no valor/);
  assert.match(html,/<input type="radio" name="previaDesempenho-30" value="com" checked>/);
  semInline(renderPage({title:'Configurações | Gestão Nexus',status:200,view:'configuracoes',vm:tela('configuracoes',regua())}));
});

test('configurações: a etapa com mensagem própria, o {desempenho}, o vm de antes da régua e o escape',()=>{
  const proprio='Oi, {responsavel}! Faltam poucos dias: a assinatura {prazo}. {desempenho}';
  const html=views.configuracoes(tela('configuracoes',regua({modelosLembrete:{...configuracoesRegua.modelosLembrete,7:proprio}})));
  const sete=html.slice(html.indexOf('data-etapa-bloco="7"'),html.indexOf('data-etapa-bloco="1"'));
  assert.match(sete,/^data-etapa-bloco="7" data-prazo="vence em 15\/10\/2026" open><summary>[^]*<span class="etapa-modelo-estado is-proprio" data-estado-etapa>Mensagem própria<\/span>/);
  assert.match(sete,/data-antes="Oi, \{responsavel\}! Faltam poucos dias: a assinatura \{prazo\}\. \{desempenho\}" data-etapa="7">Oi, \{responsavel\}!/);
  assert.match(sete,/<p class="previa-origem" data-previa-origem hidden>/);
  assert.match(sete,/<p class="balao" data-previa aria-live="polite">Oi, Marina Souza! Faltam poucos dias: a assinatura vence em 15\/10\/2026\. Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro\.<\/p><fieldset class="escolha previa-opcao" data-previa-desempenho><legend/);
  assert.equal((html.match(/data-estado-etapa>Usa a mensagem de cobrança</g)||[]).length,4);
  // Sem etapas no vm (antes da v0.14.0): nada da régua.
  const antes=views.configuracoes(tela('configuracoes',configuracoes));
  assert.doesNotMatch(antes,/data-modelos-lembrete|as dos lembretes/);
  // O nome da etapa e o texto vêm do vm e passam pelo escape.
  const xss=views.configuracoes(tela('configuracoes',regua({etapas:[{dias:7,nome:XSS}],modelosLembrete:{7:`Oi ${XSS} {prazo}`}})));
  assert.doesNotMatch(xss,/<img src=x/);
  assert.match(xss,/<span>&lt;img src=x onerror=alert\(1\)&gt;<\/span>/);
  assert.match(xss,/<p class="balao" data-previa aria-live="polite">Oi &lt;img src=x onerror=alert\(1\)&gt; vence em 15\/10\/2026<\/p>/);
});

test('ficha: o lembrete da linha do tempo diz a etapa, com o nome que vem do vm',()=>{
  const lembrete={...ficha.linhaDoTempo[0],contato:{...ficha.linhaDoTempo[0].contato,tipo:'lembrete',etapa:15,venceEm:'2026-11-15'}};
  const dados={...ficha,etapas:configuracoesRegua.etapas,linhaDoTempo:[lembrete,...ficha.linhaDoTempo.slice(1)]};
  const html=views.cliente(tela('cliente',dados));
  assert.match(html,/<li class="evento is-contato"><p class="evento-titulo">Lembrete pelo WhatsApp · 15 dias antes<\/p><p>Clínica Vida Plena · Centro · Premium · vencimento de 15\/11\/2026<\/p>/);
  assert.match(views.cliente(tela('cliente',{...dados,etapas:undefined})),/<p class="evento-titulo">Lembrete pelo WhatsApp<\/p>/,'sem a lista, sem o nome');
  assert.match(views.cliente(tela('cliente',ficha)),/<p class="evento-titulo">Cobrança pelo WhatsApp<\/p>/,'a cobrança não muda');
  assert.match(views.cliente(tela('cliente',{...dados,etapas:[{dias:15,nome:XSS}]})),/Lembrete pelo WhatsApp · &lt;img src=x onerror=alert\(1\)&gt;<\/p>/);
});
