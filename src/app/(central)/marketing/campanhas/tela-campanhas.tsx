'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, FolderOpen, Megaphone, Plus, Radio, Target, UserRound } from 'lucide-react';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { AbasMarketing, EtiquetaDaCampanha, EtiquetaDoContexto, KICKER_MARKETING, nomeDoContexto, opcoesDeContexto } from '@/componentes/marketing/apoio';
import { FormularioDeCampanha } from '@/componentes/marketing/formulario-campanha';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import type { Campanha } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { carregarCampanhas, filtrarCampanhas, FILTROS_CAMPANHAS_INICIAIS, ligadosACampanha, ROTULOS_SITUACAO_CAMPANHA, type FiltrosCampanhas } from '@/dominio/campanhas';
import { ROTULOS_CANAL } from '@/dominio/conteudo';
import { formatarDiaISO } from '@/lib/formatacao';

const periodo = (campanha: Pick<Campanha, 'inicio' | 'fim'>) => (campanha.inicio || campanha.fim ? `${campanha.inicio ? formatarDiaISO(campanha.inicio) : '…'} a ${campanha.fim ? formatarDiaISO(campanha.fim) : 'sem fim definido'}` : 'Período não definido');
const nomesDosCanais = (canais: readonly string[]) => canais.map((canal) => ROTULOS_CANAL[canal as keyof typeof ROTULOS_CANAL] ?? canal).join(', ');

/** T08.06, lista. Sem totais de dinheiro: orçamento e lançamentos ficam na ficha, com a classe FIN. */
export function TelaCampanhas() {
  const roteador = useRouter();
  const { contexto } = useCentral();
  const consulta = useConsulta(carregarCampanhas);
  const [filtros, setFiltros] = useState<FiltrosCampanhas>(FILTROS_CAMPANHAS_INICIAIS);
  const [nova, setNova] = useState(false);
  const dados = consulta.dados;
  const linhas = useMemo(() => (dados ? filtrarCampanhas(dados.campanhas, filtros, contexto.id) : []), [dados, filtros, contexto.id]);
  const nomeDaPessoa = (id: string) => dados?.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';

  const colunas = useMemo<readonly Coluna<Campanha>[]>(() => {
    if (!dados) return [];
    const nome = (id: string) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
    return [
      { id: 'nome', titulo: 'Campanha', fixa: true, essencial: true, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), texto: (campanha) => campanha.nome, celula: (campanha) => <span className="grid min-w-44 gap-0.5"><span className="font-medium break-words">{campanha.nome}</span><span className="text-xs text-ink-soft tabular-nums">{campanha.codigo}</span></span> },
      { id: 'contexto', titulo: 'Marca ou produto', essencial: true, texto: (campanha) => nomeDoContexto(campanha.produto_id ?? 'institucional', dados.produtos), celula: (campanha) => <EtiquetaDoContexto id={campanha.produto_id} produtos={dados.produtos} marcas={dados.marcas} /> },
      { id: 'situacao', titulo: 'Situação', essencial: true, texto: (campanha) => ROTULOS_SITUACAO_CAMPANHA[campanha.situacao], celula: (campanha) => <EtiquetaDaCampanha situacao={campanha.situacao} /> },
      { id: 'periodo', titulo: 'Período', ordenar: (a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? ''), texto: periodo, celula: (campanha) => <span className="tabular-nums">{periodo(campanha)}</span> },
      { id: 'canais', titulo: 'Canais', texto: (campanha) => nomesDosCanais(campanha.canais), celula: (campanha) => nomesDosCanais(campanha.canais) || '—' },
      { id: 'pecas', titulo: 'Peças', numerica: true, texto: (campanha) => String(ligadosACampanha(campanha.id, dados).pecas.length), celula: (campanha) => ligadosACampanha(campanha.id, dados).pecas.length },
      { id: 'responsavel', titulo: 'Responsável', texto: (campanha) => nome(campanha.responsavel_id), celula: (campanha) => nome(campanha.responsavel_id) },
    ];
  }, [dados]);

  const cabecalho = (
    <CabecalhoPagina
      comoUsar="/ajuda/marketing/campanhas"
      kicker={KICKER_MARKETING}
      titulo="Campanhas"
      resumo="Planejamento e acompanhamento das campanhas. Lançamentos ficam no Financeiro, e oportunidades no Comercial."
      acoes={
        <Button disabled={!dados} onClick={() => setNova(true)}>
          <Plus aria-hidden />
          Nova campanha
        </Button>
      }
    />
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {cabecalho}
        <AbasMarketing ativa="campanhas" />
        <EstadoErro className="mt-5" titulo="Não deu para ler as campanhas." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const mudar = (parcial: Partial<FiltrosCampanhas>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_CAMPANHAS_INICIAIS, arquivados: atuais.arquivados }));
  const responsaveis = [...new Set(dados.campanhas.map((campanha) => campanha.responsavel_id))].map((id) => ({ valor: id, rotulo: nomeDaPessoa(id) }));
  const arquivadas = dados.campanhas.filter((campanha) => campanha.arquivado_em).length;
  const ativos: FiltroAtivo[] = [
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto, dados.produtos)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_CAMPANHA[filtros.situacao as Campanha['situacao']]}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(filtros.responsavel)}` }] : []),
    ...(filtros.canal ? [{ id: 'canal', rotulo: `Canal: ${ROTULOS_CANAL[filtros.canal as keyof typeof ROTULOS_CANAL]}` }] : []),
  ];

  return (
    <div>
      {cabecalho}
      <AbasMarketing ativa="campanhas" />
      <div className="mt-5 space-y-4">
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={mudar}
          aoLimpar={limpar}
          rotuloBusca="Buscar campanha por nome, objetivo ou código"
          rotuloAvancados="Mais filtros"

          seletores={[
            seletorDeOpcoes<FiltrosCampanhas>({ id: 'contexto', rotulo: 'Contexto', icone: FolderOpen, campo: 'contexto', opcoes: opcoesDeContexto(dados.produtos), largura: 150 }),
            seletorDeOpcoes<FiltrosCampanhas>({ id: 'situacao', rotulo: 'Situação', icone: Target, campo: 'situacao', opcoes: paraOpcoes(ROTULOS_SITUACAO_CAMPANHA), todos: 'Todas', largura: 140 }),
            seletorDeOpcoes<FiltrosCampanhas>({ id: 'responsavel', rotulo: 'Responsável', icone: UserRound, campo: 'responsavel', opcoes: responsaveis, todos: 'Todas', largura: 160 }),
          ]}
          quantosAvancados={(valor) => (valor.canal ? 1 : 0)}
          avancados={(valor, aoMudar) => seletorDeOpcoes<FiltrosCampanhas>({ id: 'canal', rotulo: 'Canal', icone: Radio, campo: 'canal', opcoes: paraOpcoes(ROTULOS_CANAL), largura: 120 }).campos(valor, aoMudar, () => undefined)}
          ativos={ativos}
          aoRemoverAtivo={(id) => mudar({ [id]: '' })}
        />
        {arquivadas > 0 && (
          <div className="flex justify-end">
            <Button variante="terciario" aria-pressed={filtros.arquivados} onClick={() => mudar({ arquivados: !filtros.arquivados })}>
              <Archive aria-hidden />
              {filtros.arquivados ? 'Voltar às campanhas' : `Arquivadas (${arquivadas})`}
            </Button>
          </div>
        )}
        <Lista
          rotulo="Campanhas"
          linhas={linhas}
          colunas={colunas}
          chave={(campanha) => campanha.id}
          aoAbrir={(campanha) => roteador.push(`/marketing/campanhas/${campanha.id}`)}
          filtrando={ativos.length > 0 || Boolean(filtros.busca.trim()) || filtros.arquivados}
          aoLimparFiltros={() => setFiltros(FILTROS_CAMPANHAS_INICIAIS)}
          vazio={<EstadoVazio icone={Megaphone} titulo="Nenhuma campanha ainda." texto="Reúna objetivo, período, peças e listas de espera em um lugar só." acao={<Button onClick={() => setNova(true)}>Nova campanha</Button>} />}
          cartao={(campanha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold break-words">{campanha.nome}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <EtiquetaDoContexto id={campanha.produto_id} produtos={dados.produtos} marcas={dados.marcas} />
                <EtiquetaDaCampanha situacao={campanha.situacao} />
              </span>
              <span className="text-[13px] text-ink-soft">{periodo(campanha)}</span>
            </span>
          )}
        />
      </div>
      {nova && <FormularioDeCampanha dados={dados} aoFechar={() => setNova(false)} aoCriar={(criada) => roteador.push(`/marketing/campanhas/${criada.id}`)} />}
    </div>
  );
}
