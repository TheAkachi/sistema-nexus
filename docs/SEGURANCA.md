# Segurança da gestão Nexus

Registro iniciado em 26/10/2026 a partir da cópia de código recebida. Escopo: aplicação `Sistema-Nexus`, documentação e configuração de exemplo. O código do site `nexus`, o servidor, as contas Google/eDirectory e as configurações efetivamente publicadas não foram inspecionados nesta revisão local.

**Estado: revisão e preparação local; uso com dados reais ainda não liberado.** Este documento atende à organização prevista em D7 e não atesta ausência de vulnerabilidades, conformidade legal, implantação ou conclusão dos testes de homologação. O resultado dos testes executados em cada entrega deve ser registrado no HANDOFF, com ambiente e limitações.

Documentos associados: [plano](gestao/PLANO.md), [contrato](CONTRATO.md), [briefing de segurança](gestao/BRIEFING-SEGURANCA.md), [operação](OPERACAO.md) e [histórico](HANDOFF.md).

## 1. Escopo e fronteiras de confiança

- Gestão: equipe interna, dados de clientes, assinaturas, valores, pagamentos, estornos, contatos e auditoria. O afiliado não acessa este aplicativo.
- Guia: sistema separado; fornece empresas e planos e recebe o plano esperado de uma empresa pela integração. O cliente da gestão trata respostas do site como entrada externa.
- Navegador: sem confiança nos papéis, IDs, valores ou campos enviados. A autorização ocorre no servidor.
- VPS: executa os contêineres, guarda os segredos de execução e alcança os bancos. Acesso administrativo à VPS é acesso privilegiado a todo esse ambiente.
- Backup externo: contém dados pessoais e financeiros cifrados. Quem obtiver o arquivo e sua senha consegue ler o conteúdo.
- Originais do eDirectory, gravações e exportações: material restrito; exemplos para desenvolvimento devem usar dados fictícios ou anonimizados.

## 2. Modelo de ameaças

| Ameaça | Controle observado ou previsto | Limite a validar |
| --- | --- | --- |
| Roubo de senha ou força bruta | scrypt, senha de 12 a 128 caracteres, rejeição de senhas comuns, TOTP obrigatório e limites de tentativas | Confirmar proxy/IP real e tentativas concorrentes na homologação; lista local de senhas não é uma consulta completa a vazamentos |
| Reaproveitamento de sessão, código ou convite | tokens aleatórios, hashes no banco, expiração, consumo de links/códigos, invalidação de sessões | Verificar fluxos completos e concorrência; proteger links de convite como credenciais |
| Membro da equipe com papel inadequado | matriz por rota, confirmação recente em ações sensíveis, auditoria | Todos os papéis podem ler a carteira e indicadores financeiros; confirmar com Lucas se esse acesso é necessário |
| CSRF e alteração de requisição | `Origin`, token CSRF nas escritas autenticadas, cookies restritos, validação no servidor | Login e definição de senha não têm sessão e usam `Origin`; validar domínio HTTPS e acesso pelo proxy |
| Injeção de HTML ou SQL | escape nas views, parâmetros nas consultas, CSP e limites de entrada | Revisão contínua das novas rotas; CSP não substitui escape e autorização |
| Site comprometido ou integração falsa | HMAC com hash do corpo, tempo e nonce no contrato; validação das respostas; timeout | A verificação de HMAC, repetição e bloqueio externo acontece no site, cujo código não está neste pacote |
| Banco ou servidor comprometido | banco próprio, credenciais separadas, backup cifrado, auditoria com gatilhos | Acesso ao host ou papel privilegiado de banco pode contornar gatilhos; cifrar TOTP não protege se a chave também for roubada |
| Perda, corrupção ou exclusão de dados | backup e restauração implementados; rotina operacional a instalar e comprovar | Arquivo gerado não prova restauração, cópia externa ou monitoramento de falha |
| Ex-funcionário ou conta compartilhada | desativação de usuário, expiração e invalidação de sessões, papéis individuais | Processo de desligamento precisa cobrir também VPS, GitHub, Google, eDirectory, links e gerenciador de senhas |
| Vazamento por arquivos e logs | logs HTTP reduzidos, prévias de CSV temporárias, backup sem credenciais de autenticação | Auditoria contém dados pessoais; é necessário definir acesso, retenção e tratamento de solicitações |

## 3. Controles existentes e condições de validade

### Autenticação e sessões

- `api/auth.mjs` usa scrypt com sal aleatório e comparação em tempo constante; os parâmetros do formato atual são N=32768, r=8 e p=1.
- `api/login.mjs` implementa senha seguida de TOTP, configuração inicial e dez códigos de recuperação. Os códigos de recuperação são derivados com HMAC e consumidos uma vez.
- `api/lib/cifra.mjs` cifra o segredo TOTP com AES-256-GCM, associado ao ID da conta. Em produção, `TOTP_KEY` é obrigatória. A chave fixa de desenvolvimento não serve para dados reais.
- A sessão usa cookie `HttpOnly`, `SameSite=Strict` e `Secure` quando a origem é HTTPS. Expira por 30 minutos sem uso ou oito horas desde o login. Confirmação de identidade vale cinco minutos.
- Convite dura 72 horas; link para conta com senha dura uma hora. Links novos invalidam os anteriores da mesma pessoa. Definir senha encerra as sessões existentes.
- A senha não substitui verificação da identidade de quem solicita uma redefinição de 2FA. O administrador deve confirmar a solicitação por um canal já conhecido e registrar o atendimento sem copiar o segredo.

### Permissões, dados e escritas

- `api/rotas.mjs` centraliza sessão, CSRF, autorização e reautenticação. A tabela vigente está em `api/permissoes.mjs` e na seção 3 do contrato.
- Os papéis são `admin`, `financeiro`, `comercial` e `leitura`. A restrição é por ação, não por carteira individual: qualquer papel autenticado com `ver` lê os clientes e valores.
- `api/server.mjs` valida `Origin` em POST/PATCH/DELETE, aplica limites de corpo, CSP, HSTS sob HTTPS e respostas sem cache para dados autenticados. Erros internos não devolvem a pilha.
- O banco registra pagamentos e estornos sem apagar o histórico. Alterações usam transações e controle de versão nos fluxos definidos no contrato; cada nova alteração financeira deve manter essas garantias.
- Não há exportação CSV na Fase 1. Quando for adicionada, deverá incluir defesa contra fórmulas e testes; não se deve alegar proteção de uma função ainda inexistente.

### Importação e retenção técnica

- CSV limitado a 2 MB e 2.000 linhas; até dez envios por usuário por hora. Só administradores importam, e confirmar exige reautenticação.
- O arquivo original não é mantido. A prévia contém dados pessoais e vence em 24 horas; confirmar, descartar ou expirar remove sua representação no banco.
- A rotina `limpar` remove prévias expiradas, links usados/vencidos, logins pendentes vencidos, sessões vencidas e limites antigos. A expiração precisa de execução comprovada; não assumir limpeza do servidor pela presença do código.
- Essas rotinas não definem nem executam retenção geral dos clientes, pagamentos, contatos e auditoria.

### Auditoria e logs

- Logs HTTP registram identificador da requisição, método, resultado e duração, sem corpo, caminho, e-mail ou IP.
- A auditoria de negócio é diferente: contém ator, recurso, antes/depois e IP. Falhas de login também registram o e-mail tentado. Ela é dado restrito e faz parte do backup.
- Gatilhos bloqueiam UPDATE, DELETE e TRUNCATE de `audit_log` no uso normal. Isso não equivale a armazenamento imutável contra superusuário ou dono do banco.
- O compose de exemplo usa o papel criado por `POSTGRES_USER` tanto na aplicação quanto nas migrações. Na imagem PostgreSQL, esse papel inicial é privilegiado. Antes dos dados reais, separar migração/administração de execução e testar os privilégios efetivos; não remover privilégios do processo atual sem adaptar e validar a inicialização.

### Integração e rede

- A gestão assina método, caminho/query, carimbo, nonce e hash do corpo usando HMAC-SHA256. O contrato prevê tolerância de cinco minutos e memória de nonces de dez minutos no site.
- O bloqueio de `/api/integracao` pelo proxy é um requisito que precisa ser verificado na configuração do site. O código local do cliente não comprova esse bloqueio.
- O compose coloca a gestão também na rede do site. O HANDOFF registra que ela consegue alcançar a porta do banco do site; credenciais distintas reduzem o acesso, mas não isolam a rede. Preparar rede exclusiva entre os aplicativos e verificar os demais projetos da VPS antes de mudar a topologia.
- `api/lib/ip.mjs` confia em conexões vindas de redes privadas/loopback para ler o último `X-Forwarded-For`. Essa premissa depende de o aplicativo ser acessível somente pelo proxy esperado. Outro contêiner na mesma rede não é automaticamente um proxy confiável.
- Na topologia atual, o endereço do banco da gestão é `sistema-nexus-db-1`, nunca o nome ambíguo `db`.

## 4. Segredos e recuperação de acesso

Valores reais não entram neste documento, no repositório, no chat, em capturas de tela nem em logs. Arquivos de execução devem ter dono e permissões restritos, com revisão de cópias antigas. Os exemplos `.env.example` não são arquivos de configuração prontos para produção.

| Segredo | Guarda | Troca e recuperação |
| --- | --- | --- |
| Senha do PostgreSQL / `DATABASE_URL` | Configuração restrita do serviço; cópia controlada no gerenciador | Trocar no banco e no consumidor de forma coordenada, validar conexão e remover versões antigas. Não trocar a credencial do banco do site |
| `TOTP_KEY` | Configuração restrita e cópia de recuperação separada do host | Não substituir diretamente: segredos cifrados e códigos de recuperação dependem dela. Preparar migração de cifra ou redefinição coordenada do 2FA, invalidar sessões e validar contas antes de retirar a chave antiga |
| `INTEGRACAO_CHAVE` | Configuração restrita da gestão e do site | Site aceita chave atual e anterior conforme contrato: incluir nova no site, mudar gestão, verificar chamadas e retirar antiga. Exige acesso ao outro repositório/serviço |
| `BACKUP_PASSPHRASE` | Arquivo restrito do serviço de backup e cópia recuperável fora da VPS | Novos arquivos usam a senha nova; os antigos continuam dependendo da anterior. Manter ambas até expirar o último arquivo antigo. Nunca armazenar a senha junto dos arquivos cifrados |
| Chave SSH da cópia externa | Credencial dedicada do serviço, com destino e permissões restritos | Revogar acesso antigo, conferir chave do servidor por canal confiável e testar novo acesso. Não reutilizar a credencial administrativa do operador |
| Convites, links de senha e códigos de recuperação | Canal individual já verificado | Invalidar link exposto gerando outro; códigos de recuperação não podem ser reenviados do banco. Redefinir 2FA por fluxo administrativo auditado quando necessário |

Se houver suspeita de exposição: identificar credenciais/contas afetadas, restringir acesso, preservar evidências sem replicar segredos, trocar/revogar o material comprometido e verificar registros relevantes. A Nexus deve designar o responsável pela resposta e por eventuais comunicações exigidas; esta revisão não conclui obrigações legais do incidente.

## 5. Incidente anterior: registro pendente de evidência

O PDF de situação e o briefing relatam exposição de credenciais e dados em gravações/dossiê compartilhados por link público. Não foram acessadas as gravações, o compartilhamento, o eDirectory nem os consoles Google nesta revisão. O estado abaixo é documental.

| Ação | Estado em 26/10/2026 | Evidência esperada, sem segredos |
| --- | --- | --- |
| Revogar compartilhamento público | Não verificado | Data, responsável e confirmação de remoção |
| Trocar segredo do reCAPTCHA e atualizar eDirectory | Não verificado | Registro da troca e teste funcional |
| Trocar segredo OAuth ou desabilitar login Google | Não verificado | Registro da decisão e teste de acesso |
| Restringir e, se necessário, trocar chave Maps | Não verificado | Lista de domínios/APIs autorizados e teste funcional |
| Revisar administradores e conta de suporte do eDirectory | Não verificado | Lista de acessos aprovada, sem senhas |
| Remover cópias antigas de configuração na VPS | Não verificado | Caminhos revisados, responsável e data; preservar antes o procedimento de recuperação necessário |

## 6. Privacidade: decisões para o Nexus

Não coletar CPF, CNPJ, cartão ou outros campos fora da finalidade definida para a Fase 1. Campos livres devem evitar dados sensíveis, credenciais e documentos pessoais. Amostras de importação usadas no desenvolvimento devem ser fictícias/anonimizadas.

Antes da carteira real, registrar com o responsável do Nexus:

1. Finalidades e bases legais por operação, com validação jurídica quando necessária. As hipóteses citadas no planejamento não substituem essa decisão.
2. Quem precisa ler clientes, valores e auditoria; a matriz atual permite leitura ampla a todos os quatro papéis.
3. Prazos de retenção para carteira encerrada, registros financeiros, contatos, auditoria, logs e backups, incluindo fundamento e rotina responsável. Não há prazo aprovado neste pacote.
4. Canal para solicitações dos titulares e procedimento de identificação, análise, resposta e registro. Encerrar um cliente não exclui seus dados; a Fase 1 não tem anonimização/exclusão geral implementada.
5. Como conciliar solicitações de eliminação com registros que precisam permanecer e com cópias de backup. Qualquer implementação de anonimização deve preservar integridade financeira e tratar também os campos antes/depois da auditoria.
6. Aviso de privacidade da equipe e informações aos clientes; responsáveis pelos fornecedores que recebem dados, incluindo WhatsApp e hospedagem.

## 7. Backup e disponibilidade

O backup lógico da aplicação usa AES-256-GCM. Exclui hashes de senha, segredos TOTP, códigos de recuperação, sessões, links e prévias de importação. As contas restauradas precisam de novos links de senha e nova configuração de 2FA. A restauração exige banco vazio e o mesmo conjunto de migrações, incluindo seus hashes.

O pacote operacional é descrito em [OPERACAO.md](OPERACAO.md). Presença dos scripts não comprova instalação. A liberação requer backup agendado com execução observada, cópia externa verificável, senha disponível fora da VPS, restauração em ambiente isolado, conciliação das contagens/dados e responsável pelo monitoramento. Um arquivo não autenticado ou apenas um checksum não prova recuperabilidade.

O objetivo de perda máxima de dados e o prazo de recuperação precisam ser acordados com o Nexus. A proposta de backup diário do plano implica potencial perda do intervalo entre cópias; não há garantia de recuperação em minutos nem de perda zero.

## 8. Critérios de liberação e evidências

Nenhum item abaixo é marcado como concluído por esta documentação.

- [ ] Incidente anterior tratado e evidências da Parte A registradas.
- [ ] Revisão local consolidada, com falhas encontradas corrigidas e testes pertinentes passando.
- [ ] Configuração publicada verificada: HTTPS, cookies, CSP, proxy/IP, portas, isolamento e privilégios mínimos do banco.
- [ ] Backup diário, cópia externa e monitoramento de falhas ativos; restauração isolada comprovada e repetida mensalmente.
- [ ] Teste autorizado na homologação: login/2FA, repetição de códigos e links, concorrência, CSRF, cada papel, entradas hostis, upload e limites.
- [ ] Integração validada com o site: assinatura inválida, tempo fora da janela, nonce repetido e tentativa externa recusados; assinatura de teste aplica e remove o plano esperado.
- [ ] Exportação real anonimizada validada; importação, reimportação e conciliação conferidas antes de carteira real.
- [ ] P1-P8 e decisões de privacidade registradas; papéis e responsáveis aprovados pelo Nexus.
- [ ] Aceite final de uso real com data, responsável, versão publicada, evidências e nenhuma pendência alta aberta.

Para cada verificação, registrar versão, ambiente, cenário, resultado, responsável, data e referência à evidência sem dado pessoal ou segredo. Uma suíte local com site simulado não substitui testes do proxy, rede, PostgreSQL da VPS ou integração real.

## 9. Registro desta preparação

| Data | Escopo | Resultado | Fora do escopo |
| --- | --- | --- | --- |
| 26/10/2026 | Leitura estática do código, contrato, plano, briefings e configuração de exemplo | Controles documentados; briefing alinhado à D7; exemplo de host do banco corrigido; pendências de rede, privilégios, privacidade e operação registradas | Acesso à VPS, contas, dados reais, revisão do código do site, teste de invasão e aceite de produção |
