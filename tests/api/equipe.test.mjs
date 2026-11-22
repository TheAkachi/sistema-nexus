import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { COOKIE_LOGIN } from '../../api/login.mjs';
import { listarEquipe } from '../../api/data/equipe.mjs';
import { ambiente, valorCookie, SENHA } from './ambiente.mjs';

// Equipe (contrato 6.13 e 7.6).
let t,admin;
before(async()=>{t=await ambiente();admin=await t.sessao('lucas@exemplo.test',{nome:'Lucas'});});
after(async()=>{await t?.fim();});
const versao=async id=>(await t.db.query('SELECT version FROM users WHERE id=$1',[id])).rows[0].version;
const confirmar=s=>t.req('/api/auth/confirmar',{method:'POST',body:{senha:SENHA},s});

test('convidar: conta sem senha, link de convite de 72 horas e e-mail repetido recusado',async()=>{
  const r=await t.req('/api/equipe',{method:'POST',body:{email:' Julia@Exemplo.test ',nome:'Júlia',papel:'leitura'},s:admin});
  assert.equal(r.status,201);
  const {membro,link,expira}=r.json;
  assert.deepEqual({...membro,id:undefined},{id:undefined,email:'julia@exemplo.test',nome:'Júlia',papel:'leitura',desativado:false,doisFatores:false,ultimoAcesso:null,
    convitePendente:{expira,vencido:false},version:1});
  assert.equal(new Date(expira).getTime()-t.agora.getTime(),72*3600000);
  assert.match(link,/^http:\/\/127\.0\.0\.1:4184\/entrar\/definir-senha\?token=[a-f0-9]{64}$/);
  assert.equal((await t.pagina(new URL(link).pathname+new URL(link).search)).vm.convidadoPor,'Lucas');
  assert.equal((await t.req('/api/equipe',{method:'POST',body:{email:'julia@exemplo.test',nome:'Júlia',papel:'leitura'},s:admin})).status,409);
  for(const [body,campo] of [[{email:'x',nome:'A',papel:'leitura'},'email'],[{email:'a@b.test',nome:' ',papel:'leitura'},'nome'],[{email:'a@b.test',nome:'A',papel:'dono'},'papel'],[{email:'a@b.test',nome:'A',papel:'leitura',extra:1},'extra']])
    assert.equal((await t.req('/api/equipe',{method:'POST',body,s:admin})).json.campo,campo);
  assert.deepEqual((await t.auditoria('membro_convidado',membro.id))[0].after,{email:'julia@exemplo.test',nome:'Júlia',papel:'leitura'});
  t.julia=membro.id;
  t.minutos(73*60);
  assert.equal((await listarEquipe(t.db,t.agora)).itens.find(m=>m.id===t.julia).convitePendente.vencido,true);
});

test('lista: ativas primeiro, em ordem alfabética do nome',async()=>{
  const b=await t.conta('bruno@exemplo.test',{nome:'Bruno',papel:'comercial'});
  await t.conta('rafael@exemplo.test',{nome:'Álvaro',papel:'comercial',desativado:true});
  const nomes=(await t.req('/api/equipe',{s:await t.sessao('outro-admin@exemplo.test',{nome:'Zélia'})})).json.itens.map(m=>m.nome);
  assert.deepEqual(nomes,['Bruno','Júlia','Lucas','Zélia','Álvaro']);
  t.bruno=b;
});

test('editar: nome sem reautenticação, papel com ela, versão conferida e regras da própria conta',async()=>{
  const s=await t.sessao('editor-admin@exemplo.test',{nome:'Editora'});
  let r=await t.req(`/api/equipe/${t.bruno}`,{method:'PATCH',body:{nome:'Bruno Lima',version:await versao(t.bruno)},s});
  assert.equal(r.status,200);assert.equal(r.json.nome,'Bruno Lima');
  t.minutos(6);
  assert.equal((await t.req(`/api/equipe/${t.bruno}`,{method:'PATCH',body:{nome:'Bruno',version:await versao(t.bruno)},s})).status,200,'nome não pede reautenticação');
  r=await t.req(`/api/equipe/${t.bruno}`,{method:'PATCH',body:{papel:'financeiro',version:await versao(t.bruno)},s});
  assert.equal(r.status,403);assert.equal(r.json.reautenticar,true);
  await confirmar(s);
  assert.equal((await t.req(`/api/equipe/${t.bruno}`,{method:'PATCH',body:{papel:'financeiro',version:1},s})).status,409,'versão velha');
  r=await t.req(`/api/equipe/${t.bruno}`,{method:'PATCH',body:{papel:'financeiro',version:await versao(t.bruno)},s});
  assert.equal(r.json.papel,'financeiro');
  assert.deepEqual((await t.auditoria('membro_editado',t.bruno))[0].after,{papel:'financeiro'});
  assert.equal((await t.req(`/api/equipe/${s.id}`,{method:'PATCH',body:{papel:'leitura',version:await versao(s.id)},s})).json.campo,'papel','o próprio papel');
  assert.equal((await t.req(`/api/equipe/${s.id}`,{method:'PATCH',body:{desativado:true,version:await versao(s.id)},s})).json.campo,'desativado','se desativar');
  assert.equal((await t.req(`/api/equipe/${s.id}`,{method:'PATCH',body:{papel:'admin',nome:'Editora Admin',version:await versao(s.id)},s})).status,200,'o mesmo papel pode ir junto');
  assert.equal((await t.req(`/api/equipe/${s.id}`,{method:'PATCH',body:{desativado:'sim',version:await versao(s.id)},s})).json.campo,'desativado');
});

test('desativar encerra as sessões e o login pendente; reativar devolve a mesma conta',async()=>{
  // O relógio andou 73 horas no primeiro teste: a sessão do admin de antes venceu.
  admin=await t.sessao('lucas-2@exemplo.test',{nome:'Lucas'});
  const alvo=await t.sessao('saindo@exemplo.test',{papel:'comercial'});
  const p=await t.req('/api/auth/login',{method:'POST',body:{email:'saindo@exemplo.test',senha:SENHA}}),cookie=valorCookie(p.cookies,COOKIE_LOGIN);
  assert.equal((await t.req(`/api/equipe/${alvo.id}`,{method:'PATCH',body:{desativado:true,version:await versao(alvo.id)},s:admin})).json.desativado,true);
  assert.equal((await t.req('/api/me',{s:alvo})).status,401);
  assert.equal((await t.req('/api/auth/codigo',{method:'POST',body:{codigo:t.codigo(alvo.id)},cookie})).status,401);
  assert.equal((await t.req(`/api/equipe/${alvo.id}/link-senha`,{method:'POST',body:{},s:admin})).status,422,'desativada não recebe link');
  assert.equal((await t.req(`/api/equipe/${alvo.id}`,{method:'PATCH',body:{desativado:false,version:await versao(alvo.id)},s:admin})).json.doisFatores,true);
  assert.deepEqual((await t.req('/api/auth/login',{method:'POST',body:{email:'saindo@exemplo.test',senha:SENHA}})).json,{etapa:'codigo'});
});

test('link de senha: com reautenticação; convite para quem não tem senha, link de 1 hora para quem tem',async()=>{
  const s=await t.sessao('links-admin@exemplo.test');t.minutos(6);
  assert.equal((await t.req(`/api/equipe/${t.julia}/link-senha`,{method:'POST',body:{},s})).json.reautenticar,true);
  await confirmar(s);
  let r=await t.req(`/api/equipe/${t.julia}/link-senha`,{method:'POST',body:{},s});
  assert.equal(r.json.tipo,'convite');assert.equal(new Date(r.json.expira).getTime()-t.agora.getTime(),72*3600000);
  assert.equal((await listarEquipe(t.db,t.agora)).itens.find(m=>m.id===t.julia).convitePendente.vencido,false,'o convite novo vale');
  r=await t.req(`/api/equipe/${t.bruno}/link-senha`,{method:'POST',body:{},s});
  assert.equal(r.json.tipo,'senha');assert.equal(new Date(r.json.expira).getTime()-t.agora.getTime(),3600000);
  assert.equal((await t.auditoria('link_senha_gerado',t.bruno))[0].after.tipo,'senha');
  assert.equal((await t.req(`/api/equipe/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}/link-senha`,{method:'POST',body:{},s})).status,404);
});

test('redefinir o 2FA: com reautenticação, nunca o próprio; a pessoa configura de novo no próximo login',async()=>{
  const s=await t.sessao('dois-fatores@exemplo.test');const alvo=await t.sessao('perdeu-celular@exemplo.test',{papel:'financeiro'});
  t.minutos(6);
  assert.equal((await t.req(`/api/equipe/${alvo.id}/redefinir-2fa`,{method:'POST',body:{version:1},s})).json.reautenticar,true);
  await confirmar(s);
  assert.equal((await t.req(`/api/equipe/${s.id}/redefinir-2fa`,{method:'POST',body:{version:await versao(s.id)},s})).status,422);
  const r=await t.req(`/api/equipe/${alvo.id}/redefinir-2fa`,{method:'POST',body:{version:await versao(alvo.id)},s});
  assert.equal(r.json.doisFatores,false);
  assert.equal((await t.req('/api/me',{s:alvo})).status,401,'as sessões acabaram');
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM recovery_codes WHERE user_id=$1',[alvo.id])).rows[0].n,0);
  assert.deepEqual((await t.req('/api/auth/login',{method:'POST',body:{email:'perdeu-celular@exemplo.test',senha:SENHA}})).json,{etapa:'configurar'});
  assert.deepEqual((await t.auditoria('2fa_redefinido',alvo.id))[0].after,{doisFatores:false});
});

test('página /equipe: a moldura com a lista para o admin; 403 para os outros papéis',async()=>{
  admin=await t.sessao('lucas-3@exemplo.test',{nome:'Lucas'});
  const p=await t.pagina('/equipe',{s:admin});
  assert.equal(p.view,'equipe');assert.equal(p.title,'Equipe | Gestão Nexus');
  assert.deepEqual(Object.keys(p.vm),['usuario','csrf','pode','modulos','avisos','tela','filtros','dados']);
  assert.deepEqual(p.vm.usuario,{id:admin.id,nome:'Lucas',email:'lucas-3@exemplo.test',papel:'admin'});
  assert.equal(p.vm.csrf,admin.csrf);assert.deepEqual(p.vm.dados,await listarEquipe(t.db,t.agora));
  for(const papel of ['financeiro','comercial','leitura']) {
    const e=await t.pagina('/equipe',{s:await t.sessao(`pagina-${papel}@exemplo.test`,{papel})});
    assert.equal(e.status,403);assert.equal(e.view,'erro');assert.equal(e.title,'Sem permissão | Gestão Nexus');assert.equal(e.vm.dados.status,403);
  }
  const n=await t.pagina('/nao-existe',{s:admin});assert.equal(n.status,404);assert.equal(n.vm.tela,'erro');
});
