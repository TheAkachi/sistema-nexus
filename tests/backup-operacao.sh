#!/usr/bin/env bash
# Teste do controle operacional com Docker/SSH falsos. Nao testa containers reais.
set -euo pipefail
umask 077
project=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
scratch=$(mktemp -d /tmp/nexus-backup-test.XXXXXXXX)
cleanup() {
  [[ "$scratch" == /tmp/nexus-backup-test.* && -d "$scratch" ]] && rm -rf -- "$scratch"
}
trap cleanup EXIT
mkdir "$scratch/bin"
cat > "$scratch/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
case "$1" in
  compose) printf '%064d\n' 1 ;;
  inspect) printf 'sha256:%064d\n' 2 ;;
  image) if [[ "$2" == save ]]; then printf 'imagem-de-teste'; fi ;;
  exec) if [[ "$2" == -i ]]; then cat >/dev/null; printf '{"format":1}'; fi ;;
  run)
    if [[ "$2" == --detach ]]; then printf '%064d\n' 3
    else cat >/dev/null; [[ ${MOCK_RESTORE_FAIL:-0} != 1 ]]; fi ;;
  rm) : ;;
  *) exit 91 ;;
esac
MOCK
cat > "$scratch/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
set -eu
# Forca upload da imagem; as demais etapas remotas simulam sucesso.
[[ "$*" != *'sha256sum -c - >/dev/null 2>&1'* ]]
MOCK
cat > "$scratch/bin/scp" <<'MOCK'
#!/usr/bin/env bash
set -eu
[[ ${MOCK_COPY_FAIL:-0} != 1 ]]
MOCK
cat > "$scratch/bin/find" <<'MOCK'
#!/usr/bin/env bash
set -eu
printf 'retencao\n' >> "$MOCK_MARKER"
MOCK
chmod 700 "$scratch/bin/"*
printf '%s' 'senha-ficticia-apenas-para-teste' > "$scratch/passphrase"
touch "$scratch/id" "$scratch/hosts"
export PATH="$scratch/bin:$PATH"
export BACKUP_PASSPHRASE_FILE="$scratch/passphrase" SSH_KEY="$scratch/id" SSH_KNOWN_HOSTS="$scratch/hosts"
export OFFSITE_HOST=backup@exemplo.test OFFSITE_DIR=/backups/nexus
export MOCK_MARKER="$scratch/retencao"
for scenario in restore copia sucesso; do
  export BACKUP_DIR="$scratch/$scenario"
  export MOCK_RESTORE_FAIL=0 MOCK_COPY_FAIL=0
  if [[ "$scenario" == restore ]]; then export MOCK_RESTORE_FAIL=1; fi
  if [[ "$scenario" == copia ]]; then export MOCK_COPY_FAIL=1; fi
  result=0
  bash "$project/scripts/backup/executar.sh" > "$scratch/$scenario.log" 2>&1 || result=$?
  if [[ "$scenario" == sucesso ]]; then
    [[ "$result" == 0 && -f "$MOCK_MARKER" ]] || { cat "$scratch/$scenario.log"; exit 1; }
  else
    [[ "$result" != 0 && ! -e "$MOCK_MARKER" ]] || exit 1
  fi
  if grep -q 'senha-ficticia-apenas-para-teste' "$scratch/$scenario.log"; then exit 1; fi
done
printf 'Backup operacional: falha de restauracao/copia impede retencao; sucesso permite retencao; senha ausente dos logs.\n'
