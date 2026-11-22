import { rota } from './rotas.mjs';
import { contexto, listarAssinaturas, obterAssinatura, criarAssinatura, editarAssinatura, mudarStatus } from './data/assinaturas.mjs';
import { planosSite } from './data/planos.mjs';

// APIs de assinaturas e dos planos do site (contrato 7.1 e 7.5).
const op=ctx=>({session:ctx.session,ip:ctx.ip,now:ctx.now,site:ctx.site,siteOrigin:ctx.siteOrigin});
const cx=ctx=>contexto(ctx.db,{now:ctx.now,siteOrigin:ctx.siteOrigin});
const status=acao=>rota('POST',`/api/assinaturas/:id/${acao}`,'assinaturas',async ctx=>mudarStatus(ctx.db,{...op(ctx),id:ctx.params.id,acao,p:await ctx.body()}));
export const rotasAssinaturas=[
  rota('GET','/api/assinaturas','ver',async ctx=>listarAssinaturas(ctx.db,ctx.url,await cx(ctx))),
  rota('POST','/api/assinaturas','assinaturas',async ctx=>{const r=await criarAssinatura(ctx.db,{...op(ctx),p:await ctx.body()});ctx.status(201);return r;}),
  rota('GET','/api/assinaturas/:id','ver',async ctx=>obterAssinatura(ctx.db,ctx.params.id,await cx(ctx))),
  rota('PATCH','/api/assinaturas/:id','assinaturas',async ctx=>editarAssinatura(ctx.db,{...op(ctx),id:ctx.params.id,p:await ctx.body()})),
  status('suspender'),status('reativar'),status('cancelar'),
  rota('GET','/api/planos-site','assinaturas',ctx=>planosSite(ctx.db,{site:ctx.site,now:ctx.now}))
];
