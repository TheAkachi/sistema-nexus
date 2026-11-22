import { rota } from './rotas.mjs';
import { contexto } from './data/assinaturas.mjs';
import { indicadores } from './data/indicadores.mjs';

// Indicadores, bloco Dinheiro (contrato 6.17 e 7.1), para todo papel. O funil dos interessados (14.6) só com a chave ligada.
export const rotasIndicadores=[
  rota('GET','/api/indicadores','ver',async ctx=>indicadores(ctx.db,await contexto(ctx.db,{now:ctx.now,siteOrigin:ctx.siteOrigin}),{leads:ctx.leads}))
];
