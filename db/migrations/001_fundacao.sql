-- Fundação da gestão (contrato, seções 4 e 5.1): equipe, sessões, login em duas etapas, 2FA, links de uso único,
-- limites de tentativa e auditoria só de inserção. As tabelas de infraestrutura copiam as do site (colunas em inglês);
-- as do negócio, que chegam nas próximas migrações, usam colunas em português.

-- Equipe do Nexus. O 2FA (TOTP) é obrigatório: totp_secret fica cifrado com a chave TOTP_KEY do .env e
-- totp_ultimo_passo guarda o último passo de 30 s aceito, para o mesmo código não entrar duas vezes.
CREATE TABLE users (
 id text PRIMARY KEY,
 email text NOT NULL UNIQUE CHECK (email = lower(email)),
 nome text NOT NULL DEFAULT '',
 papel text NOT NULL CHECK (papel IN ('admin','financeiro','comercial','leitura')),
 password_hash text NOT NULL,
 totp_secret text,
 totp_ativo boolean NOT NULL DEFAULT false,
 totp_ultimo_passo bigint,
 desativado boolean NOT NULL DEFAULT false,
 criado_em timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 CHECK (NOT totp_ativo OR totp_secret IS NOT NULL)
);

-- Sessão: o cookie leva o valor; o banco guarda só o hash, o csrf e um id público. confirmed_at marca a última
-- reautenticação (senha ou código), exigida pelas ações sensíveis.
CREATE TABLE sessions (
 token_hash text PRIMARY KEY,
 id text NOT NULL UNIQUE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf text NOT NULL,
 created_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 confirmed_at timestamptz,
 user_agent text NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Login em andamento: a senha conferiu e falta o código do 2FA (codigo) ou configurar o 2FA no primeiro acesso
-- (configurar, com o segredo novo cifrado). Vale poucos minutos e morre depois de 5 códigos errados.
CREATE TABLE login_challenges (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 stage text NOT NULL CHECK (stage IN ('codigo','configurar')),
 new_totp_secret text,
 failures integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK (stage = 'codigo' OR new_totp_secret IS NOT NULL)
);
CREATE INDEX login_challenges_user ON login_challenges(user_id);

-- Códigos de recuperação do 2FA: 10 por pessoa, guardados só como hash, cada um vale uma vez.
CREATE TABLE recovery_codes (
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 used_at timestamptz,
 PRIMARY KEY (user_id, code_hash)
);

-- Links de uso único: convite de quem entra na equipe e link de senha gerado pelo admin ou pelo CLI.
CREATE TABLE access_tokens (
 token_hash text PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('convite','senha')),
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_by text REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE INDEX access_tokens_user ON access_tokens(user_id);

-- Limite de tentativas por chave (IP real, conta, sessão), guardando só o hash da chave.
CREATE TABLE rate_limits (
 key_hash text PRIMARY KEY,
 count integer NOT NULL,
 reset_at timestamptz NOT NULL
);

-- Auditoria: quem, o quê, sobre qual registro, o valor antes e depois e o IP real. Só aceita INSERT.
CREATE TABLE audit_log (
 id text PRIMARY KEY,
 actor_id text,
 action text NOT NULL,
 resource_type text NOT NULL DEFAULT '',
 resource_id text NOT NULL,
 before jsonb,
 after jsonb,
 ip text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_date ON audit_log(created_at);
CREATE INDEX audit_actor ON audit_log(actor_id, created_at);
CREATE FUNCTION audit_log_so_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log só aceita INSERT'; END $$;
CREATE TRIGGER audit_log_sem_update_delete BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_so_insert();
CREATE TRIGGER audit_log_sem_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_so_insert();
