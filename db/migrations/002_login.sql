-- Login, 2FA e Equipe (contrato 4, 6.13 e 7.6): o último login de cada pessoa, mostrado na Equipe.
ALTER TABLE users ADD COLUMN ultimo_acesso timestamptz;
