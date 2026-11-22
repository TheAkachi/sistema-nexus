import { fail } from './lib/erros.mjs';
import { rota } from './rotas.mjs';
import { pode } from './permissoes.mjs';
import { idEmpresaValido } from './integracao.mjs';
import { contexto } from './data/assinaturas.mjs';
import { listarClientes, obterFicha, criarCliente, editarCliente, vincular, desvincular, empresasSite } from './data/clientes.mjs';
import { registrarRelatorio } from './data/relatorio.mjs';

// APIs de clientes e vínculos (contrato 7.1 e 7.5). O businessId do caminho é o id da empresa no site.
const op=ctx=>({session:ctx.session,ip:ctx.ip,now:ctx.now,site:ctx.site});
const cx=ctx=>contexto(ctx.db,{now:ctx.now,siteOrigin:ctx.siteOrigin});
const empresaDoCaminho=ctx=>{if(!idEmpresaValido(ctx.params.businessId))throw fail('Empresa não encontrada no guia.',404);return ctx.params.businessId;};
export const rotasClientes=[
  rota('GET','/api/clientes','ver',async ctx=>listarClientes(ctx.db,ctx.url,await cx(ctx))),
  rota('POST','/api/clientes','clientes',async ctx=>{ctx.status(201);return criarCliente(ctx.db,{...op(ctx),p:await ctx.body()},await cx(ctx));}),
  rota('GET','/api/clientes/:id','ver',async ctx=>obterFicha(ctx.db,ctx.params.id,await cx(ctx),{podeCobrar:pode(ctx.session.papel,'cobrar')})),
  rota('PATCH','/api/clientes/:id','clientes',async ctx=>editarCliente(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()},await cx(ctx))),
  rota('POST','/api/clientes/:id/empresas/:businessId','clientes',async ctx=>{
    const r=await vincular(ctx.db,{...op(ctx),id:ctx.params.id,businessId:empresaDoCaminho(ctx)},await cx(ctx));ctx.status(201);return r;
  }),
  rota('DELETE','/api/clientes/:id/empresas/:businessId','clientes',async ctx=>desvincular(ctx.db,{...op(ctx),id:ctx.params.id,businessId:empresaDoCaminho(ctx)},await cx(ctx))),
  // Relatório do mês (7.4, v0.11.0): registra o envio pelo WhatsApp do cliente, como a cobrança.
  rota('POST','/api/clientes/:id/empresas/:businessId/relatorios','cobrar',async ctx=>{
    const r=await registrarRelatorio(ctx.db,{...op(ctx),id:ctx.params.id,businessId:empresaDoCaminho(ctx),p:await ctx.body()},await cx(ctx));ctx.status(201);return r;
  }),
  rota('GET','/api/empresas-site','clientes',ctx=>empresasSite(ctx.db,ctx.url,{site:ctx.site,siteOrigin:ctx.siteOrigin}))
];
