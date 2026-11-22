# Operação e recuperação — Gestão Nexus

Preparação local em 26/10/2026, versão 0.8.2. Nenhum comando deste documento foi executado na VPS do Nexus. Instalação, publicação e tratamento de dados reais dependem dos critérios de [segurança](SEGURANCA.md) e da [validação](VALIDACAO.md). O host é compartilhado: identificar os recursos da gestão antes de qualquer ação.

## 1. Aplicação e configuração

O projeto usa Node.js 22 ou superior, pnpm 11.25.0 e PostgreSQL 17. O `Dockerfile` roda o aplicativo como usuário `node`; `scripts/deploy/docker-compose.exemplo.yml` é a referência da homologação, não um inventário confirmado da VPS atual.

- Porta interna da gestão: **4184**. O proxy publica somente o domínio aprovado, com HTTPS.
- Banco da gestão: `sistema-nexus-db-1`. Não usar o nome ambíguo `db` quando o aplicativo participa da rede do site.
- Variáveis de execução e segredos estão listados em `.env.example` e no contrato, seção 11. Gerar os valores fora dos chats e manter arquivos restritos.
- O site do Guia é outro projeto. A rede de integração, o bloqueio externo da API e as credenciais correspondentes precisam ser conferidos nos dois lados.
- O papel inicial `POSTGRES_USER=gestao` do exemplo é privilegiado e também usado pelo aplicativo. Antes de dados reais, separar o papel de migrações/administração do de execução e adaptar a inicialização, que hoje aplica migrações. Não alterar privilégios cegamente: testar o fluxo completo.

Primeiro administrador, dentro do contêiner da gestão: `node api/cli.mjs admin EMAIL NOME`. O comando imprime um link de acesso; executar em terminal privado, não registrar a saída em logs compartilhados e transmitir o link ao destinatário por canal verificado. O primeiro login exige configurar TOTP. Os próximos convites são feitos pela tela Equipe.

## 2. Publicação e retorno à versão anterior

1. Comparar esta entrega com a `main` atual, revisar alterações e executar a CI. O ZIP recebido não inclui histórico Git; não sobrepor mudanças posteriores.
2. Registrar a versão/imagem que está rodando e preservar o código, lockfile e as cinco migrações com seus hashes.
3. Verificar o funcionamento do backup e a capacidade de restaurar antes de qualquer mudança em ambiente com dados reais.
4. Publicar somente a gestão, pelo procedimento autorizado da VPS. A 0.8.2 não adiciona nem altera migrações. Coordenar a substituição do aplicativo e a rotina diária: não deixar um processo antigo de sincronização enviando planos junto com o novo.
5. Conferir `/health/live` (versão) e `/health/ready` (banco), login, acesso conforme papel, fila e cenário comercial em dados de teste.
6. Se precisar retornar, usar a imagem anterior preservada e verificar sua compatibilidade com o schema. Retorno de código não equivale a retorno de dados. Não executar `docker compose down -v`, apagar volumes ou restaurar por cima do banco atual.

As cópias antigas `.env.antes-integracao` e similares citadas no HANDOFF devem ser inventariadas e retiradas após validar a recuperação. Não copiar seu conteúdo para o repositório ou para mensagens.

## 3. O que a rotina de backup entrega

`scripts/backup/executar.sh` executa, nesta ordem:

1. Valida configuração, dono/permissões e exclusão mútua da rotina.
2. Lê a senha por credencial/arquivo e a envia ao processo pelo stdin, sem colocá-la nos argumentos ou no ambiente do contêiner.
3. Gera backup lógico cifrado AES-256-GCM. Tabelas e migrações vêm do mesmo snapshot, inclusive se houver pagamento durante a leitura.
4. Restaura em PostgreSQL descartável, sem rede externa, portas publicadas ou volume persistente. Confere schema, contagens e exclusão de credenciais/prévias.
5. Guarda o arquivo `.json` e um `.image` com o ID da imagem exata do aplicativo.
6. Exporta a imagem para `image-<sha256>.tar.gz` e verifica sua cópia fora da VPS. A imagem acompanha código, dependências e migrações necessários à restauração; apenas guardar o ID não bastaria. Uma imagem externa já íntegra não é enviada novamente.
7. Envia o backup por SSH/SCP com chave do servidor previamente conferida, valida checksum e publica o arquivo final no destino.
8. Só depois do sucesso remove backups **locais** antigos com os padrões previstos. Não apaga arquivos remotos nem imagens de recuperação automaticamente.

Falha de restauração ou envio interrompe a rotina antes da retenção. Um arquivo local deixado por falha de cópia não deve ser contado como backup externo aprovado. Arquivos incompletos são limpos na saída normal/erro; queda abrupta de energia pode deixá-los, devendo ser examinados pelo operador.

## 4. Pré-requisitos do servidor

- Linux, Bash, Docker com Compose, OpenSSH, `gzip` e utilitários GNU; systemd **247 ou superior** para `LoadCredential`.
- Diretórios locais e remotos dedicados, pertencentes ao usuário da rotina, com permissão 700. O serviço de referência roda como root porque controla o Docker; esse acesso é administrativo.
- Uma única instância `app` identificável no compose da gestão.
- Imagem PostgreSQL 17 previamente baixada e verificada. A rotina não faz pull; pode-se fixar `RESTORE_POSTGRES_IMAGE` por digest aprovado.
- Memória/espaço suficientes: o banco de teste usa tmpfs, cujo limite padrão é 1 GB. Ajustar `RESTORE_TMPFS_SIZE` para o volume de dados e capacidade da VPS. O teste não pode pressionar os outros projetos.
- Destino em **outro servidor**, chave SSH dedicada, diretório remoto criado previamente e acesso limitado à finalidade do backup.
- `known_hosts` com chave do servidor confirmada por canal independente. Não usar aceitação automática nem confiar apenas em uma coleta não verificada de `ssh-keyscan`.
- Senha forte de backup em arquivo restrito na VPS e cópia recuperável em gerenciador fora dela. Não armazená-la junto dos backups no destino.
- Responsável e canal de alerta para falhas, ausência de execução, falta de espaço e perda de acesso ao destino externo.

## 5. Instalação inicial do backup

Os comandos abaixo são um roteiro para o operador, após revisar os caminhos e a autorização. **Não reaplicar os modelos sobre uma configuração existente**; primeiro comparar e preservar a configuração aprovada.

```sh
sudo install -d -m 700 /etc/nexus-backup /var/backups/sistema-nexus
sudo install -m 600 scripts/backup/backup.conf.example /etc/nexus-backup/backup.conf
sudoedit /etc/nexus-backup/backup.conf
sudoedit /etc/nexus-backup/passphrase
sudo chmod 600 /etc/nexus-backup/passphrase
```

Editar os campos `OFFSITE_HOST`, `OFFSITE_DIR`, `SSH_KEY` e `SSH_KNOWN_HOSTS` com valores reais, sem compartilhá-los aqui. A senha deve ser uma linha com pelo menos 16 caracteres; preferir geração aleatória pelo gerenciador. Instalar a chave SSH e o arquivo `known_hosts` com dono root e permissões 600. Confirmar previamente a pasta remota com permissão 700.

O modelo usa `/opt/sistema-nexus` como código e `/docker/sistema-nexus/docker-compose.yml` como compose. Se os caminhos forem outros, adaptar o arquivo de configuração e `ExecStart`. Se mudar `BACKUP_DIR`, ajustar também `ReadWritePaths` na unidade; `ProtectHome=true` exige credenciais fora de diretórios pessoais.

```sh
sudo install -m 644 scripts/backup/gestao-backup.service /etc/systemd/system/gestao-backup.service
sudo install -m 644 scripts/backup/gestao-backup.timer /etc/systemd/system/gestao-backup.timer
sudo systemctl daemon-reload
sudo systemctl start gestao-backup.service
sudo systemctl status gestao-backup.service
sudo journalctl -u gestao-backup.service --since today
```

Antes de ativar o agendamento, confirmar saída com sucesso, restauração isolada, backup e imagem no destino externo, disponibilidade da senha fora da VPS e alertas funcionando. Depois:

```sh
sudo systemctl enable --now gestao-backup.timer
sudo systemctl list-timers gestao-backup.timer
```

O modelo roda às **04:00 de São Paulo**, com até cinco minutos de variação. A sincronização de planos existente usa 05:00. Horário, retenção local de 30 dias e capacidade são propostas operacionais configuráveis, não políticas legais aprovadas. A política externa deve ser definida separadamente; não eliminar a imagem ou a senha antiga enquanto algum backup retido depender delas.

## 6. Recuperação e simulação de desastre

Mensalmente, e após mudança relevante, repetir o exercício usando **arquivos obtidos do destino externo**, não só a cópia local. Guardar data, versão, resultado, duração e responsável, sem dados pessoais.

1. Recuperar o `.json`, seu `.image`, a imagem `image-<sha256>.tar.gz` e a senha pelo canal de recuperação.
2. Em máquina isolada, carregar a imagem com `docker image load --input ARQUIVO.tar.gz` e conferir que o ID coincide com o `.image`. Preparar também a imagem PostgreSQL 17 aprovada.
3. Executar `bash scripts/backup/restaurar-isolado.sh ARQUIVO.json ID_DA_IMAGEM ARQUIVO_DA_SENHA`. O script aceita ID imutável `sha256:...`, não tag. O arquivo da senha deve ter acesso restrito.
4. O script cria recursos temporários exclusivos e os remove ao terminar. Não utiliza banco ou rede da gestão. Se a restauração falhar, não promover o backup.
5. Para recuperação efetiva, restaurar primeiro em **banco novo, vazio e migrado**, usando o código exato do backup. O comando administrativo é `node api/cli.mjs restore ARQUIVO`, com `DATABASE_URL` apontando para esse banco novo e `BACKUP_PASSPHRASE` fornecida por mecanismo restrito. O operador deve conferir o destino antes da execução; o script isolado não faz esse corte.
6. As contas voltam sem senha e sem 2FA; sessões, links, códigos de recuperação e prévias não voltam. Recriar o acesso por links novos e configurar o autenticador de cada pessoa. Não tornar a aplicação pública antes dessa conferência.
7. Conferir clientes, assinaturas, pagamentos, estornos, configurações, auditoria e totais com as evidências comerciais disponíveis. Determinar quais operações posteriores ao backup precisam ser reconstruídas.
8. Manter a integração desativada durante a recuperação. A fila restaurada pode conter pedidos pendentes; revisar o estado esperado e só então religar o site e executar a conferência autorizada. A rotina não faz essa reconciliação automaticamente.
9. Planejar o corte para o banco recuperado e preservar o anterior para análise/retorno. Não eliminar volumes durante o exercício.

Backups exigem o mesmo conjunto de migrações e hashes. Não editar migração aplicada nem tentar contornar a validação do schema. O arquivo criptografado não contém os segredos do ambiente; chaves da integração, chave TOTP e acessos de infraestrutura têm plano de recuperação separado em `SEGURANCA.md`.

## 7. Monitoramento e limites verificados

O `journal` registra sucesso/falha do serviço; a ausência de erro não comprova que o timer está ativo. Verificar última execução, próxima execução, saída final, espaço, arquivos externos e alertas. A integração do alerta com o canal da operação depende do ambiente e **não está instalada por este pacote**.

Nesta entrega foram verificados sintaxe Bash, análise ShellCheck e cenários de falha/sucesso da orquestração com Docker/SSH falsos. A restauração lógica e o snapshot concorrente foram testados em banco local. Docker, systemd, SSH e a cópia externa reais ainda precisam do teste completo na VPS. O teste local não comprova execução ou recuperação do servidor publicado.
