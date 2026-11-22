# Changelog

## v1.0.0 — Nexus Gestão Comercial (Portfólio Full Stack)

Versão inicial pública do **Sistema Nexus**, aplicação administrativa e comercial para gestão de clientes, assinaturas, cobranças, renovações, indicadores e auditoria do guia gastronômico e cultural **Nexus (Rio de Janeiro)**.

### Funcionalidades incluídas

- **Autenticação & Segurança:** login com senha `scrypt`, 2FA obrigatório via TOTP (QR Code SVG + códigos de recuperação de uso único), sessões `HttpOnly`, proteção CSRF, reautenticação para ações sensíveis, controle de acesso por papel (`admin`, `financeiro`, `comercial`, `leitura`) e trilha de auditoria append-only.
- **Modo Demonstrativo (`db:seed`):** seed completo com estabelecimentos do Rio de Janeiro, assinaturas em diferentes status, histórico de pagamentos, fila de renovações, métricas do guia e contas demonstrativas protegidas (`@nexus.demo`).
- **Carteira & Assinaturas:** cadastro de clientes, vínculo com empresas do guia, ciclos (`mensal`, `trimestral`, `semestral`, `anual`), suspensão, reativação, cancelamento e encerramento.
- **Cobrança & Régua de Renovações:** fila por janelas (`vencidas`, `lembrar hoje`, `7`, `15`, `30` dias), modelos personalizáveis de mensagem de cobrança, lembrete e relatório mensal, com prévia em tempo real e link direto para WhatsApp.
- **Indicadores & Desempenho:** gráficos SVG server-side de receita, carteira ativa, inadimplência, audiência do guia e anunciantes em risco ou sem medição.
- **Importação CSV & Leads:** importação idempotente com prévia e revisão linha a linha, além do módulo de interessados vindos do guia.
- **Operação & Testes:** PostgreSQL/PGlite embarcado, migrações SQL, backup cifrado, Dockerfile, Docker Compose, GitHub Actions e suíte automatizada com `node:test`.
