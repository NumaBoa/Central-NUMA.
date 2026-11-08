'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, CalendarDays, Ellipsis, Files, FolderOpen, Info, LayoutGrid, Link2, List, Lock, Plus, Shapes, UserRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EtiquetasDoRegistro } from '@/componentes/campos/etiquetas';
import { Selecao } from '@/componentes/campos/selecao';
import { executar, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasMarketing, AlternarVisao, EtiquetaClasse, EtiquetaDireitos, EtiquetaDoContexto, IconeDoTipo, KICKER_MARKETING, nomeDoContexto, opcoesDeContexto } from '@/componentes/marketing/apoio';
import { DialogoLote } from '@/componentes/marketing/dialogo-lote';
import { FormularioDeArquivo } from '@/componentes/marketing/formulario-arquivo';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { PilulaFiltro, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { BotaoExportarCsv, MenuColunas, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import type { Arquivo } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { arquivarArquivo, carregarBiblioteca, COLECOES, contadoresDasColecoes, contextosDoArquivo, filtrarArquivos, FILTROS_BIBLIOTECA_INICIAIS, quantosMaisFiltros, quantosVinculos, ROTULOS_TIPO_ARQUIVO, type DadosDaBiblioteca, type FiltrosBiblioteca, type IdDaColecao } from '@/dominio/biblioteca';
import { ROTULOS_CLASSE } from '@/dominio/classes';
import { REGISTROS_DO_ARQUIVO } from '@/dominio/vinculos-arquivo';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const LISTA = 'biblioteca';
const CAMINHO = '/marketing/arquivos';
const COLUNAS_PADRAO = ['titulo', 'contexto', 'versao', 'classe', 'etiquetas', 'atualizado', 'vinculos'];
type Visao = 'grade' | 'lista';

const nomeDaPessoa = (id: string | null, dados: DadosDaBiblioteca) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';

function MenuDoArquivo({ arquivo }: { arquivo: Arquivo }) {
  return (
    <MenuSobreposto
      titulo="Ações"
      largura={220}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={`Ações de ${arquivo.titulo}`}>
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          <li>
            <LinkCentral href={`${CAMINHO}/${arquivo.id}`} className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}>
              Abrir ficha
            </LinkCentral>
          </li>
          <li>
            <a href={arquivo.url_atual} target="_blank" rel="noopener noreferrer" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={fechar}>
              Abrir no Drive
            </a>
          </li>
          {!arquivo.arquivado_em && (
            <li>
              <button
                type="button"
                className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
                onClick={() => {
                  fechar();
                  void executar(() => arquivarArquivo(arquivo.id), 'Arquivo arquivado. Dá para restaurar em Arquivados.');
                }}
              >
                Arquivar
              </button>
            </li>
          )}
        </ul>
      )}
    </MenuSobreposto>
  );
}

/** T08.01, grade: ícone por tipo, sem miniatura e sem simular acesso ao conteúdo. */
function CartaoDaGrade({ arquivo, dados, hoje }: { arquivo: Arquivo; dados: DadosDaBiblioteca; hoje: string }) {
  const contextos = contextosDoArquivo(arquivo.id, dados.contextos);
  const vinculos = quantosVinculos(arquivo.id, dados.vinculos);
  const restrita = arquivo.classe === 'fin' || arquivo.classe === 'doc';
  return (
    <li className="relative flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-paper p-3.5 transition-colors duration-150 hover:border-ink-soft">
      <div className="relative grid h-24 place-items-center rounded-md bg-mist text-ink-soft">
        <IconeDoTipo tipo={arquivo.tipo} className="size-9" />
        {restrita && (
          <span className="absolute right-[calc(50%-34px)] bottom-4 grid size-6 place-items-center rounded-full bg-paper text-ink" title="Item restrito na Central">
            <Lock className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10">
        <MenuDoArquivo arquivo={arquivo} />
      </div>
      <h3 className="min-w-0 break-words">
        <LinkCentral href={`${CAMINHO}/${arquivo.id}`} className="inline-flex min-h-11 items-center after:absolute after:inset-0 after:rounded-lg hover:underline md:min-h-0">
          {arquivo.titulo}
        </LinkCentral>
      </h3>
      <p className="text-xs text-ink-soft">{ROTULOS_TIPO_ARQUIVO[arquivo.tipo]}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {contextos.map((id) => (
          <EtiquetaDoContexto key={id} id={id} produtos={dados.produtos} marcas={dados.marcas} />
        ))}
        <span className="rounded-pill bg-mist px-2 py-0.5 text-xs font-semibold text-ink-soft">v{arquivo.versao_atual}</span>
        <EtiquetaClasse classe={arquivo.classe} />
      </div>
      <EtiquetaDireitos arquivo={arquivo} hoje={hoje} />
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs text-ink-soft [&_svg]:size-3.5 [&_svg]:shrink-0">
        <span className="inline-flex items-center gap-1">
          <CalendarDays aria-hidden />
          {formatarDiaISO(arquivo.atualizado_em.slice(0, 10))}
        </span>
        <span className="inline-flex items-center gap-1">
          <UserRound aria-hidden />
          {nomeDaPessoa(arquivo.responsavel_id, dados)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Link2 aria-hidden />
          {vinculos === 1 ? '1 vínculo' : `${vinculos} vínculos`}
        </span>
      </p>
    </li>
  );
}

/** T08.01 (P1): os mesmos filtros e coleções, em grade ou lista. */
export function TelaBiblioteca() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const { pessoa, contexto } = useCentral();
  const consulta = useConsulta(carregarBiblioteca);
  const [filtros, setFiltros] = useState<FiltrosBiblioteca>(FILTROS_BIBLIOTECA_INICIAIS);
  const [visao, setVisao] = useState<Visao>(parametros.get('visao') === 'lista' ? 'lista' : 'grade');
  const [adicionando, setAdicionando] = useState(parametros.get('novo') === '1');
  const [emLote, setEmLote] = useState(false);
  const { colunasVisiveis } = usePreferenciasDaLista(pessoa.id, LISTA, COLUNAS_PADRAO);
  const dados = consulta.dados;
  const hoje = hojeISO();

  const opcoes = useMemo(() => (dados ? { contextoGlobalId: contexto.id, hoje, dados } : null), [dados, contexto.id, hoje]);
  const linhas = useMemo(() => (dados && opcoes ? filtrarArquivos(dados.arquivos, filtros, opcoes) : []), [dados, filtros, opcoes]);
  const contadores = useMemo(() => (dados && opcoes ? contadoresDasColecoes(dados.arquivos, filtros, opcoes) : null), [dados, filtros, opcoes]);

  const colunas = useMemo<readonly Coluna<Arquivo>[]>(() => {
    if (!dados) return [];
    return [
      {
        id: 'titulo',
        titulo: 'Título',
        fixa: true,
        essencial: true,
        ordenar: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
        texto: (arquivo) => arquivo.titulo,
        celula: (arquivo) => (
          <span className="flex min-w-48 items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-mist text-ink-soft">
              <IconeDoTipo tipo={arquivo.tipo} className="size-[18px]" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium break-words">{arquivo.titulo}</span>
              <span className="text-xs text-ink-soft">
                {ROTULOS_TIPO_ARQUIVO[arquivo.tipo]} · {arquivo.codigo}
              </span>
              <EtiquetaDireitos arquivo={arquivo} hoje={hoje} />
            </span>
          </span>
        ),
      },
      {
        id: 'contexto',
        titulo: 'Contexto',
        essencial: true,
        texto: (arquivo) =>
          contextosDoArquivo(arquivo.id, dados.contextos)
            .map((id) => nomeDoContexto(id, dados.produtos))
            .join(', '),
        celula: (arquivo) => (
          <span className="flex flex-wrap gap-1">
            {contextosDoArquivo(arquivo.id, dados.contextos).map((id) => (
              <EtiquetaDoContexto key={id} id={id} produtos={dados.produtos} marcas={dados.marcas} />
            ))}
          </span>
        ),
      },
      { id: 'versao', titulo: 'Versão', ordenar: (a, b) => a.versao_atual - b.versao_atual, texto: (arquivo) => `v${arquivo.versao_atual}`, celula: (arquivo) => <span className="tabular-nums">v{arquivo.versao_atual}</span> },
      { id: 'classe', titulo: 'Classe', essencial: true, ordenar: (a, b) => a.classe.localeCompare(b.classe), texto: (arquivo) => ROTULOS_CLASSE[arquivo.classe], celula: (arquivo) => <EtiquetaClasse classe={arquivo.classe} /> },
      {
        id: 'etiquetas',
        titulo: 'Etiquetas',
        texto: (arquivo) =>
          dados.etiquetas
            .filter((etiqueta) => (dados.etiquetasDosArquivos.get(arquivo.id) ?? []).includes(etiqueta.id))
            .map((etiqueta) => etiqueta.nome)
            .join(', '),
        celula: (arquivo) => <EtiquetasDoRegistro ids={dados.etiquetasDosArquivos.get(arquivo.id) ?? []} etiquetas={dados.etiquetas} />,
      },
      {
        id: 'atualizado',
        titulo: 'Atualizado',
        essencial: true,
        ordenar: (a, b) => a.atualizado_em.localeCompare(b.atualizado_em),
        texto: (arquivo) => formatarDiaISO(arquivo.atualizado_em.slice(0, 10)),
        celula: (arquivo) => (
          <span className="grid gap-0.5 whitespace-nowrap">
            <span className="tabular-nums">{formatarDiaISO(arquivo.atualizado_em.slice(0, 10))}</span>
            <span className="text-xs text-ink-soft">{nomeDaPessoa(arquivo.atualizado_por ?? arquivo.responsavel_id, dados)}</span>
          </span>
        ),
      },
      { id: 'vinculos', titulo: 'Vínculos', numerica: true, ordenar: (a, b) => quantosVinculos(a.id, dados.vinculos) - quantosVinculos(b.id, dados.vinculos), texto: (arquivo) => String(quantosVinculos(arquivo.id, dados.vinculos)), celula: (arquivo) => quantosVinculos(arquivo.id, dados.vinculos) },
      { id: 'responsavel', titulo: 'Responsável', texto: (arquivo) => nomeDaPessoa(arquivo.responsavel_id, dados), celula: (arquivo) => nomeDaPessoa(arquivo.responsavel_id, dados) },
      { id: 'direitos', titulo: 'Validade dos direitos', texto: (arquivo) => (arquivo.direitos_validade ? formatarDiaISO(arquivo.direitos_validade) : ''), celula: (arquivo) => (arquivo.direitos_validade ? formatarDiaISO(arquivo.direitos_validade) : '—') },
    ];
  }, [dados, hoje]);
  const visiveis = useMemo(() => colunas.filter((coluna) => coluna.fixa || colunasVisiveis.includes(coluna.id)), [colunas, colunasVisiveis]);

  const cabecalho = (
    <CabecalhoPagina
      kicker={KICKER_MARKETING}
      titulo="Biblioteca"
      resumo="Encontre e reutilize os materiais da Numa e dos produtos. Os arquivos ficam no Drive."
      acoes={
        <>
          <Button disabled={!dados} onClick={() => setAdicionando(true)}>
            <Plus aria-hidden />
            Adicionar arquivo
          </Button>
          <Button variante="secundario" disabled={!dados} onClick={() => setEmLote(true)}>
            <Files aria-hidden />
            Adicionar em lote
          </Button>
        </>
      }
    />
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {cabecalho}
        <AbasMarketing ativa="biblioteca" />
        <EstadoErro className="mt-5" titulo="Não deu para ler a biblioteca." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const mudar = (parcial: Partial<FiltrosBiblioteca>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_BIBLIOTECA_INICIAIS, colecao: atuais.colecao, arquivados: atuais.arquivados }));
  const opcoesContexto = opcoesDeContexto(dados.produtos);
  const arquivados = dados.arquivos.filter((arquivo) => arquivo.arquivado_em).length;
  const ativos: FiltroAtivo[] = [
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ARQUIVO[filtros.tipo as Arquivo['tipo']]}` }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto, dados.produtos)}` }] : []),
    ...(filtros.classe ? [{ id: 'classe', rotulo: `Classe: ${ROTULOS_CLASSE[filtros.classe as Arquivo['classe']]}` }] : []),
    ...(filtros.etiqueta ? [{ id: 'etiqueta', rotulo: `Etiqueta: ${dados.etiquetas.find((etiqueta) => etiqueta.id === filtros.etiqueta)?.nome ?? ''}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(filtros.responsavel, dados)}` }] : []),
    ...(filtros.atualizadoDe ? [{ id: 'atualizadoDe', rotulo: `Atualizado desde ${formatarDiaISO(filtros.atualizadoDe)}` }] : []),
    ...(filtros.atualizadoAte ? [{ id: 'atualizadoAte', rotulo: `Atualizado até ${formatarDiaISO(filtros.atualizadoAte)}` }] : []),
    ...(filtros.direitos ? [{ id: 'direitos', rotulo: filtros.direitos === 'a_vencer' ? 'Direitos a vencer' : 'Direitos expirados' }] : []),
    ...(filtros.vinculadoA ? [{ id: 'vinculadoA', rotulo: `Vinculado a: ${REGISTROS_DO_ARQUIVO[filtros.vinculadoA]?.rotulo ?? ''}` }] : []),
  ];
  const filtrando = ativos.length > 0 || Boolean(filtros.busca.trim()) || filtros.arquivados || filtros.colecao !== 'todos';

  const alternar = (
    <AlternarVisao<Visao>
      rotulo="Forma de ver a biblioteca"
      ativa={visao}
      aoMudar={setVisao}
      opcoes={[
        { id: 'grade', rotulo: 'Grade', icone: LayoutGrid },
        { id: 'lista', rotulo: 'Lista', icone: List },
      ]}
    />
  );

  return (
    <div>
      {cabecalho}
      <AbasMarketing ativa="biblioteca" />
      <div className="mt-5 space-y-4">
        <div role="group" aria-label="Coleções" className="faixa-rolagem flex gap-1.5">
          {COLECOES.map(({ id, rotulo }) => (
            <PilulaFiltro key={id} ativa={filtros.colecao === id} aoClicar={() => mudar({ colecao: id as IdDaColecao })} filtro={{ id, rotulo, contador: contadores?.[id] }} />
          ))}
        </div>
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={mudar}
          aoLimpar={limpar}
          rotuloBusca="Buscar por título, etiqueta, descrição ou código"
          rotuloAvancados="Mais filtros"
          larguraAvancados={150}
          seletores={[
            seletorDeOpcoes<FiltrosBiblioteca>({ id: 'tipo', rotulo: 'Tipo', icone: Shapes, campo: 'tipo', opcoes: paraOpcoes(ROTULOS_TIPO_ARQUIVO), largura: 130 }),
            seletorDeOpcoes<FiltrosBiblioteca>({ id: 'contexto', rotulo: 'Contexto', icone: FolderOpen, campo: 'contexto', opcoes: opcoesContexto, largura: 150 }),
            seletorDeOpcoes<FiltrosBiblioteca>({ id: 'classe', rotulo: 'Classe', icone: Lock, campo: 'classe', opcoes: paraOpcoes(ROTULOS_CLASSE), todos: 'Todas', largura: 130 }),
          ]}
          quantosAvancados={quantosMaisFiltros}
          avancados={(valor, aoMudar) => (
            <>
              <Campo id="biblioteca-etiqueta" rotulo="Etiqueta">
                {(controle) => (
                  <Selecao {...controle} value={valor.etiqueta} onChange={(evento) => aoMudar({ etiqueta: evento.target.value })}>
                    <option value="">Todas</option>
                    {dados.etiquetas
                      .filter((etiqueta) => !etiqueta.arquivado_em)
                      .map((etiqueta) => (
                        <option key={etiqueta.id} value={etiqueta.id}>
                          {etiqueta.nome}
                        </option>
                      ))}
                  </Selecao>
                )}
              </Campo>
              <Campo id="biblioteca-responsavel" rotulo="Responsável">
                {(controle) => (
                  <Selecao {...controle} value={valor.responsavel} onChange={(evento) => aoMudar({ responsavel: evento.target.value })}>
                    <option value="">Todas</option>
                    {[...new Set(dados.arquivos.map((arquivo) => arquivo.responsavel_id))].map((id) => (
                      <option key={id} value={id}>
                        {nomeDaPessoa(id, dados)}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="biblioteca-de" rotulo="Atualizado de">
                  {(controle) => <EntradaData {...controle} value={valor.atualizadoDe} onChange={(evento) => aoMudar({ atualizadoDe: evento.target.value })} />}
                </Campo>
                <Campo id="biblioteca-ate" rotulo="Atualizado até">
                  {(controle) => <EntradaData {...controle} value={valor.atualizadoAte} onChange={(evento) => aoMudar({ atualizadoAte: evento.target.value })} />}
                </Campo>
              </div>
              <Campo id="biblioteca-direitos" rotulo="Direitos de uso">
                {(controle) => (
                  <Selecao {...controle} value={valor.direitos} onChange={(evento) => aoMudar({ direitos: evento.target.value as FiltrosBiblioteca['direitos'] })}>
                    <option value="">Todos</option>
                    <option value="a_vencer">A vencer em até 30 dias</option>
                    <option value="expirados">Expirados</option>
                  </Selecao>
                )}
              </Campo>
              <Campo id="biblioteca-vinculo" rotulo="Vinculado a">
                {(controle) => (
                  <Selecao {...controle} value={valor.vinculadoA} onChange={(evento) => aoMudar({ vinculadoA: evento.target.value })}>
                    <option value="">Qualquer registro</option>
                    {Object.entries(REGISTROS_DO_ARQUIVO).map(([tipo, { rotulo }]) => (
                      <option key={tipo} value={tipo}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </>
          )}
          direita={alternar}
          larguraDireita={170}
          ativos={ativos}
          aoRemoverAtivo={(id) => mudar({ [id]: '' })}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-[13px] text-ink-soft tabular-nums">
            {linhas.length === 1 ? '1 material' : `${linhas.length} materiais`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="md:hidden">{alternar}</div>
            {visao === 'lista' && <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />}
            <BotaoExportarCsv nomeDoArquivo="biblioteca" colunas={visiveis} linhas={linhas} />
            {arquivados > 0 && (
              <Button variante="terciario" aria-pressed={filtros.arquivados} onClick={() => mudar({ arquivados: !filtros.arquivados })}>
                <Archive aria-hidden />
                {filtros.arquivados ? 'Voltar aos ativos' : `Arquivados (${arquivados})`}
              </Button>
            )}
          </div>
        </div>
        {!dados.arquivos.length ? (
          <EstadoVazio icone={Files} titulo="A biblioteca ainda está vazia." texto="Cole o link de um arquivo do Drive para começar. O arquivo continua lá." acao={<Button onClick={() => setAdicionando(true)}>Adicionar arquivo</Button>} />
        ) : !linhas.length ? (
          <EstadoVazioFiltro aoLimpar={() => setFiltros(FILTROS_BIBLIOTECA_INICIAIS)} />
        ) : visao === 'grade' ? (
          <ul aria-label="Materiais" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {linhas.map((arquivo) => (
              <CartaoDaGrade key={arquivo.id} arquivo={arquivo} dados={dados} hoje={hoje} />
            ))}
          </ul>
        ) : (
          <Lista
            rotulo="Materiais"
            linhas={linhas}
            colunas={visiveis}
            chave={(arquivo) => arquivo.id}
            aoAbrir={(arquivo) => roteador.push(`${CAMINHO}/${arquivo.id}`)}
            acoesDaLinha={(arquivo) => <MenuDoArquivo arquivo={arquivo} />}
            filtrando={filtrando}
            aoLimparFiltros={() => setFiltros(FILTROS_BIBLIOTECA_INICIAIS)}
            vazio={null}
            cartaoInterativo
            cartao={(arquivo) => (
              <span className="grid gap-1.5">
                <span className="flex items-start justify-between gap-2">
                  <LinkCentral href={`${CAMINHO}/${arquivo.id}`} className="inline-flex min-h-11 min-w-0 items-center font-semibold break-words hover:underline md:min-h-0">
                    {arquivo.titulo}
                  </LinkCentral>
                  <MenuDoArquivo arquivo={arquivo} />
                </span>
                <span className="text-[13px] text-ink-soft">
                  {ROTULOS_TIPO_ARQUIVO[arquivo.tipo]} · v{arquivo.versao_atual}
                </span>
                <span className="flex flex-wrap gap-1">
                  {contextosDoArquivo(arquivo.id, dados.contextos).map((id) => (
                    <EtiquetaDoContexto key={id} id={id} produtos={dados.produtos} marcas={dados.marcas} />
                  ))}
                  <EtiquetaClasse classe={arquivo.classe} />
                </span>
                <EtiquetaDireitos arquivo={arquivo} hoje={hoje} />
              </span>
            )}
          />
        )}
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />A classe limita quem vê o item na Central; a permissão real é a do Drive. As miniaturas dependem de uma integração com o Drive que ainda não existe, por isso aparecem ícones por tipo.
        </p>
      </div>
      <FormularioDeArquivo
        aberto={adicionando}
        aoFechar={() => setAdicionando(false)}
        dados={dados}
        tipoInicial={filtros.colecao === 'apresentacoes' ? 'apresentacao' : undefined}
        aoPedirLote={() => {
          setAdicionando(false);
          setEmLote(true);
        }}
      />
      {emLote && <DialogoLote dados={dados} aoFechar={() => setEmLote(false)} />}
    </div>
  );
}
