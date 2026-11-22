-- Fase 2 sem leads (contrato 9.5, v0.9.0): o WhatsApp do atendimento que o afiliado vê na "Minha assinatura", o motivo
-- novo da fila (a mudança da chave Pix ou do WhatsApp do atendimento põe todas as empresas na fila) e a cópia das métricas
-- do site, lida uma vez por dia (só totais, sem dado pessoal).
ALTER TABLE settings ADD COLUMN whatsapp_atendimento text NOT NULL DEFAULT '' CHECK (whatsapp_atendimento ~ '^(55[0-9]{10,11})?$');

ALTER TABLE plan_sync DROP CONSTRAINT plan_sync_motivo_check;
ALTER TABLE plan_sync ADD CONSTRAINT plan_sync_motivo_check CHECK (motivo IN ('ativacao','edicao','suspensao','reativacao','cancelamento','desvinculo','pagamento','estorno','tolerancia','importacao','conferencia','configuracao'));

CREATE TABLE site_metrics (
 id integer PRIMARY KEY CHECK (id = 1),
 de text,
 ate text,
 dados jsonb,
 lido_em timestamptz,
 erro text NOT NULL DEFAULT '',
 tentado_em timestamptz
);
