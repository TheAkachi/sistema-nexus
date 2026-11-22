import { escape } from '../lib/html.mjs';
import { entrar, definirSenha } from './entrar.mjs';
import { erro } from './erro.mjs';
import { resumo, renovacoes, pagamento } from './cobranca.mjs';
import { clientes, cliente, clienteForm, assinaturaForm } from './clientes.mjs';
import { equipe, configuracoes } from './admin.mjs';
import { auditoria } from './auditoria.mjs';
import { importacao, importacaoPrevia } from './importacao.mjs';
import { indicadores } from './indicadores.mjs';
import { interessados, interessado } from './interessados.mjs';

// Registro das views (docs/CONTRATO.md, seção 6.1): o campo view de cada rota escolhe uma destas funções puras vm → HTML,
// e o renderPage põe o resultado no documento, com o CSS, a fonte e os scripts da tela. Nenhum script inline nem atributo
// style (a CSP proíbe): o comportamento fica nos módulos de p2/, servidos em /assets/.
export const views={entrar,'definir-senha':definirSenha,erro,resumo,indicadores,renovacoes,pagamento,clientes,cliente,'cliente-form':clienteForm,'assinatura-form':assinaturaForm,equipe,configuracoes,auditoria,importacao,'importacao-previa':importacaoPrevia,interessados,interessado};

// Scripts de cada view, depois do gestao.js (a moldura: menu, avisos, sair, confirmação de identidade e o WhatsApp).
const SEM_MOLDURA={entrar:['entrar.js'],'definir-senha':['entrar.js']};
const SCRIPTS={indicadores:['indicadores.js'],interessados:['interessados.js'],interessado:['interessados.js'],pagamento:['pagamento.js'],cliente:['clientes.js','indicadores.js'],'cliente-form':['clientes.js'],'assinatura-form':['clientes.js'],equipe:['admin.js'],configuracoes:['admin.js'],importacao:['importacao.js'],'importacao-previa':['importacao.js']};
const FONTE='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

export function renderPage(route) {
  const view=views[route.view];
  const corpo=view?view(route.vm||{}):`<main><h1>${escape(route.title)}</h1>${route.vm?.mensagem?`<p>${escape(route.vm.mensagem)}</p>`:''}</main>`;
  const scripts=SEM_MOLDURA[route.view]||(route.vm?.usuario?['gestao.js',...(SCRIPTS[route.view]||[])]:[]);
  return `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="color-scheme" content="light"><title>${escape(route.title)}</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTE}"><link rel="stylesheet" href="/assets/gestao.css"><noscript><link rel="stylesheet" href="/assets/sem-script.css"></noscript>${scripts.map(s=>`<script type="module" src="/assets/${s}"></script>`).join('')}</head><body>${corpo}</body></html>`;
}
