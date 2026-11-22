-- Cobrança (contrato 5.2, 5.4, 7.4 e 7.5): pagamentos com baixa manual e estorno que não apaga, e o registro de cada
-- cobrança aberta no WhatsApp.

CREATE TABLE payments (
 id text PRIMARY KEY,
 subscription_id text NOT NULL REFERENCES subscriptions(id),
 valor_centavos integer NOT NULL CHECK (valor_centavos BETWEEN 1 AND 100000000),
 pago_em date NOT NULL,
 forma text NOT NULL CHECK (forma IN ('pix','dinheiro','cartao','boleto','transferencia','mercado-pago')),
 meses integer NOT NULL CHECK (meses IN (1,3,6,12)),
 vence_antes date NOT NULL,
 vence_depois date NOT NULL,
 referencia_de date NOT NULL,
 referencia_ate date NOT NULL,
 obs text NOT NULL DEFAULT '',
 registrado_por text REFERENCES users(id) ON DELETE SET NULL,
 registrado_em timestamptz NOT NULL DEFAULT now(),
 estornado_em timestamptz,
 estornado_por text REFERENCES users(id) ON DELETE SET NULL,
 motivo_estorno text NOT NULL DEFAULT '',
 CHECK (vence_depois > vence_antes),
 CHECK (estornado_em IS NULL OR motivo_estorno <> '')
);
CREATE INDEX payments_subscription ON payments(subscription_id, registrado_em);
CREATE INDEX payments_pago_em ON payments(pago_em) WHERE estornado_em IS NULL;

CREATE TABLE contacts (
 id text PRIMARY KEY,
 subscription_id text NOT NULL REFERENCES subscriptions(id),
 canal text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp')),
 tipo text NOT NULL CHECK (tipo IN ('cobranca','lembrete')),
 vence_em date NOT NULL,
 feito_em timestamptz NOT NULL DEFAULT now(),
 feito_por text REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX contacts_subscription ON contacts(subscription_id, feito_em);
