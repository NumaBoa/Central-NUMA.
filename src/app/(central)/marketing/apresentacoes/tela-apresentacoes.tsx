'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, FolderOpen, Info, Lock, Plus, Presentation, Target } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasMarketing, BotaoAbrirNoDrive, EtiquetaClasse, EtiquetaDoContexto, KICKER_MARKETING, nomeDoContexto, opcoesDeContexto } from '@/componentes/marketing/apoio';
import { FormularioDeArquivo } from '@/componentes/marketing/formulario-arquivo';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Button } from '@/componentes/ui/button';
import type { Arquivo } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { carregarBiblioteca, contextosDoArquivo, filtrarArquivos, FILTROS_BIBLIOTECA_INICIAIS, ROTULOS_FINALIDADE, type FiltrosBiblioteca } from '@/dominio/biblioteca';
import { ROTULOS_CLASSE } from '@/dominio/classes';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

function textoDosPrecos(arquivo: Arquivo): string {
  if (arquivo.contem_precos === null) return 'Preços: não informado';
  if (!arquivo.contem_precos) return 'Sem preços';
  return `Preços de ${arquivo.precos_data ? formatarDiaISO(arquivo.precos_data) : 'data não informada'}`;
}

/** T08.08, F0b: os mesmos itens da biblioteca, filtrados por tipo. Não há cadastro paralelo. */
export function TelaApresentacoes() {
  const roteador = useRouter();
  const { contexto } = useCentral();
  const consulta = useConsulta(carregarBiblioteca);
  const [filtros, setFiltros] = useState<FiltrosBiblioteca>(FILTROS_BIBLIOTECA_INICIAIS);
  const [registrando, setRegistrando] = useState(false);
  const dados = consulta.dados;
  const hoje = hojeISO();
  const linhas = useMemo(() => (dados ? filtrarArquivos(dados.arquivos, filtros, { contextoGlobalId: contexto.id, hoje, dados, tipoFixo: 'apresentacao' }) : []), [dados, filtros, contexto.id, hoje]);

  const cabecalho = (
    <CabecalhoPagina
      kicker={KICKER_MARKETING}
      titulo="Apresentações"
      resumo="Reutilize as apresentações já guardadas. São os mesmos itens da biblioteca, sem duplicar."
      acoes={
        <Button disabled={!dados} onClick={() => setRegistrando(true)}>
          <Plus aria-hidden />
          Registrar apresentação
        </Button>
      }
    />
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {cabecalho}
        <AbasMarketing ativa="apresentacoes" />
        <EstadoErro className="mt-5" titulo="Não deu para ler as apresentações." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const mudar = (parcial: Partial<FiltrosBiblioteca>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros(FILTROS_BIBLIOTECA_INICIAIS);
  const ativos: FiltroAtivo[] = [
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto, dados.produtos)}` }] : []),
    ...(filtros.finalidade ? [{ id: 'finalidade', rotulo: `Finalidade: ${ROTULOS_FINALIDADE[filtros.finalidade as NonNullable<Arquivo['finalidade']>]}` }] : []),
    ...(filtros.classe ? [{ id: 'classe', rotulo: `Classe: ${ROTULOS_CLASSE[filtros.classe as Arquivo['classe']]}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${dados.pessoas.find((pessoa) => pessoa.id === filtros.responsavel)?.nome_completo ?? ''}` }] : []),
  ];
  const haApresentacoes = dados.arquivos.some((arquivo) => arquivo.tipo === 'apresentacao' && !arquivo.arquivado_em);

  return (
    <div>
      {cabecalho}
      <AbasMarketing ativa="apresentacoes" />
      <div className="mt-5 space-y-4">
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={mudar}
          aoLimpar={limpar}
          rotuloBusca="Buscar apresentação por título, público ou código"
          rotuloAvancados="Mais filtros"
          larguraAvancados={150}
          seletores={[
            seletorDeOpcoes<FiltrosBiblioteca>({ id: 'contexto', rotulo: 'Contexto', icone: FolderOpen, campo: 'contexto', opcoes: opcoesDeContexto(dados.produtos), largura: 150 }),
            seletorDeOpcoes<FiltrosBiblioteca>({ id: 'finalidade', rotulo: 'Finalidade', icone: Target, campo: 'finalidade', opcoes: paraOpcoes(ROTULOS_FINALIDADE), todos: 'Todas', largura: 150 }),
            seletorDeOpcoes<FiltrosBiblioteca>({ id: 'classe', rotulo: 'Classe', icone: Lock, campo: 'classe', opcoes: paraOpcoes(ROTULOS_CLASSE), todos: 'Todas', largura: 130 }),
          ]}
          quantosAvancados={(valor) => (valor.responsavel ? 1 : 0)}
          avancados={(valor, aoMudar) => (
            <Campo id="apresentacao-responsavel" rotulo="Responsável">
              {(controle) => (
                <Selecao {...controle} value={valor.responsavel} onChange={(evento) => aoMudar({ responsavel: evento.target.value })}>
                  <option value="">Todas</option>
                  {[...new Set(dados.arquivos.filter((arquivo) => arquivo.tipo === 'apresentacao').map((arquivo) => arquivo.responsavel_id))].map((id) => (
                    <option key={id} value={id}>
                      {dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida'}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          ativos={ativos}
          aoRemoverAtivo={(id) => mudar({ [id]: '' })}
        />
        {!haApresentacoes ? (
          <EstadoVazio icone={Presentation} titulo="Nenhuma apresentação guardada ainda." texto="Registre o link do Drive para reutilizar depois." acao={<Button onClick={() => setRegistrando(true)}>Registrar apresentação</Button>} />
        ) : !linhas.length ? (
          <EstadoVazioFiltro aoLimpar={limpar} />
        ) : (
          <>
            <p aria-live="polite" className="text-[13px] text-ink-soft tabular-nums">
              {linhas.length === 1 ? '1 apresentação' : `${linhas.length} apresentações`}
            </p>
            <ul aria-label="Apresentações" className="grid gap-3 lg:grid-cols-2">
              {linhas.map((arquivo) => (
                <li key={arquivo.id} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-paper p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-mist text-ink-soft">
                      <Presentation className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words">{arquivo.titulo}</h3>
                      <p className="text-xs text-ink-soft">
                        {arquivo.codigo} · versão {arquivo.versao_atual}
                      </p>
                    </div>
                    <EtiquetaClasse classe={arquivo.classe} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {contextosDoArquivo(arquivo.id, dados.contextos).map((id) => (
                      <EtiquetaDoContexto key={id} id={id} produtos={dados.produtos} marcas={dados.marcas} />
                    ))}
                    {arquivo.contem_fin && <EtiquetaLivre>Contém dados FIN</EtiquetaLivre>}
                  </div>
                  <dl className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
                    <div>
                      <dt className="inline text-ink-soft">Finalidade: </dt>
                      <dd className="inline">{arquivo.finalidade ? ROTULOS_FINALIDADE[arquivo.finalidade] : 'não informada'}</dd>
                    </div>
                    <div>
                      <dt className="inline text-ink-soft">Público: </dt>
                      <dd className="inline">{arquivo.publico ?? 'não informado'}</dd>
                    </div>
                    <div>
                      <dt className="inline text-ink-soft">Data de uso: </dt>
                      <dd className="inline">{arquivo.data_uso ? formatarDiaISO(arquivo.data_uso) : 'não informada'}</dd>
                    </div>
                    <div>
                      <dd className="inline">{textoDosPrecos(arquivo)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <BotaoAbrirNoDrive link={arquivo.url_atual} variante="secundario" />
                    <Button variante="secundario" onClick={() => roteador.push(`/marketing/arquivos/${arquivo.id}`)}>
                      <FileText aria-hidden />
                      Ver ficha na biblioteca
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          Apresentação com dados FIN não pode ser PUB. Gerar a partir de modelos é da F2 e ainda não existe aqui.{' '}
          <LinkCentral href="/marketing" className="underline">
            Ver toda a biblioteca
          </LinkCentral>
        </p>
      </div>
      <FormularioDeArquivo aberto={registrando} aoFechar={() => setRegistrando(false)} dados={dados} tipoInicial="apresentacao" />
    </div>
  );
}
