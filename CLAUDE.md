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

O andamento e as decisões ficam em `../Mapa-do-Prototipo.md`. Consulte esse arquivo antes de continuar e atualize-o a cada tela.

## Regras de trabalho

- **Siga o ciclo de `17 §1`, uma tela por vez.** Passo 1: resuma o que vai construir e liste dúvidas e conflitos, sem código. Espere a confirmação de Kimberly antes de programar. Ao terminar a tela, apresente e espere a validação antes da próxima. Nenhuma tela é validada automaticamente.
- **Dúvida: procure na especificação. Incoerência: pergunte a Kimberly antes de decidir.** Isso vale dentro da especificação e entre ela e os protótipos.
- **Decisões novas** vão para "Pontos decididos" do arquivo do módulo e para o Mapa.
- **Trabalhe por fases:** F0a → F0b → F1 → F2 → F3 (`01 §3`), na ordem de `17 §2`.

## Recorte vigente

- **Só da Numa:** organização única, sem multi-cliente (D5, AR-06). O destino é um sistema on-line com login; o momento da etapa com servidor ainda será definido.
- **Etapa atual, local:** roda na máquina de Kimberly, sem login, sem permissões e sem banco (D26–D29). Os dados são de exemplo, ficam no navegador e são acessados por repositórios. "Você é" substitui o login (`02 §0.4`).
- **Camada de dados:** telas nunca acessam `localStorage` diretamente. O `Repositorio<T>` deve permitir a troca por um banco sem refazer as telas (`02 §0.3`).
- **Regras de negócio:** ficam em `src/dominio`, com testes Vitest, nunca em componentes de tela.
- **Dados:** não inventar. Registros fictícios levam `exemplo: true`; o que não foi definido fica vazio, nunca zero.

## Visual

- `../Prototipos` é **referência visual**, não código a evoluir. A T02.01 foi aprovada nessa forma: `configuracoes.html`, `visual.css` e `visual.js`.
- Nos demais casos, vale `18-identidade-visual-e-responsividade.md`. Cada tela deve funcionar em 1440, 768 e 360px.
- **Menu:** estrutura final completa, com o que ainda não existe esmaecido e marcado "Em breve", sem link. Decisão de Kimberly em 05/11/2026, que desvia de RT-23 só no menu.
