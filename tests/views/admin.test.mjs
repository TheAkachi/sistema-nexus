import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views, renderPage } from '../../api/views/index.mjs';
import { previa } from '../../api/views/admin.mjs';
import { preencher, VARIAVEIS } from '../../api/lib/mensagem.mjs';
import { tela, equipe, configuracoes } from './exemplos.mjs';
import { semInline } from './ajuda.mjs';

// fe/admin: Equipe (6.13 e 7.6) e Configurações (6.14 e 7.3), a partir dos vms de exemplo do contrato.
const XSS='<img src=x onerror=alert(1)>';
const pagina=(view,vm)=>renderPage({title:'Tela | Gestão Nexus',status:200,view,vm});
const de=(html,id)=>{const i=html.indexOf(`id="membro-${id}"`);assert.ok(i>=0,id);return html.slice(i,html.indexOf('</li>',i));};

test('equipe: convidar com o papel explicado, e cada pessoa com a situação, o 2FA e as ações',()=>{
  const html=views.equipe(tela('equipe',equipe));
  assert.match(html,/<h1 id="titulo">Equipe<\/h1>/);
  assert.match(html,/<details class="vincular" id="convidar"><summary class="botao">[^]*Convidar alguém<\/summary><form class="formulario" method="post" data-form="convite" novalidate>/);
  assert.match(html,/id="convite-email" name="email"[^>]*required[^]*<select id="convite-papel" name="papel"[^>]*><option value="admin">Admin<\/option><option value="financeiro">Financeiro<\/option><option value="comercial" selected>Comercial<\/option><option value="leitura">Leitura<\/option><\/select>/);
  assert.match(html,/<dt>Financeiro<\/dt><dd>Assinaturas, pagamentos e estornos, e a cobrança no WhatsApp\.<\/dd>/);
  assert.match(html,/o link do convite aparece aqui, para você mandar pelo WhatsApp\. Ele vale 72 horas\./);
  const ana=de(html,'a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21');
  assert.match(ana,/<p class="membro-nome">Ana<\/p><p class="membro-apoio">ana@exemplo\.test · Financeiro<\/p>/);
  assert.match(ana,/<span class="selo is-em-dia">Ativa<\/span><\/p><p class="membro-apoio">Verificação em duas etapas ativa\. Último acesso em <time[^>]*>20\/10\/2026 às 10:02<\/time>\./);
  assert.match(ana,/data-form="membro" data-id="a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21" data-version="2"[^]*name="nome"[^>]*data-antes="Ana"[^]*<select id="membro-a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21-papel" name="papel"[^>]*data-antes="financeiro"><option value="admin">Admin<\/option><option value="financeiro" selected>/);
  assert.match(ana,/data-link-senha="a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21">Gerar link de senha[^]*data-redefinir-2fa="a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21" data-version="2">Redefinir o 2FA[^]*data-desativar="a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21" data-version="2" data-valor="true">Desativar a conta/);
  const julia=de(html,'e2b4c6d8-1a3f-4b5d-9c7e-0f1a2b3c4d58');
  assert.match(julia,/<span class="selo is-a-vencer">Convite enviado<\/span><\/p><p class="membro-apoio">Convite vale até <time[^>]*>23\/10\/2026 às 09:00<\/time>\. Ainda não entrou\./);
  assert.match(julia,/Gerar um convite novo/);assert.doesNotMatch(julia,/data-redefinir-2fa/,'sem 2FA, nada para redefinir');
  const rafael=de(html,'f3c5d7e9-2b4a-4c6e-8d0f-1a2b3c4d5e69');
  assert.match(html,/<li class="membro is-desativado" id="membro-f3c5d7e9-2b4a-4c6e-8d0f-1a2b3c4d5e69">/);
  assert.match(rafael,/<span class="selo">Desativada<\/span>[^]*data-valor="false">Reativar a conta/);
  assert.doesNotMatch(rafael,/data-link-senha|data-redefinir-2fa/,'desativada: só reativar');
  const eu=de(html,'6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10');
  assert.match(eu,/Lucas <span class="muted">\(você\)<\/span>/);
  assert.match(eu,/<p>Admin <span class="muted">\(você não muda o próprio papel\)<\/span><\/p>/);
  assert.doesNotMatch(eu,/name="papel"|data-desativar|data-redefinir-2fa|data-link-senha/,'ninguém muda o próprio papel, nem se desativa');
  const vencido=views.equipe(tela('equipe',{itens:[{...equipe.itens[2],convitePendente:{expira:'2026-10-18T12:00:00.000Z',vencido:true}}]}));
  assert.match(vencido,/<span class="selo is-a-vencer">Convite vencido<\/span>[^]*O convite venceu em <time[^>]*>18\/10\/2026 às 09:00<\/time>\. Gere um link novo\./);
  assert.match(views.equipe(tela('equipe',{itens:[{...equipe.itens[0],nome:XSS}]})),/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(pagina('equipe',tela('equipe',equipe)),/<script type="module" src="\/assets\/admin\.js"><\/script>/);
  semInline(pagina('equipe',tela('equipe',equipe)));
});

test('configurações: Pix, modelo com as variáveis e a pré-visualização, tolerância e um único salvar',()=>{
  const html=views.configuracoes(tela('configuracoes',configuracoes));
  assert.match(html,/<h1 id="titulo">Configurações<\/h1><p>Só os dados do negócio: a chave Pix, o WhatsApp do atendimento, a mensagem de cobrança, a do relatório do mês e a tolerância\.<\/p>/);
  assert.match(html,/data-form="configuracoes" data-variaveis="responsavel,cliente,empresa,plano,valor,vencimento,prazo,chave_pix,desempenho" novalidate>[^]*name="version" value="2">/);
  assert.match(html,/id="config-pix" name="chavePix"[^>]*value="pix@exemplo\.test" maxlength="77"[^>]*data-antes="pix@exemplo\.test"/);
  assert.match(html,/<textarea id="config-modelo" name="modeloMensagem"[^>]*rows="6" maxlength="1000" required minlength="20" data-antes="Olá, \{responsavel\}!/);
  assert.match(html,/<div class="variaveis" role="group" aria-label="Inserir uma variável no modelo"><button type="button" class="aba" data-variavel="responsavel" title="Responsável pelo cliente \(ou o nome do cliente, se não houver\)">\{responsavel\}/);
  assert.match(html,/<p class="balao" data-previa aria-live="polite">Olá, Marina Souza! Aqui é do Nexus\. A assinatura do plano Premium da Clínica Vida Plena · Centro venceu em 15\/10\/2026, no valor de R\$ 99,00\. Para renovar, faça o Pix para a chave pix@exemplo\.test e mande o comprovante por aqui\. Obrigado!<\/p>/);
  assert.match(html,/<input type="number" id="config-tolerancia" name="toleranciaDias"[^>]*value="10" min="0" max="60"/);
  assert.match(html,/<p class="form-nota">Atualizado em <time[^>]*>20\/10\/2026 às 08:00<\/time> por Lucas\.<\/p><div class="form-acoes"><button type="submit" class="botao">Salvar as configurações<\/button><\/div>/);
  assert.equal((html.match(/data-form="configuracoes"/g)||[]).length,1);
  assert.match(views.configuracoes(tela('configuracoes',{...configuracoes,atualizadoEm:null,atualizadoPor:null})),/Ainda com os valores da instalação\./);
  assert.match(views.configuracoes(tela('configuracoes',{...configuracoes,modeloMensagem:`Oi ${XSS}`})),/data-previa aria-live="polite">Oi &lt;img src=x/);
  assert.doesNotMatch(html,/SMTP|token|chave de API|OAuth/i,'nada técnico na tela (D3)');
  semInline(pagina('configuracoes',tela('configuracoes',configuracoes)));
});

test('a pré-visualização segue a regra do servidor: variáveis da lista, o resto entre chaves fica e a chave Pix do campo',()=>{
  const v=configuracoes.variaveis,exemplos=Object.fromEntries(VARIAVEIS.map(x=>[x.chave,x.exemplo]));
  for(const modelo of [configuracoes.modeloMensagem,'Oi {cliente}, {x} e {responsavel}{plano} {chave_pix}.','{prazo} {valor} {vencimento} {empresa} {nao_existe}'])
    assert.equal(previa(modelo,v,exemplos.chave_pix),preencher(modelo,exemplos),modelo);
  assert.equal(previa('Pix: {chave_pix}.',v,''),'Pix: .','sem chave, a mensagem sai sem ela');
  assert.equal(previa('Pix: {chave_pix}.',v,'outra@chave.test'),'Pix: outra@chave.test.');
});
