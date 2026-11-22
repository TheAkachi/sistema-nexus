import { fail } from './lib/erros.mjs';

// Papéis da equipe e ações (contrato 3.1), sempre conferidos no servidor; o menu escondido é só conforto.
// O teste tests/api/contrato.test.mjs exige que esta tabela seja a mesma do contrato.
export const PAPEIS=['admin','financeiro','comercial','leitura'];
export const ACOES={
  ver:['admin','financeiro','comercial','leitura'],
  clientes:['admin','comercial'],
  assinaturas:['admin','financeiro','comercial'],
  pagamentos:['admin','financeiro'],
  cobrar:['admin','financeiro','comercial'],
  importar:['admin'],
  equipe:['admin'],
  configuracoes:['admin'],
  auditoria:['admin']
};
export const pode=(papel,acao)=>Boolean(ACOES[acao]?.includes(papel));
// As ações já resolvidas para o papel, como vão no vm (contrato 6.1); "ver" fica de fora porque todo papel tem.
export const podeDe=papel=>Object.fromEntries(Object.keys(ACOES).filter(a=>a!=='ver').map(a=>[a,pode(papel,a)]));
// Sem sessão, 401; sem permissão, 403 antes de procurar o registro, para não revelar se ele existe (contrato 3.2).
export function exigir(session,acao) {
  if(!session)throw fail('Entre para continuar.',401);
  if(!pode(session.papel,acao))throw fail('O seu papel não permite esta ação.',403);
}
