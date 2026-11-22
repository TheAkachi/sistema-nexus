-- Importação (contrato 5.2 e 8): a prévia de cada arquivo enviado, que vence em 24 horas. O arquivo nunca é guardado: só o
-- SHA-256, o número de linhas, o que foi detectado (separador, codificação e ordem das datas) e as linhas já lidas, apagadas
-- ao confirmar, ao descartar ou ao vencer.
CREATE TABLE imports (
 id text PRIMARY KEY,
 tipo text NOT NULL CHECK (tipo IN ('edirectory','planilha')),
 status text NOT NULL DEFAULT 'previa' CHECK (status IN ('previa','confirmada','descartada','expirada')),
 arquivo_sha256 text NOT NULL,
 arquivo_info jsonb NOT NULL DEFAULT '{}',
 linhas integer NOT NULL,
 previa jsonb,
 resumo jsonb NOT NULL,
 criado_por text REFERENCES users(id) ON DELETE SET NULL,
 criado_em timestamptz NOT NULL,
 expira_em timestamptz NOT NULL,
 confirmado_em timestamptz,
 confirmado_por text REFERENCES users(id) ON DELETE SET NULL,
 version integer NOT NULL DEFAULT 1,
 CHECK (status = 'previa' OR previa IS NULL)
);
CREATE INDEX imports_criado ON imports(criado_em);
