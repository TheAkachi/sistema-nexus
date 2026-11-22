#!/usr/bin/env bash
# Backup diario + restauracao isolada + copia externa. Nao instala nem altera servicos.
set -euo pipefail
umask 077

fail() { printf 'Backup Nexus: %s\n' "$1" >&2; exit 1; }
for command in docker flock realpath stat mktemp sha256sum ssh scp find gzip; do
  command -v "$command" >/dev/null || fail "comando ausente: $command"
done
compose_file=${COMPOSE_FILE:-/docker/sistema-nexus/docker-compose.yml}
backup_dir=${BACKUP_DIR:-/var/backups/sistema-nexus}
retention=${RETENTION_DAYS:-30}
secret_file=${BACKUP_PASSPHRASE_FILE:-${CREDENTIALS_DIRECTORY:-/etc/nexus-backup}/passphrase}
[[ "$backup_dir" == /* && "$backup_dir" != / && ! -L "$backup_dir" ]] || fail 'BACKUP_DIR precisa ser diretorio absoluto dedicado.'
[[ "$retention" =~ ^[0-9]+$ && "$retention" -ge 7 && "$retention" -le 3650 ]] || fail 'RETENTION_DAYS precisa estar entre 7 e 3650.'
[[ -n ${OFFSITE_HOST:-} && "$OFFSITE_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.@-]*$ ]] || fail 'configure OFFSITE_HOST (alias SSH ou usuario@host).'
[[ ${OFFSITE_DIR:-} =~ ^/[a-zA-Z0-9_./-]+$ && "$OFFSITE_DIR" != / && "$OFFSITE_DIR" != *'/../'* && "$OFFSITE_DIR" != */.. ]] || fail 'configure OFFSITE_DIR absoluto, dedicado e sem espacos.'
[[ -f ${SSH_KEY:-} && -f ${SSH_KNOWN_HOSTS:-} ]] || fail 'configure SSH_KEY e SSH_KNOWN_HOSTS.'
[[ -f "$secret_file" && ! -L "$secret_file" ]] || fail 'arquivo da senha ausente ou link simbolico.'
[[ $(stat -c %u "$secret_file") == "$EUID" ]] || fail 'credencial precisa pertencer ao usuario da rotina.'
mode=$(stat -c %a "$secret_file")
(( (8#$mode & 077) == 0 )) || fail 'credencial nao pode permitir acesso ao grupo ou a outros.'
mkdir -p -- "$backup_dir"
backup_dir=$(realpath -- "$backup_dir")
[[ "$backup_dir" != / ]] || fail 'diretorio resolvido nao pode ser a raiz.'
[[ $(stat -c %u "$backup_dir") == "$EUID" ]] || fail 'diretorio precisa pertencer ao usuario da rotina.'
mode=$(stat -c %a "$backup_dir")
(( (8#$mode & 077) == 0 )) || fail 'diretorio precisa ter permissao 700.'
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || fail 'outra execucao esta em andamento.'

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
passphrase=$(cat -- "$secret_file")
[[ ${#passphrase} -ge 16 && "$passphrase" != *$'\n'* && "$passphrase" != *$'\r'* ]] || fail 'a senha precisa ter uma linha com ao menos 16 caracteres.'
container=$(docker compose -f "$compose_file" ps -q app)
[[ "$container" =~ ^[a-f0-9]{12,64}$ ]] || fail 'esperada exatamente uma instancia do app em execucao.'
app_image=$(docker inspect --format '{{.Image}}' "$container")
[[ "$app_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'imagem da aplicacao nao identificada.'
name="gestao-$(date -u +%Y%m%dT%H%M%SZ)-$$.json"
temporary=$(mktemp "$backup_dir/.incompleto.XXXXXXXX")
image_temporary=''
cleanup() { rm -f -- "$temporary"; if [[ -n "$image_temporary" ]]; then rm -f -- "$image_temporary"; fi; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Chama somente a leitura do backup: nao executa migrate nem outro comando operacional do CLI.
printf '%s' "$passphrase" | docker exec -i "$container" node --input-type=module -e '
import {readFileSync} from "node:fs";
import {openDB} from "./api/db.mjs";
import {backup} from "./api/backup.mjs";
const db=await openDB();
try {process.stdout.write(JSON.stringify(await backup(db,readFileSync(0,"utf8"))));}
catch {console.error("Nao foi possivel gerar o backup. Confira o banco e a credencial sem registrar seus valores.");process.exitCode=1;}
finally {await db.close();}
' > "$temporary"
unset passphrase
[[ -s "$temporary" ]] || fail 'arquivo vazio.'
bash "$script_dir/restaurar-isolado.sh" "$temporary" "$app_image" "$secret_file"
archive="$backup_dir/$name"
mv -- "$temporary" "$archive"
printf '%s\n' "$app_image" > "$archive.image"

# Host key deve ser conferida por um canal independente antes da instalacao. Nunca aceita host novo automaticamente.
ssh_options=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20 -o IdentitiesOnly=yes \
  -i "$SSH_KEY" -o "UserKnownHostsFile=$SSH_KNOWN_HOSTS")
digest=$(sha256sum -- "$archive"); digest=${digest%% *}
# OFFSITE_DIR e os nomes abaixo foram restritos a caracteres seguros; expansao local intencional.
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$OFFSITE_HOST" "test -d '$OFFSITE_DIR'"

# O ID sha256 sozinho nao recupera uma imagem perdida. Preserva tambem a imagem
# exata da aplicacao fora da VPS, com codigo/dependencias/migracoes correspondentes.
image_name="image-${app_image#sha256:}.tar.gz"
image_temporary=$(mktemp "$backup_dir/.imagem.XXXXXXXX")
docker image save "$app_image" | gzip -c > "$image_temporary"
[[ -s "$image_temporary" ]] || fail 'imagem de recuperacao vazia.'
mv -- "$image_temporary" "$backup_dir/$image_name"
image_digest=$(sha256sum -- "$backup_dir/$image_name"); image_digest=${image_digest%% *}
# shellcheck disable=SC2029
if ! ssh "${ssh_options[@]}" "$OFFSITE_HOST" "printf '%s  %s\n' '$image_digest' '$OFFSITE_DIR/$image_name' | sha256sum -c - >/dev/null 2>&1"; then
  scp -q "${ssh_options[@]}" "$backup_dir/$image_name" "$OFFSITE_HOST:$OFFSITE_DIR/$image_name.part"
  # shellcheck disable=SC2029
  ssh "${ssh_options[@]}" "$OFFSITE_HOST" "set -eu; chmod 600 '$OFFSITE_DIR/$image_name.part'; printf '%s  %s\n' '$image_digest' '$OFFSITE_DIR/$image_name.part' | sha256sum -c - >/dev/null; mv '$OFFSITE_DIR/$image_name.part' '$OFFSITE_DIR/$image_name'"
fi
scp -q "${ssh_options[@]}" "$archive" "$OFFSITE_HOST:$OFFSITE_DIR/$name.part"
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$OFFSITE_HOST" "set -eu; chmod 600 '$OFFSITE_DIR/$name.part'; printf '%s  %s\n' '$digest' '$OFFSITE_DIR/$name.part' | sha256sum -c - >/dev/null; mv '$OFFSITE_DIR/$name.part' '$OFFSITE_DIR/$name'"
scp -q "${ssh_options[@]}" "$archive.image" "$OFFSITE_HOST:$OFFSITE_DIR/$name.image"
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$OFFSITE_HOST" "chmod 600 '$OFFSITE_DIR/$name.image'"

# Retencao local somente depois de backup novo restaurado, copia externa e checksum confirmados.
# Nao remove nada no destino externo, nem outros arquivos da pasta local.
# Imagens de recuperacao nao sao removidas automaticamente: podem atender backups mais antigos.
find "$backup_dir" -maxdepth 1 -type f \( -name 'gestao-*.json' -o -name 'gestao-*.json.image' \) -mtime +"$retention" -delete
printf 'Backup Nexus concluido: %s; restauracao isolada e copia externa verificadas.\n' "$name"
