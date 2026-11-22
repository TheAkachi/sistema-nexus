# Contrato da gestão Nexus

Fonte da verdade entre os chats de back-end, front-end e segurança do sistema de gestão comercial do Nexus ([plano mestre](gestao/PLANO.md)). O back escreve aqui antes de implementar cada módulo. Toda mudança neste arquivo ganha uma entrada em [`docs/HANDOFF.md`](HANDOFF.md).

Versão do contrato: **Fase 3 · v0.14.1 · 30/10/2026** (os anunciantes sem medição ficam fora das listas e do risco, 6.17; *v0.14.0:* a régua de lembretes, sem envio automático, seção 15; *v0.13.0:* os interessados, os leads, construídos e desligados até a revisão de segurança, seção 14; *v0.12.0:* o endereço dos acessos ao painel do site em cada empresa da ficha, 6.7, para a lista de acessos do admin do site, seção 21 do contrato dele; *v0.11.0:* o relatório do mês para o anunciante: o envio pelo WhatsApp a partir da ficha, 6.7 e 7.4, com o modelo próprio nas Configurações, 6.14 e 7.3, e a página no painel do site, seção 20 do contrato dele; *v0.10.0:* o desempenho por anunciante na ficha do cliente, 6.7, e na mensagem de renovação, com a variável `{desempenho}`, 7.3; *v0.9.2:* as categorias da Audiência com o nome, 6.17; a Fase 1 implementada, com o formato do eDirectory provisório; da Fase 2, sem os leads: a "Minha assinatura" enviada ao site e as métricas do site nos Indicadores, 9.5; da v0.8.2 do colaborador: a concorrência do envio do plano, em 9.3, e o pacote de backup, em 10, ainda não instalado na VPS). As correções e o pacote de backup não comprovam publicação nem liberação para dados reais; ver [VALIDACAO.md](VALIDACAO.md), [SEGURANCA.md](SEGURANCA.md) e [OPERACAO.md](OPERACAO.md).

**O que é provisório.** Duas marcas aparecem ao longo do texto, e a seção 12 lista todos os casos:
- **[P1]** a **[P8]**: depende de uma resposta do Nexus (perguntas do plano, seção 5). Vale o padrão provisório do plano até a resposta.
- **[SEG]**: depende do `docs/SEGURANCA.md`, que o chat de segurança ainda vai escrever (decisão D7). Segue a Parte B do [briefing de segurança](gestao/BRIEFING-SEGURANCA.md) e o modelo do site (contrato do site, 12.2), e pode ser apertado na revisão.

## 1. Quem é dono de cada arquivo

| Front | Back | Compartilhado (só muda com aviso no HANDOFF) |
| --- | --- | --- |
| `api/views/**`: views puras, vm → HTML | `api/server.mjs`: rotas, CSP e cabeçalhos | `docs/CONTRATO.md` |
| `p2/**`: CSS, scripts do navegador e imagens, servidos em `/assets/` | `api/data/**`: loaders das páginas e regras do negócio | `docs/HANDOFF.md` |
| `tests/views/**` | `api/lib/**`, `api/auth.mjs`, `api/permissoes.mjs`, `api/*-api.mjs`, `api/backup.mjs`, `api/cli.mjs`, `api/db.mjs` | `CHANGELOG.md` (subseções Front e Back) |
| | `db/migrations/**`, `scripts/**`, `tests/api/**`, `package.json`, `pnpm-lock.yaml`, `Dockerfile`, `.github/**` | `README.md` |

- A segurança é dona do `docs/SEGURANCA.md` e dos branches `sec/<tema>`, e revisa todo PR antes da `main` (Parte C do briefing dela).
- O `api/views/index.mjs` de hoje é um esboço do back, só para o servidor subir. É do front: pode trocar tudo, mantendo `views` e `renderPage(route)`.
- O front copia os vms de exemplo da seção 6 para `tests/views/exemplos.mjs`. Quando as páginas existirem, o `tests/api/contrato.test.mjs` do back vai exigir que toda chave do exemplo exista no vm real, como no site: o back pode acrescentar campo antes de o front usar, mas não tira nem renomeia sem combinar no HANDOFF.

## 2. Convenções

### 2.1 Dados

- **Dinheiro** sempre em centavos inteiros: `valorCentavos: 9900` é R$ 99,00. A tela formata em pt-BR (`R$ 1.250,00`).
- **Dia** em `aaaa-mm-dd`, no fuso de São Paulo: início, vencimento, data do pagamento. "Hoje" é o dia corrente em São Paulo.
- **Instante** em ISO 8601 UTC (`2026-10-20T15:04:05.000Z`). A tela mostra no fuso de São Paulo.
- **Ids** são UUID em texto. As exceções vêm do site: o id da empresa (`businessId`, como `padaria-pao-dourado`) e o id do plano (`plano-premium`).
- **Chaves** em português e camelCase. Enumerações em minúsculas, com hífen (`a-vencer`, `mercado-pago`).
- **WhatsApp** só com dígitos, com o 55 e o DDD (`5521987654321`, 12 ou 13 dígitos). A API aceita com máscara e devolve só os dígitos.
- **E-mail** em minúsculas.
- **Sem CPF nem CNPJ** na Fase 1 **[P3]**.

### 2.2 Listas

`GET` com `?q=&status=&page=` e filtros próprios. Resposta `{itens, total, pagina, paginas}`, com 20 itens por página. A página além da última vem vazia, com `pagina` igual à pedida.

### 2.3 Escrita, versão e erros

- Toda escrita (POST, PATCH e DELETE) exige o `Origin` da gestão e o cabeçalho `X-CSRF-Token` com o `csrf` da sessão, que vem no vm de toda página e no `GET /api/me`. A comparação é em tempo constante. O login e a definição de senha exigem só o `Origin`, porque ainda não há sessão.
- O corpo é JSON (`Content-Type: application/json`), com até 16 KB. A exceção é o CSV da importação, enviado como corpo binário, com até 2 MB (seção 8).
- Campo desconhecido no corpo: `422 {erro:'Campo não permitido.', campo}`.
- Todo registro editável traz `version`, e toda alteração leva a `version` lida. Se outra pessoa salvou antes: `409 {erro:'Esta informação mudou desde que você abriu. Recarregue.'}`.
- A criação responde `201` com o registro.
- Erros `{erro, campo?}`:
  - 400: JSON ou caminho inválido;
  - 401: sem sessão;
  - 403: origem, CSRF, permissão ou reautenticação (esta vem com `reautenticar: true`, seção 4.6);
  - 404: registro ou rota inexistente;
  - 409: versão ou registro repetido;
  - 413: tamanho;
  - 415: tipo do corpo;
  - 422: validação, com `campo`;
  - 429: limite de tentativas;
  - 500: `{erro:'Falha interna. Tente de novo em instantes.', requestId}`, nunca a pilha;
  - 503: o site não respondeu e a rota depende dele (`{erro:'O guia não respondeu. Tente de novo em instantes.'}`, seção 9.4).

### 2.4 Páginas

- Toda página tem `Cache-Control: no-store` e `noindex`.
- Sem sessão, toda página (fora `/entrar` e `/entrar/definir-senha`) responde `303` para `/entrar?next=<caminho>`. Com a sessão expirada, `/entrar?next=<caminho>&motivo=expirou`.
- Sem permissão para a tela: `403` com a view `erro`. Registro que não existe: `404` com a view `erro`.
- O loader devolve `{title, status, view, vm}`, ou `{redirect}`. O `title` já vem completo e termina em `| Gestão Nexus`.

### 2.5 Cabeçalhos e CSP

Toda resposta leva:
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' <SITE_PUBLIC_ORIGIN>; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` e `X-Request-ID`;
- com origem https, `Strict-Transport-Security: max-age=31536000`.

Para o front, isso quer dizer:
- nenhum `<script>` inline, `onclick` ou atributo `style`;
- imagens só da própria gestão e da origem pública do site (as miniaturas das empresas);
- Plus Jakarta Sans pelo Google Fonts, como no site;
- links para o WhatsApp abrem em nova aba (`target="_blank" rel="noopener"`), e o `no-referrer` não deixa o endereço da gestão chegar ao WhatsApp.

`robots.txt` responde `Disallow: /`. **[SEG]**

### 2.6 Logs

Cada requisição registra só o `requestId`, o método, o status e a duração. Não entram caminho, query, corpo, e-mail, WhatsApp, IP nem segredo. O erro interno registra o `requestId` e o tipo, sem a pilha na resposta. **[SEG]**

## 3. Papéis e permissões

### 3.1 Tabela

Proposta do briefing do back, mantida **[SEG]**. O `api/permissoes.mjs` tem esta mesma tabela, e o `tests/api/contrato.test.mjs` confere as duas.

| Ação | admin | financeiro | comercial | leitura |
| --- | --- | --- | --- | --- |
| `ver`: resumo, indicadores, renovações, clientes, fichas, assinaturas, pagamentos e contatos | sim | sim | sim | sim |
| `clientes`: criar e editar clientes, vincular e desvincular empresas | sim | — | sim | — |
| `assinaturas`: criar, editar, suspender, reativar e cancelar | sim | sim | sim | — |
| `pagamentos`: registrar e estornar | sim | sim | — | — |
| `cobrar`: abrir a cobrança no WhatsApp e registrar o contato | sim | sim | sim | — |
| `importar`: enviar o CSV, resolver a prévia e confirmar | sim | — | — | — |
| `equipe`: convidar, mudar papel, desativar, gerar link de senha e redefinir o 2FA | sim | — | — | — |
| `configuracoes`: chave Pix, modelo da mensagem e tolerância | sim | — | — | — |
| `auditoria`: ler a auditoria | sim | — | — | — |

O vm de toda página traz `pode` com estas ações já resolvidas para o papel da pessoa, sem o `ver`, que todo papel tem.

### 3.2 Regras

- A permissão é conferida no servidor em toda rota. Esconder o botão é só conforto.
- A ordem das checagens é sessão (401), permissão da ação (403), registro (404), validação (422) e versão (409). Sem permissão, a resposta é 403 mesmo para um id que não existe: ela não revela se o registro existe.
- Ninguém muda o próprio papel nem se desativa. A gestão sempre fica com pelo menos um admin ativo: `422 {erro, campo:'papel'}` ou `campo:'desativado'`.
- Sem `cobrar`, o `linkWhatsapp` dos vms vem `null`.
- As ações sensíveis pedem reautenticação (4.6).

## 4. Login, sessão e 2FA **[SEG]**

### 4.1 Contas

- Só a equipe do Nexus tem conta. Não há cadastro aberto nem login social.
- O primeiro admin vem do CLI (`admin EMAIL`, seção 10), que imprime um link de uso único para definir a senha. Os demais entram por convite, na tela Equipe.
- Lucas é o admin, e os demais papéis são definidos por ele **[P4]**.

### 4.2 Senha e links de uso único

- De 12 a 128 caracteres, guardada com scrypt (N=32768, r=8, p=1), com os parâmetros no próprio hash, como no site.
- A senha nova é recusada com `422 {erro:'Esta senha é fácil de adivinhar. Escolha outra.', campo:'senha'}` quando, comparada em minúsculas e sem acento:
  - está na lista local de senhas vazadas comuns (`api/lib/senhas-comuns.txt`, sem consulta a serviço externo);
  - repete um caractere só (`aaaaaaaaaaaa`) ou é uma sequência simples, como `123456789012`, `abcdefghijkl` ou `qwertyuiopas`;
  - contém a parte do e-mail antes do `@` (com 4 caracteres ou mais), "nexus" ou "gestao".
- Não há "esqueci a senha" por e-mail na Fase 1. Quem esqueceu pede ao admin um link novo (Equipe → Gerar link de senha) ou o admin usa o CLI (`link-senha EMAIL`).
- O link é `/entrar/definir-senha?token=<64 hex>`.
  - O convite vale 72 horas, e o link de senha vale 1 hora. Quem ainda não definiu a senha recebe sempre um convite, também pelo "Gerar link de senha" e pelo CLI. Quem já tem senha recebe o link de senha.
  - Um link novo invalida os anteriores da mesma pessoa.
  - O link vale uma vez só. Usá-lo encerra todas as sessões da pessoa e não dispensa o 2FA no login seguinte.
- Como não há e-mail na Fase 1, quem gera o link recebe o link na resposta e manda pelo WhatsApp.

### 4.3 Sessão

- Cookie `gestao_sessao`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age` de 8 horas e `Secure` com origem https. O banco guarda só o hash do valor.
- A sessão expira depois de **30 minutos sem uso** e, de qualquer jeito, **8 horas depois do login**.
- Só existe sessão para conta ativa e com o 2FA ativo.
- Desativar a conta, redefinir o 2FA ou definir a senha pelo link encerra as sessões da pessoa. A mudança de papel vale na próxima requisição.

### 4.4 Login em duas etapas

1. `POST /api/auth/login {email, senha}`.
   - Certo: `200 {etapa:'codigo'}` (2FA já configurado) ou `200 {etapa:'configurar'}` (primeiro acesso), mais o cookie `gestao_login` (`HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=600` e `Secure` com https). Ainda não é uma sessão: ele só serve para a etapa seguinte, durante 10 minutos.
   - Errado, conta inexistente, desativada ou ainda sem senha: `401 {erro:'E-mail ou senha incorretos.'}`, sempre a mesma resposta e no mesmo tempo.
   - Depois da resposta certa, a tela recarrega `/entrar` com o mesmo `next`, e a página já vem na etapa seguinte.
   - Com sessão válida, `/entrar` manda (303) para o `next` ou para `/`.
2. Com o cookie `gestao_login`, a página `/entrar` mostra a etapa seguinte (6.2):
   - **Código.** `POST /api/auth/codigo {codigo}` aceita o código de 6 dígitos do autenticador ou um código de recuperação (`k7m2q-x9p4t`). Certo: `200 {csrf, usuario}`, mais o cookie da sessão; o `gestao_login` é apagado. Com código de recuperação, vem também `recuperacao: {restantes}`. Errado: `422 {erro:'Código incorreto.', campo:'codigo'}`.
   - **Configurar** (primeiro acesso ou depois de o admin redefinir o 2FA). A página traz o QR, o link `otpauth://` (para quem configura no próprio celular) e a chave para digitar. `POST /api/auth/2fa {codigo}` confere o primeiro código e devolve `200 {csrf, usuario, codigosRecuperacao:[10 códigos]}`, mais o cookie da sessão. Os códigos de recuperação só aparecem nessa resposta, uma vez ("Já guardei").
   - Depois de 5 códigos errados, o login pendente morre: `401 {erro:'Muitas tentativas. Entre de novo com a sua senha.'}`.
   - Sem login pendente, ou com ele vencido: `401 {erro:'O login expirou. Entre de novo com a sua senha.'}`. Chamar a etapa errada (`/api/auth/codigo` na etapa `configurar`, ou o contrário): `409`.
- `POST /api/auth/logout`: `200 {ok:true}`. Com sessão, exige o `X-CSRF-Token`, encerra a sessão e apaga o cookie. Sem sessão, cancela o login pendente ("Entrar com outra conta") com só o `Origin`. Os dois cookies saem apagados.
- `GET /api/me`: `{usuario:{id, email, nome, papel}, csrf, pode}`.

**TOTP.**
- RFC 6238: SHA-1, 6 dígitos e passos de 30 segundos, aceitando também o passo anterior e o seguinte (celular adiantado ou atrasado). O mesmo código não entra duas vezes.
- O segredo tem 20 bytes e fica cifrado no banco (AES-256-GCM, com a chave `TOTP_KEY` do `.env`).
- O QR é gerado no servidor, como SVG, sem script e sem serviço de terceiros. A dependência escolhida passa pela segurança.

**Códigos de recuperação.** São 10, cada um com 10 caracteres em base32, em dois grupos (`k7m2q-x9p4t`). A tela aceita com ou sem o hífen e em maiúsculas. Ficam guardados só como HMAC-SHA-256 com a `TOTP_KEY`, de modo que o banco sozinho não basta para testar códigos, e cada um vale uma vez. Acabaram os códigos: o admin redefine o 2FA (4.7).

### 4.5 Limites de tentativa

| O quê | Limite |
| --- | --- |
| Senha (`/api/auth/login`) | 20 por IP real e 5 falhas por conta, em 15 minutos |
| Código (`/api/auth/codigo` e `/api/auth/2fa`) | 5 erros por login pendente e 10 erros por conta, em 15 minutos |
| Definição de senha (`/api/auth/senha`) | 10 por IP real em 15 minutos |
| Reautenticação (`/api/auth/confirmar`) | 5 erros por sessão em 15 minutos |
| Envio de CSV (`POST /api/importacoes`) | 10 por pessoa por hora |

Acima do limite: `429 {erro:'Muitas tentativas. Tente de novo em alguns minutos.'}`.

### 4.6 Reautenticação

- **Ações sensíveis:** mudar o papel de alguém, gerar link de senha, redefinir o 2FA de alguém, confirmar uma importação, estornar um pagamento e mudar a chave Pix.
- Elas exigem a senha ou um código do autenticador confirmados nos **últimos 5 minutos**. O próprio login conta como confirmação.
- Sem confirmação recente, a resposta é `403 {erro:'Confirme a sua senha ou um código do autenticador para continuar.', reautenticar:true}`. A tela pede a senha ou o código, chama `POST /api/auth/confirmar {senha}` ou `{codigo}` (resposta `200 {ok:true, valeAte}`) e repete a ação.
- Senha ou código errado: `422 {erro, campo:'senha'}` ou `campo:'codigo'`.

### 4.7 Redefinir o 2FA

O admin redefine o 2FA de alguém na tela Equipe (com reautenticação), ou pelo CLI (`reset-2fa EMAIL`, que pede o e-mail de novo para confirmar). Isso apaga o segredo e os códigos de recuperação e encerra as sessões da pessoa. No login seguinte, ela configura o 2FA de novo. Entra na auditoria.

### 4.8 Auditoria

Entram, com o IP real, o antes e o depois:
- login, falha de login (com o e-mail tentado), código errado, logout, definição de senha, 2FA configurado e redefinido, reautenticação;
- convite, mudança de papel, desativação e link de senha gerado;
- toda criação e alteração de cliente, vínculo, assinatura e configuração;
- pagamento, estorno, cobrança registrada, importação confirmada e sincronização com o site.

A tabela só aceita INSERT (gatilho no banco). Só o admin lê.

Ações do login e da equipe (o `acao` de 6.15), para os rótulos do filtro:

| `acao` | Quando |
| --- | --- |
| `login`, `login_falha`, `login_bloqueado` | senha certa, errada e conta bloqueada pelo limite (com o e-mail tentado) |
| `codigo_falha`, `codigo_recuperacao_usado` | código do 2FA errado e código de recuperação usado |
| `2fa_configurado`, `2fa_redefinido` | 2FA configurado no primeiro acesso e redefinido pelo admin |
| `logout`, `senha_definida` | saída e senha definida pelo link (convite ou senha) |
| `plano_enviado`, `sincronizacao_conferida` | plano gravado no site e a rotina diária (9.3), por `null` |
| `importacao_enviada`, `importacao_confirmada`, `importacao_descartada` | a prévia, a gravação e o descarte de uma importação (8.5) |
| `metricas_lidas` | a leitura das métricas do site (9.5), por `null` |
| `reautenticacao`, `reautenticacao_falha` | confirmação de identidade certa e errada (4.6) |
| `membro_convidado`, `membro_editado`, `link_senha_gerado` | convite, mudança de nome, papel ou desativação, e link gerado pelo admin |
| `admin_cli`, `link_senha_cli`, `2fa_redefinido_cli` | as mesmas ações, feitas pelo CLI (`por: null`) |

## 5. Modelo de dados

As tabelas de infraestrutura (5.1) copiam as do site, com as colunas em inglês, e já estão na migração `001_fundacao.sql`. As do negócio (5.2) usam colunas em português e chegam com cada módulo. Toda escrita do negócio vai para a auditoria com o antes e o depois.

### 5.1 Infraestrutura (migração 001)

| Tabela | Campos | Observações |
| --- | --- | --- |
| `users` | `id, email, nome, papel, password_hash, totp_secret, totp_ativo, totp_ultimo_passo, desativado, criado_em, version` e `ultimo_acesso` (migração 002) | `papel`: `admin`, `financeiro`, `comercial` ou `leitura`. `totp_secret` cifrado. `totp_ultimo_passo` impede o mesmo código duas vezes. `ultimo_acesso` é o último login. A conta convidada que ainda não definiu a senha tem `password_hash = '!sem-senha'`. |
| `sessions` | `token_hash, id, user_id, csrf, created_at, last_seen_at, expires_at, confirmed_at, user_agent` | `confirmed_at` é a última reautenticação (4.6). |
| `login_challenges` | `token_hash, user_id, stage, new_totp_secret, failures, created_at, expires_at` | O login entre a senha e o código (`stage`: `codigo` ou `configurar`). |
| `recovery_codes` | `user_id, code_hash, created_at, used_at` | 10 por pessoa. |
| `access_tokens` | `token_hash, kind, user_id, created_by, created_at, expires_at, used_at` | `kind`: `convite` ou `senha`. |
| `rate_limits` | `key_hash, count, reset_at` | Só o hash da chave (IP, conta ou sessão). |
| `audit_log` | `id, actor_id, action, resource_type, resource_id, before, after, ip, created_at` | Só INSERT. |

### 5.2 Negócio (migrações dos módulos)

A migração `003_clientes_assinaturas.sql` (v0.3.0) cria `clients`, `client_businesses`, `subscriptions`, `settings` (já com a linha padrão: chave Pix vazia, o modelo de 6.14 e 10 dias de tolerância), `site_plans` e `plan_sync`. A `004_cobranca.sql` (v0.4.0) cria `payments` e `contacts`. `imports` chega com a importação. *v0.11.0:* a `007_relatorio_mensal.sql` acrescenta o envio do relatório do mês a `contacts` e o modelo da mensagem dele a `settings`. *v0.14.0:* a `009_regua_lembretes.sql` acrescenta a etapa do lembrete a `contacts` e os modelos das etapas a `settings` (seção 15).

| Tabela | Campos | Regras |
| --- | --- | --- |
| `clients` | `id, nome, responsavel, whatsapp, email, notas, status, source_key, criado_em, atualizado_em, version` | `nome` de 2 a 160 caracteres; `responsavel` até 120; `notas` até 2.000. `status`: `ativo` ou `encerrado`. `source_key` (único) liga o cliente à importação. |
| `client_businesses` | `client_id, business_id, nome_cache, slug_cache, bairro_cache, foto_cache, vinculado_em, vinculado_por` | `business_id` é o id da empresa no site e é único: a empresa tem um cliente só. Um cliente pode ter várias empresas (as unidades de uma rede). Os caches vêm da integração. |
| `subscriptions` | `id, client_id, business_id, plano_site, plano_nome, valor_centavos, ciclo, inicio, vence_em, dia_base, status, suspensa_em, cancelada_em, motivo, origem, source_key, notas, gerida_em, criado_em, atualizado_em, version` | `business_id` é uma das empresas do cliente, ou `null` enquanto a empresa do guia não foi achada. `plano_site` é o id do plano no site, com o nome em `plano_nome`. `valor_centavos` de 0 a 100.000.000. `ciclo`: `mensal`, `trimestral`, `semestral` ou `anual`. `status`: `ativa`, `suspensa` ou `cancelada`. `origem`: `edirectory`, `planilha` ou `manual`. `source_key` é único. `gerida_em` marca a primeira vez que a assinatura foi criada, editada, suspensa, reativada, cancelada, paga ou cobrada na gestão (a partir dela, a importação não mexe mais nessa assinatura). Uma empresa tem no máximo uma assinatura não cancelada. |
| `payments` | `id, subscription_id, valor_centavos, pago_em, forma, meses, vence_antes, vence_depois, referencia_de, referencia_ate, obs, registrado_por, registrado_em, estornado_em, estornado_por, motivo_estorno` | `forma`: `pix`, `dinheiro`, `cartao`, `boleto`, `transferencia` ou `mercado-pago` **[P1]**. `meses` é quanto a baixa avançou o vencimento. O estorno não apaga: preenche os campos `estornado_*`. |
| `contacts` | `id, subscription_id, canal, tipo, vence_em, client_id, business_id, mes, feito_em, feito_por` | `canal`: `whatsapp`. `tipo`: `cobranca` (já vencida), `lembrete` (a vencer) ou `relatorio` (v0.11.0, o envio do relatório do mês). Na cobrança e no lembrete, `subscription_id` e `vence_em` (o vencimento cobrado) vêm preenchidos, e `client_id`, `business_id` e `mes` vêm `null`. No relatório, é o contrário: o cliente, a empresa do guia e o mês do relatório (`aaaa-mm`), sem assinatura nem vencimento. O banco confere as duas formas. *v0.14.0:* `etapa` (`0`, `1`, `7`, `15`, `30` ou `null`) é a etapa da régua do lembrete (15.3); só o `lembrete` tem etapa. |
| `settings` | `id, chave_pix, whatsapp_atendimento, modelo_mensagem, modelo_relatorio, modelos_lembrete, tolerancia_dias, atualizado_em, atualizado_por, version` | Uma linha só (`id = 1`). Só dados do negócio: nada técnico vai para a tela (D3). `modelo_relatorio` (v0.11.0) é o modelo da mensagem do relatório do mês (6.14), com o padrão **[P1]**. `modelos_lembrete` (v0.14.0) guarda só os modelos próprios das etapas da régua que existem (15.4). |
| `site_plans` | `id, nome, pago, status, preco_centavos, atualizado_em` | Cópia dos planos do site, atualizada a cada leitura da integração. Serve à tela da assinatura quando o site não responde. |
| `imports` | `id, tipo, status, arquivo_sha256, arquivo_info, linhas, previa, resumo, criado_por, criado_em, expira_em, confirmado_em, confirmado_por, version` | Migração 005 (v0.7.0). `tipo`: `edirectory` ou `planilha`. `status`: `previa`, `confirmada`, `descartada` ou `expirada`. `arquivo_info` guarda o separador, a codificação e a ordem das datas. O arquivo não fica guardado: só o hash e a prévia (as linhas já lidas). A prévia é apagada ao confirmar, ao descartar ou depois de 24 horas, e o backup não a leva (8.6). |
| `plan_sync` | `id, business_id, plano, gerida, subscription_id, motivo, criado_em, tentativas, proxima_em, ultimo_erro, enviado_em` | Fila do envio do plano ao site (9.3). `plano` é `null` quando a empresa volta a não ter plano pago, e `gerida` é o valor do PUT de 9.1. `motivo`: `ativacao`, `edicao`, `suspensao`, `reativacao`, `cancelamento`, `desvinculo`, `pagamento`, `estorno`, `tolerancia`, `importacao`, `conferencia` ou `configuracao` (v0.9.0). |
| `site_metrics` | `id, de, ate, dados, lido_em, erro, tentado_em` | Migração 006 (v0.9.0). Uma linha só (`id = 1`): a cópia das métricas do site (9.5), com o período lido, a resposta juntada de todas as páginas e a hora da leitura. `erro` e `tentado_em` são da última tentativa que falhou. Só totais, sem dado pessoal; o backup não leva (o próximo dia lê de novo). |

### 5.3 Situação da assinatura

A situação é **calculada** a cada leitura, nunca guardada. Ela parte de `dias = vence_em − hoje` e da tolerância (`tolerancia_dias`, 10 dias por padrão **[P2]**).

| `status` | `dias` | `situacao` | Na tela |
| --- | --- | --- | --- |
| `ativa` | maior que 30 | `em-dia` | Ativa |
| `ativa` | de 0 a 30 | `a-vencer` | Vence em X dias (0: vence hoje) |
| `ativa` | de −tolerância a −1 | `vencida` | Vencida |
| `ativa` | menor que −tolerância | `inadimplente` | Inadimplente |
| `suspensa` | — | `suspensa` | Suspensa |
| `cancelada` | — | `cancelada` | Cancelada |

### 5.4 Vencimento e ciclo

- O ciclo em meses: mensal 1, trimestral 3, semestral 6 e anual 12.
- `dia_base` é o dia do mês do vencimento, gravado ao criar a assinatura e ao editar o vencimento.
- **Avançar** um vencimento soma os meses do ciclo e usa o `dia_base`. Se o mês não tem esse dia, vale o último dia do mês. Assim o dia não escorrega: 31/01 → 28/02 → 31/03; e 29/02/2028, num ciclo anual, → 28/02/2029.
- **Pagamento:** `vence_depois` é o `vence_em` avançado um ciclo. A referência vai de `vence_em` até o dia anterior a `vence_depois`. O vencimento avança a partir do vencimento anterior, não da data em que o cliente pagou.
- **Estorno:** recua o `vence_em` atual pelos `meses` daquele pagamento, com a mesma regra do `dia_base`.

## 6. Páginas e vms

### 6.1 Rotas e moldura

| Caminho | View | Permissão | `dados` |
| --- | --- | --- | --- |
| `/entrar` | `entrar` | sem sessão | sem moldura: `Entrar` (6.2) |
| `/entrar/definir-senha?token=` | `definir-senha` | sem sessão | sem moldura: `DefinirSenha` (6.3) |
| `/` | `resumo` | `ver` | o que `GET /api/resumo` devolve (6.4) |
| `/indicadores` | `indicadores` | `ver` | o que `GET /api/indicadores` devolve (6.17) |
| `/renovacoes?janela=&page=` | `renovacoes` | `ver` | o que `GET /api/renovacoes` devolve (6.5) |
| `/clientes?q=&status=&situacao=&page=` | `clientes` | `ver` | o que `GET /api/clientes` devolve (6.6) |
| `/clientes/novo` | `cliente-form` | `clientes` | `{cliente: null}` (6.8) |
| `/clientes/<id>` | `cliente` | `ver` | o que `GET /api/clientes/<id>` devolve (6.7) |
| `/clientes/<id>/editar` | `cliente-form` | `clientes` | `{cliente}` (6.8) |
| `/assinaturas/nova?cliente=<id>` | `assinatura-form` | `assinaturas` | `{assinatura: null, cliente, planos, ciclos}` (6.9) |
| `/assinaturas/<id>` | `assinatura-form` | `assinaturas` | `{assinatura, cliente, planos, ciclos}` (6.9) |
| `/assinaturas/<id>/pagamento` | `pagamento` | `pagamentos` | `{assinatura, cliente, sugestao, formas}` (6.10) |
| `/importacao` | `importacao` | `importar` | o que `GET /api/importacoes` devolve (6.11) |
| `/importacao/<id>` | `importacao-previa` | `importar` | o que `GET /api/importacoes/<id>` devolve (6.12) |
| `/equipe` | `equipe` | `equipe` | o que `GET /api/equipe` devolve (6.13) |
| `/configuracoes` | `configuracoes` | `configuracoes` | o que `GET /api/configuracoes` devolve (6.14) |
| `/auditoria?acao=&usuario=&recurso=&de=&ate=&q=&page=` | `auditoria` | `auditoria` | o que `GET /api/auditoria` devolve (6.15) |
| `/interessados?q=&situacao=&page=` | `interessados` | `clientes` | o que `GET /api/leads` devolve (14.5, v0.13.0; com a chave desligada, 404) |
| `/interessados/<id>` | `interessado` | `clientes` | o Lead (14.4; com a chave desligada, 404) |
| 403 e 404 | `erro` | — | `{status, mensagem}` (6.16) |

Os títulos (`<title>`) são `Resumo`, `Indicadores`, `Renovações`, `Clientes`, `Novo cliente`, `<cliente> · Clientes`, `Editar <cliente>`, `Nova assinatura`, `Assinatura · <empresa ou cliente>`, `Registrar pagamento · <empresa ou cliente>`, `Importação`, `Prévia da importação`, `Equipe`, `Configurações`, `Auditoria`, `Entrar`, `Definir senha`, `Sem permissão` e `Página não encontrada`, todos com `| Gestão Nexus` no fim.

**Moldura.** Toda página com sessão recebe este vm, e só `tela`, `filtros` e `dados` mudam de uma tela para outra:
- `usuario` é quem está na sessão.
- `csrf` vai no `X-CSRF-Token` de toda escrita.
- `pode` traz as ações de 3.1 para o papel (o menu mostra só o que a pessoa pode usar).
- `modulos` *(v0.13.0)* traz `{interessados}`: `true` só com a chave dos leads ligada e a ação `clientes` (14.5). O menu mostra "Interessados" só com ele.
- `avisos` traz o que precisa de atenção, com `tipo`:
  - `chave-pix`: a chave Pix não foi definida (para quem pode cobrar);
  - `sincronizacao`: um envio de plano ao site falha há mais de 1 hora (para o admin);
  - `site-fora`: a integração não respondeu (só na tela da assinatura). Com a cópia dos planos, o texto é "O guia não respondeu. A lista de planos é a última cópia guardada."; sem cópia nenhuma, é "O guia não respondeu, e não há cópia dos planos guardada. Tente de novo em instantes." (v0.8.1). Com o site no ar e sem plano ativo, não há aviso: a lista vem vazia.
  - Cada aviso é `{tipo, texto, href}`, e o texto já vem pronto. Os três valem desde a v0.3.0.
- `filtros` traz a query da página.

```json
{
  "usuario": {"id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10", "nome": "Lucas", "email": "lucas@exemplo.test", "papel": "admin"},
  "csrf": "4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c",
  "pode": {"clientes": true, "assinaturas": true, "pagamentos": true, "cobrar": true, "importar": true, "equipe": true, "configuracoes": true, "auditoria": true},
  "modulos": {"interessados": false},
  "avisos": [{"tipo": "chave-pix", "texto": "Defina a chave Pix em Configurações. Sem ela, a mensagem de cobrança sai sem a chave.", "href": "/configuracoes"}],
  "tela": "resumo",
  "filtros": {},
  "dados": {}
}
```

Os exemplos abaixo mostram só o `dados` (e o `filtros`, quando a tela tem). Os nomes, telefones, e-mails, planos e valores são fictícios. "Hoje" é 20/10/2026 e a tolerância é de 10 dias.

### 6.2 Entrar

`{etapa, next, motivo, email, configurar}`, sem moldura:
- `etapa` é `senha`, `codigo` ou `configurar`. Vem do cookie `gestao_login` (4.4).
- `next` é o caminho interno para depois do login (começa com `/` e não com `//`), ou `''`.
- `motivo` é `''`, `expirou`, `saiu` ou `senha-definida`.
- `email` é o da conta, a partir da etapa `codigo`.
- `configurar` só vem na etapa `configurar`: `{qrSvg, link, chave, emissor, conta}`. O `qrSvg` é o único HTML pronto de um vm. O servidor gera só `<svg>` e `<path>`, sem texto de usuário, e a view insere sem escape. O `link` é o `otpauth://`, para tocar no celular, e `chave` é o segredo em grupos de 4, para digitar.

```json
{"etapa": "senha", "next": "/renovacoes", "motivo": "expirou", "email": "", "configurar": null}
```

```json
{
  "etapa": "configurar",
  "next": "",
  "motivo": "",
  "email": "lucas@exemplo.test",
  "configurar": {
    "qrSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 37 37\" role=\"img\" aria-label=\"QR code do autenticador\"><path d=\"M0 0h7v1H0z\"/></svg>",
    "link": "otpauth://totp/Gest%C3%A3o%20Nexus:lucas%40exemplo.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Gest%C3%A3o%20Nexus&algorithm=SHA1&digits=6&period=30",
    "chave": "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP",
    "emissor": "Gestão Nexus",
    "conta": "lucas@exemplo.test"
  }
}
```

### 6.3 Definir senha

`{token, valido, tipo, email, nome, convidadoPor}`, sem moldura. `tipo` é `convite` ou `senha`. Com o token vencido, usado ou inválido, `valido: false` e os textos vazios. `convidadoPor` é o nome de quem convidou, ou `Equipe Nexus` quando o link veio do CLI. Depois de `POST /api/auth/senha`, a tela vai para `/entrar?motivo=senha-definida`.

```json
{"token": "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0", "valido": true, "tipo": "convite", "email": "ana@exemplo.test", "nome": "Ana", "convidadoPor": "Lucas"}
```

### 6.4 Resumo

`GET /api/resumo` devolve `{hoje, mrr, recebidoMes, aRenovar30:{qtd, valor}, inadimplentes:{qtd, valor}, ativas, cobrarHoje, cobrarHojeTotal}`. Todos os valores são em centavos:
- `mrr`: receita mensal recorrente. Soma, das assinaturas ativas que não estão inadimplentes, o valor dividido pelos meses do ciclo (o trimestral conta um terço por mês). Arredonda o total, não cada parcela.
- `recebidoMes`: soma dos pagamentos não estornados com `pagoEm` no mês corrente, em São Paulo.
- `aRenovar30`: assinaturas ativas com `dias` de 0 a 30, com a quantidade e a soma dos valores.
- `inadimplentes`: assinaturas inadimplentes, com a quantidade e a soma dos valores de um ciclo.
- `ativas`: assinaturas com `status` ativa, vencidas ou não.
- `cobrarHoje`: as vencidas e inadimplentes, e as que vencem em até 7 dias, no formato `Renovacao` (6.5). As vencidas vêm primeiro, da mais atrasada para a menos; depois as a vencer, da mais próxima para a mais distante. São até 50 itens, e `cobrarHojeTotal` diz quantas são ao todo.
- A página `/` é para todo papel, com `filtros: {}`.
- *v0.14.0:* `lembrarHoje` é quantas assinaturas a régua pede para lembrar hoje, cada item do `cobrarHoje` ganha a `etapa`, e a resposta ganha `etapas`, a lista de 15.1 com os nomes (15.5).

```json
{
  "hoje": "2026-10-20",
  "mrr": 186700,
  "recebidoMes": 53600,
  "aRenovar30": {"qtd": 4, "valor": 43400},
  "inadimplentes": {"qtd": 1, "valor": 9900},
  "ativas": 23,
  "cobrarHoje": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c04",
      "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63", "nome": "Auto Peças Iguaçu", "responsavel": "Rita Alves", "whatsapp": "5521900000003"},
      "empresa": {"id": "auto-pecas-iguacu", "nome": "Auto Peças Iguaçu", "miniatura": "https://nexus.demo/midia/5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e/320.webp", "url": "https://nexus.demo/comercio/auto-pecas-iguacu"},
      "plano": {"id": "plano-premium", "nome": "Premium"},
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-02",
      "dias": -18,
      "situacao": "inadimplente",
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000003?text=Ol%C3%A1%2C%20Rita%20Alves!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Auto%20Pe%C3%A7as%20Igua%C3%A7u%20venceu%20em%2002%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 2
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
      "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena", "responsavel": "Marina Souza", "whatsapp": "5521900000001"},
      "empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro", "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"},
      "plano": {"id": "plano-premium", "nome": "Premium"},
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-15",
      "dias": -5,
      "situacao": "vencida",
      "ultimoContato": {"em": "2026-10-16T13:20:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}, "tipo": "cobranca"},
      "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Centro%20venceu%20em%2015%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 5
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03",
      "cliente": {"id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52", "nome": "Padaria Pão Dourado", "responsavel": "Carlos Lima", "whatsapp": "5521900000002"},
      "empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado", "miniatura": "", "url": "https://nexus.demo/comercio/padaria-pao-dourado"},
      "plano": {"id": "plano-avancado", "nome": "Avançado"},
      "valorCentavos": 18000,
      "ciclo": "trimestral",
      "venceEm": "2026-10-24",
      "dias": 4,
      "situacao": "a-vencer",
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000002?text=Ol%C3%A1%2C%20Carlos%20Lima!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Avan%C3%A7ado%20da%20Padaria%20P%C3%A3o%20Dourado%20vence%20em%2024%2F10%2F2026%2C%20no%20valor%20de%20R%24%20180%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 1
    }
  ],
  "cobrarHojeTotal": 3
}
```

### 6.5 Renovações

`GET /api/renovacoes?janela=vencidas|7|15|30|lembrar&page=` devolve `{janela, contagem:{vencidas, ate7, ate15, ate30}, itens, total, pagina, paginas}`. O `filtros` da página é `{janela, page}`, e a janela padrão é `vencidas`, que também vale para uma janela desconhecida.
- `vencidas`: as ativas com `dias` negativo (`vencida` e `inadimplente`), da mais atrasada para a menos.
- `7`, `15` e `30`: as ativas com `dias` de 0 até 7, 15 ou 30, da mais próxima para a mais distante. As janelas se somam: a de 30 contém a de 7.
- No empate de vencimento, a ordem é alfabética pelo nome do cliente.
- Suspensas e canceladas não entram. `contagem` conta cada janela inteira, sem a paginação.
- *v0.14.0:* `lembrar` é a "Lembrar hoje" da régua (15.2). A `contagem` ganha `lembrar`, e a resposta ganha `etapas` (15.5).

**Renovacao** `{id, cliente:{id, nome, responsavel, whatsapp}, empresa, plano, valorCentavos, ciclo, venceEm, dias, situacao, ultimoContato, linkWhatsapp, version}`:
- `id` e `version` são da assinatura.
- `empresa` é `{id, nome, miniatura, url}` ou `null`. `miniatura` é a foto principal da empresa no site, com 320 px de largura (`<SITE_PUBLIC_ORIGIN>/midia/<id>/320.webp`), ou `''` quando a empresa não tem foto. `url` é a página da empresa no guia ("Ver no guia").
- `plano` é `{id, nome}` ou `null`.
- `ultimoContato` é `{em, por:{id, nome}, tipo}` ou `null`. É o contato mais recente **do vencimento atual**: só contam os contatos com `contacts.vence_em` igual ao `venceEm` da assinatura (v0.7.1). Depois de um pagamento, que avança o vencimento, ele volta a `null` até a próxima cobrança. O estorno recua o vencimento e traz de volta o contato daquele vencimento. A mudança de vencimento na edição também deixa os contatos antigos de fora. Os contatos antigos continuam na linha do tempo da ficha (6.7).
- `linkWhatsapp` já vem montado com a mensagem (7.3). É `null` quando o cliente não tem WhatsApp ou quando a pessoa não pode cobrar.
- `etapa` *(v0.14.0)* é a etapa da régua (15.1), ou `null`. Com ela, o `linkWhatsapp` usa o modelo da etapa (15.4), e o `ultimoContato` traz também a `etapa` do contato (15.3).

```json
{
  "janela": "vencidas",
  "contagem": {"vencidas": 2, "ate7": 1, "ate15": 1, "ate30": 4},
  "itens": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c04",
      "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63", "nome": "Auto Peças Iguaçu", "responsavel": "Rita Alves", "whatsapp": "5521900000003"},
      "empresa": {"id": "auto-pecas-iguacu", "nome": "Auto Peças Iguaçu", "miniatura": "https://nexus.demo/midia/5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e/320.webp", "url": "https://nexus.demo/comercio/auto-pecas-iguacu"},
      "plano": {"id": "plano-premium", "nome": "Premium"},
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-02",
      "dias": -18,
      "situacao": "inadimplente",
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000003?text=Ol%C3%A1%2C%20Rita%20Alves!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Auto%20Pe%C3%A7as%20Igua%C3%A7u%20venceu%20em%2002%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 2
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
      "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena", "responsavel": "Marina Souza", "whatsapp": "5521900000001"},
      "empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro", "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"},
      "plano": {"id": "plano-premium", "nome": "Premium"},
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-15",
      "dias": -5,
      "situacao": "vencida",
      "ultimoContato": {"em": "2026-10-16T13:20:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}, "tipo": "cobranca"},
      "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Centro%20venceu%20em%2015%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 5
    }
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1
}
```

### 6.6 Clientes

`GET /api/clientes?q=&status=&situacao=&page=` devolve uma lista (2.2) de **ClienteLinha** `{id, nome, responsavel, whatsapp, empresas, planoPrincipal, situacao, status}`, em ordem alfabética pt-BR. O `filtros` da página é `{q, status, situacao, page}`.
- `q` procura, sem acento nem caixa, no nome, no responsável, no e-mail e no nome das empresas vinculadas. Com 4 dígitos ou mais, procura também nos dígitos do WhatsApp (`9876` acha `5521998765432`).
- `status` é `ativo` ou `encerrado` (o cliente).
- `situacao` filtra pela situação do cliente: `em-dia`, `a-vencer`, `vencida`, `inadimplente`, `suspensa`, `cancelada` ou `sem-assinatura`.
- `empresas` é quantas empresas estão vinculadas.
- `planoPrincipal` é o `{id, nome}` da assinatura não cancelada de maior valor mensal (no empate, a de início mais antigo e, depois, a criada primeiro), ou `null`.
- `situacao` é a pior entre as assinaturas do cliente, nesta ordem: `inadimplente`, `vencida`, `a-vencer`, `em-dia`, `suspensa`, `cancelada`. Sem nenhuma assinatura, `null`.

```json
{
  "itens": [
    {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63", "nome": "Auto Peças Iguaçu", "responsavel": "Rita Alves", "whatsapp": "5521900000003", "empresas": 1, "planoPrincipal": {"id": "plano-premium", "nome": "Premium"}, "situacao": "inadimplente", "status": "ativo"},
    {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena", "responsavel": "Marina Souza", "whatsapp": "5521900000001", "empresas": 2, "planoPrincipal": {"id": "plano-premium", "nome": "Premium"}, "situacao": "vencida", "status": "ativo"},
    {"id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52", "nome": "Padaria Pão Dourado", "responsavel": "Carlos Lima", "whatsapp": "5521900000002", "empresas": 1, "planoPrincipal": {"id": "plano-avancado", "nome": "Avançado"}, "situacao": "a-vencer", "status": "ativo"},
    {"id": "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a74", "nome": "Studio Bella", "responsavel": "", "whatsapp": "", "empresas": 1, "planoPrincipal": {"id": "plano-avancado", "nome": "Avançado"}, "situacao": "em-dia", "status": "ativo"}
  ],
  "total": 4,
  "pagina": 1,
  "paginas": 1
}
```

### 6.7 Ficha do cliente

`GET /api/clientes/<id>` devolve a **Ficha** `{id, nome, responsavel, whatsapp, email, notas, status, criadoEm, version, empresas, assinaturas, desempenho, relatorio, linhaDoTempo, etapas}`:
- `empresas`: `[{id, nome, slug, bairro, miniatura, url, vinculadaEm, acessosUrl}]`, as empresas do guia vinculadas.
  - *v0.12.0:* `acessosUrl` é o endereço da lista de acessos ao painel do admin do site, já aberta nessa empresa: `<origem do site>/admin/acessos?empresa=<id>` (seção 21 do contrato do site). Sem a origem do site configurada, vem `''`. A mesma empresa, com o campo, volta no vínculo e no desvínculo (`{empresas}`).
  - O endereço abre no site e pede o login da equipe do site, com a ação `acessos` do admin dele. Na lista, a equipe convida o anunciante, reenvia ou cancela o convite e vê quem já tem acesso.
  - A gestão não convida, não vê convites e nunca recebe o link de um convite: a integração continua só lendo empresas e planos e gravando o plano (9).
- `assinaturas`: `Assinatura[]`, as não canceladas primeiro.
- `desempenho` *(v0.10.0)*: as visitas e os contatos de cada empresa vinculada no guia, mês a mês, da cópia das métricas do site (9.5). Ver **Desempenho**, abaixo.
- `relatorio` *(v0.11.0)*: o "Enviar o relatório de <mês>" de cada empresa vinculada. Ver **Relatório**, abaixo.
- `linhaDoTempo`: os últimos 100 acontecimentos, do mais novo para o mais antigo. Cada um é `{tipo, em, por:{id, nome}|null, assinatura:{id, empresa, plano}|null, empresa?, pagamento?, contato?}`, com `tipo` igual a `pagamento`, `estorno`, `contato` ou `relatorio` (v0.11.0). No `estorno`, `em` é a hora do estorno e `por` é quem estornou; o mesmo pagamento aparece também como `pagamento`, na hora em que foi registrado. O `relatorio` é um envio do relatório do mês (7.4): vem com `assinatura: null`, com `empresa: {id, nome}` e com o `contato`.
- `etapas` *(v0.14.0)*: a lista de 15.1, `[{dias, nome}]`, na ordem da régua, para a linha do tempo mostrar o nome da etapa do contato (15.3). É a mesma lista das Renovações e das Configurações, com o exemplo em 15.4, e não está no exemplo abaixo.

**Assinatura** `{id, cliente:{id, nome}, empresa, plano, valorCentavos, ciclo, inicio, venceEm, diaBase, dias, situacao, status, suspensaEm, canceladaEm, motivo, origem, notas, gerida, sincronizacao, criadaEm, atualizadaEm, version}`:
- `empresa` é `{id, nome, miniatura, url}` ou `null`, quando a importação não achou a empresa no guia. Nesse caso, a ficha pede para vincular a empresa.
- `sincronizacao` é o estado do plano no site: `{estado, em, erro}`, com `estado` igual a `ok`, `pendente`, `falhou` ou `sem-empresa`.
- `gerida` diz se a assinatura já foi mexida na gestão, porque aí a importação não a atualiza mais (8.4).

**Pagamento** `{id, assinaturaId, valorCentavos, pagoEm, forma, referencia:{de, ate}, venceAntes, venceDepois, obs, registradoPor:{id, nome}, registradoEm, estorno:{em, por:{id, nome}, motivo}|null}`.

**Contato** `{id, assinaturaId, empresaId, canal, tipo, venceEm, mes, em, por:{id, nome}}`. *v0.11.0:* `tipo` também pode ser `relatorio`. Na cobrança e no lembrete, `empresaId` e `mes` vêm `null`; no relatório, `assinaturaId` e `venceEm` vêm `null`, e `empresaId` e `mes` dizem de que empresa e de que mês foi o relatório.

**Relatório** *(v0.11.0)* `{mes, rotulo, empresas:[{id, url, linkWhatsapp, ultimoEnvio:{em, por:{id, nome}}|null}]}`: o relatório do mês de cada empresa vinculada, que é uma página no painel do site (seção 20 do contrato do site).
- `mes` é o mês anterior ao atual, no dia de São Paulo (`aaaa-mm`), o último mês fechado. `rotulo` é o mês por extenso ("setembro de 2026"), para o botão "Enviar o relatório de setembro de 2026".
- `empresas` traz uma linha por empresa vinculada, na mesma ordem de `empresas` da ficha:
  - `url` é o endereço do relatório no site, `<origem do site>/painel/<id da empresa>/relatorio/<mes>`, que continua pedindo login. Quem recebe precisa de uma conta no painel com papel na empresa (convite pelo painel ou pela equipe do site). Sem a origem do site configurada, vem `''`.
  - `linkWhatsapp` já vem com a mensagem do relatório (7.3) para o WhatsApp do cliente. É `null` quando a pessoa não pode cobrar (`cobrar`), quando o cliente não tem WhatsApp ou quando `url` é `''`.
  - `ultimoEnvio` é o último envio registrado do relatório desse mês para essa empresa (7.4), ou `null`.

**Desempenho** *(v0.10.0)* `{como, disponivel, lidaEm, medidoDesde, meses, empresas:[{id, nome, naCopia, atual, anterior, meses}]}`: o desempenho por anunciante (plano, Fase 2), da cópia das métricas do site (9.5). A ficha nunca chama o site.
- `meses` são os 6 meses (`aaaa-mm`) até o atual, do mais antigo ao atual, no dia de São Paulo.
- `empresas` traz uma linha por empresa vinculada, na mesma ordem de `empresas` da ficha, com o `nome` da empresa. O `meses` de cada uma tem os mesmos 6 meses, cada um como **Mês** `{mes, visitas, contatos:{whatsapp, telefone, rota, site}, contatosTotal, parcial}`. `atual` e `anterior` são o mês atual e o anterior, iguais aos dois últimos de `meses`.
- `contatosTotal` soma os quatro canais. `rota` junta o mapa e o Waze, como no site.
- **Mês sem medição vem com `null`** em `visitas`, `contatos` e `contatosTotal`, nunca com zero. Zero só aparece quando o site mediu e ninguém visitou ou entrou em contato. Vem `null`:
  - no mês que o site ainda não media (o que acaba antes de `medidoDesde`, 19.6 do site);
  - no mês fora do período da cópia, como o mês que começou depois da última leitura;
  - em todos os meses da empresa que não veio na cópia (`naCopia: false`), porque o site só lista as empresas publicadas;
  - em tudo, enquanto a gestão não leu as métricas nenhuma vez (`disponivel: false`, `lidaEm` e `medidoDesde` `null`, `naCopia: false`).
- `parcial` é `true` no mês que os números não cobrem inteiro. Sem cópia, só o atual é parcial. Com cópia, são parciais:
  - o mês que ainda não tinha acabado quando a cópia foi lida, ou seja, o mês da leitura e os seguintes, no dia de São Paulo. O mês atual sempre é parcial, e o anterior também é quando a cópia é de antes de ele acabar, por exemplo, se a leitura do dia 1º falhou;
  - o mês em que a medição começou depois do dia 1º (o mês de `medidoDesde`): os números dele são só de uma parte do mês.
- `lidaEm` é a hora em que a cópia foi lida, que a tela mostra ("Lido em…"). `medidoDesde` é o primeiro dia em que o site mediu as visitas e os contatos, ou `null`.
- `como` é a frase pronta que a tela mostra junto dos números.
- As visitas e os contatos são só dos visitantes que aceitaram a medição no site. Só totais: nenhum dado de quem visitou.

```json
{
  "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
  "nome": "Clínica Vida Plena",
  "responsavel": "Marina Souza",
  "whatsapp": "5521900000001",
  "email": "marina@exemplo.test",
  "notas": "Prefere ser chamada pelo WhatsApp depois das 14h.",
  "status": "ativo",
  "criadoEm": "2026-10-01T11:02:13.000Z",
  "version": 3,
  "empresas": [
    {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro", "slug": "clinica-vida-plena-centro", "bairro": "Centro", "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-centro", "vinculadaEm": "2026-10-01T11:02:13.000Z", "acessosUrl": "https://nexus.demo/admin/acessos?empresa=clinica-vida-plena-centro"},
    {"id": "clinica-vida-plena-austin", "nome": "Clínica Vida Plena · Austin", "slug": "clinica-vida-plena-austin", "bairro": "Austin", "miniatura": "https://nexus.demo/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-austin", "vinculadaEm": "2026-10-01T11:02:13.000Z", "acessosUrl": "https://nexus.demo/admin/acessos?empresa=clinica-vida-plena-austin"}
  ],
  "assinaturas": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
      "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena"},
      "empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro", "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"},
      "plano": {"id": "plano-premium", "nome": "Premium"},
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "inicio": "2025-03-15",
      "venceEm": "2026-10-15",
      "diaBase": 15,
      "dias": -5,
      "situacao": "vencida",
      "status": "ativa",
      "suspensaEm": null,
      "canceladaEm": null,
      "motivo": "",
      "origem": "edirectory",
      "notas": "",
      "gerida": true,
      "sincronizacao": {"estado": "ok", "em": "2026-09-14T17:45:02.000Z", "erro": ""},
      "criadaEm": "2026-10-01T11:02:13.000Z",
      "atualizadaEm": "2026-10-01T11:02:13.000Z",
      "version": 5
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
      "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena"},
      "empresa": {"id": "clinica-vida-plena-austin", "nome": "Clínica Vida Plena · Austin", "miniatura": "https://nexus.demo/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-austin"},
      "plano": {"id": "plano-avancado", "nome": "Avançado"},
      "valorCentavos": 6700,
      "ciclo": "mensal",
      "inicio": "2026-02-15",
      "venceEm": "2026-11-15",
      "diaBase": 15,
      "dias": 26,
      "situacao": "a-vencer",
      "status": "ativa",
      "suspensaEm": null,
      "canceladaEm": null,
      "motivo": "",
      "origem": "edirectory",
      "notas": "",
      "gerida": true,
      "sincronizacao": {"estado": "ok", "em": "2026-10-15T14:10:40.000Z", "erro": ""},
      "criadaEm": "2026-10-01T11:02:13.000Z",
      "atualizadaEm": "2026-10-15T14:10:40.000Z",
      "version": 4
    }
  ],
  "desempenho": {
    "como": "Visitas e contatos no guia dos visitantes que aceitaram a medição no site, da cópia das métricas lida uma vez por dia. Mês sem medição aparece em branco; o mês que os números não cobrem inteiro aparece como parcial.",
    "disponivel": true,
    "lidaEm": "2026-10-20T08:00:04.000Z",
    "medidoDesde": "2026-07-14",
    "meses": ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
    "empresas": [
      {
        "id": "clinica-vida-plena-centro",
        "nome": "Clínica Vida Plena · Centro",
        "naCopia": true,
        "atual": {"mes": "2026-10", "visitas": 205, "contatos": {"whatsapp": 27, "telefone": 3, "rota": 8, "site": 1}, "contatosTotal": 39, "parcial": true},
        "anterior": {"mes": "2026-09", "visitas": 312, "contatos": {"whatsapp": 41, "telefone": 6, "rota": 14, "site": 4}, "contatosTotal": 65, "parcial": false},
        "meses": [
          {"mes": "2026-05", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-06", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-07", "visitas": 180, "contatos": {"whatsapp": 22, "telefone": 5, "rota": 9, "site": 2}, "contatosTotal": 38, "parcial": true},
          {"mes": "2026-08", "visitas": 296, "contatos": {"whatsapp": 35, "telefone": 7, "rota": 12, "site": 3}, "contatosTotal": 57, "parcial": false},
          {"mes": "2026-09", "visitas": 312, "contatos": {"whatsapp": 41, "telefone": 6, "rota": 14, "site": 4}, "contatosTotal": 65, "parcial": false},
          {"mes": "2026-10", "visitas": 205, "contatos": {"whatsapp": 27, "telefone": 3, "rota": 8, "site": 1}, "contatosTotal": 39, "parcial": true}
        ]
      },
      {
        "id": "clinica-vida-plena-austin",
        "nome": "Clínica Vida Plena · Austin",
        "naCopia": false,
        "atual": {"mes": "2026-10", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": true},
        "anterior": {"mes": "2026-09", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
        "meses": [
          {"mes": "2026-05", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-06", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-07", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-08", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-09", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-10", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": true}
        ]
      }
    ]
  },
  "relatorio": {
    "mes": "2026-09",
    "rotulo": "setembro de 2026",
    "empresas": [
      {
        "id": "clinica-vida-plena-centro",
        "url": "https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09",
        "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20Seu%20an%C3%BAncio%20teve%20312%20visitas%20e%2041%20contatos%20pelo%20WhatsApp%20em%20setembro.%20O%20relat%C3%B3rio%20de%20setembro%20de%202026%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Centro%20est%C3%A1%20neste%20link%3A%20https%3A%2F%2Fnexus.demo%2Fpainel%2Fclinica-vida-plena-centro%2Frelatorio%2F2026-09",
        "ultimoEnvio": {"em": "2026-10-02T13:05:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}}
      },
      {
        "id": "clinica-vida-plena-austin",
        "url": "https://nexus.demo/painel/clinica-vida-plena-austin/relatorio/2026-09",
        "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20O%20relat%C3%B3rio%20de%20setembro%20de%202026%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Austin%20est%C3%A1%20neste%20link%3A%20https%3A%2F%2Fnexus.demo%2Fpainel%2Fclinica-vida-plena-austin%2Frelatorio%2F2026-09",
        "ultimoEnvio": null
      }
    ]
  },
  "linhaDoTempo": [
    {
      "tipo": "contato",
      "em": "2026-10-16T13:20:00.000Z",
      "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"},
      "assinatura": {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01", "empresa": "Clínica Vida Plena · Centro", "plano": "Premium"},
      "contato": {"id": "7b6a5f4e-3d2c-4b1a-9f8e-7d6c5b4a3f21", "assinaturaId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01", "empresaId": null, "canal": "whatsapp", "tipo": "cobranca", "venceEm": "2026-10-15", "mes": null, "em": "2026-10-16T13:20:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}}
    },
    {
      "tipo": "pagamento",
      "em": "2026-10-15T14:10:40.000Z",
      "por": {"id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21", "nome": "Ana"},
      "assinatura": {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", "empresa": "Clínica Vida Plena · Austin", "plano": "Avançado"},
      "pagamento": {"id": "5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d11", "assinaturaId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", "valorCentavos": 6700, "pagoEm": "2026-10-15", "forma": "pix", "referencia": {"de": "2026-10-15", "ate": "2026-11-14"}, "venceAntes": "2026-10-15", "venceDepois": "2026-11-15", "obs": "", "registradoPor": {"id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21", "nome": "Ana"}, "registradoEm": "2026-10-15T14:10:40.000Z", "estorno": null}
    },
    {
      "tipo": "relatorio",
      "em": "2026-10-02T13:05:00.000Z",
      "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"},
      "assinatura": null,
      "empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro"},
      "contato": {"id": "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e61", "assinaturaId": null, "empresaId": "clinica-vida-plena-centro", "canal": "whatsapp", "tipo": "relatorio", "venceEm": null, "mes": "2026-09", "em": "2026-10-02T13:05:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}}
    }
  ]
}
```

### 6.8 Cliente (criar e editar)

`dados` é `{cliente}`: `null` em `/clientes/novo`, ou a Ficha (6.7) em `/clientes/<id>/editar`. O formulário tem nome, responsável, WhatsApp, e-mail e notas. Vincular e desvincular empresas fica na ficha.

```json
{"cliente": null}
```

### 6.9 Assinatura (criar e editar)

`dados` é `{assinatura, cliente:{id, nome, empresas:[{id, nome}]}, planos, ciclos}`:
- `assinatura`: `null` em `/assinaturas/nova?cliente=<id>`, ou a `Assinatura` (6.7). Sem `?cliente=` de um cliente que existe, a página responde 404. Com o cliente encerrado, 422 com a view `erro`.
- `cliente.empresas`: as empresas vinculadas ao cliente, as únicas que a assinatura aceita.
- `planos`: os planos ativos do site, `[{id, nome, pago, precoCentavos}]`, em ordem alfabética. Escolher um plano sugere o `precoCentavos` como valor, que a pessoa pode mudar (`precoCentavos` pode vir `null`). Se o site não responde, vem a última cópia e o aviso `site-fora`. Sem nenhuma cópia, `[]`. Na edição, o plano atual da assinatura entra na lista mesmo que o site o tenha pausado.
- `ciclos`: `["mensal", "trimestral", "semestral", "anual"]`.

A tela também tem suspender, reativar e cancelar (7.5).

```json
{
  "assinatura": null,
  "cliente": {"id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52", "nome": "Padaria Pão Dourado", "empresas": [{"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado"}]},
  "planos": [
    {"id": "plano-avancado", "nome": "Avançado", "pago": true, "precoCentavos": 6700},
    {"id": "plano-premium", "nome": "Premium", "pago": true, "precoCentavos": 9900}
  ],
  "ciclos": ["mensal", "trimestral", "semestral", "anual"]
}
```

### 6.10 Registrar pagamento

`dados` é `{assinatura, cliente:{id, nome}, sugestao:{valorCentavos, pagoEm, forma, venceDepois}, formas}`:
- `sugestao` preenche o formulário com o valor da assinatura, a data de hoje e o Pix, e mostra o próximo vencimento (`venceDepois`, o vencimento atual avançado um ciclo).
- `formas`: `["pix", "dinheiro", "cartao", "boleto", "transferencia", "mercado-pago"]` **[P1]**.
- A assinatura precisa estar ativa. Suspensa ou cancelada, a página responde 422 com a view `erro`. O `<title>` usa o nome da empresa ou, sem ela, o do cliente.

Depois de salvar, a resposta traz a assinatura nova, e a tela mostra "Pago. Próximo vencimento: 15/11/2026". O estorno fica na ficha.

```json
{
  "assinatura": {
    "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
    "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena"},
    "empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro", "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"},
    "plano": {"id": "plano-premium", "nome": "Premium"},
    "valorCentavos": 9900,
    "ciclo": "mensal",
    "inicio": "2025-03-15",
    "venceEm": "2026-10-15",
    "diaBase": 15,
    "dias": -5,
    "situacao": "vencida",
    "status": "ativa",
    "suspensaEm": null,
    "canceladaEm": null,
    "motivo": "",
    "origem": "edirectory",
    "notas": "",
    "gerida": true,
    "sincronizacao": {"estado": "ok", "em": "2026-09-14T17:45:02.000Z", "erro": ""},
    "criadaEm": "2026-10-01T11:02:13.000Z",
    "atualizadaEm": "2026-10-01T11:02:13.000Z",
    "version": 5
  },
  "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena"},
  "sugestao": {"valorCentavos": 9900, "pagoEm": "2026-10-20", "forma": "pix", "venceDepois": "2026-11-15"},
  "formas": ["pix", "dinheiro", "cartao", "boleto", "transferencia", "mercado-pago"]
}
```

### 6.11 Importação

`GET /api/importacoes?page=` devolve uma lista (2.2) de `{id, tipo, status, criadaEm, criadaPor:{id, nome}, linhas, resumo, confirmadaEm}`, da mais nova para a mais antiga. `status` é `previa`, `confirmada`, `descartada` ou `expirada`. A tela tem o envio do CSV (8.1), com a escolha do tipo: exportação do eDirectory ou planilha de controle.

```json
{
  "itens": [
    {"id": "8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a31", "tipo": "edirectory", "status": "previa", "criadaEm": "2026-10-20T10:58:00.000Z", "criadaPor": {"id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10", "nome": "Lucas"}, "linhas": 46, "resumo": {"novos": 3, "atualizados": 2, "iguais": 31, "semEmpresa": 1, "ignorados": 8, "erros": 2}, "confirmadaEm": null},
    {"id": "8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a30", "tipo": "edirectory", "status": "confirmada", "criadaEm": "2026-10-01T10:40:00.000Z", "criadaPor": {"id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10", "nome": "Lucas"}, "linhas": 44, "resumo": {"novos": 42, "atualizados": 0, "iguais": 0, "semEmpresa": 4, "ignorados": 0, "erros": 2}, "confirmadaEm": "2026-10-01T11:02:13.000Z"}
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1
}
```

### 6.12 Prévia da importação

`GET /api/importacoes/<id>` devolve a **Importacao** `{id, tipo, status, arquivo:{sha256, linhas}, criadaEm, criadaPor, expiraEm, confirmadaEm, resumo, linhas, version}`:
- `arquivo` é `{sha256, linhas, separador, codificacao, datas}`: `linhas` conta as linhas de dados, sem o cabeçalho; `separador` é `;`, `,` ou `tab`; `codificacao` é `utf-8` ou `windows-1252`; `datas` é `dia/mês` ou `mês/dia` (8.2).
- `resumo`: `{novos, atualizados, iguais, semEmpresa, ignorados, erros}`. Somados, `novos`, `atualizados`, `iguais`, `ignorados` e `erros` dão o total de linhas. `semEmpresa` conta as linhas que vão entrar sem empresa do guia, que também estão em `novos` ou `atualizados`.
- `linhas`: todas as linhas do arquivo. Cada uma é `{linha, acao, cliente:{nome, email, whatsapp}, empresa:{id, nome}|null, sugestoes:[{id, nome}], plano:{id, nome}|null, valorCentavos, ciclo, venceEm, status, mudancas, aviso, erro}`.
  - `linha` é o número da linha no arquivo, contando o cabeçalho como 1.
  - `acao` é `novo`, `atualizar`, `igual`, `ignorar` ou `erro`.
  - `sugestoes`: até 3 empresas do guia parecidas, quando `empresa` é `null`.
  - `mudancas`: os campos que mudam, no `atualizar`.
  - `aviso`: o que a pessoa deve conferir, como "Plano Ouro não existe no site" ou "Sem valor no arquivo: usado o preço do plano".
  - `erro`: por que a linha não entra.
- Depois de confirmada, `linhas` vem `[]`, porque a prévia é apagada (o `resumo` fica).

```json
{
  "id": "8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a31",
  "tipo": "edirectory",
  "status": "previa",
  "arquivo": {"sha256": "5d41402abc4b2a76b9719d911017c592ae0b9b3d7f1e2c3a4b5c6d7e8f9a0b1c", "linhas": 46, "separador": ",", "codificacao": "utf-8", "datas": "dia/mês"},
  "criadaEm": "2026-10-20T10:58:00.000Z",
  "criadaPor": {"id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10", "nome": "Lucas"},
  "expiraEm": "2026-10-21T10:58:00.000Z",
  "confirmadaEm": null,
  "resumo": {"novos": 3, "atualizados": 2, "iguais": 31, "semEmpresa": 1, "ignorados": 8, "erros": 2},
  "linhas": [
    {"linha": 2, "acao": "ignorar", "cliente": {"nome": "Clínica Vida Plena", "email": "marina@exemplo.test", "whatsapp": "5521900000001"}, "empresa": {"id": "clinica-vida-plena-austin", "nome": "Clínica Vida Plena · Austin"}, "sugestoes": [], "plano": {"id": "plano-avancado", "nome": "Avançado"}, "valorCentavos": 6700, "ciclo": "mensal", "venceEm": "2026-10-15", "status": "ativa", "mudancas": [], "aviso": "Editada na gestão depois da importação.", "erro": ""},
    {"linha": 4, "acao": "atualizar", "cliente": {"nome": "Padaria Pão Dourado", "email": "carlos@exemplo.test", "whatsapp": "5521900000002"}, "empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado"}, "sugestoes": [], "plano": {"id": "plano-avancado", "nome": "Avançado"}, "valorCentavos": 18000, "ciclo": "trimestral", "venceEm": "2026-10-24", "status": "ativa", "mudancas": ["valorCentavos", "ciclo"], "aviso": "", "erro": ""},
    {"linha": 7, "acao": "novo", "cliente": {"nome": "Studio Bela Forma", "email": "contato@exemplo.test", "whatsapp": ""}, "empresa": null, "sugestoes": [{"id": "studio-bella", "nome": "Studio Bella"}], "plano": {"id": "plano-avancado", "nome": "Avançado"}, "valorCentavos": 6700, "ciclo": "mensal", "venceEm": "2026-11-03", "status": "ativa", "mudancas": [], "aviso": "Sem valor no arquivo: usado o preço do plano.", "erro": ""},
    {"linha": 12, "acao": "erro", "cliente": {"nome": "", "email": "", "whatsapp": ""}, "empresa": null, "sugestoes": [], "plano": null, "valorCentavos": null, "ciclo": null, "venceEm": null, "status": null, "mudancas": [], "aviso": "", "erro": "Falta o título do anúncio."}
  ],
  "version": 1
}
```

### 6.13 Equipe

`GET /api/equipe` devolve `{itens:[Membro]}`, sem paginação. **Membro** `{id, email, nome, papel, desativado, doisFatores, ultimoAcesso, convitePendente, version}`:
- `doisFatores` diz se o 2FA está configurado.
- `ultimoAcesso` é o instante do último login, ou `null`.
- `convitePendente` é `{expira, vencido}` enquanto a pessoa não definiu a senha, com a validade do último convite, ou `null`. Com o convite vencido, a tela oferece "Gerar link de senha", que manda um convite novo (4.2).
- A lista vem com as contas ativas primeiro e, dentro delas, em ordem alfabética do nome.

```json
{
  "itens": [
    {"id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21", "email": "ana@exemplo.test", "nome": "Ana", "papel": "financeiro", "desativado": false, "doisFatores": true, "ultimoAcesso": "2026-10-20T13:02:00.000Z", "convitePendente": null, "version": 2},
    {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "email": "bruno@exemplo.test", "nome": "Bruno", "papel": "comercial", "desativado": false, "doisFatores": true, "ultimoAcesso": "2026-10-19T19:40:00.000Z", "convitePendente": null, "version": 1},
    {"id": "e2b4c6d8-1a3f-4b5d-9c7e-0f1a2b3c4d58", "email": "julia@exemplo.test", "nome": "Júlia", "papel": "leitura", "desativado": false, "doisFatores": false, "ultimoAcesso": null, "convitePendente": {"expira": "2026-10-23T12:00:00.000Z", "vencido": false}, "version": 1},
    {"id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10", "email": "lucas@exemplo.test", "nome": "Lucas", "papel": "admin", "desativado": false, "doisFatores": true, "ultimoAcesso": "2026-10-20T14:58:00.000Z", "convitePendente": null, "version": 1},
    {"id": "f3c5d7e9-2b4a-4c6e-8d0f-1a2b3c4d5e69", "email": "rafael@exemplo.test", "nome": "Rafael", "papel": "comercial", "desativado": true, "doisFatores": true, "ultimoAcesso": "2026-09-30T18:12:00.000Z", "convitePendente": null, "version": 3}
  ]
}
```

### 6.14 Configurações

`GET /api/configuracoes` devolve `{chavePix, whatsappAtendimento, modeloMensagem, toleranciaDias, variaveis, modeloRelatorio, variaveisRelatorio, atualizadoEm, atualizadoPor, version}`. *v0.9.0:* `whatsappAtendimento` é o WhatsApp do atendimento do Nexus que o afiliado vê na "Minha assinatura" (9.5), no formato de 7.2, ou `''`. `variaveis` lista o que o modelo aceita, com um valor de exemplo para a pré-visualização ao vivo, que o navegador monta sem chamar o servidor (7.3).

*v0.10.0:* `variaveis` ganha `desempenho`, a frase do desempenho do mês anterior no guia (7.3). O modelo padrão não muda: o Nexus põe a variável no texto dela, se quiser.

*v0.11.0:* o GET ganha `modeloRelatorio` e `variaveisRelatorio`: o modelo da mensagem do relatório do mês (7.3 e 7.4) e as variáveis que ele aceita, com o exemplo da pré-visualização, como `variaveis`. O PATCH aceita `modeloRelatorio`, sem reautenticação: de 20 a 1.000 caracteres, só com as variáveis de `variaveisRelatorio` e com `{link}` pelo menos uma vez (`422 {erro, campo:'modeloRelatorio'}`). O padrão da instalação é o modelo do exemplo abaixo, **[P1]**: o Nexus revisa e troca pelo texto dela.

*v0.14.0:* o GET ganha `etapas` e `modelosLembrete`, e o PATCH aceita `modelosLembrete`: os modelos opcionais das etapas da régua, com o exemplo em 15.4. Sem modelo próprio, a etapa usa o `modeloMensagem`.

O padrão da instalação é a chave Pix vazia, a tolerância de 10 dias **[P2]** e o modelo abaixo **[P1]**, que o Nexus troca pelo texto dela. `atualizadoPor` é `{id, nome}`, ou `null` enquanto ninguém mudou nada.

`PATCH /api/configuracoes` recebe só os campos que mudaram, porque a presença de `chavePix` ou de `whatsappAtendimento` já pede a reautenticação (4.6): os dois chegam ao afiliado como "como pagar". Mudar um deles põe na fila do site todas as empresas com assinatura não cancelada (9.5). Responde com as Configurações novas. Mudar a tolerância muda na hora a situação de todas as assinaturas, e o plano no site acompanha na rotina diária (9.3).

```json
{
  "chavePix": "pix@exemplo.test",
  "whatsappAtendimento": "5521900000000",
  "modeloMensagem": "Olá, {responsavel}! Aqui é do Nexus. A assinatura do plano {plano} da {empresa} {prazo}, no valor de {valor}. Para renovar, faça o Pix para a chave {chave_pix} e mande o comprovante por aqui. Obrigado!",
  "toleranciaDias": 10,
  "variaveis": [
    {"chave": "responsavel", "descricao": "Responsável pelo cliente (ou o nome do cliente, se não houver)", "exemplo": "Marina Souza"},
    {"chave": "cliente", "descricao": "Nome do cliente", "exemplo": "Clínica Vida Plena"},
    {"chave": "empresa", "descricao": "Empresa do guia (ou o nome do cliente, se não houver)", "exemplo": "Clínica Vida Plena · Centro"},
    {"chave": "plano", "descricao": "Nome do plano", "exemplo": "Premium"},
    {"chave": "valor", "descricao": "Valor de um ciclo", "exemplo": "R$ 99,00"},
    {"chave": "vencimento", "descricao": "Data do vencimento", "exemplo": "15/10/2026"},
    {"chave": "prazo", "descricao": "\"vence em…\", \"vence hoje\" ou \"venceu em…\"", "exemplo": "venceu em 15/10/2026"},
    {"chave": "chave_pix", "descricao": "Chave Pix das Configurações", "exemplo": "pix@exemplo.test"},
    {"chave": "desempenho", "descricao": "Visitas e contatos pelo WhatsApp do mês anterior no guia (fica vazia sem medição ou sem visitas)", "exemplo": "Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro."}
  ],
  "modeloRelatorio": "Olá, {responsavel}! Aqui é do Nexus. {desempenho} O relatório de {mes} da {empresa} está neste link: {link}",
  "variaveisRelatorio": [
    {"chave": "responsavel", "descricao": "Responsável pelo cliente (ou o nome do cliente, se não houver)", "exemplo": "Marina Souza"},
    {"chave": "cliente", "descricao": "Nome do cliente", "exemplo": "Clínica Vida Plena"},
    {"chave": "empresa", "descricao": "Empresa do guia do relatório", "exemplo": "Clínica Vida Plena · Centro"},
    {"chave": "mes", "descricao": "Mês do relatório", "exemplo": "setembro de 2026"},
    {"chave": "desempenho", "descricao": "Visitas e contatos pelo WhatsApp no mês do relatório (fica vazia sem medição ou sem visitas)", "exemplo": "Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro."},
    {"chave": "link", "descricao": "Endereço do relatório no painel do site (pede login)", "exemplo": "https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09"}
  ],
  "atualizadoEm": "2026-10-20T11:00:00.000Z",
  "atualizadoPor": {"id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10", "nome": "Lucas"},
  "version": 2
}
```

### 6.15 Auditoria

`GET /api/auditoria?acao=&usuario=&recurso=&de=&ate=&q=&page=` devolve uma lista (2.2) de `{id, em, acao, recurso:{tipo, id}, por:{id, nome, email}|null, antes, depois, ip}`, da mais nova para a mais antiga, e mais `opcoes:{acoes:[…], pessoas:[{id, nome}]}` para os filtros. O `filtros` da página é `{acao, usuario, recurso, de, ate, q, page}`.
- `acao` é uma das ações de 4.8, 7.5 e 9.3, comparada por inteiro. `opcoes.acoes` traz só as que já aparecem na auditoria, em ordem alfabética.
- `usuario` é o id de uma pessoa da equipe, ou `sistema` para o que não tem pessoa: o CLI, a rotina diária e o envio da fila. `opcoes.pessoas` traz toda a equipe, inclusive as contas desativadas, em ordem alfabética.
- `recurso` é o id exato de um registro (uma assinatura, um cliente, uma empresa, uma conta), para ver o histórico dele. A ficha do cliente pode levar para `/auditoria?recurso=<id>`.
- `de` e `ate` são dias (`aaaa-mm-dd`) em São Paulo e entram inteiros (de 00:00 de `de` até 23:59 de `ate`). Fora do formato: `422 {erro, campo:de}` ou `campo:ate`.
- `q` procura, sem caixa, no id do recurso e no nome da ação.
- `recurso.tipo` é `usuario`, `cliente`, `assinatura`, `empresa` ou `configuracoes`.
- `por` é `null` nas ações sem pessoa. A falha de login traz o e-mail tentado em `recurso.id` e em `depois`. Por isso a auditoria é só do admin (3.1).

```json
{
  "itens": [
    {"id": "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f51", "em": "2026-10-15T14:10:40.000Z", "acao": "pagamento_registrado", "recurso": {"tipo": "assinatura", "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02"}, "por": {"id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21", "nome": "Ana", "email": "ana@exemplo.test"}, "antes": {"venceEm": "2026-10-15"}, "depois": {"venceEm": "2026-11-15", "valorCentavos": 6700, "forma": "pix"}, "ip": "203.0.113.7"}
  ],
  "total": 1,
  "pagina": 1,
  "paginas": 1,
  "opcoes": {"acoes": ["login", "login_falha", "pagamento_registrado", "pagamento_estornado"], "pessoas": [{"id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21", "nome": "Ana"}]}
}
```

### 6.16 Erro

`dados` é `{status, mensagem}`, com a moldura quando há sessão.

```json
{"status": 403, "mensagem": "O seu papel não permite abrir esta tela."}
```

### 6.17 Indicadores

*v0.8.0.* `GET /api/indicadores` devolve `{hoje, meses, recebido, mrr, movimento, previsao, inadimplencia, planos, audiencia, anunciantes, funil}`. *v0.13.0:* `funil` é o bloco dos interessados (14.6), ou `null` com a chave dos leads desligada. É o bloco Dinheiro dos Indicadores (D9 do plano): a evolução no tempo, só com dados da gestão. O Resumo (6.4) continua sendo a foto do dia. *v0.9.0:* os blocos Audiência do Guia e Anunciantes vêm da cópia das métricas do site (9.5), lida uma vez por dia.

- **Quem vê:** todo papel (`ver`), como o Resumo. A página `/indicadores` tem `filtros: {}`.
- Os valores são em centavos. Os dias e os meses são os de São Paulo.
- `meses` são os 12 meses das séries (`aaaa-mm`), do mais antigo ao atual. Cada série tem os 12, e o mês sem dado vem com zero, nunca fora da lista. O mês atual vem com `parcial: true`.
- Cada bloco traz `como`: a frase pronta que a tela mostra junto do número, dizendo de onde ele vem e como é calculado.
- Nenhum número é inventado nem estimado: o que a gestão não sabe reconstruir está dito no `como` e abaixo.

**`recebido`** `{como, meses:[{mes, centavos, pagos:{qtd, centavos}, estornados:{qtd, centavos}, parcial}], total}`:
- `pagos`: os pagamentos com `pagoEm` no mês, inclusive os que foram estornados depois.
- `estornados`: os estornos feitos no mês (o dia do estorno), de pagamentos de qualquer mês.
- `centavos` é `pagos.centavos − estornados.centavos`, e pode ser negativo. `total` soma os 12 meses.
- O estorno desconta no mês em que foi feito, para o passado não mudar. Por isso, o mês atual pode ser diferente do `recebidoMes` do Resumo, que tira o pagamento estornado do mês em que ele foi pago.

**`mrr`** `{como, meses:[{mes, centavos, assinaturas, parcial}]}`: a receita mensal recorrente reconstruída no fim de cada mês.
- O dia de cada mês é o último dia do mês; no mês atual, é hoje.
- Uma assinatura conta nesse dia quando: já tinha começado (`inicio` até o dia); não estava cancelada (sem `canceladaEm`, ou com `canceladaEm` depois do dia); e não estava suspensa.
- Os períodos de suspensão vão do dia da suspensão até o dia da reativação, sem ele. Eles vêm da auditoria (`assinatura_suspensa` e `assinatura_reativada`, no dia de São Paulo), mais a suspensão em aberto (`suspensaEm` da assinatura suspensa, ou da cancelada que estava suspensa).
- Cada assinatura entra com o valor de hoje dividido pelos meses do ciclo de hoje: a série não reconstrói as edições de valor e de ciclo. O total de cada mês é arredondado, não cada parcela. `assinaturas` conta as que entraram.
- As inadimplentes contam, porque o atraso de meses passados não é reconstruído. Por isso, o mês atual pode ser maior que o `mrr` do Resumo, que tira as inadimplentes de hoje.

**`movimento`** `{como, meses:[{mes, novas:{qtd, centavos}, canceladas:{qtd, centavos}, parcial}]}`:
- `novas`: assinaturas com `inicio` no mês; `canceladas`: assinaturas com `canceladaEm` no mês.
- `centavos` é a receita mensal delas (o valor dividido pelos meses do ciclo), com o total do mês arredondado.
- Na importação sem início, o início é o vencimento recuado um ciclo (8.2).

**`previsao`** `{como, de, ate, semanas:[{de, ate, qtd, centavos, itens}], total:{qtd, centavos}, atrasadas:{vencidas:{qtd, centavos}, inadimplentes:{qtd, centavos}}}`: o que deve entrar nos próximos 30 dias.
- As assinaturas ativas com `dias` de 0 a 30 (as mesmas do `aRenovar30` do Resumo), em 5 semanas contadas a partir de hoje: de 0 a 6 dias, de 7 a 13, de 14 a 20, de 21 a 27 e de 28 a 30. `de` e `ate` são os dias de cada semana e da previsão inteira. Cada assinatura entra com o valor de um ciclo.
- `itens` são `{id, cliente:{id, nome}, empresa:{id, nome}|null, plano:{id, nome}|null, venceEm, dias, valorCentavos, situacao}`, em ordem de vencimento e, no empate, pelo nome do cliente.
- `atrasadas` é o que já venceu e ainda não foi pago: as vencidas dentro da tolerância e as inadimplentes, cada uma com o valor de um ciclo. Elas não entram nas semanas.
- Suspensas e canceladas não entram.

**`inadimplencia`** `{como, qtd, centavos, faixas:[{de, ate, qtd, centavos}]}`:
- As assinaturas inadimplentes de hoje (ativas, vencidas há mais dias que a tolerância das Configurações), como no Resumo, com o valor de um ciclo de cada.
- `faixas` pelos dias de atraso: de 1 a 30, de 31 a 60, de 61 a 90 e de 91 em diante (`ate: null`). As quatro faixas vêm sempre, com zero quando vazias. Com a tolerância de 10 dias, a primeira faixa só tem atrasos de 11 a 30 dias.

**`planos`** `{como, itens:[{plano:{id, nome}|null, assinaturas, centavos}], assinaturas, mrr, valorMedio}`:
- A mesma base do `mrr` do Resumo: as assinaturas ativas que não estão inadimplentes, com o valor dividido pelos meses do ciclo. `mrr` aqui é igual ao do Resumo.
- `itens` agrupa pelo plano da assinatura (`plano: null` para as sem plano), com a receita mensal de cada plano arredondada. A soma dos itens pode diferir de `mrr` em alguns centavos de arredondamento. A ordem é da maior receita para a menor e, no empate, pelo nome do plano.
- `valorMedio` é `mrr` dividido por `assinaturas`, arredondado, ou `0`.
**`audiencia`** *(v0.9.0)* `{como, disponivel, atualizadaEm, medidoDesde:{contatos, buscas}, meses:[{mes, visitas, contatos:{whatsapp, telefone, rota, site}, contatosTotal, buscas, buscasSemResultado, parcial}], buscasMaisFeitas:[{termo, vezes}], buscasSemResultado:[{termo, vezes}], bairros:[{bairro, vezes}], categorias:[{categoria, nome, vezes}]}`: a Audiência do Guia, da cópia das métricas do site (9.5).
- `meses` são os mesmos 12 dos outros blocos. O mês que o site ainda não media vem com `null` nos números, e a tela mostra "sem medição", nunca zero.
- As visitas e os contatos são só dos visitantes que aceitaram a medição no site. As buscas são contadas pelo servidor do site, sem dado pessoal. As listas trazem só o que apareceu pelo menos 3 vezes no período.
- *v0.9.2:* cada categoria traz `categoria`, o identificador da busca do site (como `alimentacao`), e `nome`, o nome que o guia mostra (como "Alimentação"), que é o que a tela usa. Na cópia lida de um site que ainda não manda o nome (antes da v0.19.1 do site), `nome` repete o identificador.
- `disponivel` é `false` enquanto a gestão não leu as métricas nenhuma vez: os números vêm `null`, as listas vazias e `atualizadaEm` vem `null`.

**`anunciantes`** *(v0.9.0)* `{como, disponivel, atualizadaEm, base, semMedicao, maisContatos, menosContatos, emRisco, banners}`: os anunciantes da gestão, cruzados com a cópia das métricas.
- A base são as empresas do guia com assinatura **ativa** na gestão; `base` conta quantas são.
- Cada anunciante é `{empresa:{id, nome}, cliente:{id, nome}, assinatura:{id, venceEm, dias, situacao}, visitas30, contatos30, contatos30Canais:{whatsapp, telefone, rota, site}}`, com os últimos 30 dias do site (`ultimos30`, 19.6).
- *v0.14.1:* `semMedicao`: as empresas da base que o site não listou (não publicadas), em ordem de nome, cada uma `{empresa, cliente, assinatura}`, sem número nenhum. Zero só aparece quando o site mediu e ninguém visitou nem entrou em contato. Antes da v0.14.1, elas entravam com zero nas listas e no risco.
- `maisContatos`, `menosContatos` e `emRisco` só trazem as empresas medidas.
- `maisContatos`: até 5, do que mais recebeu contatos para o que menos. `menosContatos`: até 5, do que menos recebeu para o que mais, sem repetir os de `maisContatos`. No empate, pelo nome da empresa.
- `emRisco`: as que vencem em até 30 dias (`dias` de 0 a 30) e receberam menos de 5 contatos nos últimos 30 dias (limite provisório, a combinar com o Nexus), em ordem de vencimento.
- `banners`: os banners de anunciantes do período, do mais clicado para o menos, `{id, titulo, empresa:{id, nome}|null, impressoes, cliques, ctr}`. `ctr` é cliques ÷ impressões, com 4 casas, ou `0`.
- `disponivel` é `false` enquanto a gestão não leu as métricas: as listas vêm vazias e `atualizadaEm` vem `null`.

```json
{
  "hoje": "2026-10-20",
  "meses": ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
  "recebido": {
    "como": "Pagamentos registrados com data no mês, menos os estornos feitos no mês. O estorno desconta no mês em que foi feito.",
    "meses": [
      {"mes": "2025-11", "centavos": 0, "pagos": {"qtd": 0, "centavos": 0}, "estornados": {"qtd": 0, "centavos": 0}, "parcial": false},
      {"mes": "2026-09", "centavos": 51700, "pagos": {"qtd": 6, "centavos": 61600}, "estornados": {"qtd": 1, "centavos": 9900}, "parcial": false},
      {"mes": "2026-10", "centavos": 53600, "pagos": {"qtd": 5, "centavos": 53600}, "estornados": {"qtd": 0, "centavos": 0}, "parcial": true}
    ],
    "total": 105300
  },
  "mrr": {
    "como": "Assinaturas que, no último dia de cada mês (hoje, no mês atual), já tinham começado e não estavam suspensas nem canceladas, cada uma com o valor de hoje dividido pelos meses do ciclo. As inadimplentes entram.",
    "meses": [
      {"mes": "2025-11", "centavos": 0, "assinaturas": 0, "parcial": false},
      {"mes": "2026-09", "centavos": 186700, "assinaturas": 21, "parcial": false},
      {"mes": "2026-10", "centavos": 196600, "assinaturas": 23, "parcial": true}
    ]
  },
  "movimento": {
    "como": "Novas pelo mês do início e canceladas pelo mês do cancelamento, com a receita mensal de cada uma.",
    "meses": [
      {"mes": "2025-11", "novas": {"qtd": 0, "centavos": 0}, "canceladas": {"qtd": 0, "centavos": 0}, "parcial": false},
      {"mes": "2026-10", "novas": {"qtd": 2, "centavos": 16600}, "canceladas": {"qtd": 1, "centavos": 6700}, "parcial": true}
    ]
  },
  "previsao": {
    "como": "Assinaturas ativas que vencem nos próximos 30 dias, por semana, com o valor de um ciclo. Atrasadas são as que já venceram e ainda não foram pagas.",
    "de": "2026-10-20",
    "ate": "2026-11-19",
    "semanas": [
      {"de": "2026-10-20", "ate": "2026-10-26", "qtd": 1, "centavos": 18000, "itens": [
        {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62", "nome": "Padaria Pão Dourado"}, "empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado"}, "plano": {"id": "plano-avancado", "nome": "Avançado"}, "venceEm": "2026-10-24", "dias": 4, "valorCentavos": 18000, "situacao": "a-vencer"}
      ]},
      {"de": "2026-10-27", "ate": "2026-11-02", "qtd": 0, "centavos": 0, "itens": []},
      {"de": "2026-11-03", "ate": "2026-11-09", "qtd": 1, "centavos": 6700, "itens": []},
      {"de": "2026-11-10", "ate": "2026-11-16", "qtd": 2, "centavos": 18700, "itens": []},
      {"de": "2026-11-17", "ate": "2026-11-19", "qtd": 0, "centavos": 0, "itens": []}
    ],
    "total": {"qtd": 4, "centavos": 43400},
    "atrasadas": {"vencidas": {"qtd": 1, "centavos": 9900}, "inadimplentes": {"qtd": 1, "centavos": 9900}}
  },
  "inadimplencia": {
    "como": "Assinaturas ativas vencidas há mais de 10 dias (a tolerância das Configurações), pelos dias de atraso, com o valor de um ciclo.",
    "qtd": 1,
    "centavos": 9900,
    "faixas": [
      {"de": 1, "ate": 30, "qtd": 1, "centavos": 9900},
      {"de": 31, "ate": 60, "qtd": 0, "centavos": 0},
      {"de": 61, "ate": 90, "qtd": 0, "centavos": 0},
      {"de": 91, "ate": null, "qtd": 0, "centavos": 0}
    ]
  },
  "planos": {
    "como": "Assinaturas ativas que não estão inadimplentes, com o valor dividido pelos meses do ciclo: a mesma conta da receita mensal do Resumo.",
    "itens": [
      {"plano": {"id": "plano-premium", "nome": "Premium"}, "assinaturas": 12, "centavos": 118800},
      {"plano": {"id": "plano-avancado", "nome": "Avançado"}, "assinaturas": 9, "centavos": 67900},
      {"plano": null, "assinaturas": 1, "centavos": 0}
    ],
    "assinaturas": 22,
    "mrr": 186700,
    "valorMedio": 8486
  },
  "audiencia": {
    "como": "Visitas e contatos dos visitantes que aceitaram a medição no site; buscas contadas pelo servidor do site, sem dado pessoal. Mês sem medição aparece em branco.",
    "disponivel": true,
    "atualizadaEm": "2026-10-20T08:00:41.000Z",
    "medidoDesde": {"contatos": "2026-07-28", "buscas": "2026-10-01"},
    "meses": [
      {"mes": "2025-11", "visitas": null, "contatos": null, "contatosTotal": null, "buscas": null, "buscasSemResultado": null, "parcial": false},
      {"mes": "2026-10", "visitas": 1240, "contatos": {"whatsapp": 96, "telefone": 21, "rota": 34, "site": 8}, "contatosTotal": 159, "buscas": 310, "buscasSemResultado": 22, "parcial": true}
    ],
    "buscasMaisFeitas": [{"termo": "pizzaria", "vezes": 41}, {"termo": "farmacia", "vezes": 17}],
    "buscasSemResultado": [{"termo": "chaveiro 24 horas", "vezes": 6}],
    "bairros": [{"bairro": "Centro", "vezes": 58}],
    "categorias": [{"categoria": "alimentacao", "nome": "Alimentação", "vezes": 77}]
  },
  "anunciantes": {
    "como": "Empresas com assinatura ativa na gestão, com as visitas e os contatos dos últimos 30 dias no guia. Em risco: vence em até 30 dias e recebeu menos de 5 contatos. Sem medição: o site não mede a empresa, porque ela não está publicada; fica fora das listas e do risco.",
    "disponivel": true,
    "atualizadaEm": "2026-10-20T08:00:41.000Z",
    "base": 22,
    "semMedicao": [
      {"empresa": {"id": "studio-bella", "nome": "Studio Bella"}, "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63", "nome": "Studio Bella"}, "assinatura": {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03", "venceEm": "2026-11-05", "dias": 16, "situacao": "a-vencer"}}
    ],
    "maisContatos": [
      {"empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro"}, "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f61", "nome": "Clínica Vida Plena"}, "assinatura": {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01", "venceEm": "2026-11-15", "dias": 26, "situacao": "a-vencer"}, "visitas30": 412, "contatos30": 41, "contatos30Canais": {"whatsapp": 30, "telefone": 6, "rota": 4, "site": 1}}
    ],
    "menosContatos": [
      {"empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado"}, "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62", "nome": "Padaria Pão Dourado"}, "assinatura": {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", "venceEm": "2026-10-24", "dias": 4, "situacao": "a-vencer"}, "visitas30": 38, "contatos30": 2, "contatos30Canais": {"whatsapp": 2, "telefone": 0, "rota": 0, "site": 0}}
    ],
    "emRisco": [
      {"empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado"}, "cliente": {"id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62", "nome": "Padaria Pão Dourado"}, "assinatura": {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", "venceEm": "2026-10-24", "dias": 4, "situacao": "a-vencer"}, "visitas30": 38, "contatos30": 2, "contatos30Canais": {"whatsapp": 2, "telefone": 0, "rota": 0, "site": 0}}
    ],
    "banners": [
      {"id": "padaria-pao-de-queijo", "titulo": "Pão de queijo em dobro", "empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado"}, "impressoes": 4210, "cliques": 63, "ctr": 0.015}
    ]
  },
  "funil": null
}
```

No exemplo, `meses` das séries mostra só alguns dos 12, para encurtar, e as semanas sem `itens` também foram encurtadas. A resposta real traz os 12 meses e todos os itens.

## 7. APIs

Todas exigem sessão, menos as do login (4.4). A coluna Ação é a de 3.1: `—` é a rota sem sessão, e `sessão` é a que vale para qualquer papel. A marca ⟳ indica reautenticação (4.6). O `tests/api/contrato.test.mjs` confere que cada rota implementada está nesta tabela, com a mesma ação e a mesma marca, e a matriz de testes cobre cada rota implementada com cada papel.

### 7.1 Rotas

| Rota | Ação | Entrada | Saída |
| --- | --- | --- | --- |
| `POST /api/auth/login` | — | `{email, senha}` | `{etapa}` e o cookie `gestao_login` (4.4) |
| `POST /api/auth/codigo` | — | `{codigo}` | `{csrf, usuario, recuperacao?}` e o cookie da sessão |
| `POST /api/auth/2fa` | — | `{codigo}` | `{csrf, usuario, codigosRecuperacao}` e o cookie da sessão |
| `POST /api/auth/senha` | — | `{token, senha}` | `{ok:true}` |
| `POST /api/auth/confirmar` | sessão | `{senha}` ou `{codigo}` | `{ok:true, valeAte}` |
| `POST /api/auth/logout` | — | — | `{ok:true}` (com sessão, exige o `X-CSRF-Token`; 4.4) |
| `GET /api/me` | sessão | — | `{usuario, csrf, pode}` |
| `GET /api/resumo` | `ver` | — | Resumo (6.4) |
| `GET /api/indicadores` | `ver` | — | Indicadores (6.17) |
| `GET /api/renovacoes` | `ver` | `?janela=&page=` | lista de Renovacao (6.5) |
| `POST /api/assinaturas/:id/contatos` | `cobrar` | `{}` | `201 Contato` |
| `GET /api/clientes` | `ver` | `?q=&status=&situacao=&page=` | lista de ClienteLinha (6.6) |
| `POST /api/clientes` | `clientes` | `{nome, responsavel?, whatsapp?, email?, notas?}` | `201` Ficha |
| `GET /api/clientes/:id` | `ver` | — | Ficha (6.7) |
| `PATCH /api/clientes/:id` | `clientes` | campos do POST, `status?` e `version` | Ficha |
| `POST /api/clientes/:id/empresas/:businessId` | `clientes` | `{}` | `201 {empresas}` |
| `DELETE /api/clientes/:id/empresas/:businessId` | `clientes` | — | `{empresas}` |
| `POST /api/clientes/:id/empresas/:businessId/relatorios` | `cobrar` | `{mes}` | `201 Contato` (7.4, v0.11.0) |
| `GET /api/leads` | `clientes` | `?q=&situacao=&page=` | lista de LeadLinha (14.4, v0.13.0; desligada, 404) |
| `GET /api/leads/:id` | `clientes` | — | Lead (14.4) |
| `PATCH /api/leads/:id` | `clientes` | campos de 14.4 e `version` | Lead |
| `POST /api/leads/:id/cliente` | `clientes` | `{version}` | `201 {lead, cliente}` |
| `POST /api/leads/buscar` | `clientes` | `{}` | `{novos, erro}` |
| `GET /api/empresas-site` | `clientes` | `?q=&page=` | lista de `{id, nome, slug, bairro, status, plano:{id, nome}\|null, miniatura, url, cliente:{id, nome}\|null}` |
| `GET /api/assinaturas` | `ver` | `?q=&status=&situacao=&cliente=&page=` | lista de Assinatura |
| `POST /api/assinaturas` | `assinaturas` | `{cliente, empresa?, plano, valorCentavos, ciclo, inicio, venceEm, notas?}` | `201 Assinatura` |
| `GET /api/assinaturas/:id` | `ver` | — | Assinatura |
| `PATCH /api/assinaturas/:id` | `assinaturas` | `{empresa?, plano?, valorCentavos?, ciclo?, inicio?, venceEm?, notas?, version}` | Assinatura |
| `POST /api/assinaturas/:id/suspender` | `assinaturas` | `{motivo?, version}` | Assinatura |
| `POST /api/assinaturas/:id/reativar` | `assinaturas` | `{version}` | Assinatura |
| `POST /api/assinaturas/:id/cancelar` | `assinaturas` | `{motivo, canceladaEm?, version}` | Assinatura |
| `GET /api/planos-site` | `assinaturas` | — | `{itens:[{id, nome, pago, status, precoCentavos}], atualizadoEm, copia}` |
| `POST /api/assinaturas/:id/pagamentos` | `pagamentos` | `{valorCentavos, pagoEm, forma, obs?, version}` | `201 {pagamento, assinatura}` |
| `POST /api/pagamentos/:id/estornar` | `pagamentos` ⟳ | `{motivo}` | `{pagamento, assinatura}` |
| `GET /api/importacoes` | `importar` | `?page=` | lista (6.11) |
| `POST /api/importacoes?tipo=edirectory\|planilha` | `importar` | o CSV, como corpo binário | `201 Importacao` (prévia, sem gravar nada) |
| `GET /api/importacoes/:id` | `importar` | — | Importacao (6.12) |
| `PATCH /api/importacoes/:id/linhas/:linha` | `importar` | `{empresa?, ignorar?, version}` | Importacao |
| `POST /api/importacoes/:id/confirmar` | `importar` ⟳ | `{version}` | Importacao (`status: confirmada`) |
| `DELETE /api/importacoes/:id` | `importar` | — | `{ok:true}`: descarta a prévia |
| `GET /api/equipe` | `equipe` | — | `{itens: Membro[]}` (6.13) |
| `POST /api/equipe` | `equipe` ⟳ | `{email, nome, papel}` | `201 {membro, link, expira}`. E-mail que já está na equipe: `409`. |
| `PATCH /api/equipe/:id` | `equipe` (⟳ para `papel` e `desativado`) | `{nome?, papel?, desativado?, version}` | Membro |
| `POST /api/equipe/:id/link-senha` | `equipe` ⟳ | `{}` | `{link, expira, tipo}`, com `tipo` igual a `convite` ou `senha` (4.2) |
| `POST /api/equipe/:id/redefinir-2fa` | `equipe` ⟳ | `{version}` | Membro |
| `GET /api/configuracoes` | `configuracoes` | — | Configurações (6.14) |
| `PATCH /api/configuracoes` | `configuracoes` (⟳ para `chavePix` e `whatsappAtendimento`) | `{chavePix?, whatsappAtendimento?, modeloMensagem?, modeloRelatorio?, modelosLembrete?, toleranciaDias?, version}` | Configurações |
| `GET /api/auditoria` | `auditoria` | `?acao=&usuario=&recurso=&de=&ate=&q=&page=` | lista (6.15) |

### 7.2 Validação

| Campo | Regra | Mensagem (422, com `campo`) |
| --- | --- | --- |
| `nome` (cliente) | 2 a 160 caracteres | "Informe o nome do cliente." |
| `responsavel` | até 120 | "Use até 120 caracteres." |
| `whatsapp` | vazio; DDD e número (10 ou 11 dígitos), aos quais a API acrescenta o 55; ou já com o 55 (12 ou 13 dígitos). Aceita máscara. Com `+` na frente, só o `+55`. | "Informe o WhatsApp com DDD, como (21) 98765-4321." |
| `email` | vazio, ou um e-mail válido | "Informe um e-mail válido." |
| `notas` | até 2.000 | "Use até 2.000 caracteres." |
| `status` (cliente) | `ativo` ou `encerrado`; encerrar só com todas as assinaturas canceladas | "Cancele as assinaturas do cliente antes de encerrar." |
| `cliente` (assinatura) | um cliente que existe e está ativo | "Cliente não encontrado." ou "Reabra o cliente antes de criar uma assinatura." |
| `empresa` | uma empresa vinculada ao cliente, ou `null` | "Vincule a empresa ao cliente antes." |
| `businessId` (no caminho) | o id de uma empresa do site: letras minúsculas, números e hífens, até 120 caracteres; senão, 404 | — |
| `plano` | obrigatório na criação; um plano ativo do site, conferido na hora ou na última cópia, se o site não responde. Sem nenhuma cópia: 503. Na edição, o plano que a assinatura já tem continua aceito. | "Escolha um plano do guia." |
| `valorCentavos` | inteiro de 0 a 100.000.000 (no pagamento, de 1 em diante) | "Informe o valor, como 99,00." |
| `ciclo` | da lista | "Escolha o ciclo." |
| `inicio`, `venceEm` | dia válido; `venceEm` não antes de `inicio` | "Use a data no formato aaaa-mm-dd." |
| `pagoEm` | dia válido, até hoje (em São Paulo) | "A data do pagamento não pode ser no futuro." |
| `forma` | da lista | "Escolha a forma de pagamento." |
| `obs` | até 300 | "Use até 300 caracteres." |
| `motivo` | 3 a 300 (obrigatório no cancelamento e no estorno) | "Conte o motivo em poucas palavras." |
| `canceladaEm` | dia válido, de `inicio` até hoje | "A data do cancelamento vai do início até hoje." |
| `chavePix` | até 77 caracteres, numa linha, sem espaços nas pontas; vazia apaga a chave | "Use até 77 caracteres, numa linha só." |
| `modeloMensagem` | 20 a 1.000 caracteres; toda palavra entre chaves precisa ser uma variável de 6.14 | "Variável desconhecida: {x}." |
| `toleranciaDias` | inteiro de 0 a 60 | "Use de 0 a 60 dias." |
| `modelosLembrete` (v0.14.0) | um objeto só com as etapas de 15.1. Cada valor é vazio (tira o modelo próprio) ou tem de 20 a 1.000 caracteres, só com as variáveis de 6.14 | "Etapa desconhecida: x." (`campo: modelosLembrete`); "Use de 20 a 1.000 caracteres." ou "Variável desconhecida: {x}." (`campo: modelosLembrete.<dias>`) |

### 7.3 Mensagem do WhatsApp

- O `linkWhatsapp` é `https://wa.me/<whatsapp>?text=<mensagem>`, com a mensagem codificada para URL (`encodeURIComponent`).
- A mensagem é o `modeloMensagem` com as variáveis trocadas. O que está entre chaves e não é uma variável da lista fica como está:
  - `{responsavel}`: o responsável, ou o nome do cliente;
  - `{cliente}`: o nome do cliente;
  - `{empresa}`: o nome da empresa do guia, ou o nome do cliente;
  - `{plano}`: o nome do plano, ou `''`;
  - `{valor}`: o valor de um ciclo em pt-BR, com espaço comum e o ponto dos milhares (`R$ 1.250,00`);
  - `{vencimento}`: `dd/mm/aaaa`;
  - `{prazo}`: `vence em 24/10/2026` (com `dias` maior que 0), `vence hoje` (0) ou `venceu em 15/10/2026` (negativo);
  - `{chave_pix}`: a chave Pix das Configurações;
  - `{desempenho}` *(v0.10.0)*: a frase do desempenho da empresa da assinatura no mês anterior (o mês antes do atual, em São Paulo), da cópia das métricas do site (9.5), com o ponto final: `Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro.`
- Sem chave Pix definida, `{chave_pix}` fica vazio, e as telas mostram o aviso `chave-pix`.
- **A frase do `{desempenho}`** **[P1]**:
  - usa os mesmos números do `anterior` do desempenho da ficha (6.7): as visitas e os contatos pelo WhatsApp, só dos visitantes que aceitaram a medição no site;
  - os números vêm com o ponto dos milhares (`1.234 visitas`) e no singular quando são 1 (`1 visita`, `1 contato pelo WhatsApp`); o mês vem por extenso e em minúsculas (`em setembro`);
  - sem contato pelo WhatsApp no mês, a frase fica só com as visitas: `Seu anúncio teve 312 visitas em setembro.`
- **A variável fica vazia**, sem frase pela metade e sem número inventado, quando:
  - a assinatura não tem empresa do guia;
  - a gestão nunca leu as métricas, ou a empresa não veio na cópia;
  - o mês anterior não tem medição (`null`) ou não foi medido inteiro (`parcial`, 6.7): ainda estava aberto quando a cópia foi lida, ou a medição começou no meio dele;
  - as visitas do mês anterior foram zero.
- Vazio, o `{desempenho}` sai do texto junto com o espaço antes dele; sem espaço antes, com o espaço depois. Assim a mensagem não fica com dois espaços seguidos.
- **A mensagem do relatório do mês** *(v0.11.0)* é o `modeloRelatorio` (6.14), com as mesmas regras de troca e o mesmo `linkWhatsapp` para o WhatsApp do cliente. As variáveis são as de `variaveisRelatorio`:
  - `{responsavel}` e `{cliente}`: como na cobrança;
  - `{empresa}`: o nome da empresa do guia do relatório;
  - `{mes}`: o mês do relatório por extenso ("setembro de 2026");
  - `{desempenho}`: a frase do desempenho da empresa no mês do relatório, com as mesmas regras de cima. O mês do relatório é o mês anterior, então os números são os mesmos do `anterior` do desempenho da ficha;
  - `{link}`: o endereço do relatório no painel do site (`relatorio.empresas[].url`, 6.7).
- O navegador monta a pré-visualização das Configurações com os exemplos de `variaveis`, pela mesma regra.

### 7.4 Cobrança

`POST /api/assinaturas/:id/contatos` registra que a cobrança foi aberta no WhatsApp e responde `201` com o Contato. O `tipo` é `cobranca` com a assinatura vencida (`dias` negativo) e `lembrete` com ela a vencer, e `venceEm` guarda o vencimento cobrado. A tela abre o `linkWhatsapp` em nova aba **e** chama esta rota. Se o registro falhar, a mensagem abre do mesmo jeito e a tela avisa. O contato marca a assinatura como gerida e entra na auditoria (`cobranca_registrada`). *v0.14.0:* o lembrete guarda a `etapa` da régua no dia do registro, e o Contato e a auditoria a trazem (15.3).

- Só a assinatura ativa é cobrada: `422 {erro:'Só a assinatura ativa pode ser cobrada.'}`.
- O cliente sem WhatsApp responde `422 {erro:'O cliente não tem WhatsApp.', campo:'whatsapp'}`.
- O corpo é `{}`, sem `version`: registrar o contato não muda a assinatura.

**Relatório do mês** *(v0.11.0)*. `POST /api/clientes/:id/empresas/:businessId/relatorios` com `{mes}` registra que o relatório do mês daquela empresa foi aberto no WhatsApp do cliente e responde `201` com o Contato (`tipo: 'relatorio'`). Como na cobrança, a tela abre o `linkWhatsapp` de `relatorio.empresas[]` (6.7) em nova aba **e** chama esta rota. Se o registro falhar, a mensagem abre do mesmo jeito e a tela avisa.
- O envio entra na linha do tempo da ficha (`tipo: 'relatorio'`), passa a ser o `ultimoEnvio` daquela empresa e mês, e entra na auditoria (`relatorio_enviado`, com a empresa e o mês). Não mexe em assinatura nenhuma.
- Pode ser enviado de novo: cada envio fica registrado.
- A empresa precisa estar vinculada ao cliente: senão, `404 {erro:'Esta empresa não está vinculada a este cliente.'}`.
- `mes` é um mês fechado (`aaaa-mm`), dos 12 antes do atual: senão, `422 {erro, campo:'mes'}`. A tela manda o `relatorio.mes` da ficha.
- O cliente sem WhatsApp responde `422 {erro:'O cliente não tem WhatsApp.', campo:'whatsapp'}`.
- O corpo aceita só o `mes`: outro campo dá `422`, como nas outras rotas.

### 7.5 Assinaturas, pagamentos e estornos

- **Criar:** a assinatura nasce `ativa`, com `origem: manual` e já gerida. Se a empresa já tem uma assinatura não cancelada, a resposta é `409 {erro:'Esta empresa já tem uma assinatura. Edite a que existe.', campo:'empresa'}`.
- **Editar:** muda os campos de 7.1. Mudar o `venceEm` refaz o `diaBase`. A assinatura cancelada só aceita mudança em `notas` (`422 {erro:'A assinatura cancelada só aceita mudança nas notas.'}`). Um `PATCH` que não muda nada responde com a assinatura, sem nova versão e sem auditoria.
- Toda mudança de plano, empresa, vencimento ou situação põe o plano esperado na fila do site (9.3), na mesma transação.
- **Suspender** (`ativa` → `suspensa`): o motivo é opcional.
- **Reativar** (`suspensa` → `ativa`): o vencimento continua o mesmo.
- **Cancelar** (`ativa` ou `suspensa` → `cancelada`): exige o motivo. `canceladaEm` é hoje por padrão e aceita uma data passada, desde que não antes do início. Cancelar não tem volta: para retomar, cria-se uma assinatura nova.
- **Registrar pagamento:** só na assinatura ativa (`422 {erro:'Reative a assinatura antes de registrar o pagamento.'}`), com a `version` lida. Isso impede que dois toques registrem o mesmo pagamento duas vezes. A baixa avança o vencimento em um ciclo (5.4), qualquer que seja o valor pago.
  - O pagamento guarda `meses`, `venceAntes`, `venceDepois` e a referência (de `venceAntes` até o dia anterior a `venceDepois`).
  - A assinatura ganha versão nova e fica gerida. O plano esperado vai para a fila do site (motivo `pagamento`), e o pagamento entra na auditoria (`pagamento_registrado`).
  - A resposta é `201 {pagamento, assinatura}`.
- **Estornar:** exige o motivo e a reautenticação. Recua o vencimento pelos meses daquele pagamento, sem passar do início da assinatura.
  - O pagamento já estornado responde `422 {erro:'Este pagamento já foi estornado.'}`, e o que não existe, `404`.
  - Vale também na assinatura suspensa ou cancelada, para corrigir o registro financeiro.
  - A assinatura ganha versão nova, o plano esperado vai para a fila (motivo `estorno`), e o estorno entra na auditoria (`pagamento_estornado`). A resposta é `{pagamento, assinatura}`.
- **Configurações:** cada mudança entra na auditoria (`configuracoes_editadas`), com o antes e o depois.
- **Vínculos:**
  - A busca no guia (`GET /api/empresas-site`) traz o plano de cada empresa como `{id, nome}`, com o nome da lista de planos do site (a mesma de 6.9, ou a última cópia, se o site não responde). Um plano que a lista não tem vem com o id no lugar do nome (v0.8.1).
  - Vincular confere a empresa no site, na hora, e guarda nome, slug, bairro e foto. A empresa que o site não conhece responde `404`; o site fora do ar, `503`.
  - A empresa já vinculada a outro cliente responde `409 {erro:'Esta empresa já é do cliente <nome>.', campo:'businessId'}`. Já vinculada ao mesmo cliente, `409 {erro:'Esta empresa já está vinculada a este cliente.'}`.
  - Desvincular uma empresa que tem assinatura não cancelada responde `422 {erro:'Cancele a assinatura desta empresa antes de desvincular.', campo:'businessId'}`. Desvincular põe na fila o `plano: null` com `gerida: false` (9.3).
- **Cliente encerrado:** só com todas as assinaturas canceladas. Pode ser reaberto (`status: ativo`). O cliente não é apagado na Fase 1. O pedido de exclusão da LGPD fica para o `SEGURANCA.md` **[SEG]**.
- **Auditoria:** `cliente_criado`, `cliente_editado`, `empresa_vinculada`, `empresa_desvinculada`, `assinatura_criada`, `assinatura_editada`, `assinatura_suspensa`, `assinatura_reativada` e `assinatura_cancelada`, com o antes e o depois dos campos que mudaram.

### 7.6 Equipe

- **Convidar** (`POST /api/equipe`): e-mail válido, nome de 1 a 120 caracteres e papel da lista. Cria a conta sem senha e devolve o link do convite (72 horas), para mandar pelo WhatsApp. O e-mail que já existe na equipe, ativo ou desativado, responde `409 {erro:'Este e-mail já está na equipe.', campo:'email'}`. Para trazer alguém de volta, reative.
- **Editar** (`PATCH /api/equipe/:id`): mande só os campos que mudaram, porque a presença de `papel` já pede a reautenticação.
  - `nome`: de 1 a 120 caracteres.
  - `desativado: true` encerra as sessões e o login pendente da pessoa; `false` reativa a conta, com a mesma senha e o mesmo 2FA.
  - As regras de 3.2 valem aqui: ninguém muda o próprio papel nem se desativa, e sempre sobra um admin ativo (`422`).
- **Gerar link de senha:** a conta desativada responde `422 {erro:'Reative a conta antes de gerar o link.'}`. O link novo invalida os anteriores.
- **Redefinir o 2FA** (4.7): não vale para a própria conta (`422 {erro:'Peça a outro admin ou use o CLI para redefinir o seu 2FA.'}`).

## 8. Importação

O formato do eDirectory veio da documentação pública dele (support.edirectory.com: "How to fill out the Import Fields" e "How to Export Data from eDirectory"): a exportação de anúncios (Content Manager → Export → Listings) usa "o mesmo formato da importação". O arquivo real do Nexus ainda não foi visto. Os nomes, os formatos de data e os valores de situação são provisórios até ele chegar **[P7]**. Os testes usam um exemplo montado com esses nomes e dados fictícios (`tests/fixtures/`).

### 8.1 Envio

- `POST /api/importacoes?tipo=edirectory|planilha`, com o CSV como corpo binário. O `Content-Type` é `text/csv`, `text/plain`, `application/vnd.ms-excel` ou `application/octet-stream`; outro tipo responde `415`.
- Até 2 MB (`413`) e 2.000 linhas de dados. Mais linhas: `422 {erro:'O arquivo tem mais de 2.000 linhas. Divida em partes.', campo:'arquivo'}`.
- A codificação é detectada: UTF-8 (com ou sem BOM) ou, se não for UTF-8 válido, Windows-1252. O arquivo com byte nulo não é texto: `415`.
- O separador é o que mais aparece no cabeçalho, fora das aspas, entre `;`, `,` e tabulação. Aspas seguem o padrão do CSV: `""` dentro de aspas é uma aspa, e a quebra de linha dentro de aspas faz parte da célula. A primeira linha é o cabeçalho, e as linhas vazias são puladas.
- Sem as colunas obrigatórias (8.2): `422 {erro:'Faltam as colunas: …', campo:'arquivo'}`.
- A prévia depende do site, para casar as empresas e os planos. Com o site fora do ar: `503`.
- Até 10 envios por pessoa por hora (4.5).
- A resposta é `201` com a **prévia**: nada é gravado em clientes nem em assinaturas. O mesmo arquivo (mesmo SHA-256 e mesmo tipo) enviado de novo enquanto a prévia dele está aberta devolve a mesma prévia, com `200`.

### 8.2 Colunas

Os nomes do cabeçalho são comparados sem acento, sem caixa e sem pontuação (`E-mail` e `email` são iguais). Vale o primeiro nome da lista que existir no arquivo.

| Dado | eDirectory | Planilha de controle |
| --- | --- | --- |
| Id do anúncio | `Listing DB ID`, `id do anuncio`, `listing id` | — |
| Empresa (o anúncio) | `Listing Title`, `titulo`, `title` (obrigatória) | `empresa`, `nome fantasia`, `razao social`, `nome`, `assinante` (obrigatória) |
| Cliente (quem paga) | `Account Contact Company`; sem ela, o nome do contato; sem ele, o título | `cliente`; sem ela, a empresa |
| Responsável | `Account Contact First Name` e `Account Contact Last Name`, juntos | `responsavel`, `contato` |
| E-mail | `Account Username` (o e-mail da conta), `Account Contact Email`, `Listing Email`, `email` | `email` |
| WhatsApp | `Account Contact Phone`, `Listing Phone`, `whatsapp`, `telefone`, `celular` | `whatsapp`, `celular`, `telefone` |
| Plano | `Listing Product`, `Listing Level`, `nivel`, `plano` | `plano`, `produto`, `pacote` |
| Valor | `valor`, `preco`, `price` | `valor`, `mensalidade`, `valor mensal`, `preco` (obrigatória) |
| Ciclo | `ciclo`, `periodo`, `renewal period` | `periodicidade`, `ciclo`, `recorrencia`, `frequencia` |
| Início | `inicio`, `data de criacao`, `created` | `inicio`, `data de inicio`, `adesao`, `contratacao` (obrigatória) |
| Vencimento | `Listing Renewal Date`, `renovacao`, `data de renovacao`, `vencimento` (obrigatória) | `vencimento`, `proximo vencimento`, `data de vencimento` |
| Situação | `Listing Status`, `status`, `situacao` | `situacao`, `status` |

- **O resto do arquivo é ignorado e nunca é guardado:** endereço, descrições, categorias, imagens, a senha da conta (`Account Password`) e os outros campos. A prévia só leva o que está na tabela.
- **Datas:** `dd/mm/aaaa`, `mm/dd/aaaa` ou `aaaa-mm-dd`, com ou sem hora (a hora é descartada). A ordem de dia e mês vale para o arquivo inteiro: se alguma data tem o primeiro número maior que 12, é dia/mês; se tem o segundo maior que 12, é mês/dia. Sem nenhuma pista, vale dia/mês, como o eDirectory configurado no Brasil. A Importacao mostra a ordem usada em `arquivo.datas`.
- **Valores:** `99,00`, `R$ 1.250,00`, `1250.00` ou `99`.
- **Ciclo:** mensal, trimestral, semestral ou anual, também em inglês (`monthly`, `quarterly`, `semiannual`, `yearly`/`annual`). Sem a coluna ou com valor desconhecido: mensal, com aviso no valor desconhecido.
- **Situação:** `Active`, `Ativo`, `Pending`, `Pendente`, `Expired` e `Expirado` viram `ativa` (o expirado fica com o vencimento passado, e a situação calculada mostra se está vencida ou inadimplente). `Suspended` e `Suspenso` viram `suspensa`. `Deleted`, `Excluído`, `Cancelado`, `Inativo` e `Encerrado` viram `cancelada`. Vazia: `ativa`. Outro valor: `ativa`, com aviso.
- **Plano:** comparado pelo id e pelo nome com os planos do site (a cópia de `site_plans`, se o site não responde). Sem plano no arquivo ou com um nome que o site não tem: `plano: null`, com aviso.
- **Sem valor no arquivo** (o eDirectory não exporta preço): vale o `precoCentavos` do plano no site, com aviso. Sem ele também: R$ 0,00, com aviso.
- **Sem início:** o vencimento recuado um ciclo **[P7]**.
- **WhatsApp:** a mesma regra de 7.2. Inválido: fica em branco, com aviso. **E-mail** inválido: fica em branco, com aviso.

### 8.3 Como cada linha é casada

- **Erro:** a linha sem empresa, sem vencimento válido (no eDirectory) ou sem valor e início válidos (na planilha) vira `erro`, com o motivo, e não entra. A linha com o mesmo id de anúncio (ou a mesma `source_key`) de uma linha anterior também: "Linha repetida no arquivo (igual à linha N)."
- **Empresa do guia:** pelo nome normalizado (sem acento, caixa e pontuação, e com os espaços juntados), igual ao de uma única empresa do site. Sem nome igual, ou com mais de uma empresa com o mesmo nome, a empresa fica `null` e vêm até 3 `sugestoes` (as que têm mais palavras em comum). A empresa também fica `null`, com aviso, quando ela já é de outro cliente na gestão, quando outra linha do arquivo já a usou ou quando ela já tem uma assinatura não cancelada de outra origem (menos na linha cancelada). A empresa escolhida pela equipe vem antes da achada pelo nome: a linha que tinha achado a mesma empresa fica sem ela, com aviso.
- **A equipe resolve** com `PATCH /api/importacoes/:id/linhas/:linha {empresa, version}` (o id de uma empresa do guia, conferida no site, ou `null`) ou `{ignorar: true|false, version}`. A linha com erro não muda (`422`). A empresa escolhida que não pode ficar na linha (pelos motivos acima) responde `422 {erro, campo:'empresa'}`, com o motivo. A linha que fica sem empresa entra assim mesmo: o cliente e a assinatura são criados, e a empresa é vinculada depois, na ficha.
- **Cliente:** pelo e-mail normalizado. Sem e-mail, pelo nome normalizado. Vários anúncios do mesmo e-mail viram um cliente com várias empresas (as unidades de uma rede). O cliente que já existe é achado pela mesma chave (`clients.source_key`, `email:<e-mail>` ou `nome:<nome normalizado>`), ou pelo e-mail.
- **Assinatura:** pela `source_key`. No eDirectory, é `edirectory:<id do anúncio>`, ou, sem a coluna de id, `edirectory:<sha1 do título e do e-mail normalizados>`. Na planilha, é `planilha:<sha1 do nome, do plano e do início normalizados>`.
- **Ação:** `novo` (a `source_key` não existe), `atualizar` (existe e algo mudou: empresa, plano, valor, ciclo, vencimento ou situação, listados em `mudancas`), `igual`, `ignorar` (pela equipe, ou a assinatura é gerida, 8.4) ou `erro`.
- Mais de um aviso na mesma linha vêm juntos em `aviso`, separados por espaço.

### 8.4 Reimportação

- Reimportar não duplica nada: a `source_key` que já existe vira `atualizar` (com as `mudancas`) ou `igual`.
- A assinatura `gerida` (mexida na gestão depois da importação: edição, pagamento ou cobrança) vira `ignorar`, com o aviso "Editada na gestão depois da importação." Assim, um arquivo antigo do eDirectory não desfaz um pagamento registrado na gestão. A confirmação confere isso de novo, na hora.
- Os dados do cliente que já existem não são sobrescritos. A importação só preenche os campos vazios.

### 8.5 Confirmação, descarte e prazo

- `POST /api/importacoes/:id/confirmar {version}`, com reautenticação, grava tudo numa transação só:
  - cria os clientes que faltam e preenche os campos vazios dos que existem;
  - vincula as empresas (com os caches da prévia) que ainda não são de ninguém;
  - cria ou atualiza as assinaturas, com a `origem` do tipo, a `source_key` e **sem** marcar como gerida. A suspensa ganha `suspensaEm` de hoje; a cancelada, `canceladaEm` igual ao vencimento (ou ao início, se o vencimento vier antes dele);
  - põe na fila o plano de cada empresa que mudou (motivo `importacao`, 9.3): a de cada assinatura nova e, na atualização, quando mudam a empresa, o plano, o vencimento ou a situação.
- A empresa que, na hora de confirmar, já tem assinatura não cancelada de outra origem entra sem empresa e conta em `semEmpresa`. A prévia seguinte mostra o aviso.
- Depois de confirmada, a Importacao fica com `status: confirmada`, `linhas: []` e o `resumo` do que foi gravado.
- `DELETE /api/importacoes/:id` descarta a prévia (`status: descartada`). Só a prévia aberta pode ser confirmada, mudada ou descartada: nos outros status, `422 {erro:'Esta importação já foi fechada.'}`.
- A prévia vence 24 horas depois do envio. Na leitura seguinte, ou no `limpar` da rotina diária, ela fica `expirada` e as linhas são apagadas.
- **Auditoria:** `importacao_enviada` (tipo, linhas e SHA-256), `importacao_confirmada` (o resumo e quantos clientes foram criados, `clientesNovos`) e `importacao_descartada`.

### 8.6 Dados pessoais

- A prévia (com nomes, e-mails e telefones) é apagada ao confirmar, ao descartar ou ao vencer. Ficam só o `resumo`, o SHA-256 e o número de linhas. O arquivo nunca é guardado, e o backup não leva a prévia: a importação que estava aberta volta da restauração como `expirada`.
- Os arquivos reais não entram no repositório nem no chat. Os testes usam exemplos com dados fictícios em `tests/fixtures/`.
- A importação com dados reais espera a revisão de segurança (D7).
- **Exportação futura:** todo CSV gerado pela gestão escreve a célula que começa com `=`, `+`, `-` ou `@` entre aspas e com um apóstrofo na frente, para não virar fórmula **[SEG]**.

## 9. Integração com o site

A gestão é a fonte da verdade do plano pago (D5). O site ganha a seção 19 no contrato dele, escrita pelo back no branch `be/integracao-gestao` do `nexus`. Esta seção diz o que a gestão espera.

### 9.1 Rotas do site

| Rota | Saída |
| --- | --- |
| `GET /api/integracao/v1/empresas?q=&ids=&page=` | lista (2.2) de `{id, nome, slug, status, bairro, plano, foto}`. `ids` é uma lista separada por vírgulas, para atualizar os caches. `foto` é o caminho da foto principal (`/midia/<id>/320.webp`) ou `null`. |
| `GET /api/integracao/v1/planos` | `{itens:[{id, nome, pago, status, precoCentavos}]}` |
| `PUT /api/integracao/v1/empresas/:id/plano` | entrada `{plano, gerida, assinatura, motivo, minhaAssinatura}` (`minhaAssinatura` desde a v0.9.0, 9.5): `plano` é o id ou `null` (sem plano pago); `gerida` diz se o admin do site deve mostrar o plano como somente leitura, "definido pela gestão". Saída `{id, plano, alterado}`. Grava `businesses.plan_id` e a auditoria do site com o ator `gestao`. |

Em relação ao briefing do back, entram `foto` e `ids` nas empresas, `precoCentavos` nos planos e `gerida` no PUT.

### 9.2 Assinatura das chamadas **[SEG]**

- A gestão assina cada chamada com HMAC-SHA256, usando a `INTEGRACAO_CHAVE` do `.env`.
- A mensagem assinada é a junção, com `\n`, do método, do caminho com a query, do carimbo de tempo, do nonce e do SHA-256 (em hex) do corpo. O corpo vazio entra como o SHA-256 de `''`.
- Os cabeçalhos são `X-Gestao-Chave` (o id da chave, como `k1`), `X-Gestao-Carimbo` (segundos Unix), `X-Gestao-Nonce` (32 hex) e `X-Gestao-Assinatura` (hex).
- O site aceita carimbos de até 5 minutos para mais ou para menos, guarda os nonces por 10 minutos e recusa a repetição. Assinatura inválida, carimbo vencido e nonce repetido respondem `401`, sem detalhe.
- **Troca da chave sem parar:** o site aceita duas chaves ao mesmo tempo, a atual e a anterior, pelo id. Primeiro a chave nova entra no site; depois, na gestão; por fim, a antiga sai do site.
- **Rede:** a gestão chama o site pela rede interna do Docker (`SITE_API_URL`). O Traefik não roteia `/api/integracao/` para a internet. Como segunda barreira, o site recusa essas rotas (404) quando a requisição chega com `X-Forwarded-For`, isto é, pelo proxy.
- A integração só lê empresas e planos e grava o plano. Nada além.
- A gestão espera até 5 segundos por resposta.

### 9.3 Quando a gestão envia o plano

O plano esperado de uma empresa vem da assinatura não cancelada dela: o `plano_site`, se a assinatura está ativa e não inadimplente; senão, `null`.

| Evento | Plano enviado |
| --- | --- |
| Criar ou reativar assinatura, ou confirmar a importação | o plano da assinatura (ou `null`, se ela já está inadimplente) |
| Registrar pagamento | o plano da assinatura |
| Editar o plano ou a empresa | o plano novo na empresa nova e `null` na antiga |
| Suspender ou cancelar | `null`: a empresa continua no guia, sem plano pago **[P2]** |
| Passar da tolerância (inadimplente) | `null`, pela rotina diária **[P2]** |
| Estorno que deixa a assinatura inadimplente | `null` |
| Desvincular a empresa do cliente | `null`, com `gerida: false`: o admin do site volta a poder mudar o plano |
| Editar o valor ou o ciclo (v0.9.0) | o plano da assinatura, com a "Minha assinatura" nova (9.5) |
| Mudar a chave Pix ou o WhatsApp do atendimento (v0.9.0) | o plano de cada empresa com assinatura não cancelada, motivo `configuracao` (9.5) |

- Cada envio entra na fila `plan_sync`, na mesma transação da mudança, e é tentado logo depois: o servidor processa a fila logo depois de cada escrita e, de qualquer jeito, a cada 30 segundos.
- **Só o último vale.** De cada empresa, vai só o pedido mais novo da fila, com `{plano, gerida, assinatura, motivo}` (o PUT de 9.1). Quando ele chega, os pedidos mais antigos da mesma empresa que ainda esperavam saem junto, como enviados.
- **Concorrência (v0.8.2):** o envio usa trava transacional por empresa no banco, compartilhada entre o servidor e o CLI; relê o pedido mais recente depois de adquirir a trava. Uma empresa que outro processo está enviando fica para a próxima rodada. A conferência diária consulta o site antes de bloquear escritas, relê vínculos, assinaturas e tolerância sob uma trava curta e só então enfileira divergências; o envio acontece depois de liberar essa trava. A rotina não usa o estado da assinatura capturado antes da consulta remota.
- Se o site não responde, ou responde que a empresa não existe, a fila tenta de novo em 1, 5, 15 e 60 minutos, e depois a cada hora, com o erro guardado em `ultimo_erro`. Com mais de 1 hora de falha, o admin vê o aviso `sincronizacao`.
- Cada envio que chega entra na auditoria (`plano_enviado`, por `null`), com o plano, o `gerida`, o motivo e se o site mudou alguma coisa (`alterado`).
- A rotina diária (`sincronizar-planos --aplicar`, às 05:00 de São Paulo, depois do `limpar`) compara o plano esperado de cada empresa vinculada com o plano no site, atualiza os caches (nome, slug, bairro e foto), põe na fila as divergências (motivo `tolerancia` quando a assinatura passou da tolerância, `conferencia` nos outros casos), envia a fila e registra o resultado na auditoria (`sincronizacao_conferida`).
- `Assinatura.sincronizacao` (6.7) sai do último envio da empresa na fila: `ok` quando foi enviado (`em` é a hora do envio), `falhou` quando falha há mais de 1 hora (com o `erro`), `pendente` nos outros casos e `sem-empresa` quando a assinatura não tem empresa.

### 9.4 O que já existe (v0.5.0)

- **Na gestão:** o cliente da integração (`api/integracao.mjs`) assina as chamadas como em 9.2. Ele lê empresas e planos, e o envio da fila grava o plano (9.3). As rotas que dependem dele (`GET /api/empresas-site` e o vínculo de empresa) respondem `503` quando o site não responde ou quando `SITE_API_URL` não está configurado. Os planos usam a cópia de `site_plans`. Sem a integração configurada, a fila só acumula, e `sincronizacao` fica `pendente`.
- **No site:** as rotas de 9.1 estão no branch `be/integracao-gestao` do `nexus` (v0.18.0, seção 19 do contrato do site), com a assinatura de 9.2, duas chaves para a troca e o 404 pelo proxy. O site devolve o `status` dos planos como `ativo`, `pausado` ou `rascunho`, e a gestão trata os dois últimos como pausados.
- **Na VPS (homologação), ligada em 22/10/2026:** a mesma chave `k1` está no `.env` do site (`INTEGRACAO_CHAVES`) e no da gestão (`INTEGRACAO_CHAVE_ID` e `INTEGRACAO_CHAVE`). O app da gestão entra também na rede do site (`nexus_default`) e chama `SITE_API_URL=http://nexus-app-1:4183`, pelo nome do contêiner, porque os dois projetos têm um serviço `app`. Pelo mesmo motivo, o `DATABASE_URL` da gestão usa `sistema-nexus-db-1`, e não `db`, que na rede do site é o banco do site. A regra do Traefik do site exclui `/api/integracao`. O compose está em `scripts/deploy/docker-compose.exemplo.yml`, e o passo a passo no `docs/OPERACAO.md` do site.
- **Detalhes da assinatura (9.2):** a chave é usada como bytes (os 32 bytes do hex). O caminho assinado é exatamente o da requisição, com a query como foi enviada. O carimbo vai em segundos, como texto decimal, e o corpo entra como os bytes enviados.

### 9.5 Fase 2: a "Minha assinatura" e as métricas do site (v0.9.0)

*v0.9.0.* O lado do site está na seção 19.6 do contrato dele (v0.19.0). Os leads ficam para depois da revisão de segurança.

**"Minha assinatura" no painel do afiliado (D8)**

- O afiliado nunca entra na gestão. Ele vê a própria assinatura no painel do site, na seção "Minha assinatura", no lugar do "O que contratei?", só com os papéis `dono` e `financeiro` daquela empresa.
- O PUT do plano (9.1) leva o campo `minhaAssinatura`, junto com o plano:

```json
{
  "plano": "plano-premium",
  "gerida": true,
  "assinatura": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
  "motivo": "pagamento",
  "minhaAssinatura": {
    "plano": {"id": "plano-premium", "nome": "Premium"},
    "valorCentavos": 9900,
    "ciclo": "mensal",
    "venceEm": "2026-11-15",
    "status": "ativa",
    "ultimosPagamentos": [
      {"pagoEm": "2026-10-20", "valorCentavos": 9900, "forma": "pix", "referencia": {"de": "2026-10-15", "ate": "2026-11-14"}}
    ],
    "comoPagar": {"chavePix": "pix@exemplo.test", "whatsapp": "5521900000000"}
  }
}
```

- `minhaAssinatura` é a assinatura não cancelada da empresa, se a empresa ainda está vinculada a um cliente. Sem assinatura não cancelada, ou depois do desvínculo, vai `null`, e o site apaga o que tinha.
- `status` é `ativa` ou `suspensa`. A situação que o afiliado vê (em dia, a vencer, vencida ou suspensa), o site calcula todo dia a partir de `venceEm`. A gestão não manda "inadimplente": para o afiliado, a assinatura está vencida.
- `ultimosPagamentos` são até 3, os mais recentes não estornados (pelo `pagoEm` e, no empate, pelo registro), do mais novo para o mais velho, com o período pago (`referencia`, 6.10).
- `comoPagar` traz a chave Pix e o WhatsApp do atendimento das Configurações (6.14). Cada um vem `''` quando não foi definido.
- **Nenhum dado de outro cliente nem da equipe sai da gestão:** nada do cliente (nome, responsável, e-mail, WhatsApp, notas), nada das outras empresas do mesmo cliente, nenhum nome da equipe, nenhuma observação de pagamento, nenhum motivo de suspensão ou cancelamento e nenhuma mensagem de cobrança.
- O conteúdo é montado **na hora do envio**, não na hora em que o pedido entra na fila. Como "só o último vale" (9.3), o site sempre recebe o estado atual.
- Entram na fila, além dos eventos de 9.3:
  - a edição do valor ou do ciclo, que antes não mexia no plano (motivo `edicao`);
  - a mudança da chave Pix ou do WhatsApp do atendimento, que põe na fila todas as empresas com assinatura não cancelada (motivo `configuracao`).
- **Ordem de publicação:** o site da v0.19.0 vai antes da gestão da v0.9.0. O site da v0.18.0 recusa o campo novo (`422`), e a fila tentaria de novo, com a espera de 9.3, até o site ser atualizado.

**Métricas do site para os Indicadores (D9)**

- A gestão lê do site os totais de audiência e de contatos com `GET /api/integracao/v1/metricas?de=aaaa-mm&ate=aaaa-mm&page=` (19.6), dos 12 meses dos Indicadores, página a página.
- A leitura roda na rotina diária: o `sincronizar-planos --aplicar` (às 05:00 de São Paulo) também lê as métricas, e o comando `metricas` lê na hora (10).
- A cópia fica na tabela `site_metrics`, com a hora da leitura. Se a leitura falha, a cópia anterior continua, e os Indicadores mostram a data dela. Os Indicadores e a ficha nunca chamam o site.
- Cada leitura entra na auditoria (`metricas_lidas`, por `null`), com o período, quantas empresas vieram e o erro, se houve.
- A rota só lê. A integração continua sem gravar nada no site além do plano e da "Minha assinatura".
- *v0.10.0:* a ficha do cliente (o desempenho, 6.7) e a mensagem de renovação (a variável `{desempenho}`, 7.3) também usam a cópia, com as visitas e os contatos por canal de cada empresa mês a mês (`empresas.itens[].meses`, que a rota do site já traz desde a v0.19.0). A rota do site não muda, e só a gestão é publicada.
- *v0.11.0:* o relatório do mês é uma página do painel do site (seção 20 do contrato dele, v0.20.0), que lê as somas diárias do próprio site. A gestão não lê nem guarda os números do relatório: só monta o endereço da página (`relatorio.empresas[].url`, 6.7) e a frase do `{desempenho}`, da cópia. **Ordem de publicação:** o site da v0.20.0 antes da gestão da v0.11.0. Com o site anterior, o link do relatório daria "página não encontrada" depois do login.
- *v0.12.0:* a ficha aponta, em cada empresa, para a lista de acessos ao painel do admin do site (seção 21 do contrato dele, v0.21.0), só pelo endereço. A integração não muda: nada de convite, de lista de acessos ou de link passa por ela. **Ordem de publicação:** o site da v0.21.0 antes da gestão da v0.12.0. Com o site anterior, o endereço abre o admin sem o módulo de acessos.

## 10. CLI

`node api/cli.mjs <comando>`, dentro do contêiner na VPS.

| Comando | O que faz | Quando |
| --- | --- | --- |
| `migrate` | aplica as migrações | já existe |
| `backup [--stdout]` | backup criptografado (AES-256-GCM) com a `BACKUP_PASSPHRASE`, sem hash de senha nem segredo do 2FA | já existe |
| `restore ARQUIVO` | restaura num banco vazio e já migrado. As contas voltam sem senha e sem 2FA. | já existe |
| `admin EMAIL [NOME]` | cria a conta de admin, ou promove e reativa a que existe, e imprime o link, pela regra de 4.2 (convite de 72 horas sem senha, link de 1 hora com senha). A senha nunca passa pela linha de comando. | v0.2.0 |
| `link-senha EMAIL` | imprime um link novo, pela mesma regra | v0.2.0 |
| `reset-2fa EMAIL` | pede o e-mail de novo no terminal e redefine o 2FA (4.7) | v0.2.0 |
| `sincronizar-planos [--aplicar]` | mostra as empresas vinculadas, as divergências com o site e as que o site não conhece, sem mudar nada. Com `--aplicar`, faz a rotina diária de 9.3 e, desde a v0.9.0, também lê as métricas do site (9.5). Sem a integração configurada, para com erro. O timer das 05:00 de São Paulo está em `scripts/integracao/` e, desde 22/10/2026, instalado na VPS. | v0.5.0 |
| `metricas` | lê na hora as métricas do site dos 12 meses dos Indicadores e guarda a cópia (9.5). Sem a integração configurada, para com erro. | v0.9.0 |
| `leads` | lê na hora os pedidos novos do cadastro do site (14.3). Com a chave dos leads desligada, para com aviso; sem a integração configurada, para com erro. Com a chave ligada, o `sincronizar-planos --aplicar` também lê os pedidos. | v0.13.0 |
| `limpar` | marca como expiradas as prévias vencidas (e apaga as linhas delas) e apaga os links usados ou vencidos, os logins pendentes vencidos, as sessões vencidas e os limites antigos. Roda na rotina diária. | v0.7.0 |

O pacote de backup diário está em `scripts/backup/`, com instalação e recuperação descritas em `docs/OPERACAO.md`. Não é ativado pelo deploy: depende de credencial, destino externo e instalação do serviço/timer. A rotina só considera sucesso depois de restaurar em banco isolado e validar a cópia externa; a retenção local ocorre depois dessas verificações. O backup lê tabelas e migrações em uma transação `REPEATABLE READ READ ONLY`, mantendo um único estado durante escritas concorrentes. Guarda-se também o código/imagem compatível com as migrações para recuperação.

## 11. Variáveis de ambiente e segredos **[SEG]**

Os segredos ficam só no `.env` da VPS (`chmod 600`). Nunca entram no repositório, na tela, nos logs nem nas mensagens de erro.

| Variável | Para quê | Segredo |
| --- | --- | --- |
| `NODE_ENV`, `HOST`, `PORT` | execução (`production`, `0.0.0.0`, `4184`). A porta padrão foi `4190` até a v0.7.1, mas ela está na lista de portas bloqueadas do `fetch` e dos navegadores. | não |
| `PUBLIC_ORIGIN` | origem da gestão, https em produção **[P8]** | não |
| `DATABASE_URL` | PostgreSQL próprio da gestão, com usuário próprio | sim: a senha do banco |
| `SITE_PUBLIC_ORIGIN` | origem pública do site (miniaturas, "Ver no guia" e a CSP) | não |
| `SITE_API_URL` | endereço interno do site na rede do Docker | não |
| `TOTP_KEY` | 32 bytes em hex. Cifra os segredos do 2FA. Girar exige recifrar ou redefinir o 2FA de todos (a definir no `SEGURANCA.md`). Em produção é obrigatória: sem ela, o servidor não sobe. Fora de produção, sem a variável, vale uma chave fixa de desenvolvimento, com aviso no log. | sim |
| `INTEGRACAO_CHAVE_ID`, `INTEGRACAO_CHAVE` | id e chave (32 bytes em hex) do HMAC da integração, iguais no `.env` do site | sim: a chave |
| `BACKUP_PASSPHRASE` | senha do backup, só no arquivo do backup diário da VPS, com cópia num gerenciador de senhas | sim |
| `LEADS_LIGADOS` | liga os interessados (14.1) com o valor `1`. Desligada por padrão e na homologação até a revisão de segurança. Precisa estar também no `environment` do compose. | não |

## 12. Provisórios

| Marca | O que vale até a resposta | Onde |
| --- | --- | --- |
| **[P1]** | Pix manual, com a chave em Configurações; modelo da mensagem de 6.14, a frase do `{desempenho}` de 7.3 e o modelo da mensagem do relatório do mês (v0.11.0); formas de pagamento de 5.2; as etapas da régua, os nomes delas, a etapa de 30 dias no ciclo mensal e o padrão sem modelo próprio por etapa (v0.14.0) | 5.2, 6.10, 6.14, 7.3, 15.1, 15.4 |
| **[P2]** | Tolerância de 10 dias. Depois dela, e também na suspensão e no cancelamento, a empresa volta a não ter plano pago (`plano: null`) e continua no guia. | 5.3, 9.3 |
| **[P3]** | Sem CPF e sem CNPJ | 2.1, 5.2 |
| **[P4]** | Lucas como admin; os demais papéis definidos por ele | 4.1 |
| **[P5]** | Sem data para o corte do eDirectory. Não muda o contrato. | — |
| **[P6]** | O bônus CONECTA Nexus fica como anotação livre em `notas` da assinatura até a Fase 3 | 5.2 |
| **[P7]** | Colunas da exportação do eDirectory e da planilha; o preço do plano quando o arquivo não tem valor; o ciclo mensal; o início recuado um ciclo | 8.2 |
| **[P8]** | Homologação no host da VPS, como o site; produção em `gestao.nexusdivulgacao.com.br` (`PUBLIC_ORIGIN`) | 11 |
| **[SEG]** | Cabeçalhos, CSP e logs; tabela de papéis; senha, sessão (30 minutos e 8 horas), 2FA, limites e reautenticação; exclusão da LGPD; defesa contra fórmula; HMAC e regra de rede da integração; segredos; os interessados: base legal, texto do cadastro, guarda, perdido, exclusão, papéis, backup e auditoria (14.9) | 2.5, 2.6, 3.1, 4, 7.5, 8.5, 9.2, 11, 14 |

## 13. Fora da Fase 1

- Leads e o `/cadastro` do site enviando para a gestão (Fase 2). *v0.13.0:* construídos e desligados até a revisão de segurança (seção 14).
- Métricas do site na gestão e relatório para o anunciante (Fase 2).
- Gateway de pagamento, Pix com webhook, régua de lembretes e o bônus CONECTA Nexus no sistema (Fase 3). *v0.14.0:* a régua de lembretes, sem envio automático (seção 15).
- Nota fiscal, cobrança automática e app.
- E-mail. Os links vão pelo WhatsApp, e o "esqueci a senha" é pelo admin.
- Trocar a própria senha e gerar novos códigos de recuperação pela tela. Por enquanto, isso é feito com o link de senha e a redefinição do 2FA pelo admin.
- Exportação em CSV.

## 14. Interessados: os leads, desligados (v0.13.0)

*v0.13.0.* O item "Leads" da Fase 2 do plano. Ele foi construído só com dados de teste e fica **desligado** até a revisão de segurança, como a Fase 1 pela D7. O lado do site está na seção 23 do contrato dele (v0.23.0): com a chave ligada lá, cada envio do `/cadastro` ganha um código, como `A7K3`, que vai no fim da mensagem do WhatsApp ("Pedido A7K3"), e o site guarda só o código, as respostas, a origem e a hora. Tudo o que a revisão precisa decidir antes de ligar está marcado **[SEG]** e listado em 14.9.

### 14.1 A chave

- `LEADS_LIGADOS` no `.env` da gestão, que também precisa passar pelo `environment` do `docker-compose.yml`. Ela vem **desligada por padrão**: só liga com o valor `1`. Não há tela de configuração (D3).
- **Desligada:**
  - as rotas de 14.4 e as páginas de 14.5 respondem `404`, como uma rota que não existe, mesmo para quem tem a ação;
  - a moldura traz `modulos.interessados: false`, e o menu não mostra o módulo;
  - a rotina diária e o comando `leads` não leem nada do site;
  - os Indicadores trazem `funil: null`.
- Na homologação e na produção, ela continua desligada até a revisão de segurança **[SEG]**. Ligar mexe na configuração da VPS, que fica com o usuário e o colaborador.

### 14.2 Modelo

A migração `008_leads.sql` cria:

| Tabela | Campos | Regras |
| --- | --- | --- |
| `leads` | `id, codigo, texto, respostas, origem, pedido_em, recebido_em, nome, whatsapp, situacao, motivo_perda, perdido_em, proxima_acao, proxima_em, notas, client_id, virou_cliente_em, atualizado_em, version` | O pedido é o `codigo` mais o `pedido_em` (únicos juntos): o site apaga o pedido depois de 30 dias e pode sortear o mesmo código de novo. `texto`, `respostas`, `origem` e `pedido_em` vêm do site. `nome` e `whatsapp` a equipe completa quando a pessoa escreve (o `whatsapp` no formato de 7.2). `situacao`: `novo`, `em-conversa`, `proposta`, `cliente` ou `perdido`. `motivo_perda` e `perdido_em` só no `perdido`. `client_id` e `virou_cliente_em` só no `cliente`. |
| `lead_leituras` | `id, cursor, lido_em, erro, tentado_em` | Uma linha só (`id = 1`): até onde a gestão já leu os pedidos do site (`cursor`, a hora do último pedido lido), a hora da última leitura e o erro da última tentativa que falhou. |

- **Backup [SEG]:** as duas tabelas ainda não estão no backup da gestão (`api/backup.mjs`), que é do colaborador. Elas guardam dado pessoal (`nome` e `whatsapp`), então a revisão decide se e como elas entram, antes de ligar.

### 14.3 A leitura dos pedidos

- **Quem lê:**
  - a rotina diária: o `sincronizar-planos --aplicar` também lê os pedidos, como lê as métricas (10);
  - o comando `leads`, na hora;
  - o "Buscar agora" da tela, `POST /api/leads/buscar`.
- A gestão chama `GET /api/integracao/v1/pedidos?desde=<cursor>` (23.3 do site).
  - Sem `cursor` (a primeira leitura), `desde` é 31 dias atrás, um dia além da guarda proposta no site.
  - Com mais de uma página, cada volta pede de novo a primeira, com `desde` na hora do último pedido lido. Assim um pedido apagado ou criado no meio da leitura não desloca os outros.
  - Cada pedido novo vira um lead `novo`. O que a gestão já tem (o mesmo código e a mesma hora) é ignorado; o mesmo código com outra hora é outro pedido.
  - O `cursor` passa a ser a hora do pedido mais novo lido, e nunca volta para trás.
  - Se o site responde `404` (a chave desligada lá), a leitura falha com o erro "Os pedidos estão desligados no guia.".
- **Se a leitura falha,** o `cursor` fica onde estava, e `lead_leituras` guarda o erro e a hora da tentativa. A próxima leitura começa do mesmo ponto.
- Cada leitura entra na auditoria (`leads_lidos`, com quantos novos e o erro, se houve), por quem pediu ou por `null`, na rotina.
- Desligada (14.1), nenhuma leitura acontece: o "Buscar agora" responde `404`, e o comando para com o aviso "Os interessados estão desligados (LEADS_LIGADOS).".

### 14.4 APIs

Todas pedem a ação `clientes` (3.1: `admin` e `comercial`). Com a chave desligada, todas respondem `404`.

| Rota | Entrada | Saída |
| --- | --- | --- |
| `GET /api/leads` | `?q=&situacao=&page=` | lista de LeadLinha (2.2), mais `leitura` |
| `GET /api/leads/:id` | — | Lead |
| `PATCH /api/leads/:id` | `{nome?, whatsapp?, situacao?, motivoPerda?, proximaAcao?, proximaEm?, notas?, version}` | Lead |
| `POST /api/leads/:id/cliente` | `{version}` | `201 {lead: Lead, cliente:{id, nome}}` |
| `POST /api/leads/buscar` | `{}` | `{novos, erro}` |

- **Lista:**
  - `q` acha pelo código (sem maiúscula, também só o começo dele, e "Pedido A7K3" como vem na mensagem), pelo nome ou por 4 ou mais dígitos do WhatsApp; `situacao` filtra pela situação;
  - a ordem é a do pedido mais novo para o mais velho;
  - **LeadLinha** `{id, codigo, nome, whatsapp, situacao, pedidoEm, proximaAcao, proximaEm}`;
  - `leitura` `{lidoEm, erro, tentadoEm}` diz como foi a última leitura dos pedidos: a hora da última que deu certo, o erro da última tentativa (`''` quando deu certo) e a hora dela. Sem nenhuma leitura, os três vêm `null`, `''` e `null`.
- **Lead** `{id, codigo, texto, respostas, origem, pedidoEm, recebidoEm, nome, whatsapp, situacao, motivoPerda, perdidoEm, proximaAcao, proximaEm, notas, cliente:{id, nome}|null, virouClienteEm, atualizadoEm, version}`. `respostas` são as do cadastro (17.1 do site), como `{ramo, local, plano, canais, novidades}`; `texto` é a mensagem que a pessoa mandou, com elas por extenso.

Exemplo da lista (`GET /api/leads`), com dados fictícios:

```json
{
  "itens": [
    {"id": "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e41", "codigo": "C4MN", "nome": "", "whatsapp": "", "situacao": "novo", "pedidoEm": "2026-10-20T09:30:00.000Z", "proximaAcao": "", "proximaEm": null},
    {"id": "6d2e3f4a-5b6c-4d7e-9f80-a1b2c3d4e5f2", "codigo": "A7K3", "nome": "Marta Souza", "whatsapp": "5521987654321", "situacao": "em-conversa", "pedidoEm": "2026-10-19T14:00:00.000Z", "proximaAcao": "Mandar a tabela de planos", "proximaEm": "2026-10-22"}
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1,
  "leitura": {"lidoEm": "2026-10-20T08:00:03.000Z", "erro": "", "tentadoEm": "2026-10-20T08:00:03.000Z"}
}
```

Exemplo do Lead (`GET /api/leads/:id`):

```json
{
  "id": "6d2e3f4a-5b6c-4d7e-9f80-a1b2c3d4e5f2",
  "codigo": "A7K3",
  "texto": "Olá, Lucas! Tenho interesse em me tornar afiliado ao Nexus.\n\nMeu negócio é do ramo de alimentação. Ele fica em Nova Iguaçu.\n\nQuero ajuda para escolher o melhor plano.\n\nEnviado pelo site site.exemplo.test\nPedido A7K3",
  "respostas": {"ramo": "alimentacao", "local": "nova-iguacu", "plano": "conhecer"},
  "origem": "plano-premium",
  "pedidoEm": "2026-10-19T14:00:00.000Z",
  "recebidoEm": "2026-10-20T08:00:03.000Z",
  "nome": "Marta Souza",
  "whatsapp": "5521987654321",
  "situacao": "em-conversa",
  "motivoPerda": "",
  "perdidoEm": null,
  "proximaAcao": "Mandar a tabela de planos",
  "proximaEm": "2026-10-22",
  "notas": "Padaria em Austin.",
  "cliente": null,
  "virouClienteEm": null,
  "atualizadoEm": "2026-10-20T11:40:00.000Z",
  "version": 2
}
```
- **PATCH:**
  - `nome` de 2 a 160 caracteres, ou `''`; `whatsapp` como em 7.2; `proximaAcao` até 200; `proximaEm` uma data `aaaa-mm-dd`, ou `null`; `notas` até 2.000;
  - `situacao` só muda para `novo`, `em-conversa`, `proposta` ou `perdido`. O `cliente` só vem pelo "Virar cliente";
  - `perdido` exige `motivoPerda`, de 3 a 200 caracteres (`422 {campo:'motivoPerda'}`), e grava `perdidoEm`. Sair do `perdido` apaga o motivo e a data;
  - o lead que já virou cliente não muda de situação (`422 {campo:'situacao'}`);
  - a auditoria registra `lead_editado`, com os campos mudados.
- **Virar cliente:**
  - cria o cliente (6.8) com o `nome` e o `whatsapp` do lead e liga o lead a ele (`situacao: 'cliente'`, `virouClienteEm`);
  - o lead sem nome responde `422 {erro:'Complete o nome antes de virar cliente.', campo:'nome'}`, e o que já virou cliente responde `422 {campo:'situacao'}`;
  - a auditoria registra `cliente_criado`, como na criação pela tela, e `lead_convertido`.

### 14.5 Páginas e moldura

| Caminho | View | Permissão | `dados` |
| --- | --- | --- | --- |
| `/interessados?q=&situacao=&page=` | `interessados` | `clientes` | o que `GET /api/leads` devolve, com a `leitura`; `filtros` traz `{q, situacao, page}` |
| `/interessados/<id>` | `interessado` | `clientes` | o Lead |

- Com a chave desligada, as duas páginas respondem `404`.
- Os títulos são `Interessados` e `Pedido <código> · Interessados`.
- **A moldura (6.1) ganha `modulos: {interessados}`:** `true` com a chave ligada e a ação `clientes`. O menu mostra "Interessados" só com ele.

### 14.6 O funil nos Indicadores

`GET /api/indicadores` (6.17) ganha `funil`, ou `null` com a chave desligada: `{como, meses:[{mes, novos, convertidos, perdidos, parcial}], motivosPerda:[{motivo, qtd}], tempoAteCliente:{convertidos, medianaDias}}`.

- `meses` são os 12 dos Indicadores. `novos` conta os pedidos pela hora do pedido no site; `convertidos`, pela hora em que viraram cliente; `perdidos`, pela hora em que foram dados como perdidos.
- `motivosPerda` junta os perdidos dos 12 meses pelo texto do motivo (sem acento, maiúscula nem pontuação), até 10, do mais comum para o menos. O `motivo` mostrado é a escrita do perdido mais recente do grupo.
- `tempoAteCliente` usa os convertidos dos 12 meses: quantos são e a mediana dos dias (no fuso de São Paulo) entre o pedido e a conversão. Com um número par de convertidos, a mediana é a média dos dois do meio e pode ter meio dia. Sem nenhum, `medianaDias` vem `null`.
- O bloco só tem números, sem nome nem WhatsApp. Por isso todo papel com `ver` o vê, como os outros blocos.

Exemplo do `funil` (com a chave ligada), com os meses encurtados para os três últimos:

```json
{
  "como": "Pedidos do cadastro do site pelo mês do pedido, convertidos pelo mês em que viraram cliente e perdidos pelo mês em que foram dados como perdidos. Os motivos e o tempo até virar cliente contam os 12 meses.",
  "meses": [
    {"mes": "2026-08", "novos": 1, "convertidos": 1, "perdidos": 0, "parcial": false},
    {"mes": "2026-09", "novos": 1, "convertidos": 1, "perdidos": 0, "parcial": false},
    {"mes": "2026-10", "novos": 4, "convertidos": 0, "perdidos": 3, "parcial": true}
  ],
  "motivosPerda": [{"motivo": "Preço alto", "qtd": 2}, {"motivo": "Sem resposta", "qtd": 1}],
  "tempoAteCliente": {"convertidos": 2, "medianaDias": 7}
}
```

### 14.7 Papéis

- **Quem vê e quem mexe nos interessados:** a ação `clientes` da matriz que já existe (3.1), ou seja, `admin` e `comercial`. Eles completam o nome e o WhatsApp, mudam a situação, marcam a próxima ação, escrevem as notas, buscam os pedidos e viram o lead em cliente.
- **`financeiro` e `leitura` não veem a lista nem o pedido**, porque eles trazem dado de quem ainda não é cliente. Eles veem o funil dos Indicadores, que só tem números.
- A tabela de 3.1 não muda.

### 14.8 CLI e rotina

- `leads`: lê na hora os pedidos novos do site (14.3). Sem a chave, para com o aviso de 14.3; sem a integração configurada, para com erro.
- `sincronizar-planos --aplicar` (a rotina diária) também lê os pedidos, com a chave ligada.

### 14.9 O que a revisão de segurança decide antes de ligar **[SEG]**

1. **A base legal** para guardar as respostas do cadastro no site e, na gestão, o nome e o WhatsApp de quem ainda não é cliente.
2. **O texto que o visitante vê no cadastro** sobre o código, a guarda das respostas e o uso delas. Nenhum texto foi escrito: o contrato não inventa texto jurídico (23.2 do site).
3. **O prazo de guarda no site:** a proposta é 30 dias (23.2 do site).
4. **O prazo de guarda na gestão:** quanto tempo o lead fica, nas situações `novo`, `em-conversa` e `proposta`, sem a pessoa virar cliente. Hoje não há prazo nem limpeza automática.
5. **O lead perdido:** se ele é apagado, se fica sem o nome e o WhatsApp depois de um prazo, ou se fica como está (hoje fica, com o motivo).
6. **O pedido de exclusão:** como a pessoa pede, quem atende e o que sai nos dois lados. Hoje não há rota para apagar um lead, nem no site para apagar um pedido antes do prazo.
7. **Quem vê:** a proposta é a ação `clientes` (`admin` e `comercial`, 14.7).
8. **O backup das tabelas novas** na gestão (14.2) e a guarda delas no backup do site.
9. **A auditoria:** o `lead_editado` registra o nome e o WhatsApp mudados, como a auditoria do cliente já faz. A revisão confirma se isso vale para quem ainda não é cliente.
10. **Ligar as chaves** nos dois `.env` e nos dois `docker-compose.yml`, nessa ordem: primeiro o site, depois a gestão.

### 14.10 Ordem de publicação e o que muda para o front

- **Ordem de publicação:** primeiro o site da v0.23.0, depois a gestão da v0.13.0. As duas chaves continuam desligadas, então nada muda para o visitante nem para a equipe. Para ligar, depois da revisão, também o site vem antes.
- **O que o front faz:**
  - a página `interessados`, com a busca (pelo código, que é o que a pessoa manda no WhatsApp), o filtro pela situação, a paginação, o "Buscar agora" (que mostra quantos chegaram, ou o `erro`) e a última leitura (`leitura`), com o erro quando houver;
  - a página `interessado`, com o texto do pedido, o nome e o WhatsApp para completar, a situação (com o motivo no `perdido`), a próxima ação com a data, as notas e o "Virar cliente". Depois de virar cliente, ela leva à ficha do cliente;
  - o item "Interessados" no menu, só com `modulos.interessados`;
  - o bloco do funil nos Indicadores, quando `funil` não for `null`.

## 15. Régua de lembretes (v0.14.0)

*v0.14.0.* O item "Régua de lembretes de 30, 15, 7 e 1 dia" da Fase 3 do plano, **sem envio automático**. A gestão diz quem lembrar hoje e monta a mensagem; a equipe abre o WhatsApp pelo link e registra o contato, como na cobrança (7.4). Nada é enviado sozinho, e nenhuma rotina nova roda: a lista muda à meia-noite de São Paulo, porque os `dias` (5.3) mudam. A cobrança da vencida continua como está (6.5 e 7.4).

### 15.1 As etapas **[P1]**

As etapas ficam no código (`api/lib/regua.mjs`), sem tela para configurar (D3). O Lucas confirma os dias e os nomes:

| `dias` da etapa | Nome |
| --- | --- |
| `30` | 30 dias antes |
| `15` | 15 dias antes |
| `7` | 7 dias antes |
| `1` | 1 dia antes |
| `0` | No dia do vencimento |

- **A etapa de uma assinatura** só existe com o `status` ativa e os `dias` (5.3) de 0 a 30. Ela é a etapa mais próxima do vencimento entre as que já começaram, isto é, a menor etapa que é maior ou igual aos `dias`:
  - com 20 dias, a etapa é a de 30;
  - com 5, a de 7;
  - com 1, a de 1;
  - com 0, a do dia.
- **Fora da régua,** a `etapa` é `null`: com mais de 30 dias, vencida, inadimplente, suspensa ou cancelada.
- **Quem pulou etapas aparece só na etapa atual, uma vez.** Por exemplo, a assinatura que vinha sem lembrete e já está a 5 dias aparece só na etapa de 7 dias, sem a de 30 e a de 15.
- **Pergunta para o Lucas [P1]:** no ciclo mensal, o vencimento novo fica a 28 a 31 dias do anterior. Por isso a etapa de 30 dias cai no dia do pagamento ou logo depois dele. Até a resposta, ela vale para todo ciclo, como as outras.

### 15.2 Lembrar hoje

**A lista** tem as assinaturas ativas que estão numa etapa (15.1) e que ainda não receberam o lembrete dela no vencimento atual (15.3).
- A ordem é a de 6.5: do vencimento mais próximo para o mais distante, e no empate, pelo nome do cliente.
- O cliente sem WhatsApp também entra, com `linkWhatsapp: null`, como em 6.5, para a equipe completar o WhatsApp.

**Cada item** é uma Renovacao (6.5) com a `etapa`:
- o cliente, a empresa, o plano, o valor, o ciclo, o vencimento, os `dias`, a situação, o último contato e a `version`;
- o `linkWhatsapp`, com a mensagem da etapa (15.4).

**Onde aparece:** na janela `lembrar` das Renovações e no `lembrarHoje` do Resumo (15.5).

### 15.3 O registro

- **A rota é a mesma da cobrança,** `POST /api/assinaturas/:id/contatos`, com o corpo `{}` (7.4).
  - Com a assinatura a vencer, o contato `lembrete` passa a guardar a `etapa` do dia do registro. Quem calcula é o servidor, e a tela não manda nada.
  - O lembrete com mais de 30 dias e a cobrança da vencida ficam com `etapa: null`.
- **O Contato** (7.4) ganha `etapa`, um número ou `null`. Ela aparece também na linha do tempo da ficha (6.7), que ganha a lista `etapas` com os nomes, e no `ultimoContato` da Renovacao, que fica `{em, por, tipo, etapa}`.
- **A auditoria** `cobranca_registrada` ganha a `etapa` no `depois`, quando há.
- **A etapa registrada não volta para a lista:** depois do registro, a mesma etapa da mesma assinatura e do mesmo vencimento sai de "Lembrar hoje". Registrar de novo continua permitido, e cada toque fica registrado, como antes.
- **Pagar ou mudar o vencimento recomeça a régua do vencimento novo.**
  - Só contam os lembretes com o `contacts.vence_em` igual ao vencimento atual, a mesma regra do `ultimoContato` (6.5).
  - O pagamento avança o vencimento, e a régua recomeça da etapa em que o vencimento novo estiver.
  - O estorno traz de volta o vencimento anterior e os lembretes dele.
- **A migração `009_regua_lembretes.sql`:**
  - acrescenta `contacts.etapa`, que aceita `0`, `1`, `7`, `15`, `30` ou `null` e só existe no `lembrete`;
  - calcula a etapa dos lembretes registrados antes da v0.14.0, pela mesma regra, com o dia em que foram feitos (em São Paulo) e o vencimento lembrado. Assim, quem já foi lembrado não volta para a lista quando a versão for publicada.

### 15.4 As mensagens

- **Um modelo por etapa,** opcional, em `settings.modelos_lembrete` (migração 009).
  - A etapa sem modelo próprio usa o modelo de cobrança (`modeloMensagem`, 6.14).
  - O padrão da instalação é **nenhuma etapa com modelo próprio** **[P1]**: todas usam o modelo de cobrança, que já é **[P1]**, e nada muda até o Nexus escrever os textos dela. Nenhum texto novo foi escrito.
- **As variáveis** são as mesmas de `variaveis` (6.14), inclusive o `{desempenho}`, com as regras de 7.3. O `{prazo}` sai "vence em 24/10/2026" ou "vence hoje".
- **O modelo da etapa vale em toda Renovacao que tem `etapa`:** "Lembrar hoje", as janelas `7`, `15` e `30` das Renovações e o `cobrarHoje` do Resumo. Assim, a mesma assinatura tem a mesma mensagem no mesmo dia em qualquer lista. As vencidas continuam com o `modeloMensagem`.
- **`GET /api/configuracoes`** ganha `etapas` e `modelosLembrete`.
  - `etapas` é a lista de 15.1, `[{dias, nome}]`, na ordem da régua.
  - `modelosLembrete` traz uma chave para cada etapa, com o texto ou com `''`, que quer dizer "sem modelo próprio". As chaves são os dias em texto, e o JSON as ordena como números; a ordem para mostrar é a de `etapas`.
- **`PATCH /api/configuracoes`** aceita `modelosLembrete` só com as etapas que mudaram, como o resto do PATCH, sem reautenticação.
  - `''` tira o modelo próprio da etapa.
  - O texto tem de 20 a 1.000 caracteres, só com as variáveis de `variaveis`: `422 {erro, campo:'modelosLembrete.<dias>'}`, com as mensagens de 7.2.
  - Uma chave que não é etapa responde `422 {erro:'Etapa desconhecida: <chave>.', campo:'modelosLembrete'}`.
  - A mudança entra na auditoria `configuracoes_editadas`, com o antes e o depois de `modelosLembrete`.

O que as Configurações ganham:

```json
{
  "etapas": [
    {"dias": 30, "nome": "30 dias antes"},
    {"dias": 15, "nome": "15 dias antes"},
    {"dias": 7, "nome": "7 dias antes"},
    {"dias": 1, "nome": "1 dia antes"},
    {"dias": 0, "nome": "No dia do vencimento"}
  ],
  "modelosLembrete": {"0": "", "1": "", "7": "", "15": "", "30": ""}
}
```

### 15.5 Resumo e Renovações

- **Resumo** (6.4): ganha `lembrarHoje`, quantos itens "Lembrar hoje" tem, sem o limite de 50 do `cobrarHoje`. Os itens do `cobrarHoje` ganham a `etapa`, e a resposta ganha `etapas` (15.1), para a tela mostrar o nome da etapa do último contato.
- **Renovações** (6.5):
  - a janela `lembrar` é a lista de 15.2, com `filtros: {janela:'lembrar', page}` e a paginação de sempre;
  - a `contagem` ganha `lembrar`;
  - a resposta ganha `etapas` (15.4), em qualquer janela, para a tela mostrar o nome da etapa;
  - toda Renovacao ganha `etapa`, que é `null` nas vencidas.
- **Os papéis** são os de 6.5 e 7.4:
  - todo papel vê a lista e a contagem;
  - o `linkWhatsapp` e o registro são só de quem tem a ação `cobrar`;
  - os modelos são da ação `configuracoes`.

`GET /api/renovacoes?janela=lembrar`, com o hoje de 20/10/2026. A Padaria recebeu o lembrete de 15 dias em 09/10 e agora está na etapa de 7; a Clínica, a 26 dias, está na de 30. Nenhuma das duas etapas tem modelo próprio, então a mensagem é a do modelo de cobrança:

```json
{
  "janela": "lembrar",
  "contagem": {"vencidas": 2, "ate7": 1, "ate15": 1, "ate30": 4, "lembrar": 2},
  "etapas": [
    {"dias": 30, "nome": "30 dias antes"},
    {"dias": 15, "nome": "15 dias antes"},
    {"dias": 7, "nome": "7 dias antes"},
    {"dias": 1, "nome": "1 dia antes"},
    {"dias": 0, "nome": "No dia do vencimento"}
  ],
  "itens": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03",
      "cliente": {"id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52", "nome": "Padaria Pão Dourado", "responsavel": "Carlos Lima", "whatsapp": "5521900000002"},
      "empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado", "miniatura": "", "url": "https://nexus.demo/comercio/padaria-pao-dourado"},
      "plano": {"id": "plano-avancado", "nome": "Avançado"},
      "valorCentavos": 18000,
      "ciclo": "trimestral",
      "venceEm": "2026-10-24",
      "dias": 4,
      "situacao": "a-vencer",
      "etapa": 7,
      "ultimoContato": {"em": "2026-10-09T14:05:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}, "tipo": "lembrete", "etapa": 15},
      "linkWhatsapp": "https://wa.me/5521900000002?text=Ol%C3%A1%2C%20Carlos%20Lima!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Avan%C3%A7ado%20da%20Padaria%20P%C3%A3o%20Dourado%20vence%20em%2024%2F10%2F2026%2C%20no%20valor%20de%20R%24%20180%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 1
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
      "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena", "responsavel": "Marina Souza", "whatsapp": "5521900000001"},
      "empresa": {"id": "clinica-vida-plena-austin", "nome": "Clínica Vida Plena · Austin", "miniatura": "https://nexus.demo/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-austin"},
      "plano": {"id": "plano-avancado", "nome": "Avançado"},
      "valorCentavos": 6700,
      "ciclo": "mensal",
      "venceEm": "2026-11-15",
      "dias": 26,
      "situacao": "a-vencer",
      "etapa": 30,
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Avan%C3%A7ado%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Austin%20vence%20em%2015%2F11%2F2026%2C%20no%20valor%20de%20R%24%2067%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 4
    }
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1
}
```

### 15.6 O que o front faz

- **Renovações:**
  - a janela "Lembrar hoje", com a `contagem.lembrar`, junto das que já existem;
  - em cada item, o nome da etapa (de `etapas`) e o último contato, com a etapa dele quando houver;
  - o botão do WhatsApp abre o `linkWhatsapp` em nova aba **e** chama `POST /api/assinaturas/:id/contatos`, como na cobrança. Dando certo, o item sai da lista; se o registro falhar, a mensagem abre do mesmo jeito e a tela avisa;
  - sem `linkWhatsapp`, o item mostra que falta o WhatsApp do cliente (ou que a pessoa não pode cobrar), como hoje;
  - nas janelas `7`, `15` e `30`, mostrar a etapa é opcional.
- **Resumo:** "Lembrar hoje: N" (`lembrarHoje`), com o link para `/renovacoes?janela=lembrar`. No `cobrarHoje`, o último contato com `etapa` mostra o nome dela, tirado de `etapas` do Resumo.
- **Configurações:**
  - um campo opcional por etapa, na ordem de `etapas`, com a pré-visualização ao vivo pela regra de 7.3 e os exemplos de `variaveis`;
  - o campo vazio mostra que a etapa usa o modelo de cobrança;
  - o PATCH manda só as etapas que mudaram, dentro de `modelosLembrete`, e o `422` com `campo:'modelosLembrete.<dias>'` vai para o campo daquela etapa.
- **Ficha do cliente (6.7):** o contato com `etapa` mostra o nome da etapa na linha do tempo, tirado de `etapas` da Ficha.
- **Nenhum texto institucional novo.** Os nomes das etapas vêm do vm, e o texto da mensagem é o do Nexus.
- **Testes:** os exemplos novos ficam nesta seção, fora das seções que o `SECOES` de `tests/views/exemplos.mjs` confere. Os exemplos de 6.4, 6.5, 6.7 e 6.14 não mudaram.
