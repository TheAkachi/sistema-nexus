import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { previa } from '../../api/views/admin.mjs';
import { tela, ficha, configuracoes } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/relatorio-mensal: o relatório do mês (contrato v0.11.0) na ficha (6.7 e 7.4: o envio por empresa e o item da linha do
// tempo) e nas Configurações (6.14 e 7.3: o modelo próprio, com as variáveis e a prévia), a partir dos exemplos do contrato.
const XSS='<img src=x onerror=alert(1)>';
const html=dados=>views.cliente(tela('cliente',dados));
const com=mudar=>{const d=structuredClone(ficha);mudar(d);return d;};
const empresa=(h,id)=>{const i=h.indexOf(`<li class="empresa" data-empresa="${id}">`);assert.ok(i>=0,id);return h.slice(i,h.indexOf('</li>',i)+5);};

test('ficha: o envio do relatório em cada empresa, com o último envio, o WhatsApp e o "Ver o relatório"',()=>{
  const h=html(ficha),centro=empresa(h,'clinica-vida-plena-centro'),austin=empresa(h,'clinica-vida-plena-austin');
  assert.match(centro,/<\/div><div class="empresa-relatorio"><p class="empresa-relatorio-envio" data-ultimo-envio>Relatório de setembro de 2026 enviado em <time datetime="2026-10-02T13:05:00\.000Z">02\/10\/2026 às 10:05<\/time> por Bruno<\/p><div class="empresa-relatorio-acoes">/);
  assert.match(centro,/<a class="botao whatsapp" href="https:\/\/wa\.me\/5521900000001\?text=Ol%C3%A1[^"]*relatorio%2F2026-09" target="_blank" rel="noopener" data-enviar-relatorio="clinica-vida-plena-centro" data-mes="2026-09"><svg[^]*?<\/svg><span>Enviar o relatório de setembro de 2026<\/span><span class="sr-only">: Clínica Vida Plena · Centro \(abre o WhatsApp em outra aba\)<\/span><span class="seta" aria-hidden="true">↗<\/span><\/a>/);
  assert.match(centro,/<a class="botao-texto" href="https:\/\/nexus\.demo\/painel\/clinica-vida-plena-centro\/relatorio\/2026-09" target="_blank" rel="noopener">Ver o relatório<span class="sr-only"> de setembro de 2026: Clínica Vida Plena · Centro \(abre o guia em outra aba e pede login\)<\/span> <span aria-hidden="true">↗<\/span><\/a><\/div><\/div><\/li>$/);
  assert.match(austin,/<p class="empresa-relatorio-envio" data-ultimo-envio>O relatório de setembro de 2026 ainda não foi enviado<\/p>/);
  assert.match(austin,/data-enviar-relatorio="clinica-vida-plena-austin" data-mes="2026-09"/);
  assert.match(h,/<\/ul><p class="bloco-nota">O relatório do mês é uma página do painel do guia: o cliente abre com o login dele, numa conta com acesso à empresa\.<\/p>/);
  semInline(renderPage({title:'Ficha',status:200,view:'cliente',vm:tela('cliente',ficha)}));
});

test('ficha: sem o linkWhatsapp, quem não cobra não vê o botão, e quem cobra o vê desligado, com o motivo',()=>{
  const semLink=d=>d.relatorio.empresas.forEach(r=>{r.linkWhatsapp=null;});
  // Quem não cobra: sem o botão, com o último envio e o "Ver o relatório".
  const leitura=views.cliente(tela('cliente',com(semLink),{pode:{cobrar:false}}));
  assert.doesNotMatch(leitura,/Enviar o relatório|data-enviar-relatorio/);
  assert.match(empresa(leitura,'clinica-vida-plena-centro'),/data-ultimo-envio>Relatório de setembro de 2026 enviado em[^]*<div class="empresa-relatorio-acoes"><a class="botao-texto" href="https:\/\/nexus[^"]*\/relatorio\/2026-09"/);
  // O cliente sem WhatsApp: desligado, com o caminho para cadastrar.
  const semZap=html(com(d=>{semLink(d);d.whatsapp='';}));
  assert.match(empresa(semZap,'clinica-vida-plena-austin'),/<button type="button" class="botao whatsapp" disabled><svg[^]*?<\/svg><span>Enviar o relatório de setembro de 2026<\/span><span class="sr-only">: Clínica Vida Plena · Austin<\/span><\/button><p class="renovacao-falta"><svg[^]*?<\/svg><span>Sem WhatsApp cadastrado\. <a href="\/clientes\/[^"]+\/editar">Cadastrar o WhatsApp<\/a><\/span><\/p>/);
  // Sem o endereço do guia: desligado, sem o "Ver o relatório".
  const semUrl=empresa(html(com(d=>{semLink(d);d.relatorio.empresas.forEach(r=>{r.url='';});})),'clinica-vida-plena-centro');
  assert.match(semUrl,/disabled>[^]*<span>O endereço do relatório no guia ainda não está disponível\.<\/span>/);
  assert.doesNotMatch(semUrl,/Ver o relatório/);
  // Sem o campo relatorio (ou sem a linha da empresa): nada do relatório.
  const sem=html(com(d=>{delete d.relatorio;}));
  assert.doesNotMatch(sem,/empresa-relatorio|O relatório do mês é uma página/);
  assert.doesNotMatch(empresa(html(com(d=>{d.relatorio.empresas=d.relatorio.empresas.slice(0,1);})),'clinica-vida-plena-austin'),/empresa-relatorio/);
  assert.doesNotMatch(html(com(d=>{d.relatorio.empresas[0].url=`"${XSS}`;d.relatorio.rotulo=XSS;})),/<img src=x/);
});

test('linha do tempo: o relatório enviado com o ramo próprio, a empresa, quem e quando',()=>{
  const h=html(ficha);
  assert.match(h,/<li class="evento is-relatorio"><p class="evento-titulo">Relatório de setembro de 2026 pelo WhatsApp<\/p><p>Clínica Vida Plena · Centro<\/p><p class="evento-quando"><time datetime="2026-10-02T13:05:00\.000Z">02\/10\/2026 às 10:05<\/time> por Bruno<\/p><\/li><\/ol>/,'o mais antigo, no fim');
  assert.equal((h.match(/class="evento is-pagamento/g)||[]).length,1,'não cai no ramo do pagamento');
  const x=html(com(d=>{d.linhaDoTempo.at(-1).empresa.nome=XSS;d.linhaDoTempo.at(-1).contato.mes=null;}));
  assert.match(x,/<p class="evento-titulo">Relatório do mês pelo WhatsApp<\/p><p>&lt;img src=x onerror=alert\(1\)&gt;<\/p>/);
  assert.match(html(com(d=>{d.linhaDoTempo=[];})),/os relatórios enviados aparecem aqui/);
});

test('configurações: a mensagem do relatório do mês, com as variáveis, a legenda e a prévia',()=>{
  const vr=configuracoes.variaveisRelatorio,h=views.configuracoes(tela('configuracoes',configuracoes));
  assert.deepEqual(vr.map(v=>v.chave),['responsavel','cliente','empresa','mes','desempenho','link']);
  const i=h.indexOf('<fieldset class="secao-form" data-modelo-relatorio'),bloco=h.slice(i,h.indexOf('<legend>Tolerância</legend>'));
  assert.ok(i>h.indexOf('<legend>Mensagem de cobrança</legend>'),'depois da mensagem de cobrança');
  assert.match(bloco,/^<fieldset class="secao-form" data-modelo-relatorio data-variaveis="responsavel,cliente,empresa,mes,desempenho,link" data-exemplos="\{&quot;responsavel&quot;:&quot;Marina Souza&quot;[^"]*"><legend>Mensagem do relatório do mês<\/legend>/);
  assert.match(bloco,/<textarea id="config-relatorio" name="modeloRelatorio"[^>]*maxlength="1000"[^>]*required minlength="20" data-antes="Olá, \{responsavel\}! Aqui é do Nexus\. \{desempenho\} O relatório de \{mes\} da \{empresa\} está neste link: \{link\}"/);
  assert.match(bloco,/De 20 a 1\.000 caracteres, com o \{link\} pelo menos uma vez\./);
  assert.match(bloco,/<div class="variaveis" role="group" aria-label="Inserir uma variável na mensagem do relatório"><button type="button" class="aba" data-variavel="responsavel"[^]*data-variavel="link" title="Endereço do relatório no painel do site \(pede login\)">\{link\}/);
  assert.match(bloco,/<dt>\{mes\}<\/dt><dd>Mês do relatório\. Ex\.: setembro de 2026<\/dd>/);
  const esperado=previa(configuracoes.modeloRelatorio,vr,'');
  assert.equal(esperado,'Olá, Marina Souza! Aqui é do Nexus. Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro. O relatório de setembro de 2026 da Clínica Vida Plena · Centro está neste link: https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09');
  assert.ok(bloco.includes(`<p class="balao" data-previa aria-live="polite">${esperado}</p>`));
  assert.equal(previa(configuracoes.modeloRelatorio,vr,'',{semDesempenho:true}),'Olá, Marina Souza! Aqui é do Nexus. O relatório de setembro de 2026 da Clínica Vida Plena · Centro está neste link: https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09','sem a frase, sem espaço sobrando');
  assert.match(bloco,/<fieldset class="escolha previa-opcao" data-previa-desempenho><legend class="sr-only">Na prévia, o desempenho no guia<\/legend><label><input type="radio" name="previaDesempenhoRelatorio" value="com" checked>/,'o modelo padrão usa a variável: a escolha aparece');
  assert.equal((h.match(/data-form="configuracoes"/g)||[]).length,1,'um salvar só');
  assert.doesNotMatch(views.configuracoes(tela('configuracoes',{...configuracoes,variaveisRelatorio:[]})),/data-modelo-relatorio|modeloRelatorio/,'sem as variáveis, sem o bloco');
  assert.match(views.configuracoes(tela('configuracoes',{...configuracoes,modeloRelatorio:`Oi ${XSS} {link}`})),/data-previa aria-live="polite">Oi &lt;img src=x onerror=alert\(1\)&gt; https:/);
  semInline(renderPage({title:'Configurações',status:200,view:'configuracoes',vm:tela('configuracoes',configuracoes)}));
});
