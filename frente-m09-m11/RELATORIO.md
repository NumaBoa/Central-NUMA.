# Frente M09 · M10 · M11: relatório

Relatório próprio desta frente, para ser incorporado ao Mapa (`../Prototipos/Mapa-do-Prototipo.md`) e a `17 §3` na integração. O Mapa não foi alterado daqui. Tudo abaixo está **Construído em 07/11/2026**, sem validação de Kimberly.

## Base e isolamento

- **Worktree:** `Desktop\Numa\central-numa-m09-m11` · **Branch:** `frente/m09-m10-m11`
- **Base:** `revisao-m03` em `c6f9828` (T03.06). Depois do início, a aba do M03 fez `ec97ab7` em `revisao-m03`; esta branch não o incorporou. O `main` (`0605053`) não tem `JanelaFormulario` nem os filtros em linha: **esta frente depende de `revisao-m03` entrar no `main` antes dela.**
- **Alterações alheias na pasta principal no início:** `CLAUDE.md`, `meu-dia/rotinas/formulario-rotina.tsx`, `padroes/filtros-em-linha.tsx`, `Especificacao-Central-Numa.md`. Nenhuma foi tocada.
- Servidor próprio na porta 3117 e Chrome nas portas 9391 em diante; nenhum servidor de outra aba foi usado ou encerrado.

## Commits

| Commit | Bloco |
|---|---|
| `1aa9789` | Base: tabelas, migração, MOD-SAAS-LIC v2.0 em rascunho, motor de modelos, contrato com M07, "Sócias pessoas físicas", chaves de Legal |
| `36e0ad9` | M09: T09.02, T09.03, T09.04, T09.06 e T09.07, e os alertas legais no Meu dia |
| `e709fdf` | Regras de M10 e M11, com os testes dos critérios de aceite |
| `27a6126` | M10: T10.01 a T10.08 |
| `b456275` | M11: T11.01 a T11.13 (F1) e T11.14 |
| `9ffaa2a` | Suítes: versão dos dados 16 (só a asserção de `versao_dados`, em 12 suítes) |
| (último) | Verificação no navegador, ajuste do editor de modelos em 360px e estes documentos |

## Telas construídas

| Tela | Situação | Observações |
|---|---|---|
| T09.02 Documentos legais | Construída em 07/11/2026 | Validação no registro (pedido, decisão, observações, motivo na devolução); publicação com RN-09.04; V2 substitui a V1 na data; revisão sem alterações; comparação de texto |
| T09.03 Inventário | Construída | RN-09.06 marca a política vigente e gera o alerta; RN-09.09 lista ferramentas sem operação; sugestão para o Anexo II |
| T09.04 Solicitações de titulares | Construída | Prazo sem padrão universal: configurável em T02.01, vazio fica "Prazo a definir"; resposta com evidência |
| T09.06 Cláusulas · T09.07 Modelos | Construídas | Versão fixa por bloco (CA-09.05), blocos de cláusula, texto, tabela de itens, condicional e assinaturas, prévia, variáveis obrigatórias ou opcionais |
| T10.01 a T10.08 | Construídas | Ver §Decisões; sem o M07, só itens sob medida entram |
| T11.01 a T11.13 | Construídas (F1) | Reajuste (T11.10), comparação de aditivos, repasses e Operação são F2 e não aparecem como funcionando |
| T11.14 | Construída | Prévia ao vivo, variáveis vazias clicáveis, limites legais ao salvar (CA-11.16) |
| T09.01, T09.05, T09.08 | Fora do recorte | |

## Decisões vigentes aplicadas

1. M09 é módulo próprio (`/legal`), com Documentos legais, Privacidade (Inventário e Solicitações) e Modelos e cláusulas.
2. Validação dentro do registro, sem fila. `podeValidar()` é o único ponto a mudar quando `legal.validar` existir (03 §0).
3. Desconto sem limite: justificativa obrigatória para a emissão final, com autor e data gravados no item. Não há `desconto_aprovacao`. Condição especial em T11.14: valor, duração e motivo.
4. Limite do recurso com quatro casos (limitado, ilimitado, não se aplica, não informado). Não informado bloqueia a emissão e nunca sai como "Ilimitado".
5. Fluxo do contrato: enviar para revisão → emitir final (só em revisão) → aprovar para envio (exige o final emitido) → registrar envio → registrar assinatura. Devolver volta a rascunho, com motivo.
6. MOD-SAAS-LIC v2.0 entra na carga em Rascunho, com a ressalva. Emitir final com ele pede "Emitir com modelo não validado" e motivo; o documento sai com o aviso.
7. Termos de Assinatura públicos: gerados do modelo sem contraparte, com aceite eletrônico, como rascunho em T09.02, e seguem validação e publicação.
8. Inventário só sugere o Anexo II (`sugestaoDoAnexoII`); o contrato lê a configuração do produto.
9. Parâmetros do produto vêm de T07.10, oferta e preço do M07, dados do cliente de M11. Nenhum cadastro de produto em M11.
10. Documento emitido guarda os nós e os dados; a versão assinada guarda o retrato das partes. Correção administrativa não mexe neles (CA-11.02); mudar cadastro, cláusula, modelo ou configuração não reescreve nada (CA-11.04 e CA-11.17).
11. Sem prazo universal de 15 dias para titulares.
12. Os textos dos protótipos não foram usados como minuta. O único texto jurídico carregado é o arquivo do modelo SaaS, gerado por `scripts/gerar-modelo-saas.mjs` (rode de novo se o arquivo mudar; última geração em 07/11/2026, já com D-CTR-01 a D-CTR-04).

Também: entidade "Sócias pessoas físicas" sem solidariedade, sem recebedora no contrato e com proporções somando 100% (CA-11.18 e CA-11.21); plano anual sem devolução, em destaque (CA-11.20).

## Segurança do texto

O motor (`src/dominio/modelo-texto.ts`) não executa código: condições só em formas fechadas (`campo`, `=`, `≠`, `>`, `<`, `contém`), caminhos só leem propriedades próprias, e o resultado é uma estrutura de nós que o React mostra como texto. Valores digitados não viram formatação nem HTML. O PDF é a impressão do navegador.

## Verificações

- **Regras (Vitest):** 1160 testes, todos passando (eram 1101 na base). Novos: `modelo-texto.test.ts` (13), `legal.test.ts` (26), `comercial-contratos.test.ts` (33), cobrindo CA-09.01 a CA-09.06, CA-10.01 a CA-10.03, CA-11.02 a CA-11.08, CA-11.10 a CA-11.19 e CA-11.21.
- **Tipos e build:** `tsc --noEmit` sem erros; `next build` concluído, com as 19 rotas novas.
- **Navegador (`verificacao/f1-m09-m11.mjs`), build de produção:** 137 verificações, 0 falhas, console limpo. As 14 rotas em 1440, 768 e 360px sem rolagem lateral, sem texto abaixo de 12px, toques de 44px e campos de 16px no celular; e os fluxos de M09 (validação e bloqueio da publicação), M10 (próxima ação no Meu dia, item sob medida, pendências) e M11 (assistente e T11.14 sem catálogo, CA-11.16).
- **Regressão:** ver §Regressão no fim.

## Pendências e limitações reais

- **Catálogo do M07 ausente.** Sem ele, nenhuma oferta entra em proposta ou contrato, nenhum produto tem configuração validada e nenhum contrato SaaS emite o final. As pendências explicam. Os fluxos completos de T11.14 e de proposta com oferta foram verificados só com o catálogo de exemplo, nos testes de regras: **não estão concluídos de ponta a ponta no sistema real**.
- **Receita por canal (T05.12)** não existe: a adesão padrão não mostra assinantes nem receita.
- **Assinatura eletrônica:** registro manual de envio, assinatura e evidências (D25). Plataforma é texto.
- **Biblioteca (M08):** o PDF é impresso pelo navegador e o link do Drive é registrado à mão em `/documentos/[id]`; não há item de biblioteca com classe INT (T10.06).
- **Reajuste, aditivo financeiro e repasses:** F2. Ativar programação de um aditivo é recusado com a mensagem da RN-11.19.
- **Arrastar no funil:** não há; mover é o comando do cartão (acessível por teclado). O quadro no celular vira abas por etapa.
- **Entidade PJ, representante e cargo:** o cargo usa `pessoa.funcao`.
- **Dados que só Kimberly tem**, e que ficam vazios: encarregado e canal do titular, prazo do titular, proporções das sócias, endereços das licenciantes, Anexo II real, prazos de suporte, e o parecer jurídico do MOD-SAAS-LIC.

## A revisar por Kimberly

- Renegociar mantém a renovação "Em análise" (não há estado próprio).
- Termos públicos: a tabela de todos os planos vai ao fim do texto, porque o modelo v2.0 descreve um plano por vez.
- Correção de evento de assinatura não é permitida aqui (a data segue o arquivo assinado).
- T10.01 é uma visão comercial sobre o mesmo cadastro, em `/comercial/contrapartes`; editar o cadastro abre T02.06. As abas novas não foram postas na ficha de T02.06, para não mexer em tela de outra etapa.
- Mudanças em relação aos protótipos: o funil não tem "Agendar ação" dentro do cartão, mas a faixa na ficha; os valores das abertas aparecem numa linha, com "sem valor" separado, em vez de "R$ 0".

## Regressão

Suítes anteriores no build de produção desta branch (porta 3117), rodadas uma por vez:

| Suíte | Resultado |
|---|---|
| `m03` (Meu dia, a mais recente) | 253 OK, 0 falhas |
| `janela` | 151 OK, 0 falhas, console limpo |
| `entrega2` | 82 OK, 0 falhas |
| `t0202` | 153 OK, 0 falhas |
| `t0205` | 248 OK, 0 falhas |
| `entrega1` | 109 OK, 1 falha: "painel de 480px" |
| `f0a` | 52 OK, 1 falha: o painel do alerta mostra "Origem: Financeiro · Vencimento próximo", e a suíte espera "Motivo:" |
| `t1303` | 81 OK, 1 falha: a busca abre a atividade e espera o campo `painel-titulo` |

As três falhas vêm da base, e não desta frente: a janela central em todo o sistema (`465c3de`) e o texto novo do painel (`c012d34`, em `janela-atividade.tsx`) mudaram o que essas suítes antigas conferem. Esta branch não muda nada em `componentes/padroes`, em `meu-dia` nem em `janela-atividade.tsx`. Corrigir essas suítes cabe à frente do M03, ou à integração. Na primeira rodada, as oito suítes em paralelo deram tempos esgotados; uma por vez, eles sumiram.

## Como integrar

1. Junte `revisao-m03` ao `main` primeiro: esta branch nasceu dela (`c6f9828`) e usa `JanelaFormulario` e os filtros em linha, que o `main` ainda não tem.
2. Junte `frente/m09-m10-m11`. Conflitos esperados: `VERSAO_DADOS` (o M07 também usa 16: use 17, mantenha as duas migrações e troque o número nas suítes) e as listas aditivas em `tabelas.ts`, `repositorios.ts`, `carga.ts`, `atividades.ts`, `atividades-painel.ts` e `rotinas.ts`, em que ficam as duas entradas.
3. Rode `npm test`, `npm run typecheck`, `npm run build` e `verificacao/f1-m09-m11.mjs` com as suítes anteriores.
4. Frente do menu: habilite as rotas da tabela de `INTEGRACAO.md §1` em `navegacao.ts`.
5. Quando o catálogo do M07 existir, ligue-o em `src/integracoes/conexoes.ts` (`INTEGRACAO.md §3`). Só então o fluxo de oferta e de T11.14 pode ser verificado de ponta a ponta no sistema.
6. Leve as telas a `17 §3` e ao Mapa como **Construídas em 07/11/2026**, e as propostas de `INTEGRACAO.md §7` aos arquivos da especificação.
