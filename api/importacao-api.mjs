import { rota } from './rotas.mjs';
import { MAX_BYTES, listarImportacoes, obterImportacao, enviarImportacao, mudarLinha, confirmarImportacao, descartarImportacao } from './data/importacao.mjs';

// APIs da importação (contrato 7.1 e 8). O envio é o único corpo binário da API: o CSV, com até 2 MB.
const op=ctx=>({session:ctx.session,ip:ctx.ip,now:ctx.now,site:ctx.site});
export const rotasImportacao=[
  rota('GET','/api/importacoes','importar',ctx=>listarImportacoes(ctx.db,ctx.url,ctx.now)),
  rota('POST','/api/importacoes','importar',async ctx=>{
    const r=await enviarImportacao(ctx.db,{...op(ctx),tipo:ctx.url.searchParams.get('tipo'),contentType:ctx.req.headers['content-type'],
      ler:()=>ctx.raw(MAX_BYTES,'O arquivo pode ter até 2 MB.')});
    ctx.status(r.criada?201:200);return r.importacao;
  }),
  rota('GET','/api/importacoes/:id','importar',ctx=>obterImportacao(ctx.db,ctx.params.id,ctx.now)),
  rota('PATCH','/api/importacoes/:id/linhas/:linha','importar',async ctx=>
    mudarLinha(ctx.db,{...op(ctx),id:ctx.params.id,numero:/^\d{1,5}$/.test(ctx.params.linha)?Number(ctx.params.linha):null,p:await ctx.body()})),
  rota('POST','/api/importacoes/:id/confirmar','importar',async ctx=>confirmarImportacao(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()}),{reautenticar:true}),
  rota('DELETE','/api/importacoes/:id','importar',ctx=>descartarImportacao(ctx.db,{...op(ctx),id:ctx.params.id}))
];
