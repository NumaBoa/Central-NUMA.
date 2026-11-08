'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShieldAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { useCentral } from '@/componentes/layout/central-provider';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { JanelaIncidente } from '@/componentes/operacao/formulario-incidente';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import type { IncidenteDisponibilidade } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import { carregarIncidentes, CRITERIO_DA_DISPONIBILIDADE, duracaoDoIncidente, painelDeDisponibilidade, ROTULOS_IMPACTO, textoDaDisponibilidade } from '@/dominio/incidentes';
import { hojeISO } from '@/lib/datas';
import { formatarDataHora } from '@/lib/formatacao';

const TOM_DO_IMPACTO = { total: 'erro', parcial: 'atencao', degradado: 'neutro' } as const;

/** T12.05: a disponibilidade do mês por produto, com o critério à vista, e os incidentes. */
export function TelaIncidentes() {
  const roteador = useRouter();
  const { pessoa, contexto } = useCentral();
  const hoje = hojeISO();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [criando, setCriando] = useState(false);
  const consulta = useConsulta(() => carregarIncidentes());
  const painel = useConsulta(() => painelDeDisponibilidade(mes), [mes, consulta.dados]);
  const dados = consulta.dados;
  const agora = new Date().toISOString();
  const produto = (id: string) => dados?.produtos.find((linha) => linha.id === id)?.nome ?? 'Produto removido';
  const linhas = useMemo(() => (dados?.incidentes ?? []).filter((linha) => contexto.id === ID_CONSOLIDADA || linha.produto_id === contexto.id), [dados, contexto.id]);
  const doPainel = (painel.dados ?? []).filter((linha) => contexto.id === ID_CONSOLIDADA || linha.produto.id === contexto.id);

  const colunas: readonly Coluna<IncidenteDisponibilidade>[] = [
    { id: 'titulo', titulo: 'Incidente', essencial: true, celula: (linha) => <span className="grid"><span className="font-medium">{linha.titulo}</span><span className="text-xs text-ink-soft">{linha.codigo} · {produto(linha.produto_id)}</span></span> },
    { id: 'impacto', titulo: 'Impacto', essencial: true, celula: (linha) => <EtiquetaSituacao tipo={TOM_DO_IMPACTO[linha.impacto]}>{ROTULOS_IMPACTO[linha.impacto]}</EtiquetaSituacao> },
    { id: 'inicio', titulo: 'Início', ordenar: (a, b) => a.inicio.localeCompare(b.inicio), celula: (linha) => formatarDataHora(linha.inicio) },
    { id: 'duracao', titulo: 'Duração', essencial: true, celula: (linha) => (linha.fim ? duracaoDoIncidente(linha, agora) : <span className="font-semibold text-err">{duracaoDoIncidente(linha, agora)}</span>) },
    { id: 'comunicado', titulo: 'Comunicado', celula: (linha) => (linha.comunicado ? `Sim, ${linha.canal}` : 'Não') },
    { id: 'solicitacoes', titulo: 'Solicitações', numerica: true, celula: (linha) => String(dados?.solicitacoes.filter((item) => item.incidente_id === linha.id).length ?? 0) },
  ];
  const botaoNovo = <Button onClick={() => setCriando(true)}><Plus aria-hidden />Novo incidente</Button>;

  return (
    <>
      <CabecalhoPagina kicker="Operação" titulo="Incidentes de disponibilidade" resumo="Confiança: sistema de pé. Quedas, impacto, causa e comunicação aos clientes." acoes={botaoNovo} />
      <AbasOperacao ativa="incidentes" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler os incidentes." aoTentarDeNovo={consulta.recarregar} />}
        {dados?.incidentes.some((linha) => !linha.fim) && <Faixa tipo="erro">Há incidente em andamento: encerre-o na ficha quando o produto voltar.</Faixa>}
        <section aria-label="Disponibilidade do mês" className="rounded-lg border border-line bg-paper p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[17px]">Disponibilidade do mês</h2>
            <Campo id="inc-mes" rotulo="Mês">
              {(controle) => <input {...controle} type="month" className="campo w-[190px]" value={mes} max={hoje.slice(0, 7)} onChange={(evento) => evento.target.value && setMes(evento.target.value)} />}
            </Campo>
          </div>
          <p className="mb-3 text-xs text-ink-soft">{CRITERIO_DA_DISPONIBILIDADE} Indicador gerencial: créditos a clientes são decisão manual.</p>
          {doPainel.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {doPainel.map(({ produto: item, conta, compromissos }) => (
                <li key={item.id} className="rounded-md border border-line p-3.5 text-[13px]" data-disponibilidade={item.id}>
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{item.nome}</span>
                    <span className="text-[19px] font-semibold tabular-nums">{textoDaDisponibilidade(conta.disponibilidade)}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {conta.incidentes} {conta.incidentes === 1 ? 'incidente' : 'incidentes'} · {conta.minutosTotais} min de queda total · {conta.minutosParciais} min de queda parcial{conta.emAndamento ? ' · conta até agora' : ''}
                  </p>
                  {compromissos.map((compromisso) => (
                    <p key={compromisso.rotulo} className={compromisso.abaixo ? 'mt-2 font-semibold text-err' : 'mt-2 text-ink-soft'}>
                      {compromisso.rotulo}: meta {compromisso.meta.toLocaleString('pt-BR')}%. {compromisso.abaixo ? `Abaixo da meta: créditos possíveis, decisão manual${compromisso.creditos ? ` (${compromisso.creditos})` : ''}.` : 'Dentro da meta.'}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">Nenhum incidente nem meta de disponibilidade neste mês: 100% para todos os produtos.</p>
          )}
        </section>
        <Lista
          rotulo="Incidentes de disponibilidade"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          aoAbrir={(linha) => roteador.push(`/operacao/incidentes/${linha.id}`)}
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold">{linha.titulo}</span>
              <span className="text-[13px] text-ink-soft">{linha.codigo} · {produto(linha.produto_id)} · {formatarDataHora(linha.inicio)}</span>
              <span className="flex flex-wrap items-center gap-2 text-[13px]">
                <EtiquetaSituacao tipo={TOM_DO_IMPACTO[linha.impacto]}>{ROTULOS_IMPACTO[linha.impacto]}</EtiquetaSituacao>
                <span>{duracaoDoIncidente(linha, agora)}</span>
              </span>
            </span>
          )}
          vazio={<EstadoVazio icone={ShieldAlert} titulo="Nenhum incidente registrado." texto="Registre cada queda, mesmo curta: é ela que mede a disponibilidade do mês." acao={botaoNovo} />}
        />
      </div>
      {criando && dados && (
        <JanelaIncidente
          produtos={dados.produtos}
          pessoas={dados.pessoas}
          responsavelInicial={pessoa.id}
          aoFechar={() => setCriando(false)}
          aoSalvar={(id) => {
            setCriando(false);
            roteador.push(`/operacao/incidentes/${id}`);
          }}
        />
      )}
    </>
  );
}
