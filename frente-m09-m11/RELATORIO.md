# Frente M09 · M10 · M11: relatório

Relatório próprio desta frente, para ser incorporado ao Mapa (`../Prototipos/Mapa-do-Prototipo.md`) e a `17 §3` na integração. O Mapa não foi alterado daqui.

## Base e isolamento

- **Worktree:** `Desktop\Numa\central-numa-m09-m11`
- **Branch:** `frente/m09-m10-m11`
- **Base:** `revisao-m03` em `c6f9828` (T03.06). O `main` está em `0605053`, 7 commits atrás: `JanelaFormulario` e os filtros em linha só existem em `revisao-m03`. **Esta frente depende de `revisao-m03` entrar no `main` antes dela.**
- **Alterações alheias na pasta principal na hora do início:** `CLAUDE.md`, `meu-dia/rotinas/formulario-rotina.tsx`, `padroes/filtros-em-linha.tsx` e `Especificacao-Central-Numa.md`. Nenhuma foi tocada.

## Reconhecimento (06/11/2026)

| Item | Situação na base |
|---|---|
| Contrapartes, entidades, pessoas, produtos, feriados | Existem. Entidade não tem o tipo "Sócias pessoas físicas" (`19 §8`) |
| Atividades, vínculos, alertas e rotinas (M03) | Existem: `vinculo`, `sincronizarAlertas`, `ROTINAS_DO_DIA` |
| Títulos e baixas (M05) | Existem. Não há serviço de títulos a receber de contrato |
| **Ofertas, canais, preços, T07.10 (M07)** | **Não existem nesta base.** Outra frente |
| Biblioteca de arquivos (M08) | Não existe. Documentos usam link do Drive |
| M09, M10, M11 | Nada construído |

## Sequência

1. Base de dados e contratos de integração.
2. M09 e preparação dos modelos (motor de `[SE]` e `[PARA CADA]`, carga de `MOD-SAAS-LIC` como rascunho).
3. M10 e a passagem de proposta para contrato.
4. M11 e a geração SaaS.
5. Integrações e regressão.

## Limites de arquivos

Novos, desta frente: `src/dados/tipos/{legal,comercial,contrato}.ts`, `src/dominio/*` listados em `INTEGRACAO.md`, `src/componentes/f1/*`, rotas `src/app/(central)/{legal,comercial,contratos}/*`, `verificacao/f1-*.mjs`.

Compartilhados, só com acréscimos: ver "Alterações compartilhadas" em `INTEGRACAO.md`.

Não tocados: menu, moldura, navegação, componentes do Meu dia, telas e regras do M07.
