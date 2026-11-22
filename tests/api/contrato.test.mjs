import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACOES, PAPEIS, pode, podeDe, exigir } from '../../api/permissoes.mjs';
import { ROTAS } from '../../api/api.mjs';
import { SEM_SENHA, COOKIE_LOGIN, emitirLink, entrar } from '../../api/login.mjs';
import { ambiente, SENHA } from './ambiente.mjs';

// O contrato (docs/CONTRATO.md) e o código não podem divergir: a tabela de papéis (3.1) é a mesma do api/permissoes.mjs e
// todo exemplo de vm (seção 6) é JSON válido, para o front copiar para tests/views/exemplos.mjs.
const contrato=(await readFile(new URL('../../docs/CONTRATO.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const secao=(titulo)=>{const i=contrato.indexOf(`\n### ${titulo}`);assert.ok(i>=0,`seção ${titulo}`);const fim=contrato.indexOf('\n### ',i+1);return contrato.slice(i,fim<0?undefined:fim);};

test('a tabela de papéis do contrato é a do api/permissoes.mjs',()=>{
  const linhas=secao('3.1 Tabela').split('\n').filter(l=>l.startsWith('|'));
  const cabecalho=linhas[0].split('|').slice(2,-1).map(c=>c.trim());
  assert.deepEqual(cabecalho,PAPEIS);
  const tabela={};
  for(const linha of linhas.slice(2)) {
    const [acao,...celulas]=linha.split('|').slice(1,-1).map(c=>c.trim());
    const chave=/^`(\w+)`/.exec(acao)?.[1];assert.ok(chave,linha);
    tabela[chave]=PAPEIS.filter((p,i)=>{assert.match(celulas[i],/^(sim|—)$/,linha);return celulas[i]==='sim';});
  }
  assert.deepEqual(tabela,ACOES);
});

test('pode, podeDe e exigir seguem a tabela: 401 sem sessão e 403 sem permissão',()=>{
  for(const papel of PAPEIS)for(const acao of Object.keys(ACOES))assert.equal(pode(papel,acao),ACOES[acao].includes(papel),`${papel} × ${acao}`);
  assert.equal(pode('admin','nao-existe'),false);assert.equal(pode(undefined,'ver'),false);
  assert.deepEqual(podeDe('comercial'),{clientes:true,assinaturas:true,pagamentos:false,cobrar:true,importar:false,equipe:false,configuracoes:false,auditoria:false});
  assert.equal('ver' in podeDe('leitura'),false);
  assert.throws(()=>exigir(null,'ver'),e=>e.status===401);
  assert.throws(()=>exigir({papel:'leitura'},'cobrar'),e=>e.status===403);
  exigir({papel:'financeiro'},'pagamentos');
});

test('cada rota implementada está na tabela 7.1, com a mesma ação e a mesma reautenticação',()=>{
  const tabela=new Map();
  for(const linha of secao('7.1 Rotas').split('\n').filter(l=>l.startsWith('| `'))) {
    const [rotaTxt,acaoTxt]=linha.replace(/\\\|/g,'¦').split('|').slice(1,3).map(c=>c.trim());
    const [metodo,caminho]=rotaTxt.replace(/`/g,'').split(' ');
    const acao=acaoTxt.startsWith('—')?'publica':acaoTxt.startsWith('sessão')?'sessao':/^`(\w+)`/.exec(acaoTxt)?.[1];
    // "⟳ para `a`" é um campo; "⟳ para `a` e `b`", a lista dos campos que pedem a reautenticação.
    const campos=acaoTxt.includes('⟳ para')?[...acaoTxt.slice(acaoTxt.indexOf('⟳ para')).matchAll(/`(\w+)`/g)].map(m=>m[1]):[];
    const reautenticar=campos.length>1?campos:campos[0]||acaoTxt.includes('⟳');
    tabela.set(`${metodo} ${caminho.split('?')[0]}`,{acao,reautenticar});
  }
  assert.ok(tabela.size>=40,`${tabela.size} rotas no contrato`);
  for(const r of ROTAS)assert.deepEqual(tabela.get(`${r.metodo} ${r.caminho}`),{acao:r.acao,reautenticar:r.reautenticar},`${r.metodo} ${r.caminho}`);
});

// As chaves do exemplo (o que o front usa) precisam existir no vm real; o real pode ter chaves a mais.
function faltando(exemplo,real,onde='vm') {
  if(Array.isArray(exemplo))return exemplo.length&&Array.isArray(real)&&real.length?faltando(exemplo[0],real[0],`${onde}[0]`):[];
  if(!exemplo||typeof exemplo!=='object'||!real||typeof real!=='object')return [];
  return Object.keys(exemplo).flatMap(k=>k in real?faltando(exemplo[k],real[k],`${onde}.${k}`):[`${onde}.${k}`]);
}
const exemplosDe=titulo=>[...secao(titulo).matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));

test('os vms do login e da Equipe têm todas as chaves dos exemplos (6.1, 6.2, 6.3 e 6.13)',async()=>{
  const t=await ambiente();
  try {
    const admin=await t.sessao('contrato@exemplo.test');
    const equipe=await t.pagina('/equipe',{s:admin});
    assert.deepEqual(faltando(exemplosDe('6.1 Rotas e moldura')[0],equipe.vm),[]);
    assert.deepEqual(faltando(exemplosDe('6.13 Equipe')[0],equipe.vm.dados),[]);
    const [senha,configurar]=exemplosDe('6.2 Entrar');
    assert.deepEqual(faltando(senha,(await t.pagina('/entrar')).vm),[]);
    await t.db.query("INSERT INTO users(id,email,nome,papel,password_hash) VALUES('00000000-0000-4000-8000-000000000001','novo@exemplo.test','Novo','leitura',$1)",[SEM_SENHA]);
    const {value}=await emitirLink(t.db,{userId:'00000000-0000-4000-8000-000000000001',now:t.agora});
    assert.deepEqual(faltando(exemplosDe('6.3 Definir senha')[0],(await t.pagina(`/entrar/definir-senha?token=${value}`)).vm),[]);
    await t.db.query("UPDATE users SET password_hash=(SELECT password_hash FROM users WHERE email='contrato@exemplo.test'),totp_ativo=false,totp_secret=NULL WHERE email='novo@exemplo.test'");
    const {valor}=await entrar(t.db,{email:'novo@exemplo.test',senha:SENHA,ip:'203.0.113.9',now:t.agora,chave:t.chave});
    assert.deepEqual(faltando(configurar,(await t.pagina('/entrar',{cookie:`${COOKIE_LOGIN}=${valor}`})).vm),[]);
  } finally {await t.fim();}
});

test('os vms de clientes e assinaturas têm todas as chaves dos exemplos (6.6 a 6.9)',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('contrato@exemplo.test');
    const cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Vida Plena',responsavel:'Marina',whatsapp:'21900000001',email:'marina@exemplo.test'},s})).json.id;
    await t.req(`/api/clientes/${cliente}/empresas/clinica-vida-plena-centro`,{method:'POST',body:{},s});
    const a=(await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa:'clinica-vida-plena-centro',plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2025-03-15',venceEm:'2026-10-15'}})).json;
    assert.deepEqual(faltando(exemplosDe('6.6 Clientes')[0],(await t.pagina('/clientes',{s})).vm.dados),[]);
    const ficha=(await t.pagina(`/clientes/${cliente}`,{s})).vm.dados,exemploFicha=exemplosDe('6.7 Ficha do cliente')[0];
    assert.deepEqual(faltando({...exemploFicha,linhaDoTempo:[]},ficha),[],'a linha do tempo chega com a cobrança');
    assert.deepEqual(faltando(exemplosDe('6.8 Cliente (criar e editar)')[0],(await t.pagina('/clientes/novo',{s})).vm.dados),[]);
    assert.deepEqual(faltando(exemplosDe('6.9 Assinatura (criar e editar)')[0],(await t.pagina(`/assinaturas/nova?cliente=${cliente}`,{s})).vm.dados),[]);
    assert.deepEqual(faltando({...exemplosDe('6.9 Assinatura (criar e editar)')[0],assinatura:exemploFicha.assinaturas[0]},(await t.pagina(`/assinaturas/${a.id}`,{s})).vm.dados),[]);
  } finally {await t.fim();}
});

test('os vms da cobrança têm todas as chaves dos exemplos (6.4, 6.5, 6.7, 6.10 e 6.14)',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('cobranca@exemplo.test',{nome:'Ana'});
    const cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Vida Plena',responsavel:'Marina',whatsapp:'21900000001'},s})).json.id;
    await t.req(`/api/clientes/${cliente}/empresas/clinica-vida-plena-centro`,{method:'POST',body:{},s});
    const a=(await t.req('/api/assinaturas',{method:'POST',s,body:{cliente,empresa:'clinica-vida-plena-centro',plano:'plano-premium',valorCentavos:9900,ciclo:'mensal',inicio:'2025-03-15',venceEm:'2026-10-15'}})).json;
    await t.req(`/api/assinaturas/${a.id}/contatos`,{method:'POST',body:{},s});
    assert.deepEqual(faltando(exemplosDe('6.4 Resumo')[0],(await t.pagina('/',{s})).vm.dados),[]);
    assert.deepEqual(faltando(exemplosDe('6.5 Renovações')[0],(await t.pagina('/renovacoes',{s})).vm.dados),[]);
    assert.deepEqual(faltando(exemplosDe('6.10 Registrar pagamento')[0],(await t.pagina(`/assinaturas/${a.id}/pagamento`,{s})).vm.dados),[]);
    assert.deepEqual(faltando(exemplosDe('6.14 Configurações')[0],(await t.pagina('/configuracoes',{s})).vm.dados),[]);
    await t.req(`/api/assinaturas/${a.id}/pagamentos`,{method:'POST',body:{valorCentavos:9900,pagoEm:'2026-10-20',forma:'pix',version:a.version},s});
    const ficha=(await t.pagina(`/clientes/${cliente}`,{s})).vm.dados,exemplo=exemplosDe('6.7 Ficha do cliente')[0];
    assert.deepEqual(faltando({...exemplo,linhaDoTempo:[]},ficha),[]);
    for(const tipo of ['contato','pagamento'])
      assert.deepEqual(faltando(exemplo.linhaDoTempo.find(i=>i.tipo===tipo),ficha.linhaDoTempo.find(i=>i.tipo===tipo)),[],tipo);
  } finally {await t.fim();}
});

test('o vm da auditoria tem todas as chaves do exemplo (6.15)',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('auditoria@exemplo.test');
    await t.req('/api/clientes',{method:'POST',body:{nome:'Clínica Vida Plena'},s});
    // O antes e o depois mudam de formato conforme a ação: só as chaves em volta deles são comparadas.
    const exemplo=exemplosDe('6.15 Auditoria')[0];exemplo.itens=exemplo.itens.map(a=>({...a,antes:null,depois:null}));
    assert.deepEqual(faltando(exemplo,(await t.pagina('/auditoria',{s})).vm.dados),[]);
  } finally {await t.fim();}
});

test('o vm dos Indicadores tem todas as chaves do exemplo (6.17)',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('indicadores@exemplo.test',{papel:'leitura'}),adm=await t.sessao('indicadores-admin@exemplo.test');
    const cliente=(await t.req('/api/clientes',{method:'POST',body:{nome:'Padaria Pão Dourado'},s:adm})).json.id;
    await t.req(`/api/clientes/${cliente}/empresas/padaria-pao-dourado`,{method:'POST',body:{},s:adm});
    await t.req('/api/assinaturas',{method:'POST',s:adm,body:{cliente,empresa:'padaria-pao-dourado',plano:'plano-avancado',valorCentavos:18000,ciclo:'trimestral',inicio:'2026-07-24',venceEm:'2026-10-24'}});
    // A Studio Bella não está na cópia: ela preenche a lista semMedicao (v0.14.1).
    await t.req(`/api/clientes/${cliente}/empresas/studio-bella`,{method:'POST',body:{},s:adm});
    await t.req('/api/assinaturas',{method:'POST',s:adm,body:{cliente,empresa:'studio-bella',plano:'plano-avancado',valorCentavos:6700,ciclo:'mensal',inicio:'2026-07-24',venceEm:'2026-11-05'}});
    // A cópia das métricas do site (9.5), para as listas da Audiência e dos Anunciantes não virem vazias. A categoria vem sem
    // o nome, como na cópia guardada antes da v0.9.2: o vm repete o identificador no nome.
    const c={whatsapp:2,telefone:0,rota:0,site:0};
    await t.db.query("INSERT INTO site_metrics(id,de,ate,dados,lido_em) VALUES(1,'2025-11','2026-10',$1,$2)",[JSON.stringify({medidoDesde:{contatos:'2026-07-28',buscas:'2026-10-01'},
      site:{meses:[{mes:'2026-10',visitas:10,contatos:c,buscas:4,buscasSemResultado:1}],buscasMaisFeitas:[{termo:'pao',vezes:3}],buscasSemResultado:[{termo:'x',vezes:3}],bairros:[{bairro:'Centro',vezes:3}],categorias:[{categoria:'alimentacao',vezes:3}]},
      empresas:[{id:'padaria-pao-dourado',nome:'Padaria Pão Dourado',meses:[],ultimos30:{visitas:5,contatos:c}}],
      banners:[{id:'b1',titulo:'Banner',empresa:{id:'padaria-pao-dourado',nome:'Padaria Pão Dourado'},impressoes:100,cliques:2}]}),t.agora.toISOString()]);
    const real=(await t.pagina('/indicadores',{s})).vm.dados;
    assert.deepEqual(faltando(exemplosDe('6.17 Indicadores')[0],real),[]);
    assert.ok(real.anunciantes.emRisco.length&&real.anunciantes.semMedicao.length&&real.anunciantes.banners.length&&real.audiencia.buscasMaisFeitas.length,'as listas chegaram cheias');
  } finally {await t.fim();}
});

test('os vms da importação têm todas as chaves dos exemplos (6.11 e 6.12)',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('importacao@exemplo.test',{nome:'Lucas'});
    const csv=await readFile(new URL('../fixtures/edirectory-exemplo.csv',import.meta.url));
    const imp=(await t.req('/api/importacoes?tipo=edirectory',{method:'POST',body:csv,headers:{'Content-Type':'text/csv'},s})).json;
    assert.deepEqual(faltando(exemplosDe('6.11 Importação')[0],(await t.pagina('/importacao',{s})).vm.dados),[]);
    const previa=(await t.pagina(`/importacao/${imp.id}`,{s})).vm.dados,exemplo=exemplosDe('6.12 Prévia da importação')[0];
    assert.deepEqual(faltando(exemplo,previa),[]);
    for(const acao of ['novo','erro'])assert.deepEqual(faltando(exemplo.linhas.find(l=>l.acao===acao),previa.linhas.find(l=>l.acao===acao)),[],acao);
  } finally {await t.fim();}
});

test('todo exemplo de JSON do contrato é válido, e a moldura traz o pode completo',()=>{
  const blocos=[...contrato.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>m[1]);
  assert.ok(blocos.length>=15,`${blocos.length} exemplos`);
  const exemplos=blocos.map((b,i)=>{try{return JSON.parse(b);}catch(e){assert.fail(`exemplo ${i+1}: ${e.message}\n${b.slice(0,120)}`);}});
  const moldura=exemplos.find(e=>e.tela&&e.pode);
  assert.deepEqual(Object.keys(moldura.pode),Object.keys(podeDe('admin')));
  assert.deepEqual(Object.keys(moldura).sort(),['avisos','csrf','dados','filtros','modulos','pode','tela','usuario']);
});
