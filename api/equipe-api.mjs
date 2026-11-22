import { rota } from './rotas.mjs';
import { listarEquipe, convidar, editarMembro, gerarLink, redefinir2fa } from './data/equipe.mjs';

// APIs da Equipe (contrato 7.1 e 7.6). A mudança de papel, o link de senha e a redefinição do 2FA pedem reautenticação.
const op=ctx=>({session:ctx.session,ip:ctx.ip,now:ctx.now,origin:ctx.origin});
export const rotasEquipe=[
  rota('GET','/api/equipe','equipe',ctx=>listarEquipe(ctx.db,ctx.now)),
  rota('POST','/api/equipe','equipe',async ctx=>{ctx.status(201);return convidar(ctx.db,{...op(ctx),p:await ctx.body()});}),
  rota('PATCH','/api/equipe/:id','equipe',async ctx=>editarMembro(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()}),{reautenticar:'papel'}),
  rota('POST','/api/equipe/:id/link-senha','equipe',async ctx=>gerarLink(ctx.db,{...op(ctx),id:ctx.params.id}),{reautenticar:true}),
  rota('POST','/api/equipe/:id/redefinir-2fa','equipe',async ctx=>redefinir2fa(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()}),{reautenticar:true})
];
