import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lerCsv, nomeColuna } from '../../api/lib/csv.mjs';
import { ordemDatas, paraDia, centavos } from '../../api/data/importacao.mjs';
import { limpar } from '../../api/limpeza.mjs';
import { backup, restore } from '../../api/backup.mjs';
import { openDB, migrate } from '../../api/db.mjs';
import { newSession, COOKIE } from '../../api/auth.mjs';
import { ambiente } from './ambiente.mjs';

// Importação (contrato 6.11, 6.12 e 8), com os exemplos fictícios de tests/fixtures/. O do eDirectory segue o cabeçalho da
// documentação pública dele (P7): quando o arquivo real chegar, o exemplo e estes testes mudam junto. Hoje é 20/10/2026.
const fixture=nome=>readFile(new URL(`../fixtures/${nome}`,import.meta.url));
const EDIRECTORY=await fixture('edirectory-exemplo.csv'),PLANILHA=await fixture('planilha-exemplo.csv');
const enviar=(t,s,buf,{tipo='edirectory',tipoConteudo='text/csv'}={})=>
  t.req(`/api/importacoes?tipo=${tipo}`,{method:'POST',body:buf,headers:{'Content-Type':tipoConteudo},s});
const porLinha=imp=>Object.fromEntries(imp.linhas.map(l=>[l.linha,l]));
const trocar=(buf,de,para)=>Buffer.from(buf.toString('utf8').replace(de,para));

test('CSV: codificação, separador, aspas e quebra de linha dentro da célula',()=>{
  const utf8=lerCsv(Buffer.from('﻿a;b;"c;d"\r\n1;"dois ""2""";"três\nlinhas"\r\n\r\n;;\n4;5;6'));
  assert.deepEqual(utf8,{cabecalho:['a','b','c;d'],dados:[['1','dois "2"','três\nlinhas'],['4','5','6']],separador:';',codificacao:'utf-8'});
  const latin=lerCsv(Buffer.from('Empresa\tSituação\nPão\tAtivo\n','latin1'));
  assert.deepEqual([latin.separador,latin.codificacao,latin.cabecalho[1],latin.dados[0][0]],['tab','windows-1252','Situação','Pão']);
  assert.equal(lerCsv(Buffer.from('so-uma-coluna\nx')).separador,',');
  assert.throws(()=>lerCsv(Buffer.from([0x61,0x00,0x62])),e=>e.status===415);
  assert.equal(nomeColuna(' E-mail '),'email');assert.equal(nomeColuna('Listing DB ID'),nomeColuna('listing db id'));
  assert.equal(nomeColuna('Data de início'),'datadeinicio');
});

test('datas, ordem de dia e mês do arquivo e valores',()=>{
  assert.equal(ordemDatas(['01/02/2026','15/11/2026']),'dia/mês');
  assert.equal(ordemDatas(['11/15/2026','01/02/2026']),'mês/dia');
  assert.equal(ordemDatas(['01/02/2026','2026-12-31']),'dia/mês','sem pista: dia/mês');
  assert.equal(paraDia('15/11/2026 10:30','dia/mês'),'2026-11-15');
  assert.equal(paraDia('11/15/2026','mês/dia'),'2026-11-15');
  assert.equal(paraDia('2026-11-05T00:00:00','mês/dia'),'2026-11-05','o ISO não depende da ordem');
  for(const ruim of ['31/02/2026','2026-13-01','15/2026','ontem',''])assert.equal(paraDia(ruim,'dia/mês'),null,ruim);
  assert.deepEqual(['99,00','R$ 1.250,00','1250.00','99','R$1.250','0,5'].map(centavos),[9900,125000,125000,9900,125000,50]);
  assert.equal(centavos(''),undefined);
  for(const ruim of ['abc','1,2,3','-5','1.25.0','1000000,01'])assert.equal(centavos(ruim),null,ruim);
});

test('eDirectory: prévia sem gravar nada, com casamento, avisos, erros e a mesma prévia para o mesmo arquivo',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('importa@exemplo.test',{nome:'Lucas'});
    const r=await enviar(t,s,EDIRECTORY);
    assert.equal(r.status,201,r.text);
    const imp=r.json;
    assert.deepEqual([imp.tipo,imp.status,imp.criadaPor.nome,imp.arquivo.linhas,imp.arquivo.separador,imp.arquivo.codificacao,imp.arquivo.datas],
      ['edirectory','previa','Lucas',8,',','utf-8','dia/mês']);
    assert.match(imp.arquivo.sha256,/^[a-f0-9]{64}$/);
    assert.equal(imp.expiraEm,'2026-10-21T12:00:00.000Z');
    assert.deepEqual(imp.resumo,{novos:5,atualizados:0,iguais:0,semEmpresa:2,ignorados:0,erros:3});
    const l=porLinha(imp);
    assert.deepEqual(l[2],{linha:2,acao:'novo',cliente:{nome:'Clínica Vida Plena',email:'marina@exemplo.test',whatsapp:'5521900000001'},
      empresa:{id:'clinica-vida-plena-austin',nome:'Clínica Vida Plena · Austin'},sugestoes:[],plano:{id:'plano-avancado',nome:'Avançado'},valorCentavos:6700,
      ciclo:'mensal',venceEm:'2026-11-15',status:'ativa',mudancas:[],aviso:'Sem valor no arquivo: usado o preço do plano.',erro:''});
    assert.deepEqual([l[3].empresa.id,l[3].plano.id,l[3].valorCentavos],['clinica-vida-plena-centro','plano-premium',9900]);
    assert.deepEqual([l[4].cliente.nome,l[4].cliente.whatsapp,l[4].plano.id,l[4].status,l[4].empresa.id],['Carlos Exemplo','5521900000002','plano-avancado','suspensa','padaria-pao-dourado']);
    assert.deepEqual([l[5].empresa,l[5].sugestoes,l[5].plano,l[5].valorCentavos,l[5].status],[null,[{id:'studio-bella',nome:'Studio Bella'}],null,0,'ativa']);
    assert.equal(l[5].aviso,'Plano Ouro não existe no guia. Sem valor no arquivo nem preço do plano: entra como R$ 0,00.');
    assert.deepEqual([l[6].acao,l[6].erro],['erro','Falta o título do anúncio.']);
    assert.deepEqual([l[7].acao,l[7].erro],['erro','Linha repetida no arquivo (igual à linha 2).']);
    assert.deepEqual([l[8].acao,l[8].erro,l[8].valorCentavos],['erro','Data de renovação inválida.',null]);
    assert.deepEqual([l[9].cliente,l[9].status,l[9].valorCentavos,l[9].sugestoes],[{nome:'José Exemplo',email:'',whatsapp:''},'cancelada',0,[]]);
    assert.equal(l[9].aviso,'E-mail inválido no arquivo: ficou em branco. WhatsApp inválido no arquivo: ficou em branco. Sem valor no arquivo nem preço do plano: entra como R$ 0,00.');
    // Nada gravado; a senha da conta e o endereço nem entram na prévia.
    for(const tabela of ['clients','client_businesses','subscriptions','plan_sync'])assert.equal((await t.db.query(`SELECT count(*)::int AS n FROM ${tabela}`)).rows[0].n,0,tabela);
    const previa=JSON.stringify((await t.db.query('SELECT previa FROM imports')).rows[0].previa);
    for(const fora of ['senha-ficticia','Rua Fictícia','26000-000','Atendimento'])assert.equal(previa.includes(fora),false,fora);
    assert.equal((await t.auditoria('importacao_enviada',imp.id))[0].after.linhas,8);
    // O mesmo arquivo com a prévia aberta: a mesma prévia, com 200. Pela página e pela lista, o mesmo.
    const de_novo=await enviar(t,s,EDIRECTORY);
    assert.deepEqual([de_novo.status,de_novo.json.id],[200,imp.id]);
    assert.deepEqual((await t.req(`/api/importacoes/${imp.id}`,{s})).json,imp);
    const lista=(await t.req('/api/importacoes',{s})).json;
    assert.deepEqual([lista.total,lista.itens[0].id,lista.itens[0].status,lista.itens[0].linhas],[1,imp.id,'previa',8]);
    const pagina=await t.pagina(`/importacao/${imp.id}`,{s});
    assert.deepEqual([pagina.view,pagina.title,pagina.vm.dados.id],['importacao-previa','Prévia da importação | Gestão Nexus',imp.id]);
    assert.equal((await t.pagina('/importacao',{s})).vm.dados.itens[0].id,imp.id);
  } finally {await t.fim();}
});

test('planilha: ponto e vírgula, Windows-1252, ciclos e vencimento calculado',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('planilha@exemplo.test');
    const r=await enviar(t,s,Buffer.from(PLANILHA.toString('utf8'),'latin1'),{tipo:'planilha',tipoConteudo:'application/vnd.ms-excel'});
    assert.equal(r.status,201,r.text);
    assert.deepEqual([r.json.arquivo.separador,r.json.arquivo.codificacao,r.json.arquivo.datas],[';','windows-1252','dia/mês']);
    assert.deepEqual(r.json.resumo,{novos:3,atualizados:0,iguais:0,semEmpresa:0,ignorados:0,erros:2});
    const l=porLinha(r.json);
    assert.deepEqual([l[2].cliente,l[2].empresa.id,l[2].valorCentavos,l[2].venceEm,l[2].aviso],
      [{nome:'Auto Peças Iguaçu Ltda',email:'joao@exemplo.test',whatsapp:'5521900000003'},'auto-pecas-iguacu',9900,'2026-11-05','']);
    assert.deepEqual([l[3].cliente.nome,l[3].ciclo,l[3].valorCentavos,l[3].venceEm,l[3].aviso],
      ['Padaria Pão Dourado','trimestral',18000,'2026-10-24','Sem vencimento no arquivo: o início mais um ciclo.']);
    assert.deepEqual([l[4].erro,l[5].erro],['Falta o valor.','Data de início inválida.']);
    assert.deepEqual([l[6].empresa.id,l[6].ciclo,l[6].valorCentavos,l[6].venceEm,l[6].status],['studio-bella','semestral',6700,'2027-03-01','suspensa']);
  } finally {await t.fim();}
});

test('envio: tipo, formato, tamanho, linhas, colunas, site fora do ar, limite e papel',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('envio@exemplo.test'),comercial=await t.sessao('comercial@exemplo.test',{papel:'comercial'});
    const erro=async(res,status,json)=>assert.deepEqual([res.status,res.json],[status,json],res.text);
    await erro(await enviar(t,comercial,EDIRECTORY),403,{erro:'O seu papel não permite esta ação.'});
    await erro(await enviar(t,s,EDIRECTORY,{tipo:'xls'}),422,{erro:'Escolha o tipo: edirectory ou planilha.',campo:'tipo'});
    await erro(await enviar(t,s,EDIRECTORY,{tipoConteudo:'application/pdf'}),415,{erro:'Envie um arquivo CSV.',campo:'arquivo'});
    await erro(await enviar(t,s,Buffer.from('Listing Title,Listing Renewal Date\n\u0000')),415,{erro:'Envie um arquivo CSV (texto).',campo:'arquivo'});
    await erro(await enviar(t,s,Buffer.alloc(2*1024*1024+1,'a')),413,{erro:'O arquivo pode ter até 2 MB.',campo:'arquivo'});
    await erro(await enviar(t,s,Buffer.from('Listing Title,Listing Status\nX,Active')),422,{erro:'Faltam as colunas: Listing Renewal Date.',campo:'arquivo'});
    await erro(await enviar(t,s,Buffer.from('empresa;plano\nX;Premium'),{tipo:'planilha'}),422,{erro:'Faltam as colunas: valor, início.',campo:'arquivo'});
    const muitas='Listing Title,Listing Renewal Date\n'+Array.from({length:2001},(_,i)=>`Empresa ${i},15/11/2026`).join('\n');
    await erro(await enviar(t,s,Buffer.from(muitas)),422,{erro:'O arquivo tem mais de 2.000 linhas. Divida em partes.',campo:'arquivo'});
    t.site.fora=true;
    await erro(await enviar(t,s,trocar(EDIRECTORY,'Bar do Zé','Bar do Zé 2')),503,{erro:'O guia não respondeu. Tente de novo em instantes.'});
    t.site.fora=false;
    assert.equal((await t.db.query('SELECT count(*)::int AS n FROM imports')).rows[0].n,0,'nenhuma prévia gravada');
    // 10 envios por pessoa por hora, contando os recusados depois do tipo e do formato (6 acima).
    assert.equal((await enviar(t,s,EDIRECTORY)).status,201);
    for(let i=0;i<3;i++)assert.equal((await enviar(t,s,EDIRECTORY)).status,200);
    await erro(await enviar(t,s,EDIRECTORY),429,{erro:'Muitas tentativas. Tente de novo em alguns minutos.'});
    t.minutos(61);
    const n=await newSession(t.db,s.id,{now:t.agora}),mesma={cookie:`${COOKIE}=${n.value}`,csrf:n.csrf};
    assert.equal((await enviar(t,mesma,EDIRECTORY)).status,200,'outra hora, a mesma prévia aberta');
  } finally {await t.fim();}
});

test('a equipe resolve as linhas: empresa do guia, nenhuma, ignorar; erros e versão',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('resolve@exemplo.test');
    // Padaria Pão Dourado já é de um cliente da gestão.
    const dono=(await t.req('/api/clientes',{method:'POST',body:{nome:'Outro Dono'},s})).json.id;
    await t.req(`/api/clientes/${dono}/empresas/padaria-pao-dourado`,{method:'POST',body:{},s});
    let imp=(await enviar(t,s,EDIRECTORY)).json;
    assert.deepEqual([porLinha(imp)[4].empresa,porLinha(imp)[4].aviso],[null,'Sem valor no arquivo: usado o preço do plano. A empresa Padaria Pão Dourado já é do cliente Outro Dono.']);
    const patch=(linha,body)=>t.req(`/api/importacoes/${imp.id}/linhas/${linha}`,{method:'PATCH',body,s});
    let r=await patch(5,{empresa:'studio-bella',version:imp.version});
    assert.equal(r.status,200,r.text);imp=r.json;
    assert.deepEqual([porLinha(imp)[5].empresa,porLinha(imp)[5].sugestoes,imp.resumo.semEmpresa],[{id:'studio-bella',nome:'Studio Bella'},[],2]);
    assert.deepEqual([(await patch(5,{empresa:null,version:imp.version-1})).status],[409]);
    assert.deepEqual((await patch(4,{empresa:'padaria-pao-dourado',version:imp.version})).json,{erro:'A empresa Padaria Pão Dourado já é do cliente Outro Dono.',campo:'empresa'});
    assert.deepEqual((await patch(9,{empresa:'nao-existe',version:imp.version})).json,{erro:'Empresa não encontrada no guia.',campo:'empresa'});
    assert.deepEqual((await patch(6,{ignorar:true,version:imp.version})).json,{erro:'Esta linha tem erro e não entra.'});
    assert.equal((await patch(99,{ignorar:true,version:imp.version})).status,404);
    assert.equal((await patch('abc',{ignorar:true,version:imp.version})).status,404);
    assert.deepEqual((await patch(9,{ignorar:'sim',version:imp.version})).json,{erro:'Valor inválido.',campo:'ignorar'});
    assert.deepEqual((await patch(9,{outra:1,version:imp.version})).json,{erro:'Campo não permitido.',campo:'outra'});
    // A escolha da equipe vem antes da achada pelo nome: a linha 2 perde a empresa, com aviso.
    imp=(await patch(9,{empresa:'clinica-vida-plena-austin',version:imp.version})).json;
    assert.deepEqual([porLinha(imp)[9].empresa.id,porLinha(imp)[2].empresa,porLinha(imp)[2].aviso],
      ['clinica-vida-plena-austin',null,'Sem valor no arquivo: usado o preço do plano. A empresa Clínica Vida Plena · Austin já está na linha 9.']);
    imp=(await patch(9,{empresa:null,version:imp.version})).json;
    assert.deepEqual([porLinha(imp)[9].empresa,porLinha(imp)[2].empresa.id],[null,'clinica-vida-plena-austin']);
    imp=(await patch(3,{ignorar:true,version:imp.version})).json;
    assert.deepEqual([porLinha(imp)[3].acao,imp.resumo],['ignorar',{novos:4,atualizados:0,iguais:0,semEmpresa:2,ignorados:1,erros:3}]);
    // Descartar fecha a prévia e apaga as linhas.
    assert.deepEqual((await t.req(`/api/importacoes/${imp.id}`,{method:'DELETE',s})).json,{ok:true});
    const fechada=(await t.req(`/api/importacoes/${imp.id}`,{s})).json;
    assert.deepEqual([fechada.status,fechada.linhas,fechada.resumo.ignorados],['descartada',[],1]);
    assert.equal((await t.db.query('SELECT previa FROM imports')).rows[0].previa,null);
    assert.deepEqual((await patch(5,{ignorar:true,version:fechada.version})).json,{erro:'Esta importação já foi fechada.'});
    assert.deepEqual((await t.req(`/api/importacoes/${imp.id}`,{method:'DELETE',s})).json,{erro:'Esta importação já foi fechada.'});
    assert.equal((await t.auditoria('importacao_descartada',imp.id)).length,1);
  } finally {await t.fim();}
});

test('voltar a importar recalcula a linha ignorada e a inclui na confirmação',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('retomar@exemplo.test');
    let imp=(await enviar(t,s,EDIRECTORY)).json;
    const original=porLinha(imp)[3];
    const patch=ignorar=>t.req(`/api/importacoes/${imp.id}/linhas/3`,{method:'PATCH',body:{ignorar,version:imp.version},s});
    let r=await patch(true);assert.equal(r.status,200,r.text);imp=r.json;
    assert.equal(porLinha(imp)[3].acao,'ignorar');
    r=await patch(false);assert.equal(r.status,200,r.text);imp=r.json;
    assert.deepEqual(porLinha(imp)[3],original);
    assert.equal(imp.resumo.ignorados,0);
    r=await t.req(`/api/importacoes/${imp.id}/confirmar`,{method:'POST',body:{version:imp.version},s});
    assert.equal(r.status,200,r.text);
    const sub=(await t.db.query("SELECT business_id FROM subscriptions WHERE source_key='edirectory:102'")).rows;
    assert.deepEqual(sub,[{business_id:'clinica-vida-plena-centro'}]);
  } finally {await t.fim();}
});

test('confirmar grava clientes, vínculos, assinaturas e a fila; reimportar não duplica nem desfaz o que a gestão mexeu',async()=>{
  const t=await ambiente();
  try {
    let s=await t.sessao('confirma@exemplo.test');
    const imp=(await enviar(t,s,EDIRECTORY)).json;
    // Reautenticação (4.6): a sessão de mais de 5 minutos precisa confirmar a senha.
    t.minutos(6);
    assert.equal((await t.req(`/api/importacoes/${imp.id}/confirmar`,{method:'POST',body:{version:imp.version},s})).status,403);
    s=await t.sessao('confirma2@exemplo.test');
    assert.equal((await t.req(`/api/importacoes/${imp.id}/confirmar`,{method:'POST',body:{version:imp.version+1},s})).status,409);
    const r=await t.req(`/api/importacoes/${imp.id}/confirmar`,{method:'POST',body:{version:imp.version},s});
    assert.equal(r.status,200,r.text);
    assert.deepEqual([r.json.status,r.json.linhas,r.json.resumo],['confirmada',[],{novos:5,atualizados:0,iguais:0,semEmpresa:2,ignorados:0,erros:3}]);
    assert.ok(r.json.confirmadaEm);
    const clientes=(await t.db.query('SELECT nome,email,whatsapp,responsavel,source_key FROM clients ORDER BY nome')).rows;
    assert.deepEqual(clientes,[
      {nome:'Carlos Exemplo',email:'carlos@exemplo.test',whatsapp:'5521900000002',responsavel:'Carlos Exemplo',source_key:'email:carlos@exemplo.test'},
      {nome:'Clínica Vida Plena',email:'marina@exemplo.test',whatsapp:'5521900000001',responsavel:'Marina Exemplo',source_key:'email:marina@exemplo.test'},
      {nome:'José Exemplo',email:'',whatsapp:'',responsavel:'José Exemplo',source_key:'nome:jose exemplo'},
      {nome:'Studio Bela Forma',email:'contato@exemplo.test',whatsapp:'',responsavel:'',source_key:'email:contato@exemplo.test'}]);
    const vinculos=(await t.db.query('SELECT c.nome,b.business_id,b.nome_cache,b.bairro_cache FROM client_businesses b JOIN clients c ON c.id=b.client_id ORDER BY b.business_id')).rows;
    assert.deepEqual(vinculos.map(v=>[v.nome,v.business_id,v.bairro_cache]),[['Clínica Vida Plena','clinica-vida-plena-austin','Austin'],
      ['Clínica Vida Plena','clinica-vida-plena-centro','Centro'],['Carlos Exemplo','padaria-pao-dourado','Comendador Soares']]);
    const subs=(await t.db.query(`SELECT business_id,plano_site,valor_centavos,ciclo,inicio::text,vence_em::text,dia_base,status,suspensa_em::text,cancelada_em::text,origem,source_key,gerida_em
      FROM subscriptions ORDER BY source_key`)).rows;
    assert.deepEqual(subs.map(x=>[x.source_key,x.business_id,x.plano_site,x.valor_centavos,x.inicio,x.vence_em,x.dia_base,x.status,x.suspensa_em,x.cancelada_em,x.origem,x.gerida_em]),[
      ['edirectory:101','clinica-vida-plena-austin','plano-avancado',6700,'2026-10-15','2026-11-15',15,'ativa',null,null,'edirectory',null],
      ['edirectory:102','clinica-vida-plena-centro','plano-premium',9900,'2026-10-15','2026-11-15',15,'ativa',null,null,'edirectory',null],
      ['edirectory:103','padaria-pao-dourado','plano-avancado',6700,'2026-09-24','2026-10-24',24,'suspensa','2026-10-20',null,'edirectory',null],
      ['edirectory:104',null,null,0,'2026-10-03','2026-11-03',3,'ativa',null,null,'edirectory',null],
      ['edirectory:107',null,'plano-presenca',0,'2026-11-20','2026-12-20',20,'cancelada',null,'2026-12-20','edirectory',null]]);
    const fila=(await t.db.query('SELECT business_id,plano,motivo FROM plan_sync ORDER BY business_id')).rows;
    assert.deepEqual(fila,[{business_id:'clinica-vida-plena-austin',plano:'plano-avancado',motivo:'importacao'},
      {business_id:'clinica-vida-plena-centro',plano:'plano-premium',motivo:'importacao'},{business_id:'padaria-pao-dourado',plano:null,motivo:'importacao'}]);
    const auditoria=(await t.auditoria('importacao_confirmada',imp.id))[0].after;
    assert.deepEqual([auditoria.novos,auditoria.clientesNovos,auditoria.tipo],[5,4,'edirectory']);
    assert.deepEqual((await t.req(`/api/importacoes/${imp.id}/confirmar`,{method:'POST',body:{version:r.json.version},s})).json,{erro:'Esta importação já foi fechada.'});

    // Reimportar o mesmo arquivo: tudo igual. Um pagamento na gestão deixa a assinatura gerida, e a importação não mexe mais nela.
    const igual=(await enviar(t,s,EDIRECTORY)).json;
    assert.deepEqual(igual.resumo,{novos:0,atualizados:0,iguais:5,semEmpresa:0,ignorados:0,erros:3});
    await t.req(`/api/importacoes/${igual.id}`,{method:'DELETE',s});
    const padaria=(await t.db.query("SELECT id,version FROM subscriptions WHERE source_key='edirectory:103'")).rows[0];
    await t.req(`/api/assinaturas/${padaria.id}/reativar`,{method:'POST',body:{version:padaria.version},s});
    const mudado=trocar(trocar(EDIRECTORY,'15/11/2026,Active,Avançado','15/12/2026,Active,Avançado'),'24/10/2026,Suspended','24/11/2026,Suspended');
    const nova=(await enviar(t,s,mudado)).json,l=porLinha(nova);
    assert.deepEqual(nova.resumo,{novos:0,atualizados:1,iguais:3,semEmpresa:0,ignorados:1,erros:3});
    assert.deepEqual([l[2].acao,l[2].mudancas,l[2].empresa.id],['atualizar',['venceEm'],'clinica-vida-plena-austin']);
    assert.deepEqual([l[4].acao,l[4].aviso],['ignorar','Sem valor no arquivo: usado o preço do plano. Editada na gestão depois da importação.']);
    const c=await t.req(`/api/importacoes/${nova.id}/confirmar`,{method:'POST',body:{version:nova.version},s});
    assert.deepEqual(c.json.resumo,{novos:0,atualizados:1,iguais:3,semEmpresa:0,ignorados:1,erros:3});
    const depois=(await t.db.query("SELECT source_key,vence_em::text,status FROM subscriptions WHERE source_key IN ('edirectory:101','edirectory:103') ORDER BY source_key")).rows;
    assert.deepEqual(depois,[{source_key:'edirectory:101',vence_em:'2026-12-15',status:'ativa'},{source_key:'edirectory:103',vence_em:'2026-10-24',status:'ativa'}]);
    assert.equal((await t.db.query('SELECT count(*)::int AS n FROM clients')).rows[0].n,4,'nenhum cliente duplicado');
  } finally {await t.fim();}
});

test('na confirmação, a empresa que ganhou assinatura de outra origem entra sem empresa',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('corrida@exemplo.test');
    const imp=(await enviar(t,s,EDIRECTORY)).json;
    // Depois da prévia, alguém cria na mão uma assinatura para a Clínica · Centro, num cliente com o mesmo e-mail.
    const cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Vida Plena',email:'marina@exemplo.test'},s})).json.id;
    await t.req(`/api/clientes/${cliente}/empresas/clinica-vida-plena-centro`,{method:'POST',body:{},s});
    const manual=await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa:'clinica-vida-plena-centro',plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2026-10-01',venceEm:'2026-11-01'}});
    assert.equal(manual.status,201,manual.text);
    const r=await t.req(`/api/importacoes/${imp.id}/confirmar`,{method:'POST',body:{version:imp.version},s});
    assert.equal(r.status,200,r.text);
    assert.equal(r.json.resumo.semEmpresa,3);
    const subs=(await t.db.query("SELECT client_id,business_id,origem FROM subscriptions WHERE business_id='clinica-vida-plena-centro' OR source_key='edirectory:102'")).rows;
    assert.deepEqual(subs.map(x=>[x.client_id===cliente,x.business_id,x.origem]).sort(),[[true,null,'edirectory'],[true,'clinica-vida-plena-centro','manual']]);
    // E a prévia nova já mostra o aviso.
    const nova=porLinha((await enviar(t,s,trocar(EDIRECTORY,'Bar do Zé','Bar do Zé Novo'))).json);
    assert.equal(nova[3].aviso,'Sem valor no arquivo: usado o preço do plano. A empresa Clínica Vida Plena · Centro já tem uma assinatura na gestão.');
  } finally {await t.fim();}
});

test('a prévia vence em 24 horas; o limpar da rotina diária expira e apaga o que venceu; o backup não leva a prévia',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('prazo@exemplo.test');
    const a=(await enviar(t,s,EDIRECTORY)).json;t.minutos(20);
    const b=(await enviar(t,s,PLANILHA,{tipo:'planilha'})).json;
    const arquivo=await backup(t.db,'frase-do-backup-de-teste');
    t.minutos(24*60-20);
    const vencida=(await t.req(`/api/importacoes/${a.id}`,{s:await t.sessao('prazo2@exemplo.test')})).json;
    assert.deepEqual([vencida.status,vencida.linhas],['expirada',[]]);
    t.minutos(20);
    const r=await limpar(t.db,t.agora);
    assert.equal(r.importacoes,1,'a outra prévia');
    assert.ok(r.limites>=1,JSON.stringify(r));
    assert.equal((await t.db.query('SELECT count(*)::int AS n FROM sessions WHERE expires_at<=$1',[t.agora.toISOString()])).rows[0].n,0);
    assert.deepEqual((await t.db.query('SELECT status,previa FROM imports ORDER BY tipo')).rows,[{status:'expirada',previa:null},{status:'expirada',previa:null}]);
    assert.equal(b.status,'previa');
    // Restaurado num banco novo: as importações voltam sem as linhas, como expiradas.
    const outro=await openDB({url:null,path:':memory:'});
    try {
      await migrate(outro);await restore(outro,arquivo,'frase-do-backup-de-teste');
      assert.deepEqual((await outro.query('SELECT status,previa,linhas FROM imports ORDER BY tipo')).rows,[{status:'expirada',previa:null,linhas:8},{status:'expirada',previa:null,linhas:5}]);
    } finally {await outro.close();}
  } finally {await t.fim();}
});
