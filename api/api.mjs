import { roteador } from './rotas.mjs';
import { rotasAuth } from './auth-api.mjs';
import { rotasEquipe } from './equipe-api.mjs';
import { rotasClientes } from './clientes-api.mjs';
import { rotasAssinaturas } from './assinaturas-api.mjs';
import { rotasCobranca } from './cobranca-api.mjs';
import { rotasAuditoria } from './auditoria-api.mjs';
import { rotasIndicadores } from './indicadores-api.mjs';
import { rotasImportacao } from './importacao-api.mjs';
import { rotasLeads } from './leads-api.mjs';

// Todas as rotas da API (contrato 7.1), na ordem em que são conferidas. Módulo novo entra aqui.
export const ROTAS=[...rotasAuth,...rotasEquipe,...rotasClientes,...rotasAssinaturas,...rotasCobranca,...rotasIndicadores,...rotasImportacao,...rotasLeads,...rotasAuditoria];
// Com a chave dos leads desligada (14.1), as rotas dos interessados ficam de fora e respondem 404, como uma que não existe,
// antes da sessão e da permissão.
const comLeads=roteador(ROTAS),semLeads=roteador(ROTAS.filter(r=>r.modulo!=='interessados'));
export const api=ctx=>(ctx.leads?comLeads:semLeads)(ctx);
