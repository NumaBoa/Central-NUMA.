#!/usr/bin/env bash
# Só as suítes em produção, em paralelo, sobre o build que já existe. Uso: bash verificacao/rodar-producao.sh <suítes...>
AQUI="$(cd "$(dirname "$0")" && pwd)"
R="$(cd "$AQUI/.." && pwd)"
SP="${VERIFICACAO_PASTA:-$(cygpath -u "$TEMP")/central-numa-verificacao}"
mkdir -p "$SP"
SPW="$(cygpath -m "$SP")"
PORTA=3101
PARALELO="${VERIFICACAO_PARALELO:-4}"
resumo() { grep -E '^(FALHA|ERRO|===|    estado)|^(EXCEÇÃO|ERROR|WARNING|LOG)' | cut -c1-520; }
cd "$R" || exit 1
(npx next start -p "$PORTA" > "$SP/start.log" 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null --max-time 2 "http://localhost:$PORTA/configuracoes" && break; sleep 1; done
cd "$AQUI" || exit 1
ativas=0
for suite in "$@"; do
  node "$suite.mjs" "$SPW" "http://localhost:$PORTA" > "$SP/log-$suite-prod.txt" 2>&1 &
  ativas=$((ativas + 1))
  if [ "$ativas" -ge "$PARALELO" ]; then
    wait -n
    ativas=$((ativas - 1))
  fi
done
wait
for suite in "$@"; do
  echo "=== produção: $suite"; resumo < "$SP/log-$suite-prod.txt"
done
PID=$(netstat -ano | grep ":$PORTA " | grep -i listen | awk '{print $NF}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F //T > /dev/null 2>&1
echo "produção encerrada"
