'use client';

import { useMemo } from 'react';
import { EtiquetaContexto, EtiquetaPrioridade, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import type { Atividade } from '@/dados/tipos/atividade';
import { agruparAtividades, contextosDaAtividade, estaBloqueada, primeiroNome, ROTULOS_ORIGEM_ALERTA, ROTULOS_SITUACAO_ATIVIDADE, textoDoPrazo, type AgruparPor, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import { cn } from '@/lib/utils';
import type { AcoesDaAtividade } from './acoes-atividade';
import { ConteudoDoCartao, MenuDaAtividade, TipoDaAtividade } from './cartao-atividade';

const TIPOS_DA_SITUACAO: Readonly<Record<Atividade['situacao'], TipoSituacao>> = { a_fazer: 'neutro', em_andamento: 'info', aguardando: 'atencao', concluida: 'sucesso', cancelada: 'neutro' };

export function SituacaoDaAtividade({ atividade }: { atividade: Atividade }) {
  if (estaBloqueada(atividade)) return <EtiquetaSituacao tipo="erro">Bloqueada</EtiquetaSituacao>;
  return <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[atividade.situacao]}>{atividade.situacao === 'aguardando' ? 'Aguardando' : ROTULOS_SITUACAO_ATIVIDADE[atividade.situacao]}</EtiquetaSituacao>;
}

type ListaAtividadesProps = {
  linhas: readonly AtividadeDoDia[];
  dados: DadosMeuDia;
  hoje: string;
  acoes: AcoesDaAtividade;
  agruparPor: AgruparPor;
};

/** Lista (P1) de T03.01. No celular, o mesmo cartão do quadro. */
export function ListaAtividades({ linhas, dados, hoje, acoes, agruparPor }: ListaAtividadesProps) {
  const grupos = useMemo(() => agruparAtividades(linhas, agruparPor, hoje, dados), [linhas, agruparPor, hoje, dados]);

  const colunas = useMemo<readonly Coluna<AtividadeDoDia>[]>(() => {
    const nome = (id: string) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
    return [
      {
        id: 'titulo',
        titulo: 'Atividade',
        essencial: true,
        celula: (atividade) => (
          <span className="grid min-w-44 gap-0.5">
            <span className="font-medium break-words">{atividade.titulo}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft tabular-nums">
              <TipoDaAtividade tipo={atividade.tipo} />
              {atividade.codigo}
              {atividade.tipo === 'alerta' && <span>· Origem: {ROTULOS_ORIGEM_ALERTA[atividade.origem_tipo ?? ''] ?? 'Sistema'}</span>}
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
        celula: (atividade) => (
          <span className="flex flex-wrap gap-1">
            {contextosDaAtividade(atividade, dados).map((contexto) => (
              <EtiquetaContexto key={contexto.id} contexto={contexto} />
            ))}
          </span>
        ),
      },
      { id: 'area', titulo: 'Área', celula: (atividade) => dados.areas.find((area) => area.id === atividade.area_id)?.nome ?? '—' },
      {
        id: 'prazo',
        titulo: 'Prazo',
        essencial: true,
        celula: (atividade) => {
          const prazo = textoDoPrazo(atividade, hoje);
          return <span className={cn('whitespace-nowrap', prazo.atrasada && 'font-semibold text-err')}>{prazo.texto}</span>;
        },
      },
      { id: 'prioridade', titulo: 'Prioridade', celula: (atividade) => <EtiquetaPrioridade prioridade={atividade.prioridade} /> },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (atividade) => <SituacaoDaAtividade atividade={atividade} /> },
    ];
  }, [dados, hoje]);

  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
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
            colunas={colunas}
            chave={(atividade) => atividade.id}
            aoAbrir={acoes.abrir}
            cartaoInterativo
            acoesDaLinha={(atividade) => <MenuDaAtividade atividade={atividade} acoes={acoes} />}
            cartao={(atividade) => <ConteudoDoCartao atividade={atividade} dados={dados} hoje={hoje} acoes={acoes} />}
            vazio={null}
          />
        </section>
      ))}
    </div>
  );
}
