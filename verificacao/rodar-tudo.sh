#!/usr/bin/env bash
# Verificação de uma etapa: regras, tipos e build; a suíte nova em dev; todas em produção, em paralelo.
# Uso: bash verificacao/rodar-tudo.sh <suíte nova> <suítes anteriores...>
# Sem nomes de suíte, roda só regras, tipos e build. Precisa do `npm run dev` na porta 3000.
# Cada suíte usa o próprio Chrome e a própria porta, então podem rodar juntas. VERIFICACAO_PARALELO muda quantas.
# Fotos, perfil do Chrome e registros ficam na pasta de trabalho (VERIFICACAO_PASTA).
AQUI="$(cd "$(dirname "$0")" && pwd)"
R="$(cd "$AQUI/.." && pwd)"
SP="${VERIFICACAO_PASTA:-$(cygpath -u "$TEMP")/central-numa-verificacao}"
mkdir -p "$SP"
SPW="$(cygpath -m "$SP")"
PORTA=3101
PARALELO="${VERIFICACAO_PARALELO:-4}"
NOVA="$1"
[ $# -gt 0 ] && shift

resumo() { grep -E '^(FALHA|ERRO|===|    estado)|^(EXCEÇÃO|ERROR|WARNING|LOG)' | cut -c1-520; }

cd "$R" || exit 1
inicio=$SECONDS
echo "=== regras"; npx vitest run 2>&1 | grep -E "Test Files|Tests  |FAIL|AssertionError" | cut -c1-200
echo "=== tipos"; npx tsc --noEmit 2>&1 | head -12 | cut -c1-200; echo "(fim)"
echo "=== build"; npm run build 2>&1 | grep -E "Compiled|rror|Failed" | head -6 | cut -c1-200
[ -z "$NOVA" ] && { echo "=== FIM em $((SECONDS - inicio))s"; exit 0; }
sleep 2

cd "$AQUI" || exit 1
echo "=== dev: $NOVA"; node "$NOVA.mjs" "$SPW" 2>&1 | tee "$SP/log-$NOVA-dev.txt" | resumo

cd "$R" || exit 1
(npx next start -p "$PORTA" > "$SP/start.log" 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null --max-time 2 "http://localhost:$PORTA/configuracoes" && break; sleep 1; done

cd "$AQUI" || exit 1
ativas=0
for suite in "$NOVA" "$@"; do
  node "$suite.mjs" "$SPW" "http://localhost:$PORTA" > "$SP/log-$suite-prod.txt" 2>&1 &
  ativas=$((ativas + 1))
  if [ "$ativas" -ge "$PARALELO" ]; then
    wait -n
    ativas=$((ativas - 1))
  fi
done
wait

for suite in "$NOVA" "$@"; do
  echo "=== produção: $suite"; resumo < "$SP/log-$suite-prod.txt"
done
PID=$(netstat -ano | grep ":$PORTA " | grep -i listen | awk '{print $NF}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F //T > /dev/null 2>&1
echo "=== FIM em $((SECONDS - inicio))s"
