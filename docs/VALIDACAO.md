# Validação e próximos passos — v0.8.2

Entrega local de 26/10/2026, preparada a partir do ZIP da versão 0.8.1. O ZIP e o PDF originais foram preservados. Esta pasta não contém histórico Git nem comprovação da versão atualmente publicada.

## Resultado da preparação

| Frente | Entrega local | O que ainda falta |
| --- | --- | --- |
| Importação | Correção de "ignorar" → "voltar a importar", com confirmação testada | Validar cabeçalho e amostra anonimizada do eDirectory do Nexus |
| Integração | Correção de concorrência no envio de planos e na conferência diária | Conferir comportamento com o código e o ambiente reais do Guia |
| Backup | Snapshot consistente, rotina diária, restauração isolada e cópia externa | Configurar destino/credencial, preservar imagem compatível, instalar e observar execução na VPS |
| Segurança | Modelo de ameaças, controles, riscos e critérios de liberação documentados | Revisão de privilégios/rede/proxy na VPS, incidente anterior, testes autorizados e aceite |
| Documentação | README, contrato, plano e briefing conciliados; operação documentada | Respostas P1–P8 e evidências externas |

Nenhum plano comercial, valor de produção, prazo de retenção legal ou papel da equipe foi inventado. A Fase 2 continua no contrato, condicionada às dependências do site e aos critérios do plano.

## Verificações reproduzíveis

Somente dados de teste. Instalar as dependências pelo lockfile:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

O fluxo `tests/api/fluxo-comercial.test.mjs` percorre importação com prévia, cobrança, pagamento, estorno, cancelamento e desvínculo, conferindo os resultados na gestão e no servidor HTTP que simula o Guia. Nenhuma mensagem WhatsApp é enviada.

Para verificar concorrência de verdade, usar **um PostgreSQL 17 descartável**, sem nenhum dado real, em `TEST_DATABASE_URL`. Os testes específicos criam schemas exclusivos e os removem ao terminar. O teste do banco também cria registros em `public`; nunca usar a URL do banco publicado.

```sh
node --test --test-concurrency=1 tests/api/banco.test.mjs tests/api/backup.test.mjs tests/api/fila.test.mjs tests/api/sincronizacao.test.mjs tests/api/concorrencia-postgres.test.mjs
bash -n scripts/backup/executar.sh scripts/backup/restaurar-isolado.sh
bash tests/backup-operacao.sh
```

Resultado observado em 26/10/2026:

| Verificação | Resultado |
| --- | --- |
| Base original, Node 24.19.0 / pnpm 11.25.0 | 157 testes passaram |
| Entrega 0.8.2, mesmos runtimes, `TEST_DATABASE_URL` definida | **163 testes passaram, zero falhas e zero ignorados** |
| Banco adicional | PostgreSQL 17.11 local descartável no WSL Ubuntu; concorrência de envio, cancelamento, desvínculo e snapshot durante pagamento passaram |
| Sintaxe dos módulos e `pnpm audit` | Passaram; consulta não apontou vulnerabilidades conhecidas nessa execução |
| Bash e ShellCheck | Sintaxe e análise dos dois scripts operacionais e do teste shell passaram |
| Orquestração do backup com Docker/SSH falsos | Falha de restauração/cópia impede retenção; sucesso permite retenção; senha fictícia não aparece nos logs |
| Site informado pelo usuário | Página inicial `https://nexus.demo/` respondeu HTTP 200, sem autenticação ou alteração |

O PostgreSQL 17 foi obtido do [repositório oficial de pacotes](https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-17/), extraído para teste sem instalação de serviço global. Os testes de aplicação usam PGlite e site simulado; o teste de banco e as regressões de concorrência indicadas usam PostgreSQL real. A CI continua configurada para Node 22; ela não foi executada no GitHub nesta entrega.

Docker/systemd/SSH reais e a restauração do servidor não foram executados. A análise da unidade systemd no WSL não pôde validar sua execução porque `docker.service` não está disponível ali. A consulta pública do site não valida o painel, os planos, a integração autenticada ou o código-fonte. As instruções acima não instalam o backup nem publicam o sistema.

## Sequência para homologação

1. Comparar esta entrega com a `main` atual. Como a origem é um ZIP, não substituir trabalho posterior. Revisar as alterações e executar a CI antes de publicar.
2. Conferir a versão publicada e os dois repositórios. O código do site `nexus` não veio nos anexos; sua integração e sua Fase 2 exigem esse código e acesso ao ambiente correspondente.
3. Cadastrar os planos aprovados pelo Nexus no site de testes. Confirmar os valores com o responsável; os valores das fixtures são fictícios.
4. Executar o roteiro abaixo com uma empresa de teste. Registrar situação anterior para recompor o ambiente ao terminar.
5. Configurar backup e recuperação segundo `OPERACAO.md`; registrar cópia externa, restauração, material de recuperação e monitoramento. Scripts presentes no pacote não significam serviço ativo.
6. Resolver os bloqueios de `SEGURANCA.md`, inclusive credenciais anteriormente expostas, privilégios do banco, isolamento dos aplicativos, proxy e privacidade. Registrar responsável e evidências de cada item.
7. Obter amostra anonimizada do eDirectory, ajustar mapeamento se necessário e conferir prévia/reimportação. Só depois do aceite importar carteira real.
8. Confirmar P1–P8 com Lucas, convidar equipe, configurar Pix/tolerância e operar um mês completo. Conciliar carteira com o eDirectory e recebido com o extrato. Esse período real não pode ser substituído por testes automatizados.

## Roteiro de aceite com o Guia

| Etapa | Resultado esperado |
| --- | --- |
| Importar arquivo anonimizado | Prévia mostra ações/avisos; ignorar e voltar funcionam; confirmar não duplica; reimportar preserva alterações feitas na gestão |
| Vincular empresa e criar assinatura | Plano correto chega ao site; administrador vê "Definido pela gestão" |
| Cobrar | Mensagem contém cliente, valor, vencimento e Pix corretos; contato registrado; envio real fica sob controle da equipe |
| Registrar pagamento | Uma baixa por versão; vencimento avança no ciclo correto; indicadores e site coerentes |
| Estornar | Exige confirmação; histórico permanece; vencimento e totais retornam ao estado esperado |
| Cancelar e desvincular | Plano pago removido; empresa continua no Guia; edição do plano retorna ao administrador após desvincular |
| Indisponibilidade temporária do site | Gestão informa pendência e tenta novamente; recuperação envia o estado mais recente |
| Rodar conferência diária | Mudanças recentes não são revertidas por uma leitura antiga; divergências e falhas ficam registradas |

Capturas e evidências devem usar dados de teste e não conter senhas, links de acesso, códigos TOTP nem dados da carteira real. Testes de autenticação, permissões e integração externa devem seguir o escopo autorizado em `SEGURANCA.md`.

## Dependências para concluir as fases

- **Nexus/Pedro:** acesso aos repositórios e à homologação, decisões de publicação, planos e contas externas.
- **Nexus/Lucas:** respostas P1–P8, equipe/papéis, chave Pix, tolerância e conferência comercial.
- **Operação:** destino externo de backup, credenciais, preservação da imagem, monitoramento e validação da recuperação.
- **Segurança:** evidências das correções, teste na homologação e aceite antes de dados reais.
- **Fase 2:** código do site para "Minha assinatura" e métricas; leads aguardam revisão e decisões de privacidade.
