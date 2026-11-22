#!/usr/bin/env bash
# Restaura somente em PostgreSQL temporário, sem rede externa, portas ou volume persistente.
set -euo pipefail
umask 077

fail() { printf 'Teste de restauracao: %s\n' "$1" >&2; exit 1; }
[[ $# == 3 ]] || fail 'informe arquivo, ID da imagem da aplicacao e arquivo da senha.'
archive=$(realpath -- "$1")
app_image=$2
secret_file=$3
[[ -f "$archive" && ! -L "$archive" && -r "$secret_file" ]] || fail 'arquivo ou credencial indisponivel.'
[[ "$app_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'use o ID imutavel da imagem, nao uma tag.'
passphrase=$(cat -- "$secret_file")
[[ ${#passphrase} -ge 16 && "$passphrase" != *$'\n'* && "$passphrase" != *$'\r'* ]] || fail 'a senha precisa ter uma linha com ao menos 16 caracteres.'

db_container=''
app_container="nexus-restore-app-$$-$(date -u +%s)"
cleanup() {
  # Nomes/IDs criados exclusivamente por este processo; nunca usa compose down nem volumes da aplicacao.
  docker rm -f "$app_container" >/dev/null 2>&1 || true
  if [[ -n "$db_container" ]]; then docker rm -f "$db_container" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Falha em vez de baixar imagens durante a rotina. Instalar previamente a imagem PostgreSQL aprovada.
postgres_image=${RESTORE_POSTGRES_IMAGE:-postgres:17-alpine}
docker image inspect "$postgres_image" >/dev/null
docker image inspect "$app_image" >/dev/null
db_container=$(docker run --detach --pull never --network none --read-only \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size="${RESTORE_TMPFS_SIZE:-1g}" \
  --tmpfs /var/run/postgresql:rw,nosuid,noexec,size=16m \
  --tmpfs /tmp:rw,nosuid,noexec,size=16m \
  --env POSTGRES_USER=restore_check --env POSTGRES_DB=restore_check \
  --env POSTGRES_HOST_AUTH_METHOD=trust "$postgres_image")

ready=0
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$db_container" pg_isready -U restore_check -d restore_check >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || fail 'PostgreSQL isolado nao ficou pronto.'

# Senha e arquivo entram por stdin, nunca pela linha de comando, ambiente do container ou log.
# O namespace de rede e o PostgreSQL sao exclusivos deste teste; nao ha acesso ao site nem ao banco real.
{ printf '%s\n' "$passphrase"; cat -- "$archive"; } | docker run --rm --interactive --pull never \
  --name "$app_container" --network "container:$db_container" --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --env NODE_ENV=production \
  --env DATABASE_URL=postgresql://restore_check@127.0.0.1:5432/restore_check \
  --workdir /app "$app_image" node --input-type=module -e '
import {readFileSync} from "node:fs";
import {openDB,migrate} from "./api/db.mjs";
import {restore,TABELAS,FORA,RESTORED_PASSWORD} from "./api/backup.mjs";
const input=readFileSync(0,"utf8"), newline=input.indexOf("\n");
if(newline<16)throw new Error("Credencial invalida");
const db=await openDB();
try {
  await migrate(db);
  const counts=await restore(db,JSON.parse(input.slice(newline+1)),input.slice(0,newline));
  for(const table of TABELAS) {
    const actual=(await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    if(actual!==counts[table])throw new Error("Contagem restaurada divergente");
  }
  for(const table of FORA.filter(t=>t!=="schema_migrations")) {
    if((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n!==0)throw new Error("Credencial temporaria restaurada");
  }
  if((await db.query("SELECT count(*)::int AS n FROM users WHERE password_hash<>$1 OR totp_secret IS NOT NULL OR totp_ativo OR totp_ultimo_passo IS NOT NULL",[RESTORED_PASSWORD])).rows[0].n)throw new Error("Credenciais restauradas indevidamente");
  if((await db.query("SELECT count(*)::int AS n FROM imports WHERE status=$1 OR previa IS NOT NULL",["previa"])).rows[0].n)throw new Error("Previa pessoal restaurada");
  console.log("Restauracao isolada: schema, contagens e exclusao de credenciais conferidos.");
} catch {console.error("A restauracao isolada falhou. Backup nao aprovado; detalhes pessoais nao sao registrados.");process.exitCode=1;}
finally {await db.close();}
'
unset passphrase
