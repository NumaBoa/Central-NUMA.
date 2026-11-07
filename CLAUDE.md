# Central Numa

Sistema interno de gestão da Numa, em Next.js + TypeScript, construído tela a tela com Kimberly Grebe.

## Leia antes de trabalhar

A especificação fica em `../Especificacao-Sistema`. Leia nesta ordem:

1. `00-LEIA-PRIMEIRO.md`
2. `01-visao-e-fases.md`
3. `02-fundacao-tecnica.md` (comece pelo §0)
4. `18-identidade-visual-e-responsividade.md`
5. §0 de `03-M01-acesso-login-permissoes.md`
6. §0 de `16-modelo-de-dados.md`
7. `17-roteiro-construcao-ia.md`
8. O arquivo do módulo da tela em construção

O andamento e as decisões ficam em `../Prototipos/Mapa-do-Prototipo.md`. Consulte esse arquivo antes de continuar e atualize-o a cada tela.

## Regras de trabalho

- **Siga a ordem de `17 §2`, uma etapa por vez, sem parar para confirmação.** Decisão de Kimberly em 05/11/2026, a partir da T02.02: não é preciso pedir confirmação nem validação a cada tela. Em cada etapa: leia a tela, decida, construa, teste, registre, faça o commit e junte ao `main`.
- **Nada conta como validado por Kimberly sem ela ter visto.** Em `17 §3`, marque "Construída" (com a data e as verificações), nunca "Validada". Ela revisa quando quiser.
- **Dúvida: procure na especificação. Incoerência:** escolha a opção mais conservadora e coerente com as decisões já tomadas, siga em frente e registre em "A revisar por Kimberly", no Mapa. O que depende de um dado que só ela tem fica vazio, nunca inventado (RT-08). Pare para perguntar só se não houver como seguir sem ela.
- **Decisões novas** vão para "Pontos decididos" do arquivo do módulo e para o Mapa.
- **Trabalhe por fases:** F0a → F0b → F1 → F2 → F3 (`01 §3`), na ordem de `17 §2`.

## Recorte vigente

- **Só da Numa:** organização única, sem multi-cliente (D5, AR-06). O destino é um sistema on-line com login; o momento da etapa com servidor ainda será definido.
- **Etapa atual, local:** roda na máquina de Kimberly, sem login, sem permissões e sem banco (D26–D29). Os dados são de exemplo, ficam no navegador e são acessados por repositórios. "Você é" substitui o login (`02 §0.4`).
- **Camada de dados:** telas nunca acessam `localStorage` diretamente. O `Repositorio<T>` deve permitir a troca por um banco sem refazer as telas (`02 §0.3`).
- **Regras de negócio:** ficam em `src/dominio`, com testes Vitest, nunca em componentes de tela.
- **Dados:** não inventar. Registros fictícios levam `exemplo: true`; o que não foi definido fica vazio, nunca zero.

## Como acrescentar uma tabela

1. Tipo e esquema Zod em `src/dados/tipos`, com os nomes de campos de `16`.
2. Registro em `src/dados/tabelas.ts`: ela entra sozinha em exportar, importar, restaurar e limpar exemplos.
3. Repositório em `src/dados/repositorios.ts` (`prefixoCodigo` para código legível) e exemplos em `src/dados/exemplos`. Dados reais da especificação (ex.: áreas) vão para `VALORES_INICIAIS` em `src/dados/carga.ts`: backups antigos recebem esses valores. Atualize `REGISTROS_INICIAIS` em `src/dominio/apoio-testes.ts`.
4. As telas leem com `useConsulta` e gravam pelo repositório. Mudou o formato de uma tabela já publicada, ou acrescentou uma tabela: suba `VERSAO_DADOS` e escreva a migração em `src/dados/carga.ts`. Quem já usa a Central não pode perder nada, e backups antigos precisam continuar sendo aceitos.
5. Dentro de `(central)`, links internos usam `LinkCentral`: é ele que pergunta antes de sair com alterações pendentes (P3).
6. Gravar em mais de uma tabela de uma vez: `emTransacao`, de `src/dados/transacao.ts`. Regra de negócio que barra uma ação lança `ErroDeRegra`, com a mensagem pronta para a tela.
7. O histórico por extenso fica em `CAMPOS_LEGIVEIS`, em `src/dominio/historico.ts`. Texto livre passa por `pareceCredencial` (RT-14).

## Comandos

- `npm run dev`: o sistema em `http://localhost:3000`
- `npm run dev:rede`: para abrir no celular pelo IP do computador (`18 §10.7`)
- `npm test`: regras (Vitest)
- `npm run typecheck` e `npm run build`
- `bash verificacao/rodar-tudo.sh <suíte nova> <suítes anteriores...>`: a verificação completa de uma etapa, com o `npm run dev` de pé: regras, tipos, build e as suítes num Chrome de verdade, em dev e em produção. `rodar-producao.sh` roda só as suítes, sobre o build que já existe.

As suítes ficam em `verificacao/`, uma por etapa, e entram no commit da etapa: uma pasta temporária já foi apagada entre sessões, e com ela todas as suítes. Fotos, perfil do Chrome e registros vão para `%TEMP%\central-numa-verificacao`, ou para `VERIFICACAO_PASTA`. Com mais de uma frente verificando ao mesmo tempo, cada uma usa o próprio worktree e define `VERIFICACAO_PASTA`, `VERIFICACAO_PORTA` (o servidor) e `VERIFICACAO_PORTAS` (soma nas portas do Chrome). Elas conferem números da carga inicial (`Registros151`, `51 de exemplo`, `versao_dados`): ao acrescentar carga, atualize as suítes junto com `apoio-testes.ts`.

Para rever a abertura, que só aparece uma vez por dia: `/configuracoes?abertura=1`, ou `?abertura=manter` para segurá-la na tela. A vitrine dos padrões fica em `/padroes`, fora do menu.

Para atualizar a lista oficial de municípios do IBGE: `node scripts/gerar-municipios.mjs`, e registre a nova data no Mapa.

Logo depois de mudar um arquivo, o `next dev` pode acusar erro de hidratação na primeira visita a uma rota: o servidor de desenvolvimento ainda entrega o HTML da versão anterior (visto ao mudar `abas.tsx`, com a diferença de React mostrando um item a mais só no cliente). Recarregar resolve, e em produção não acontece. Se o erro continuar depois de recarregar, é defeito de verdade.

## Git

- Repositório local. A identidade (NumaBoa) está configurada só neste repositório; nunca use `--global`.
- Um commit por etapa de `17 §2`, feito depois que todas as verificações passarem. Cada etapa é construída em um ramo próprio e, depois, juntada ao `main`; o ramo já juntado pode ser apagado. O estado anterior à fundação fica no commit `bef6b0e`.

## Dependências

- Versões fixas (`--save-exact`). TypeScript fica na 6.x: a 7 é a versão nativa, e o Next ainda usa a interface de compilação antiga.
- Esta versão do Next mudou APIs (ex.: `retry` em `error.tsx`). Antes de usar uma API, confira a documentação instalada em `node_modules/next/dist/docs/`. O `AGENTS.md` é gerado pelo próprio `next dev`.
- `npx shadcn add` instala o pacote `cn` e importa dele. Remova o pacote, importe `cn` de `@/lib/utils` e restilize o componente com os tokens de `18 §11`.

## Visual

- `../Prototipos` é **referência visual**, não código a evoluir. A T02.01 foi aprovada nessa forma: `configuracoes.html`, `visual.css` e `visual.js`. A revisão de 07/11/2026 segue `Imagens/M02/T02.01-organizacao-regiao-v1.png`, proposta ainda em avaliação por Kimberly.
- Nos demais casos, vale `18-identidade-visual-e-responsividade.md`. Cada tela deve funcionar em 1440, 768 e 360px.
- **Menu:** estrutura final completa, com o que ainda não existe esmaecido e marcado "Em breve", sem link. Decisão de Kimberly em 05/11/2026, que desvia de RT-23 só no menu.
- **Formulários e detalhes:** janela central no computador, com os obrigatórios à vista sem rolar; no celular, tela inteira (`18 §9.9`, decisão de Kimberly em 06/11/2026). Use `JanelaFormulario`; com `colunas={2}`, o formulário longo vai em duas colunas. Diálogo que é formulário leva `telaCheia`. Confirmações e menus continuam como folha inferior no celular.
- **Filtros do M03:** `FiltrosEmLinha` e `CartoesDeResumo`. Contador aplica filtro visível e segue o recorte, e nenhuma seleção aparece em dois lugares.
