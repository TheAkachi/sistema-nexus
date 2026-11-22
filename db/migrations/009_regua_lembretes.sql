-- v0.14.0: a régua de lembretes (contrato 15), sem envio automático. O lembrete guarda a etapa da régua do dia em que foi
-- feito, para a mesma etapa do mesmo vencimento não voltar a "Lembrar hoje". Os modelos próprios das etapas ficam nas
-- configurações, nenhum por padrão [P1]: a etapa sem modelo usa o modelo de cobrança.
ALTER TABLE contacts ADD COLUMN etapa smallint CHECK (etapa IN (0,1,7,15,30));
ALTER TABLE contacts ADD CONSTRAINT contacts_etapa_lembrete CHECK (etapa IS NULL OR tipo='lembrete');

-- Os lembretes de antes da régua ganham a etapa pela regra de api/lib/regua.mjs, com o dia em que foram feitos (em São
-- Paulo) e o vencimento lembrado. Assim, quem já foi lembrado não volta à lista quando esta versão for publicada.
UPDATE contacts k SET etapa=CASE WHEN x.d=0 THEN 0 WHEN x.d=1 THEN 1 WHEN x.d<=7 THEN 7 WHEN x.d<=15 THEN 15 ELSE 30 END
  FROM (SELECT id,vence_em-(feito_em AT TIME ZONE 'America/Sao_Paulo')::date AS d FROM contacts WHERE tipo='lembrete') x
  WHERE k.id=x.id AND x.d BETWEEN 0 AND 30;
CREATE INDEX contacts_lembrete ON contacts(subscription_id, vence_em, etapa) WHERE etapa IS NOT NULL;

ALTER TABLE settings ADD COLUMN modelos_lembrete jsonb NOT NULL DEFAULT '{}'::jsonb;
