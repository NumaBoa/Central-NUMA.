'use client';

import { useMemo } from 'react';
import { useCentral } from '@/componentes/layout/central-provider';
import { EtiquetaContexto, EtiquetaPrioridade, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { MenuColunas, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import type { Atividade } from '@/dados/tipos/atividade';
import { agruparAtividades, concluidaHoje, contextosDaAtividade, estaAberta, estaBloqueada, primeiroNome, ROTULOS_ORIGEM_ALERTA, ROTULOS_SITUACAO_ATIVIDADE, type AgruparPor, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import type { AcoesDaAtividade } from './acoes-atividade';
import { BotaoAdiar, CaixaDeConcluir, ConteudoDoCartao, MarcaDeRotina, MenuDaAtividade, PrazoDaAtividade, TipoDaAtividade } from './cartao-atividade';

const TIPOS_DA_SITUACAO: Readonly<Record<Atividade['situacao'], TipoSituacao>> = { a_fazer: 'neutro', em_andamento: 'info', aguardando: 'atencao', concluida: 'sucesso', cancelada: 'neutro' };

export function SituacaoDaAtividade({ atividade }: { atividade: Atividade }) {
  if (estaBloqueada(atividade)) return <EtiquetaSituacao tipo="erro">Bloqueada</EtiquetaSituacao>;
  return <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[atividade.situacao]}>{ROTULOS_SITUACAO_ATIVIDADE[atividade.situacao]}</EtiquetaSituacao>;
}

const LISTA = 'meu-dia';
const COLUNAS_PADRAO = ['titulo', 'responsavel', 'contexto', 'prazo', 'prioridade', 'situacao'];

type ListaAtividadesProps = {
  linhas: readonly AtividadeDoDia[];
  dados: DadosMeuDia;
  hoje: string;
  acoes: AcoesDaAtividade;
  agruparPor: AgruparPor;
};

/** Lista (P1) de T03.01: conclui e adia na própria linha. No celular, o mesmo cartão do quadro. */
export function ListaAtividades({ linhas, dados, hoje, acoes, agruparPor }: ListaAtividadesProps) {
  const { pessoa } = useCentral();
  const { colunasVisiveis } = usePreferenciasDaLista(pessoa.id, LISTA, COLUNAS_PADRAO);
  const grupos = useMemo(() => agruparAtividades(linhas, agruparPor, hoje, dados), [linhas, agruparPor, hoje, dados]);

  const colunas = useMemo<readonly Coluna<AtividadeDoDia>[]>(() => {
    const nome = (id: string) => dados.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
    return [
      {
        id: 'titulo',
        titulo: 'Atividade',
        essencial: true,
        fixa: true,
        celula: (atividade) => (
          <span className="flex min-w-44 items-center gap-3">
            <CaixaDeConcluir atividade={atividade} acoes={acoes} />
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[13px] font-semibold break-words">{atividade.titulo}</span>
              <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft tabular-nums">
                <TipoDaAtividade tipo={atividade.tipo} />
                {atividade.codigo}
                {atividade.recorrencia_id && <MarcaDeRotina />}
                {atividade.tipo === 'alerta' && <span>· Origem: {ROTULOS_ORIGEM_ALERTA[atividade.origem_tipo ?? ''] ?? 'Sistema'}</span>}
              </span>
              {/* Sem espaço para a coluna do prazo, ele vem aqui. */}
              <span className="text-xs @min-[800px]:hidden">
                <PrazoDaAtividade atividade={atividade} hoje={hoje} />
              </span>
            </span>
          </span>
        ),
      },
      {
        id: 'responsavel',
        titulo: 'Responsável',
        essencial: true,
        celula: (atividade) => (
          <span className="grid gap-0.5">
            <NomeDaPessoa nome={nome(atividade.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" />
            {atividade.participantes.length > 0 && <span className="text-xs text-ink-soft">{atividade.participantes.map((id) => `+${primeiroNome(nome(id))}`).join(' ')}</span>}
          </span>
        ),
      },
      {
        id: 'contexto',
        titulo: 'Contexto',
        essencial: true,
        classe: 'hidden @min-[960px]:table-cell',
        celula: (atividade) => (
          <span className="flex flex-wrap gap-1">
            {contextosDaAtividade(atividade, dados).map((contexto) => (
              <EtiquetaContexto key={contexto.id} contexto={contexto} />
            ))}
          </span>
        ),
      },
      { id: 'area', titulo: 'Área', essencial: true, classe: 'hidden @min-[960px]:table-cell', celula: (atividade) => dados.areas.find((area) => area.id === atividade.area_id)?.nome ?? '—' },
      {
        id: 'prazo',
        titulo: 'Prazo',
        essencial: true,
        classe: 'hidden @min-[800px]:table-cell',
        celula: (atividade) => (
          <span className="whitespace-nowrap">
            <PrazoDaAtividade atividade={atividade} hoje={hoje} />
          </span>
        ),
      },
      { id: 'prioridade', titulo: 'Prioridade', essencial: true, classe: 'hidden @min-[1060px]:table-cell', celula: (atividade) => <EtiquetaPrioridade prioridade={atividade.prioridade} /> },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (atividade) => <SituacaoDaAtividade atividade={atividade} /> },
    ];
  }, [dados, hoje, acoes]);

  const visiveis = colunas.filter((coluna) => colunasVisiveis.includes(coluna.id));
  const abertas = linhas.filter(estaAberta).length;
  const concluidas = linhas.filter((atividade) => concluidaHoje(atividade, hoje)).length;
  const rodape = (
    <span className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-normal text-ink-soft tabular-nums">
        {linhas.length === 1 ? '1 atividade' : `${linhas.length} atividades`} · {abertas === 1 ? '1 aberta' : `${abertas} abertas`} · {concluidas === 1 ? '1 concluída hoje' : `${concluidas} concluídas hoje`}
      </span>
      <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />
    </span>
  );

  return (
    <div className="space-y-6">
      {grupos.map((grupo, indice) => (
        <section key={grupo.id} aria-label={grupo.titulo || 'Atividades'} className="space-y-2.5">
          {grupo.titulo && (
            <h2 className="flex items-center gap-2 text-[17px] leading-6">
              {grupo.titulo}
              <span className="rounded-pill bg-hover px-2 font-body text-xs leading-[18px] font-semibold tracking-normal text-ink-soft tabular-nums">{grupo.linhas.length}</span>
            </h2>
          )}
          <Lista
            rotulo={grupo.titulo ? `Atividades: ${grupo.titulo}` : 'Atividades'}
            linhas={grupo.linhas}
            colunas={visiveis}
            chave={(atividade) => atividade.id}
            aoAbrir={acoes.abrir}
            cartaoInterativo
            compacta
            acoesDaLinha={(atividade) => (
              <span className="inline-flex items-center justify-end gap-1">
                {estaAberta(atividade) && <BotaoAdiar soIcone atividade={atividade} acoes={acoes} />}
                <MenuDaAtividade atividade={atividade} acoes={acoes} />
              </span>
            )}
            cartao={(atividade) => <ConteudoDoCartao atividade={atividade} dados={dados} hoje={hoje} acoes={acoes} />}
            rodape={indice === grupos.length - 1 ? rodape : undefined}
            vazio={null}
          />
        </section>
      ))}
    </div>
  );
}
