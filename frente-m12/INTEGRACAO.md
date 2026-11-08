# Frente M12 Operação: como juntar ao `main`

Ramo `frente/m12`, worktree `central-numa-m12`, a partir do `main` em `2b573d3` (T05.08). Um commit por tela: T12.06, T12.01 e T12.02, T12.04, T12.03, T12.05, T12.07 e T12.08. Nada foi juntado ao `main`.

## Versão dos dados

- O M12 usa a **21**. A 20 é da T05.12 (outra sessão), e a frente do M06 também anotou 20 no 17 §3: as duas precisam se acertar entre si.
- A migração do M12 só acrescenta as tabelas que faltam (`acrescentarTabelasM12`, em `src/dados/carga-m12.ts`), seja qual for a versão de origem. Por isso a ordem de junção não importa: basta `VERSAO_DADOS` ser maior que a de todas as frentes já juntadas. Se o `main` estiver em 21 ou mais quando o M12 entrar, suba para o próximo número livre e troque o comentário em `src/dados/tabelas.ts` e a condição `versao < 21` em `src/dados/carga.ts`.
- As suítes que conferem a versão: `t0201`, `t0202`, `t0204`, `t0205`, `t0207`, `t0301`, `t0302`, `t0304`, `t0401`, `t0404`, `t0501` e `t1303` (`=== 21`). Ao renumerar, troque nelas também.
- O M12 não traz carga inicial: `Registros151` e `51 de exemplo` não mudam, e `apoio-testes.ts` ficou igual.

## Arquivos compartilhados que o M12 tocou (só o indispensável)

| Arquivo | O que mudou |
|---|---|
| `src/dados/tabelas.ts`, `repositorios.ts`, `carga.ts` | Espalham `TABELAS_M12`, `repositoriosM12` e a migração 21 |
| `src/dominio/dados.ts` | `TABELAS_M12_FORA_DA_CONTAGEM` |
| `src/dominio/navegacao.ts` | `href: '/operacao'` em Operação |
| `src/dominio/navegacao.test.ts`, `configuracoes.test.ts` | `operacao` nas listas de módulos construídos |
| `src/dominio/atividades.ts`, `atividades-painel.ts` | Espalham `integracoes/meu-dia-m12.ts` (ações, origens e vínculos) |
| `src/dominio/historico.ts` | Espalha `CAMPOS_LEGIVEIS_M12`; nova função `historicoDosRegistros` |
| `src/dominio/rotinas.ts` | `gerarAlertasM12()` em "Gerar alertas" |
| `src/dominio/sla.ts` (novo) | — |
| `src/app/(central)/contratos/[id]/ficha-contrato.tsx` | "Criar implantação" em Mais ações, aba Operação, e a faixa sem "Implantação é da F2" |
| `src/app/(central)/comercial/oportunidades/[id]/ficha-oportunidade.tsx` | Referência histórica por produto (T12.08), no lugar do texto fixo |
| `src/app/(central)/produtos/simulador/tela-simulador.tsx` | A média apontada abaixo de H (D20) |
| `verificacao/entrega1.mjs`, `t0201.mjs` | Módulos "Em breve" de 4 para 3 |

## Conflitos esperados

- **Contagem de "Em breve"** (`entrega1.mjs` e `t0201.mjs`): cada frente que libera um módulo tira um. Com M06 (Empresa) e M08 (Marca e marketing) juntados, sobra só Visão geral: 1.
- **Listas de módulos construídos** em `navegacao.test.ts` e `configuracoes.test.ts`: juntar as entradas de todas as frentes.
- **`navegacao.ts`**, **`atividades.ts`**, **`atividades-painel.ts`** e **`rotinas.ts`**: linhas vizinhas às de outras frentes; juntar as duas.

## Verificação

Regras com Vitest (`horas`, `implantacoes`, `sla`, `suporte`, `incidentes`, `notas`, `estimado`), tipos e build. Suítes de navegador `t1201`, `t1203` a `t1208`, com dados de teste gravados pela própria suíte (`verificacao/semear-m12.mjs`). A porta 3121 combinada estava ocupada pela frente do M06: usei 3140 (dev) e 3141 (produção), com `VERIFICACAO_PORTAS=60`.

## Visto e não mexido

- **M11:** duas parcelas do mesmo item no mesmo dia têm a mesma chave de idempotência, e a segunda não é lançada (detalhes no Mapa, "A revisar por Kimberly (M12)").
- **M09:** o incidente de segurança (T09.05) está fora do escopo; o incidente de disponibilidade com dados pessoais fica com a pendência registrada, sem vínculo.
