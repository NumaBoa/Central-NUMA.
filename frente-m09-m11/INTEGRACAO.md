# Frente M09 · M10 · M11: documento de integração

Para as frentes do M03 (menu e Meu dia), do M07 (produtos, ofertas e preços), do M05 (financeiro) e para quem juntar as branches.

## 1. Rotas para a frente do menu (M03)

Todas existem e funcionam sem o menu. Hoje, em `src/dominio/navegacao.ts`, os três módulos estão sem `href` e aparecem "Em breve". Para habilitar, basta pôr o `href`; a fase de cada um já está certa no menu (`comercial` e `contratos` = F1, `legal` = F0b).

| Módulo (id em `navegacao.ts`) | `href` a usar | Rótulo no menu | Condição para aparecer habilitado |
|---|---|---|---|
| `legal` | `/legal` | Legal e privacidade | `fase_ativa` ≥ F0b (já é a regra de `moduloDisponivel`) |
| `comercial` | `/comercial` | Comercial | `fase_ativa` ≥ F1 |
| `contratos` | `/contratos` | Contratos | `fase_ativa` ≥ F1 |

Rotas internas, para a busca global, os atalhos e o "+ Novo":

| Rota | Tela |
|---|---|
| `/legal` | T09.02 Documentos legais (lista) |
| `/legal/documentos/[id]` | T09.02 ficha, validação e publicação |
| `/legal/privacidade` | T09.03 Inventário |
| `/legal/privacidade/solicitacoes` | T09.04 Solicitações de titulares |
| `/legal/modelos` · `/legal/modelos/[id]` | T09.07 Modelos (lista e editor) |
| `/legal/modelos/clausulas` | T09.06 Biblioteca de cláusulas |
| `/comercial` | T10.02 Funil (quadro e lista) |
| `/comercial/oportunidades/[id]` | T10.03 e T10.04 |
| `/comercial/propostas` · `/comercial/propostas/[id]` | T10.05 a T10.08 |
| `/comercial/contrapartes` · `/comercial/contrapartes/[id]` | T10.01 |
| `/contratos` | T11.01 |
| `/contratos/novo` | T11.03, início |
| `/contratos/[id]` | T11.02, com T11.06, T11.07, T11.08, T11.09 e T11.12 em janelas |
| `/contratos/[id]/editar` | T11.03 e T11.04 (ou T11.14, se o contrato for SaaS) |
| `/contratos/assinatura/novo` | T11.14, início |
| `/contratos/renovacao` | T11.11 |
| `/contratos/adesoes` | T11.13 |
| `/documentos/[id]` | Documento emitido (T10.06 e T11.05), com impressão em PDF |

Sugestão para o "+ Novo" (02 §4, "Oportunidade na F1"): `/comercial` com a janela de nova oportunidade. Não foi feito aqui, porque é componente do menu.

## 2. Meu dia (M03): o que já está ligado

Arquivo novo, sem importações: `src/dominio/integracoes/meu-dia-f1.ts`. Entrou por espalhamento (`...`), em três linhas de arquivos do M03:

| Arquivo | Linha acrescentada |
|---|---|
| `src/dominio/atividades.ts` | `...ACOES_DE_ALERTA_F1` em `ACOES_DE_ALERTA`; `...ROTULOS_ORIGEM_ALERTA_F1` em `ROTULOS_ORIGEM_ALERTA` |
| `src/dominio/atividades-painel.ts` | `...REGISTROS_VINCULAVEIS_F1` em `REGISTROS_VINCULAVEIS`; `...ORIGEM_DO_ALERTA_F1` em `ORIGEM_DO_ALERTA` |
| `src/dominio/rotinas.ts` | "Gerar alertas" soma `gerarAlertasF1()`; "Atualizar situações" soma `atualizarSituacoesF1()`; "Estender programação" soma `estenderProgramacaoDosContratos()`. A ordem e os nomes das rotinas não mudaram |

- **Próxima ação comercial** (RN-10.02): é uma tarefa do Meu dia criada por `criarAtividade` (M03), com `vinculo` `oportunidade:<id>`. Não há lista paralela.
- **Alertas** (05-M03 §5, linhas F1): revisão de documento legal, prazo do titular (só com prazo definido), validade da proposta (3 dias antes), assinatura pendente (5 dias após o envio), renovação (data-limite − 30 dias) e obrigação contratual (7 dias antes). Todos pelo motor `sincronizarAlertas`, idempotentes.
- **Atividades de saída** do encerramento e a comunicação de "não renovar" também são tarefas do M03, vinculadas ao contrato.
- **Filtro "Origem"** do Meu dia passa a mostrar Legal, Comercial e Contratos.

## 3. Produtos, ofertas e preços (M07): o contrato de integração

> **Conectado em 07/11/2026**, na junção ao `main`: `catalogoPadrao` é `catalogoDoM07` (`src/dominio/integracoes/catalogo-m07.ts`). Os campos novos de §3.2 e a T07.10 foram construídos na mesma data (versão dos dados 18): o catálogo entrega a oferta completa e a configuração Validada. Ainda falta o `limite_tipo` (o texto do limite só vira número quando é um número). A versão dos dados ficou 17: 16 do M07 e 17 desta frente.

**Proprietário:** frente do M07. **Ponto de conexão:** `src/dominio/integracoes/conexoes.ts`, função `catalogoComercial()`. Hoje devolve `catalogoAusente`. Para conectar, troque a constante `catalogoPadrao` por um adaptador que implemente a interface `CatalogoComercial` de `src/dominio/integracoes/catalogo-comercial.ts` sobre os repositórios do M07. Nada mais em M10 e M11 muda.

### 3.1 A interface

| Método | Entrada | Saída | Regra que a frente do M07 garante |
|---|---|---|---|
| `estado` | | `'conectado'` | `'exemplo'` só em desenvolvimento |
| `ofertasDoProduto(produtoId)` | id do produto | `OfertaDoCatalogo[]` | todas, em qualquer situação; M10 e M11 filtram as Aprovadas |
| `oferta(ofertaId)` | id | `OfertaDoCatalogo \| null` | |
| `canais()` | | `CanalDoCatalogo[]` | com `cobranca` (`Direto`, `Gateway`, `Google Play`) e `gateway_nome` |
| `precosDaOferta(ofertaId)` | id | `PrecoDoCatalogo[]` | todas as versões; `valor` vazio é `null` (RN-07.02). Quem escolhe a vigente é `precoVigente` (canal, periodicidade, data) |
| `configuracaoValidada(produtoId)` | id | `ConfiguracaoContratual \| null` | só a versão Validada vigente (RN-11.30) |
| `configuracaoMaisRecente(produtoId)` | id | `ConfiguracaoContratual \| null` | a mais recente, em qualquer situação: serve para explicar a pendência |

### 3.2 Campos novos da oferta (T07.04, 19 §8)

Em `OfertaDoCatalogo`, além do que 16 §4.7 já tem:

| Campo | Tipo | Uso |
|---|---|---|
| `regras_uso` | texto | Anexo I, item 5 |
| `suporte` | `{ canal, horario, prazo_critico, prazo_normal }` | Quadro-resumo e Anexo I, item 7 |
| `disponibilidade_meta` · `disponibilidade_compensacao` | número · texto, opcionais | cl. 11.4 e Anexo I, item 8 |
| `teste_dias` | inteiro | padrão do teste em T11.14 |
| `adicionais_ids` | ids de ofertas | adicionais do plano, cada um com preço aprovado próprio |
| `recursos[].limite` | `limitado` (valor e unidade) · `ilimitado` · `nao_se_aplica` · `nao_informado` | **decisão vigente 4**: limite vazio não é ilimitado. `nao_informado` bloqueia a emissão final |
| `recursos[].planejado` · `disponivel_previsto_em` | | RN-10.07 |

**Ajuste pedido ao M07:** `oferta_recurso.limite` em 16 §4.7 é um texto livre. Proponho guardar o tipo explícito (`limite_tipo`) e o valor, e não tratar vazio como ilimitado (19 RN-11.32 diz o contrário e precisa mudar; ver §7).

### 3.3 T07.10, configuração contratual do produto

`ConfiguracaoContratual` traz, um a um, os campos de 19 §4, com `versao` e `situacao` (Rascunho → Em validação → Validada → Substituída). Texto vazio é `null`, nunca um padrão: `camposVaziosDaConfiguracao` lista o que bloqueia a emissão (RN-11.35 g). `suboperadores` é lista `{ nome, finalidade, pais }`; `modalidades` e `formatos_exportacao` são listas.

**Anexo II pelo inventário (decisão vigente 8):** `sugestaoDoAnexoII(produtoId)`, em `src/dominio/legal.ts`, devolve categorias de dados, titulares e as ferramentas do inventário (T09.03). É só sugestão: a tela de T07.10 mostra, a pessoa confere e grava na configuração. M11 nunca lê o inventário direto para o contrato.

**Link para a pendência:** M11 leva a `/configuracoes/cadastros/marcas/produtos/[id]` (a ficha atual do produto). Quando a aba "Contrato" existir, troque o link em `contrato-saas.ts` (`pendenciasSaas`) pela âncora dela.

### 3.4 Implementação de exemplo

`src/dominio/integracoes/catalogo-de-exemplo.ts`: só para testes e para desenvolvimento, com `NEXT_PUBLIC_CATALOGO_EXEMPLO=1` e nunca em build de produção. As telas mostram a faixa "Catálogo de EXEMPLO". Os valores vêm da proposta de 19 §9 e não foram aprovados.

## 4. Financeiro (M05)

- **Ativação da programação** (T11.07) cria títulos pelo próprio repositório do M05: `origem: 'contrato'`, `origem_id` = contrato, `chave_idempotencia` = `contrato:<id>:<versão>:<item>:<início do período>`, `situacao: 'previsto'`, rateio de 100% no produto do item, natureza "a receber" (ou "a pagar" para fornecedor). Ativar de novo não duplica (CA-11.06). Depois, `sincronizarAlertasDosTitulos` do M05.
- **Pedido ao M05:** `titulo` não tem `contrato_id` e `item_contrato_id` (16 §4.5). Hoje a ligação está em `origem_id` e na chave. Ao acrescentar os campos, a migração pode preenchê-los lendo a chave.
- **Encerramento** cancela só os títulos futuros sem baixa, com o motivo; suspensão marca `suspenso: true`.
- **Ausente:** receita por canal (T05.12). A adesão padrão (T11.13) mostra "Depende de T05.12" no lugar de assinantes e receita.

## 5. Entidades (M02): o tipo "Sócias pessoas físicas"

Acrescentado em T02.05 (19 §8, D-CTR-01 e D-CTR-06): `tipo_pessoa: 'socias_pf'`, com `entidade_socias` (marca comercial) e `entidade_licenciante` (nome civil, nacionalidade, CPF, endereço como texto, e-mail e proporção de responsabilidade). Sem solidariedade e sem recebedora no contrato (D-CTR-02). Ativa sem CNPJ, com as proporções somando 100%.

## 6. Alterações compartilhadas (integrar com cuidado)

Todas aditivas, nos commits indicados:

| Arquivo | O que mudou | Commit |
|---|---|---|
| `src/dados/tabelas.ts` | `...TABELAS_F1` e `VERSAO_DADOS = 16` | Base |
| `src/dados/repositorios.ts` | `& RepositoriosF1` e `...repositoriosF1` | Base |
| `src/dados/carga.ts` | `acrescentarTabelasF1` na migração; MOD-SAAS-LIC nos valores iniciais | Base |
| `src/dominio/dados.ts` | tabelas de F1 fora da contagem de cadastros | Base |
| `src/dados/tipos/configuracao.ts` | 4 chaves: `encarregado_pessoa_id`, `canal_titular_email`, `prazo_resposta_titular_dias` (vazio), `validade_proposta_dias` (15) | Base |
| `src/dados/tipos/contraparte.ts` | `socias_pf` em `entidade.tipo_pessoa` | Base |
| `src/dominio/entidades.ts` e `tela-entidades.tsx` | campos das sócias | Base |
| `src/app/(central)/configuracoes/painel-geral.tsx` | seção "Legal e comercial" | Base |
| `src/dominio/atividades.ts`, `atividades-painel.ts`, `rotinas.ts` | ver §2 | M09 e regras de M10/M11 |

**Conflito certo:** a frente do M07 (na pasta principal, ramo `revisao-m03`, ainda sem commit quando esta frente começou) também sobe `VERSAO_DADOS` para 16. Quem entrar por último usa 17, mantém as duas migrações e troca o número esperado nas suítes. A migração desta frente não depende do número: `acrescentarTabelasF1` só cria as tabelas que faltam.

**As suítes de navegador** conferem números da carga (`Registros151`, `51 de exemplo`): esta frente não muda esses números (MOD-SAAS-LIC fica fora da contagem e não é exemplo). Elas também conferem `versao_dados`: o commit "Suítes: versão dos dados 16" troca 15 por 16 em 12 suítes (`t0201`, `t0202`, `t0204`, `t0205`, `t0207`, `t0301`, `t0302`, `t0304`, `t0401`, `t0404`, `t0501`, `t1303`), só nessa asserção, como pede o `CLAUDE.md`. Se o número final for outro, repita a troca.

## 7. Propostas de atualização das especificações

| Onde | Ajuste |
|---|---|
| 11-M09 §3, RN-09.08 e T09.08 | Validação no próprio registro, sem fila (decisão vigente 2). Fila fica fora do recorte |
| 11-M09 RN-09.10 e §5 | Prazo do titular sem padrão de 15 dias: configurável, vazio fica pendente (decisão 11) |
| 12-M10 §5 e 16 §4.10 | Remover `desconto_aprovacao`; o item guarda justificativa, autor e data |
| 13-M11 T11.04 | Tirar "Desconto acima do limite sem aprovação" |
| 13-M11 RN-11.07, T11.05 e 19 §5 etapa 5 | Fluxo: conferir/revisar → emitir final → aprovar para envio → enviar → assinar. "Emitir final só depois da aprovação" cria ciclo |
| 19 RN-11.31 e etapa 2 | Condição especial sem aprovação por limite: valor, duração e motivo |
| 19 RN-11.32 | "Limite vazio sai como Ilimitado" troca por quatro casos explícitos; não informado bloqueia (decisão 4) |
| 19 RN-11.37 | O modelo v2.0 descreve um plano por vez. Os Termos públicos aqui levam a tabela dos planos ao fim, como dado. Proposta: `[PARA CADA planos]` no Quadro-resumo e no Anexo I |
| 13-M11 T11.11 | "Renegociar" mantém `renovacao_situacao = em_analise` e fica registrado em `renovacao_decisao` |
| 16 §4.11 | `contrato_versao.fluxo` (situação documental por versão, para aditivos), `contrato.vigencia_prorrogada_ate` (renovação automática sem reescrever a versão assinada), `contrato.administrativo`, `item_contrato.tipo_item` e `justificativa_valor`, `entidade_socias` e `entidade_licenciante` |
