import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { decifrar } from '../../api/lib/cifra.mjs';
import { codigoDe, passoDe } from '../../api/lib/totp.mjs';
import { COOKIE } from '../../api/auth.mjs';
import { COOKIE_LOGIN, SEM_SENHA, emitirLink } from '../../api/login.mjs';
import { proximo } from '../../api/data/paginas.mjs';
import { ambiente, valorCookie, SENHA } from './ambiente.mjs';

// Login em duas etapas, 2FA, reautenticação e links de uso único (contrato 4).
let t;
before(async()=>{t=await ambiente();});
after(async()=>{await t?.fim();});
const tokenDe=link=>new URL(link).searchParams.get('token');
const convidar=async(email,papel='financeiro')=>{
  const id=randomUUID();
  await t.db.query('INSERT INTO users(id,email,nome,papel,password_hash) VALUES($1,$2,$3,$4,$5)',[id,email,'Ana',papel,SEM_SENHA]);
  const {value}=await emitirLink(t.db,{userId:id,now:t.agora});
  return {id,token:value};
};
const login=(email,senha=SENHA)=>t.req('/api/auth/login',{method:'POST',body:{email,senha}});

test('primeiro acesso: convite, senha, configurar o 2FA com o QR e os códigos de recuperação uma vez só',async()=>{
  const {id,token}=await convidar('ana@exemplo.test');
  const pagina=await t.pagina(`/entrar/definir-senha?token=${token}`);
  assert.equal(pagina.view,'definir-senha');assert.deepEqual(pagina.vm,{token,valido:true,tipo:'convite',email:'ana@exemplo.test',nome:'Ana',convidadoPor:'Equipe Nexus'});
  assert.deepEqual((await t.pagina('/entrar/definir-senha?token=x')).vm,{token:'',valido:false,tipo:'',email:'',nome:'',convidadoPor:''});
  // Antes da senha, o login falha como uma conta inexistente.
  const semSenha=await login('ana@exemplo.test');assert.equal(semSenha.status,401);
  assert.deepEqual(semSenha.json,(await login('ninguem@exemplo.test')).json);
  for(const fraca of ['senha1234567','ana.ana.ana.ana','curta'])assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token,senha:fraca}})).json.campo,'senha',fraca);
  assert.deepEqual((await t.req('/api/auth/senha',{method:'POST',body:{token,senha:SENHA}})).json,{ok:true});
  assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token,senha:SENHA}})).json.campo,'token','o link vale uma vez');
  assert.equal((await t.auditoria('senha_definida',id))[0].after.via,'convite');

  const r=await login('ana@exemplo.test');
  assert.deepEqual(r.json,{etapa:'configurar'});
  assert.match(r.cookies[0],/^gestao_login=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=600$/);
  const cookie=valorCookie(r.cookies,COOKIE_LOGIN);
  const entrar=await t.pagina('/entrar?next=/equipe',{cookie});
  assert.equal(entrar.vm.etapa,'configurar');assert.equal(entrar.vm.next,'/equipe');assert.equal(entrar.vm.email,'ana@exemplo.test');
  const {configurar}=entrar.vm;assert.match(configurar.qrSvg,/^<svg /);assert.equal(configurar.emissor,'Gestão Nexus');assert.equal(configurar.conta,'ana@exemplo.test');
  const segredo=configurar.chave.replace(/ /g,'');
  assert.match(configurar.link,new RegExp(`secret=${segredo}&`));assert.match(configurar.chave,/^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/);
  assert.equal((await t.pagina('/entrar',{cookie})).vm.configurar.chave,configurar.chave,'recarregar mostra o mesmo segredo');
  assert.equal(decifrar(t.chave,(await t.db.query('SELECT new_totp_secret FROM login_challenges WHERE user_id=$1',[id])).rows[0].new_totp_secret,id),segredo);

  assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo:'000000'},cookie})).status,409,'ainda não há 2FA para conferir');
  assert.equal((await t.req('/api/auth/2fa',{method:'POST',body:{codigo:'000000'},cookie})).json.campo,'codigo');
  const ok=await t.req('/api/auth/2fa',{method:'POST',body:{codigo:codigoDe(segredo,passoDe(t.agora))},cookie});
  assert.equal(ok.status,200);assert.deepEqual(ok.json.usuario,{id,email:'ana@exemplo.test',nome:'Ana',papel:'financeiro'});
  assert.equal(ok.json.codigosRecuperacao.length,10);assert.match(ok.json.csrf,/^[a-f0-9]{64}$/);
  assert.match(ok.cookies.find(c=>c.startsWith(`${COOKIE}=`)),/^gestao_sessao=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800$/);
  assert.match(ok.cookies.find(c=>c.startsWith(`${COOKIE_LOGIN}=`)),/Max-Age=0/,'o login pendente sai');
  const s={cookie:valorCookie(ok.cookies,COOKIE),csrf:ok.json.csrf};
  assert.deepEqual((await t.req('/api/me',{s})).json,{usuario:{id,email:'ana@exemplo.test',nome:'Ana',papel:'financeiro'},csrf:s.csrf,
    pode:{clientes:false,assinaturas:true,pagamentos:true,cobrar:true,importar:false,equipe:false,configuracoes:false,auditoria:false}});
  const u=(await t.db.query('SELECT * FROM users WHERE id=$1',[id])).rows[0];
  assert.equal(u.totp_ativo,true);assert.equal(decifrar(t.chave,u.totp_secret,id),segredo);assert.equal(new Date(u.ultimo_acesso).getTime(),t.agora.getTime());
  const codigos=(await t.db.query('SELECT code_hash FROM recovery_codes WHERE user_id=$1',[id])).rows;
  assert.equal(codigos.length,10);assert.ok(codigos.every(c=>!ok.json.codigosRecuperacao.includes(c.code_hash)),'só o hash fica no banco');
  assert.equal((await t.auditoria('login',id))[0].after.via,'configuracao');assert.equal((await t.auditoria('2fa_configurado',id)).length,1);
  // Com sessão, o Entrar manda para o next.
  assert.deepEqual(await t.pagina('/entrar?next=/renovacoes',{s}),{redirect:'/renovacoes'});
  t.recuperacao=ok.json.codigosRecuperacao;t.ana={id,segredo};
});

test('login com o código: o mesmo código não entra duas vezes; o de recuperação vale uma vez',async()=>{
  const {id,segredo}=t.ana;
  let r=await login('ana@exemplo.test');assert.deepEqual(r.json,{etapa:'codigo'});
  let cookie=valorCookie(r.cookies,COOKIE_LOGIN);
  assert.equal((await t.pagina('/entrar',{cookie})).vm.etapa,'codigo');
  const usado=codigoDe(segredo,passoDe(t.agora));
  assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo:usado},cookie})).json.erro,'Código incorreto.','o código do 2FA já foi usado neste passo');
  t.minutos(1);
  r=await t.req('/api/auth/codigo',{method:'POST',body:{codigo:codigoDe(segredo,passoDe(t.agora))},cookie});
  assert.equal(r.status,200);assert.equal(r.json.recuperacao,undefined);assert.equal((await t.auditoria('login',id))[0].after.via,'totp');

  r=await login('ana@exemplo.test');cookie=valorCookie(r.cookies,COOKIE_LOGIN);
  const [codigo]=t.recuperacao;
  r=await t.req('/api/auth/codigo',{method:'POST',body:{codigo:codigo.toUpperCase().replace('-',' ')},cookie});
  assert.equal(r.status,200);assert.deepEqual(r.json.recuperacao,{restantes:9});
  r=await login('ana@exemplo.test');cookie=valorCookie(r.cookies,COOKIE_LOGIN);
  assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo},cookie})).status,422,'o código de recuperação já foi usado');
});

test('5 códigos errados matam o login pendente; ele também vence em 10 min',async()=>{
  let r=await login('ana@exemplo.test');let cookie=valorCookie(r.cookies,COOKIE_LOGIN);
  for(let i=0;i<4;i++)assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo:'000000'},cookie})).status,422);
  r=await t.req('/api/auth/codigo',{method:'POST',body:{codigo:'000000'},cookie});
  assert.equal(r.status,401);assert.match(r.cookies[0],/^gestao_login=; .*Max-Age=0/);
  assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo:t.codigo(t.ana.id,0,t.ana.segredo)},cookie})).status,401,'mesmo o código certo não entra mais');
  assert.equal((await t.auditoria('codigo_falha',t.ana.id)).length>=5,true);
  r=await login('ana@exemplo.test');cookie=valorCookie(r.cookies,COOKIE_LOGIN);
  t.minutos(11);
  assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo:t.codigo(t.ana.id,0,t.ana.segredo)},cookie})).status,401);
  assert.equal((await t.pagina('/entrar',{cookie})).vm.etapa,'senha');
});

test('senha: 5 falhas por conta bloqueiam até a senha certa; a resposta não revela a conta',async()=>{
  await t.conta('bloqueio@exemplo.test');
  const errada=await login('bloqueio@exemplo.test','senha-errada-999');assert.equal(errada.status,401);
  assert.deepEqual(errada.json,{erro:'E-mail ou senha incorretos.'});
  for(let i=0;i<4;i++)await login('bloqueio@exemplo.test','senha-errada-999');
  assert.equal((await login('bloqueio@exemplo.test')).status,429);
  assert.equal((await t.auditoria('login_bloqueado','bloqueio@exemplo.test')).length,1);
  t.minutos(16);
  assert.equal((await login('bloqueio@exemplo.test')).status,200,'a janela passou');
  await t.conta('fora@exemplo.test',{desativado:true});
  assert.equal((await login('fora@exemplo.test')).status,401,'desativada');
});

test('logout: com sessão exige o CSRF; sem sessão, cancela o login pendente',async()=>{
  const s=await t.sessao('logout@exemplo.test');
  assert.equal((await t.req('/api/auth/logout',{method:'POST',body:{},s,csrf:false})).status,403);
  const r=await t.req('/api/auth/logout',{method:'POST',body:{},s});
  assert.deepEqual(r.json,{ok:true});assert.ok(r.cookies.some(c=>/^gestao_sessao=; .*Max-Age=0/.test(c)));
  assert.equal((await t.req('/api/me',{s})).status,401);
  assert.equal((await t.auditoria('logout',s.id)).length,1);
  const p=await login('logout@exemplo.test'),cookie=valorCookie(p.cookies,COOKIE_LOGIN);
  assert.deepEqual((await t.req('/api/auth/logout',{method:'POST',body:{},cookie})).json,{ok:true});
  assert.equal((await t.pagina('/entrar',{cookie})).vm.etapa,'senha');
});

test('reautenticação: senha ou código; 5 erros por sessão em 15 min',async()=>{
  const s=await t.sessao('confirma@exemplo.test');t.minutos(6);
  assert.equal((await t.req('/api/auth/confirmar',{method:'POST',body:{},s})).json.campo,'senha');
  assert.equal((await t.req('/api/auth/confirmar',{method:'POST',body:{senha:'x',codigo:'1'},s})).status,422);
  assert.equal((await t.req('/api/auth/confirmar',{method:'POST',body:{senha:'errada-errada'},s})).json.erro,'Senha incorreta.');
  const ok=await t.req('/api/auth/confirmar',{method:'POST',body:{senha:SENHA},s});
  assert.deepEqual(ok.json,{ok:true,valeAte:new Date(t.agora.getTime()+5*60000).toISOString()});
  assert.equal((await t.req('/api/auth/confirmar',{method:'POST',body:{codigo:t.codigo(s.id)},s})).status,200);
  assert.equal((await t.req('/api/auth/confirmar',{method:'POST',body:{codigo:t.codigo(s.id)},s})).json.campo,'codigo','o mesmo código não vale de novo');
  for(let i=0;i<3;i++)await t.req('/api/auth/confirmar',{method:'POST',body:{senha:'errada-errada'},s});
  assert.equal((await t.req('/api/auth/confirmar',{method:'POST',body:{senha:SENHA},s})).status,429);
  assert.ok((await t.auditoria('reautenticacao',s.id)).length>=2);
});

test('links: um link novo invalida o anterior; definir a senha encerra as sessões e não dispensa o 2FA',async()=>{
  const s=await t.sessao('links@exemplo.test');
  const a=await emitirLink(t.db,{userId:s.id,now:t.agora}),b=await emitirLink(t.db,{userId:s.id,now:t.agora});
  assert.equal(a.kind,'senha','quem tem senha recebe o link de 1 hora');assert.equal(b.expires.getTime()-t.agora.getTime(),3600000);
  assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:a.value,senha:'Outra-Senha-Boa-42'}})).json.campo,'token');
  assert.deepEqual((await t.req('/api/auth/senha',{method:'POST',body:{token:b.value,senha:'Outra-Senha-Boa-42'}})).json,{ok:true});
  assert.equal((await t.req('/api/me',{s})).status,401,'as sessões acabaram');
  assert.deepEqual((await login('links@exemplo.test','Outra-Senha-Boa-42')).json,{etapa:'codigo'});
  const c=await emitirLink(t.db,{userId:s.id,now:t.agora});t.minutos(61);
  assert.equal((await t.req('/api/auth/senha',{method:'POST',body:{token:c.value,senha:'Mais-Uma-Senha-Boa-9'}})).json.campo,'token','venceu');
});

test('páginas: sem sessão vão para o Entrar com o next; sessão vencida leva motivo=expirou; next só interno',async()=>{
  assert.deepEqual(await t.pagina('/equipe?x=1'),{redirect:'/entrar?next=%2Fequipe%3Fx%3D1'});
  assert.deepEqual(await t.pagina('/',{cookie:`${COOKIE}=${'a'.repeat(64)}`}),{redirect:'/entrar?next=%2F&motivo=expirou'});
  const e=await t.pagina('/entrar?next=//outro.site&motivo=saiu');
  assert.deepEqual(e.vm,{etapa:'senha',next:'',motivo:'saiu',email:'',configurar:null});assert.equal(e.title,'Entrar | Gestão Nexus');
  assert.equal((await t.pagina('/entrar?motivo=<x>')).vm.motivo,'');
  for(const [v,esperado] of [['/renovacoes?janela=7','/renovacoes?janela=7'],['/','/'],['//x.test',''],['/\\x.test',''],['https://x.test',''],['/entrar',''],['/entrar?next=/','' ],['/a b',''],[null,'']])
    assert.equal(proximo(v),esperado,String(v));
});
