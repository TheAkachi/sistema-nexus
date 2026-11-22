import { rota } from './rotas.mjs';
import { pode } from './permissoes.mjs';
import { contexto } from './data/assinaturas.mjs';
import { listarRenovacoes, resumo, registrarContato, registrarPagamento, estornar } from './data/cobranca.mjs';
import { obterConfiguracoes, editarConfiguracoes } from './data/configuracoes.mjs';

// APIs da cobrança e das configurações (contrato 7.1 e 7.3 a 7.5). O link do WhatsApp só vai para quem pode cobrar.
const op=ctx=>({session:ctx.session,ip:ctx.ip,now:ctx.now});
const cx=ctx=>contexto(ctx.db,{now:ctx.now,siteOrigin:ctx.siteOrigin});
const cobra=ctx=>({podeCobrar:pode(ctx.session.papel,'cobrar')});
export const rotasCobranca=[
  rota('GET','/api/resumo','ver',async ctx=>resumo(ctx.db,await cx(ctx),cobra(ctx))),
  rota('GET','/api/renovacoes','ver',async ctx=>listarRenovacoes(ctx.db,ctx.url,await cx(ctx),cobra(ctx))),
  rota('POST','/api/assinaturas/:id/contatos','cobrar',async ctx=>{const r=await registrarContato(ctx.db,{...op(ctx),id:ctx.params.id},await cx(ctx));ctx.status(201);return r;}),
  rota('POST','/api/assinaturas/:id/pagamentos','pagamentos',async ctx=>{const r=await registrarPagamento(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()},await cx(ctx));ctx.status(201);return r;}),
  rota('POST','/api/pagamentos/:id/estornar','pagamentos',async ctx=>estornar(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()},await cx(ctx)),{reautenticar:true}),
  rota('GET','/api/configuracoes','configuracoes',ctx=>obterConfiguracoes(ctx.db)),
  rota('PATCH','/api/configuracoes','configuracoes',async ctx=>editarConfiguracoes(ctx.db,{...op(ctx),p:await ctx.body()}),{reautenticar:['chavePix','whatsappAtendimento']})
];
