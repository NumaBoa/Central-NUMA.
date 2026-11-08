'use client';

import { BarChart3 } from 'lucide-react';
import { CartaoDePainel } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { carregarLinhasParaReferencia, referenciaDoProduto, textoDaReferencia, textoDoPercentual } from '@/dominio/estimado';
import { formatarHoras } from '@/dominio/horas';

async function carregar() {
  const [linhas, produtos, contrapartes] = await Promise.all([carregarLinhasParaReferencia(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.contraparte.listar({ incluirArquivados: true })]);
  const comImplantacao = produtos.filter((produto) => linhas.some((linha) => linha.produto_id === produto.id));
  return {
    contrapartes,
    produtos: comImplantacao.map((produto) => ({ produto, referencia: referenciaDoProduto(produto.id, linhas), emAndamento: linhas.filter((linha) => linha.produto_id === produto.id && linha.situacao !== 'concluida' && linha.situacao !== 'cancelada').length })),
  };
}

const horas = (valor: number | null) => (valor === null ? '—' : formatarHoras(valor));
const dias = (valor: number | null) => (valor === null ? '—' : `${valor.toLocaleString('pt-BR')} dias`);

/** T12.08: por produto, as implantações concluídas, horas e prazo estimados × realizados, desvio médio e amostra. */
export function TelaEstimado() {
  const { contexto } = useCentral();
  const consulta = useConsulta(() => carregar());
  const dados = consulta.dados;
  const produtos = (dados?.produtos ?? []).filter(({ produto }) => contexto.id === ID_CONSOLIDADA || produto.id === contexto.id);
  const contraparte = (id: string) => {
    const linha = dados?.contrapartes.find((item) => item.id === id);
    return linha ? nomeDaContraparte(linha) : 'Contraparte removida';
  };
  return (
    <>
      <CabecalhoPagina kicker="Operação" titulo="Estimado × realizado" resumo="O que a viabilidade e a proposta estimaram, contra o que foi apontado. É a base da referência histórica da viabilidade (T10.04)." />
      <AbasOperacao ativa="estimado" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as implantações." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        <p className="text-xs text-ink-soft">Só entram as implantações concluídas. Horas: as apontadas na implantação; prazo: do Início à Entrega realizados. Cada média tem a própria amostra, e produtos diferentes nunca se somam (RN-12.06).</p>
        {dados && !produtos.length && <EstadoVazio icone={BarChart3} titulo="Nenhuma implantação ainda." texto="Quando uma implantação for concluída, o estimado × realizado do produto aparece aqui." />}
        {produtos.map(({ produto, referencia, emAndamento }) => (
          <section key={produto.id} aria-label={`Estimado × realizado de ${produto.nome}`} data-produto={produto.id}>
            <CartaoDePainel titulo={produto.nome}>
              <div className="grid gap-4">
                <p className="text-[13px] font-semibold" data-referencia>{textoDaReferencia(referencia, produto.nome)}</p>
                <ListaDeDados>
                  <Dado rotulo="Concluídas (amostra)">{String(referencia.amostra)}</Dado>
                  <Dado rotulo="Horas realizadas, em média">{horas(referencia.mediaHoras)}</Dado>
                  <Dado rotulo="Desvio médio de horas">{textoDoPercentual(referencia.desvioMedioHoras)}</Dado>
                  <Dado rotulo="Prazo realizado, em média">{dias(referencia.mediaPrazoDias)}</Dado>
                  <Dado rotulo="Desvio médio de prazo">{textoDoPercentual(referencia.desvioMedioPrazo)}</Dado>
                  <Dado rotulo="Em andamento">{emAndamento ? `${emAndamento}, fora da referência até concluir` : 'Nenhuma'}</Dado>
                </ListaDeDados>
                {referencia.implantacoes.length > 0 && (
                  <ul aria-label={`Implantações concluídas de ${produto.nome}`} className="grid gap-2">
                    {referencia.implantacoes.map((linha) => (
                      <li key={linha.id} className="grid gap-1.5 rounded-md border border-line p-3 text-[13px] md:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,1fr))] md:items-center">
                        <LinkCentral href={`/operacao/${linha.id}`} className="inline-flex min-h-11 items-center font-medium underline md:min-h-0">{linha.codigo} · {contraparte(linha.contraparte_id)}</LinkCentral>
                        <span>Horas: {horas(linha.resultado.horasEstimadas)} × {horas(linha.horasApontadas)} <span className="text-ink-soft">({textoDoPercentual(linha.resultado.desvioHoras)})</span></span>
                        <span>Prazo: {dias(linha.resultado.prazoEstimadoDias)} × {dias(linha.resultado.prazoRealizadoDias)} <span className="text-ink-soft">({textoDoPercentual(linha.resultado.desvioPrazo)})</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CartaoDePainel>
          </section>
        ))}
      </div>
    </>
  );
}
