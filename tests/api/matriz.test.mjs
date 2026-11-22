import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ROTAS } from '../../api/api.mjs';
import { PAPEIS, pode } from '../../api/permissoes.mjs';
import { ambiente } from './ambiente.mjs';

// Matriz de permissões (briefing do back, "Testes obrigatórios"): cada rota implementada × cada papel, gerada da lista de
// rotas (api/api.mjs) e da tabela de papéis (3.1). Sem sessão, 401; sem a ação, 403 antes de procurar o registro; com a
// ação, nunca 401 nem 403. As sessões acabaram de nascer, então a reautenticação já está feita.
let t;const sessoes={};
// Com os interessados ligados (14.1), para as rotas deles entrarem na matriz.
before(async()=>{t=await ambiente({leads:true});for(const papel of PAPEIS)sessoes[papel]=await t.sessao(`matriz-${papel}@exemplo.test`,{papel});});
after(async()=>{await t?.fim();});
const caminho=r=>r.caminho.replace(/:\w+/g,()=>randomUUID());
const pedir=(r,opcoes)=>t.req(caminho(r),{method:r.metodo,...(r.metodo==='GET'?{}:{body:{}}),...opcoes});

test('cada rota com sessão × cada papel: 401, 403 ou passa, como manda a tabela',async()=>{
  const comSessao=ROTAS.filter(r=>r.acao!=='publica');
  assert.ok(comSessao.length>=6,'a lista de rotas chegou');
  for(const r of comSessao) {
    const nome=`${r.metodo} ${r.caminho}`;
    assert.equal((await pedir(r)).status,401,`${nome} sem sessão`);
    for(const papel of PAPEIS) {
      const res=await pedir(r,{s:sessoes[papel]});
      if(r.acao==='sessao'||pode(papel,r.acao))assert.ok(![401,403].includes(res.status),`${nome} × ${papel}: ${res.status} ${res.text}`);
      else assert.deepEqual([res.status,res.json],[403,{erro:'O seu papel não permite esta ação.'}],`${nome} × ${papel}`);
    }
  }
});

test('toda escrita com sessão exige o X-CSRF-Token',async()=>{
  for(const r of ROTAS.filter(r=>r.acao!=='publica'&&r.metodo!=='GET')) {
    const res=await pedir(r,{s:sessoes.admin,csrf:false});
    assert.deepEqual([res.status,res.json?.erro],[403,'Verificação da sessão falhou. Recarregue a página.'],`${r.metodo} ${r.caminho}`);
  }
});

test('id que não é UUID responde 404, depois da permissão',async()=>{
  for(const r of ROTAS.filter(r=>r.caminho.includes(':id'))) {
    const caminho=r.caminho.replace(':id','nao-e-uuid').replace(':businessId','empresa-x'),body=r.metodo==='GET'?undefined:{};
    assert.equal((await t.req(caminho,{method:r.metodo,body,s:sessoes.admin})).status,404,r.caminho);
    assert.equal((await t.req(caminho,{method:r.metodo,body,s:sessoes.leitura})).status,pode('leitura',r.acao)?404:403,r.caminho);
  }
});
