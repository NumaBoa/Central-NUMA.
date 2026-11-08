# Frente M08: documento de integração

Para as frentes do menu e Meu dia (M03), do Financeiro (M05), de Produtos (M07), de Legal (M09), do Comercial (M10) e para quem juntar as branches.

Ramo `frente/m08`, no worktree `central-numa-m08`, criado a partir do `main` em `498005e`. Nada foi juntado ao `main`.

## 1. Rotas para a frente do menu

Em `src/dominio/navegacao.ts`, o módulo `marca` ("Marca e marketing", fase `f0b`) está sem `href` e aparece "Em breve". Para habilitar, basta pôr `href: '/marketing'`. O menu não foi alterado por esta frente.

| Rota | Tela | Fase |
|---|---|---|
| `/marketing` | T08.01 Biblioteca, em grade e lista. `?visao=lista` abre na lista; `?novo=1` abre "Adicionar arquivo" | F0b |
| `/marketing/arquivos/[id]` | T08.02 Ficha do arquivo | F0b |
| `/marketing/marcas` | T08.04 Identidade das marcas. `?marca=<id>` abre uma marca | F0b |
| `/marketing/apresentacoes` | T08.08 Apresentações | F0b |
| `/marketing/conteudo` | T08.05 Calendário editorial. `?peca=<id>` abre a peça | F1 |
| `/marketing/campanhas` · `/marketing/campanhas/[id]` | T08.06 Campanhas | F1 |
| `/marketing/listas` · `/marketing/listas/[id]` | T08.07 Listas de espera | F1 |

- **Abas do módulo:** ficam em `src/componentes/marketing/apoio.tsx` (`AbasMarketing`). As da F1 aparecem "Em breve", sem link, até a F1 ser ativada, como o menu (decisão de 05/11/2026). A rota direta funciona em qualquer fase, com uma faixa que diz isso.
- **"+ Novo":** sugestão, não feita aqui porque é componente do menu: `/marketing?novo=1`.

## 2. O que entra e o que sai

| Dependência | Situação | Como está ligado | O que falta |
|---|---|---|---|
| Marcas e produtos (M02) | Disponível | Lê os repositórios `marca` e `produto`. Nenhum cadastro novo | |
| Pessoas (M02) | Disponível | `pessoasDoSeletor` e a pessoa de "Você é" | |
| Etiquetas (T02.10) | Disponível | Módulo `biblioteca` e registro `arquivo` em `dominio/etiquetas.ts` | |
| Vínculos genéricos (`vinculo`) | Disponível | Campanha com lançamento e campanha com lista | |
| Alertas do Meu dia (M03) | Disponível | Motor `sincronizarAlertas`, em `dominio/alertas-m08.ts`. Ver §3 | |
| Ativos digitais (M04) | Disponível | `redesDaMarca` lê `ativo_digital` do tipo rede social, só para mostrar | |
| Financeiro (M05) | Disponível | A campanha vincula títulos existentes, sem criar nem mudar título. Total por moeda, sem conversão | Orçamento da T05.08, quando existir |
| Oportunidades (M10) | Parcial | A ficha da campanha grava `oportunidade.campanha_id` por `indicarCampanhaDaOportunidade`, com o motivo no histórico | O formulário do M10 ainda grava `campanha_id: null` e não oferece o campo. Ver §4 |
| Inventário (M09) | Disponível só para leitura | `tratamentosDaLista` procura tratamentos com titular `inscritos_lista`, do produto ou da Numa, e a ficha da lista diz se há. O cadastro continua em `/legal/privacidade` | Nenhum tratamento é criado sozinho: a base legal é decisão de quem cuida do inventário |
| Documentos legais e modelos (M09) | Disponível | Arquivo pode ser vinculado a `documento_legal`. Não há editor de cláusulas nem de modelos aqui | |
| Google Drive | **Ausente** | Interface `ProvedorDoDrive` em `dominio/integracoes/drive.ts`, com `driveAusente` | Sem ela, não há nome automático nem miniatura |
| Permissões e classes (M01) | Etapa local, sem login (D27) | `podeVerClasse` e `podeExportarInscritos`, em `dominio/classes.ts`. Listas, busca e exportações do M08 já passam por elas | Na etapa com servidor, a regra entra só nesse arquivo |
| Envio de mensagens e publicação | Fora do recorte | Nada envia nem publica | |
| Atribuição, custo por inscrito e gerador de apresentações (F2) | Fora do recorte | Só aviso em texto, sem botão | `apresentacao_modelo` não foi criada |

**Saídas para os outros módulos:**

- `arquivosDoRegistro(tipo, id)` e `vincularArquivo(arquivoId, tipo, id)`, em `dominio/biblioteca.ts`: os arquivos de qualquer registro.
- `REGISTROS_DO_ARQUIVO`, em `dominio/vinculos-arquivo.ts`: com o que um arquivo pode ser vinculado, e o caminho de cada um.

## 3. Meu dia (M03)

Arquivo novo, sem importações: `src/dominio/integracoes/meu-dia-m08.ts`. Entra por espalhamento, no mesmo padrão de `meu-dia-f1.ts`:

| Arquivo | Linha acrescentada |
|---|---|
| `src/dominio/atividades.ts` | `...ACOES_DE_ALERTA_M08` e `...ROTULOS_ORIGEM_ALERTA_M08` |
| `src/dominio/atividades-painel.ts` | `...REGISTROS_VINCULAVEIS_M08` e `...ORIGEM_DO_ALERTA_M08` |
| `src/dominio/rotinas.ts` | "Gerar alertas" soma `gerarAlertasM08()`. A ordem e os nomes das rotinas não mudaram |

**Alertas:**

- **Direitos de uso:** 30 dias antes do fim da validade (RN-08.06). Continua depois de vencer, até a validade mudar ou o item sair.
- **Publicação:** na véspera da data prevista, para a responsável (T08.05). Se a data passar, o título vira "Publicação atrasada", até publicar, cancelar ou mudar a data. Não publica nada.

Componentes do Meu dia não foram alterados.

## 4. Pontos para as outras frentes

| Frente | Ponto | Onde |
|---|---|---|
| M07 | A área Arquivos da ficha do produto ainda diz que a biblioteca não existe. Trocar por `arquivosDoRegistro('produto', id)`. A aba não foi mexida, porque é da frente do M07 | `produtos/[id]/areas-secundarias.tsx:297` |
| M10 | Acrescentar "Campanha de origem" ao formulário da oportunidade, com o critério "origem informada manualmente" (RN-08.12) | `dominio/comercial.ts:114` |
| M03, M04 e M05 | Os links em `anexo_link` ainda não migraram para `arquivo_vinculo`. A migração muda as abas Arquivos dessas telas e precisa de um título por link, então não foi feita aqui. Até lá, as duas coisas convivem | `tipos/apoio.ts` |
| M13 | Os grupos Biblioteca, Campanhas, Conteúdo e Listas de espera já entram na busca global. Inscritos ficam de fora, porque são dados pessoais | `integracoes/busca-m08.ts` |
| Configurações | Os canais de conteúdo são uma lista fixa, e a especificação pede "configurável". Exige uma chave nova em `configuracao` | `tipos/marketing.ts` |

## 5. Arquivos compartilhados alterados

Todos com acréscimos pequenos, sem reescrever o que existia:

| Arquivo | O que mudou | Commit |
|---|---|---|
| `src/dados/tabelas.ts` | `...TABELAS_M08` e `VERSAO_DADOS = 18` | Dados |
| `src/dados/repositorios.ts` | `& RepositoriosM08` e `...repositoriosM08` | Dados |
| `src/dados/carga.ts` | `acrescentarTabelasM08` na migração, `tabelasIniciaisM08` na carga e `VALORES_INICIAIS_M08` | Dados |
| `src/dominio/dados.ts` | Partes de registros do M08 fora da contagem de cadastros | Dados |
| `src/dominio/apoio-testes.ts` | `M08_INICIAIS` nos totais | Dados |
| `src/dominio/cores.ts` | `contrasteEntre`, usado também por `contrasteComLinho`, sem mudar o resultado | Dados |
| `src/dominio/etiquetas.ts` | Módulo `biblioteca` e registro `arquivo` | Dados |
| `src/dominio/historico.ts` | Espalha `CAMPOS_LEGIVEIS_M08` e chama `registroPorExtensoM08` e as frases de importação e exportação | Dados |
| `src/dominio/atividades.ts`, `atividades-painel.ts`, `rotinas.ts` | Ver §3 | Dados |
| `src/componentes/padroes/filtros-em-linha.tsx` | Props opcionais `rotuloAvancados` e `larguraAvancados`. Sem elas, nada muda | F0b |
| `src/componentes/padroes/janela-formulario.tsx` | Prop opcional `aoEscolherErro`. Sem ela, nada muda | F0b |
| `src/dominio/busca.ts` | Grupos do M08 | Integrações |
| `verificacao/entrega2.mjs` | Totais da carga: 177 registros e 77 de exemplo | Integrações |
| `verificacao/*.mjs` | Só a asserção de `versao_dados`, de 17 para 18 | Integrações |

**Conflitos certos ao juntar:**

- **`VERSAO_DADOS`:** a frente do M06 pode subir o mesmo número. Quem entrar por último usa o seguinte e troca o número nas suítes. A migração do M08 não depende do número: `acrescentarTabelasM08` só cria as tabelas que faltam, seja qual for a versão de origem.
- **Totais de `entrega2.mjs`:** qualquer frente que acrescente exemplos muda 177 e 77. O M08 soma 26 registros de exemplo: 8 arquivos, 2 campanhas, 6 peças, 2 listas e 8 inscritos.
- **`filtros-em-linha.tsx`:** o ramo `reserva/central-numa-solto-07-11` tem props com os mesmos nomes (`rotuloAvancados`, `larguraAvancados`) e mais `placeholderBusca`. Ao juntar, fique com a versão que tem as três.
- **`lista.tsx`:** o mesmo ramo acrescenta paginação. Esta frente não alterou o arquivo.

## 6. Diferenças em relação à especificação

Decisões desta frente, para revisão. Também estão no Mapa, em "A revisar por Kimberly".

| Onde | O 16 ou o 10-M08 diz | Como ficou | Por quê |
|---|---|---|---|
| `inscrito.consentimento_versao_id` e `consentido_em` | Obrigatórios | Opcionais na inclusão manual. A importação continua exigindo (CA-08.03) | "Pendente de consentimento" só existe se puder faltar. Sem consentimento, não é elegível |
| `peca_conteudo.produto_id` | Obrigatório | Vazio é a Numa institucional | O próprio T08.05 pede "marca ou produto" |
| `arquivo.data_uso` | Não está no 16 | Acrescentado | T08.08 pede "data de uso" |
| `inscrito.convidado_em` e `convertido_em` | Não estão no 16 | Acrescentados | Para saber quando mudou, sem depender do histórico |
| `peca_conteudo.cancelado_motivo` e `campanha.cancelada_motivo` | Não estão no 16 | Acrescentados | O cancelamento preserva o histórico |
| Miniaturas | "Quando o link for imagem pública" | Sempre ícone por tipo | Sem integração, a Central não tem como saber se o arquivo é público |
| Tokens da Numa | `02 §3` | `18 §2` e `§11` | O arquivo 18 prevalece |
