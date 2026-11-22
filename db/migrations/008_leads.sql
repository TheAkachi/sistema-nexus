-- v0.13.0: os interessados, os leads (contrato 14), desligados até a revisão de segurança. O pedido vem do cadastro do
-- site (código, texto, respostas, origem e hora); o nome e o WhatsApp a equipe completa quando a pessoa escreve. O site
-- apaga o pedido depois de 30 dias e pode sortear o mesmo código de novo: o pedido é o código mais a hora (14.2).
-- [SEG] As duas tabelas ainda não estão no backup (api/backup.mjs), e o lead não tem prazo de guarda.
CREATE TABLE leads (
 id text PRIMARY KEY,
 codigo text NOT NULL CHECK (codigo ~ '^[ACDEFHJKMNPRTUVWXY3479]{4,5}$'),
 texto text NOT NULL DEFAULT '',
 respostas jsonb NOT NULL DEFAULT '{}',
 origem text NOT NULL DEFAULT '' CHECK (origem ~ '^[a-z0-9-]{0,60}$'),
 pedido_em timestamptz NOT NULL,
 recebido_em timestamptz NOT NULL,
 nome text NOT NULL DEFAULT '' CHECK (length(nome) <= 160),
 whatsapp text NOT NULL DEFAULT '' CHECK (whatsapp ~ '^(55[0-9]{10,11})?$'),
 situacao text NOT NULL DEFAULT 'novo' CHECK (situacao IN ('novo','em-conversa','proposta','cliente','perdido')),
 motivo_perda text NOT NULL DEFAULT '' CHECK (length(motivo_perda) <= 200),
 perdido_em timestamptz,
 proxima_acao text NOT NULL DEFAULT '' CHECK (length(proxima_acao) <= 200),
 proxima_em date,
 notas text NOT NULL DEFAULT '' CHECK (length(notas) <= 2000),
 client_id text REFERENCES clients(id),
 virou_cliente_em timestamptz,
 atualizado_em timestamptz NOT NULL,
 version integer NOT NULL DEFAULT 1,
 UNIQUE (codigo, pedido_em),
 CHECK ((situacao = 'perdido') = (perdido_em IS NOT NULL) AND (situacao = 'perdido' OR motivo_perda = '')),
 CHECK ((situacao = 'cliente') = (client_id IS NOT NULL) AND (client_id IS NULL) = (virou_cliente_em IS NULL))
);
CREATE INDEX leads_pedido ON leads(pedido_em);

CREATE TABLE lead_leituras (
 id integer PRIMARY KEY CHECK (id = 1),
 cursor timestamptz,
 lido_em timestamptz,
 erro text NOT NULL DEFAULT '',
 tentado_em timestamptz
);
