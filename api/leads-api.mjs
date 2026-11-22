import { rota } from './rotas.mjs';
import { rejectExtra } from './data/comum.mjs';
import { listarLeads, obterLead, editarLead, virarCliente, lerPedidos } from './data/leads.mjs';

// Interessados, os leads (contrato 14.4), com a ação clientes. Com a chave LEADS_LIGADOS desligada, o api/api.mjs deixa
// estas rotas de fora, e elas respondem 404 como uma que não existe (14.1).
const op=ctx=>({session:ctx.session,ip:ctx.ip,now:ctx.now});
const LEADS={modulo:'interessados'};
export const rotasLeads=[
  rota('GET','/api/leads','clientes',ctx=>listarLeads(ctx.db,ctx.url),LEADS),
  // "Buscar agora" (14.3): a mesma leitura da rotina diária, por quem pediu.
  rota('POST','/api/leads/buscar','clientes',async ctx=>{rejectExtra(await ctx.body(),[]);return lerPedidos(ctx.db,{site:ctx.site,now:ctx.now,actor:ctx.session.user_id,ip:ctx.ip});},LEADS),
  rota('GET','/api/leads/:id','clientes',ctx=>obterLead(ctx.db,ctx.params.id),LEADS),
  rota('PATCH','/api/leads/:id','clientes',async ctx=>editarLead(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()}),LEADS),
  rota('POST','/api/leads/:id/cliente','clientes',async ctx=>{const r=await virarCliente(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()});ctx.status(201);return r;},LEADS)
];
