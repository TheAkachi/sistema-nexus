import { rota } from './rotas.mjs';
import { listarAuditoria } from './data/auditoria.mjs';

// Leitura da auditoria (contrato 6.15 e 7.1), só para o admin.
export const rotasAuditoria=[
  rota('GET','/api/auditoria','auditoria',ctx=>listarAuditoria(ctx.db,ctx.url))
];
