-- v0.11.0: o relatório do mês para o anunciante (contrato 5.2, 6.7, 6.14, 7.3 e 7.4). O envio do relatório entra no
-- histórico de contatos com o cliente, a empresa do guia e o mês, sem assinatura nem vencimento; a cobrança e o lembrete
-- continuam como eram. O modelo da mensagem do relatório fica nas Configurações, com o padrão provisório [P1].
ALTER TABLE settings ADD COLUMN modelo_relatorio text NOT NULL DEFAULT 'Olá, {responsavel}! Aqui é do Nexus. {desempenho} O relatório de {mes} da {empresa} está neste link: {link}';

ALTER TABLE contacts ALTER COLUMN subscription_id DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN vence_em DROP NOT NULL;
ALTER TABLE contacts ADD COLUMN client_id text REFERENCES clients(id);
ALTER TABLE contacts ADD COLUMN business_id text;
ALTER TABLE contacts ADD COLUMN mes text CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE contacts DROP CONSTRAINT contacts_tipo_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_tipo_check CHECK (tipo IN ('cobranca','lembrete','relatorio'));
ALTER TABLE contacts ADD CONSTRAINT contacts_forma_check CHECK (CASE WHEN tipo='relatorio'
  THEN subscription_id IS NULL AND vence_em IS NULL AND client_id IS NOT NULL AND business_id IS NOT NULL AND mes IS NOT NULL
  ELSE subscription_id IS NOT NULL AND vence_em IS NOT NULL AND client_id IS NULL AND business_id IS NULL AND mes IS NULL END);
CREATE INDEX contacts_relatorio ON contacts(client_id, business_id, mes, feito_em) WHERE tipo='relatorio';
