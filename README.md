# Sistema Nexus · Gestão Comercial & Administrativa

> **Projeto demonstrativo de portfólio Full Stack** desenvolvido por [Pedro Siqueira](https://www.linkedin.com/in/pedro-akachi) (com apoio de IA durante o desenvolvimento). É o sistema administrativo e comercial que acompanha o guia gastronômico e cultural [Nexus](https://github.com/pedroxsst/nexus). Todos os clientes, contratos, valores, cobranças, métricas e contas de equipe são demonstrativos para avaliação da aplicação.

O **Sistema Nexus** é uma aplicação web Full Stack renderizada no servidor (SSR) em **Node.js 22+ nativo** e **PostgreSQL / PGlite**, construída para gerenciar a carteira comercial do guia Nexus: clientes, assinaturas, vencimentos, pagamentos, fila de renovações com régua de lembretes, interessados (leads), indicadores financeiros/audiência, importação CSV, equipe com RBAC e trilha de auditoria.

## Principais funcionalidades

- **Resumo & Fila de Renovações (`/`, `/renovacoes`):** visão executiva de receita, carteira ativa, atrasos e fila organizada por janelas (*Vencidas*, *Lembrar hoje*, *Até 7, 15 e 30 dias*) com modelos personalizáveis de mensagem para WhatsApp e relatório mensal.
- **Carteira de Clientes & Assinaturas (`/clientes`):** gestão de clientes, vínculo com espaços do guia Nexus, planos, ciclos (`mensal`, `trimestral`, `semestral`, `anual`), registro/estorno de pagamentos, suspensão, reativação e cancelamento.
- **Indicadores Financeiros & de Audiência (`/indicadores`):** gráficos SVG renderizados no servidor (receita, cobranças, visitas/contatos do guia, buscas mais feitas e anunciantes em risco ou sem medição).
- **Interessados (`/interessados`):** acompanhamento comercial de pedidos de afiliação vindos do guia.
- **Importação CSV com Prévia (`/importacao`):** upload de planilhas CSV (`UTF-8` ou `Windows-1252`), validação linha a linha, associação de empresas e confirmação idempotente.
- **Segurança & Arquitetura:** Node.js 22+ sem frameworks pesados, data loaders (`api/data/`) separados de views puras (`api/views/`), senhas com `scrypt`, 2FA obrigatório com TOTP (QR SVG + códigos de recuperação), sessões `HttpOnly`, proteção CSRF, reautenticação para ações sensíveis, RBAC (`admin`, `financeiro`, `comercial`, `leitura`), CSP estrita e auditoria append-only (`/auditoria`).

## Contas de demonstração (já semeadas no `db:seed`)

Após rodar `npm run db:seed`, acesse `/entrar` e utilize os botões de **Acesso demonstrativo** (1 clique, sem precisar configurar aplicativo 2FA no ambiente demo) ou entre com um dos perfis abaixo:

| Perfil | E-mail | Senha | Permissões |
| --- | --- | --- | --- |
| Admin | `admin@nexus.demo` | `NexusDemo2026!` | Acesso completo (carteira, cobrança, equipe, configurações, importação e auditoria) |
| Financeiro | `financeiro@nexus.demo` | `NexusDemo2026!` | Pagamentos, estornos, cobrança, carteira e indicadores |
| Comercial | `comercial@nexus.demo` | `NexusDemo2026!` | Clientes, assinaturas, renovações, interessados e cobrança |
| Leitura | `leitura@nexus.demo` | `NexusDemo2026!` | Consulta de resumo, indicadores, clientes e renovações |

> As contas `@nexus.demo` são protegidas contra desativação, troca de papel, redefinição de 2FA e alteração de senha no ambiente demonstrativo. Para testar o fluxo completo de convite + definição de senha + 2FA TOTP real, basta criar um novo membro na tela **Equipe** ou rodar `node api/cli.mjs admin seu@email.com`.

## Como executar localmente

Requisitos: **Node.js 22+** (usa PGlite embarcado automaticamente em `.runtime/postgres`, sem precisar instalar PostgreSQL localmente).

```bash
npm install
npm run db:seed
npm start
```

Abra **http://127.0.0.1:4184/entrar** no navegador.

Para rodar com Docker e PostgreSQL externo, configure `DATABASE_URL`, `PUBLIC_ORIGIN` e `TOTP_KEY` (veja `.env.example`, `Dockerfile` e `scripts/deploy/docker-compose.exemplo.yml`).

## Estrutura do projeto

| Pasta | Responsabilidade |
| --- | --- |
| `api/server.mjs` | Servidor HTTP nativo: rotas, CSP, cabeçalhos de segurança e arquivos estáticos (`/assets/`) |
| `api/data/` | Data loaders: consultam o banco e retornam `{title, status, view, vm}` |
| `api/views/` | Views puras: recebem o `vm` e devolvem HTML escapado |
| `api/lib/` | Utilitários: erros, escape HTML, IP real, auditoria, datas/situações, TOTP, cifra AES-GCM, QR SVG e validação de senhas |
| `api/` (demais) | Autenticação (`auth.mjs`, `login.mjs`), RBAC (`permissoes.mjs`), rotas JSON (`api.mjs`, `*-api.mjs`), integração com o guia (`integracao.mjs`), backup e CLI (`cli.mjs`) |
| `p2/` | CSS, JavaScript progressivo do navegador e identidade visual SVG do Nexus |
| `db/migrations/` | Migrações PostgreSQL aplicadas automaticamente na inicialização |
| `docs/` | Contrato técnico (`CONTRATO.md`), segurança (`SEGURANCA.md`), operação (`OPERACAO.md`) e validação (`VALIDACAO.md`) |
| `tests/` | Suítes automatizadas de API, contrato, segurança e views (`node:test`) |

## Testes e verificação

```bash
npm run check
```

Executa verificação de sintaxe (`scripts/syntax-check.mjs`), auditoria de dependências (`scripts/auditar.mjs`) e toda a suíte de testes automatizados (`tests/api/` e `tests/views/`).
