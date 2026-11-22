import { fail } from './lib/erros.mjs';
import { sameSecret, exigirConfirmacao } from './auth.mjs';
import { exigir } from './permissoes.mjs';
import { UUID } from './data/comum.mjs';

// Rotas da API (contrato 7.1). Cada uma declara o método, o caminho, a ação de 3.1 e a reautenticação; o contrato e a matriz
// de testes (tests/api/matriz.test.mjs) leem esta mesma lista. acao: 'publica' (sem sessão), 'sessao' (qualquer papel) ou
// uma ação de 3.1. reautenticar: true, ou o nome do campo do corpo (ou a lista de nomes) que, presente, pede a reautenticação.
// modulo: o módulo que liga e desliga por chave (v0.13.0: 'interessados', 14.1); desligado, a rota fica de fora (api/api.mjs).
export const rota=(metodo,caminho,acao,handler,{reautenticar=false,modulo=null}={})=>
  ({metodo,caminho,acao,reautenticar,modulo,handler,re:new RegExp(`^${caminho.replace(/:(\w+)/g,'(?<$1>[^/]+)')}$`)});

const ESCRITA=['POST','PATCH','DELETE'];
// Ordem das checagens (3.2): sessão (401), CSRF e permissão (403) e reautenticação (403); o registro (404) e a validação
// (422) ficam com o handler. Um :id que não é UUID responde 404 depois da permissão, sem revelar nada.
export function roteador(rotas) {
  return async ctx=>{
    for(const r of rotas) {
      const m=r.metodo===ctx.method&&r.re.exec(ctx.path);if(!m)continue;
      let session=null;
      if(r.acao!=='publica') {
        session=await ctx.session();
        if(!session)throw fail('Entre para continuar.',401);
        if(ESCRITA.includes(ctx.method)&&!sameSecret(ctx.req.headers['x-csrf-token'],session.csrf))throw fail('Verificação da sessão falhou. Recarregue a página.',403);
        if(r.acao!=='sessao')exigir(session,r.acao);
        const campos=typeof r.reautenticar==='string'?[r.reautenticar]:Array.isArray(r.reautenticar)?r.reautenticar:[];
        if(r.reautenticar===true)exigirConfirmacao(session,ctx.now);
        else if(campos.length){const b=await ctx.body();if(campos.some(c=>b[c]!==undefined))exigirConfirmacao(session,ctx.now);}
      }
      const params=m.groups||{};
      if(params.id!==undefined&&!UUID.test(params.id))throw fail('Não encontrado.',404);
      // Nas rotas com sessão, ctx.session já vem resolvida; nas públicas, continua a função que a lê, se a rota quiser.
      let status=200;
      const valor=await r.handler({...ctx,params,...(r.acao!=='publica'?{session}:{}),status:s=>{status=s;}});
      ctx.send(status,valor);
      // Escrita que deu certo: a fila do plano no site roda logo depois (contrato 9.3).
      if(ESCRITA.includes(ctx.method))ctx.fila?.agora();
      return true;
    }
    return false;
  };
}
