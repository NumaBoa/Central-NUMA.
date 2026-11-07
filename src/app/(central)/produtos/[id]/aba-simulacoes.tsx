'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, GitCompare } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button, variantesBotao } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { valorParaCampo } from '@/dominio/dinheiro';
import { carregarSimulacoes, compararSimulacoes, criarRascunhoDaSimulacao, formatarPercentual, type LinhaComparada, type LinhaDaSimulacao } from '@/dominio/precificacao';
import { AVISO_ESTIMATIVA } from '@/dominio/simulador';
import { formatarData, formatarDinheiro, formatarNumero } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

function textoDoValor(linha: LinhaComparada, valor: number | string | null): string {
  if (valor === null || valor === '') return 'Não informado';
  if (typeof valor === 'string') return valor;
  if (linha.tipo === 'dinheiro') return formatarDinheiro(valor, 'BRL');
  if (linha.tipo === 'percentual') return formatarPercentual(valor);
  return formatarNumero(valor);
}

function textoDaDiferenca(linha: LinhaComparada): string | null {
  if (linha.diferenca === null || !linha.diferente) return null;
  const sinal = linha.diferenca > 0 ? '+' : '−';
  const absoluto = Math.abs(linha.diferenca);
  if (linha.tipo === 'dinheiro') return `${sinal}${formatarDinheiro(absoluto, 'BRL')}`;
  if (linha.tipo === 'percentual') return `${sinal}${formatarPercentual(absoluto)}`;
  return `${sinal}${formatarNumero(absoluto)}`;
}

/** Comparar 2 simulações (T07.07): lê os snapshots. O que mudou tem texto, além do destaque. */
function JanelaComparar({ a, b, aoFechar }: { a: LinhaDaSimulacao; b: LinhaDaSimulacao; aoFechar: () => void }) {
  const linhas = compararSimulacoes(a, b);
  const grupos = [
    { id: 'premissas', titulo: 'Premissas' },
    { id: 'resultados', titulo: 'Resultados' },
  ] as const;
  const mudaram = linhas.filter((linha) => linha.diferente).length;
  return (
    <JanelaFormulario larga soLeitura aberto aoFechar={aoFechar} titulo="Comparar simulações" descricao={`${a.codigo} v${a.versao} × ${b.codigo} v${b.versao}. ${mudaram === 1 ? '1 item mudou' : `${mudaram} itens mudaram`}.`} aoEnviar={(evento) => evento.preventDefault()}>
      <Faixa tipo="atencao" className="mb-4">
        {AVISO_ESTIMATIVA}.
      </Faixa>
      {grupos.map((grupo) => (
        <section key={grupo.id} className="mb-5">
          <h3 className="mb-2 text-[15px] font-semibold">{grupo.titulo}</h3>
          <table className="hidden w-full text-[13px] md:table">
            <thead>
              <tr className="bg-mist text-left text-ink-soft">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Item
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {a.nome} v{a.versao}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {b.nome} v{b.versao}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Diferença
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas
                .filter((linha) => linha.grupo === grupo.id)
                .map((linha) => (
                  <tr key={linha.rotulo} className={cn('border-t border-line', linha.diferente && 'bg-indigo-wash')}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {linha.rotulo}
                    </th>
                    <td className="px-3 py-2 tabular-nums">{textoDoValor(linha, linha.a)}</td>
                    <td className="px-3 py-2 tabular-nums">{textoDoValor(linha, linha.b)}</td>
                    <td className="px-3 py-2 tabular-nums">{linha.diferente ? (textoDaDiferenca(linha) ?? 'Mudou') : 'Igual'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <ul className="grid gap-2 md:hidden">
            {linhas
              .filter((linha) => linha.grupo === grupo.id)
              .map((linha) => (
                <li key={linha.rotulo} className={cn('rounded-md border border-line p-3 text-[13px]', linha.diferente && 'bg-indigo-wash')}>
                  <p className="font-semibold">{linha.rotulo}</p>
                  <p className="break-words tabular-nums">
                    v{a.versao}: {textoDoValor(linha, linha.a)}
                  </p>
                  <p className="break-words tabular-nums">
                    v{b.versao}: {textoDoValor(linha, linha.b)}
                  </p>
                  <p className="text-ink-soft">{linha.diferente ? (textoDaDiferenca(linha) ?? 'Mudou') : 'Igual'}</p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </JanelaFormulario>
  );
}

/** Usar como base: pede a oferta quando a simulação não tem uma, e cria só o rascunho. */
function JanelaCriarVersao({ simulacao, ofertas, produtoId, aoFechar }: { simulacao: LinhaDaSimulacao; ofertas: { id: string; nome: string }[]; produtoId: string; aoFechar: () => void }) {
  const roteador = useRouter();
  const [ofertaId, setOfertaId] = useState(simulacao.oferta_id ?? '');
  const [erro, setErro] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (salvando) return;
    if (!ofertaId) {
      setErro('Escolha a oferta.');
      return;
    }
    setSalvando(true);
    try {
      const rascunho = await criarRascunhoDaSimulacao(simulacao.id, ofertaId);
      aviso('Rascunho criado. Salvar a simulação não aprova preço: revise e aprove.');
      aoFechar();
      roteador.push(`/produtos/${produtoId}/ofertas/${ofertaId}?aprovar=${rascunho.id}`);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo="Criar versão de preço"
      descricao={`A partir de ${simulacao.codigo}: vira um rascunho, que ainda precisa ser aprovado.`}
      rotuloSalvar="Criar rascunho"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void criar();
      }}
    >
      {ofertas.length ? (
        <Campo id="base-oferta" rotulo="Oferta" obrigatorio erro={erro}>
          {(controle) => (
            <Selecao {...controle} value={ofertaId} disabled={Boolean(simulacao.oferta_id)} onChange={(evento) => setOfertaId(evento.target.value)}>
              <option value="">Escolha</option>
              {ofertas.map((oferta) => (
                <option key={oferta.id} value={oferta.id}>
                  {oferta.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      ) : (
        <Faixa tipo="atencao">Este produto ainda não tem oferta. Crie uma em Ofertas e preços.</Faixa>
      )}
    </JanelaFormulario>
  );
}

function JanelaDetalhe({ simulacao, aoFechar }: { simulacao: LinhaDaSimulacao; aoFechar: () => void }) {
  const { premissas, resultados } = simulacao;
  const nome = (id: string) => premissas.canais.find((canal) => canal.canal_id === id)?.nome ?? 'Canal';
  const dinheiro = (valor: number | null) => (valor === null ? 'Falta dado' : formatarDinheiro(valor, 'BRL'));
  return (
    <JanelaFormulario larga soLeitura aberto aoFechar={aoFechar} titulo={`${simulacao.nome} v${simulacao.versao}`} descricao={`${simulacao.codigo} · salva em ${formatarData(simulacao.criado_em)} por ${simulacao.autor}. Premissas e resultados como estavam ao salvar.`} aoEnviar={(evento) => evento.preventDefault()}>
      <Faixa tipo="atencao" className="mb-4">
        {AVISO_ESTIMATIVA}.
      </Faixa>
      {simulacao.observacao && <p className="mb-3 text-[13px] break-words">{simulacao.observacao}</p>}
      <dl className="mb-4 grid gap-x-5 gap-y-1 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="inline text-ink-soft">Custo fixo: </dt>
          <dd className="inline tabular-nums">{dinheiro(premissas.cf)}</dd>
        </div>
        <div>
          <dt className="inline text-ink-soft">Custo variável: </dt>
          <dd className="inline tabular-nums">{dinheiro(premissas.cv)}</dd>
        </div>
        <div>
          <dt className="inline text-ink-soft">Tributos: </dt>
          <dd className="inline">{premissas.tributos_pct === null ? 'Falta dado' : formatarPercentual(premissas.tributos_pct)}</dd>
        </div>
        <div>
          <dt className="inline text-ink-soft">Margem: </dt>
          <dd className="inline">{premissas.margem_pct === null ? 'Falta dado' : formatarPercentual(premissas.margem_pct)}</dd>
        </div>
        <div>
          <dt className="inline text-ink-soft">Horas: </dt>
          <dd className="inline">{premissas.incluir_horas ? `${premissas.horas ?? 'Falta dado'} h × ${dinheiro(premissas.valor_hora)}` : 'Não incluídas'}</dd>
        </div>
        <div>
          <dt className="inline text-ink-soft">Preço de teste: </dt>
          <dd className="inline tabular-nums">{dinheiro(premissas.preco_teste)}</dd>
        </div>
        {premissas.cf_justificativa && (
          <div className="sm:col-span-2">
            <dt className="inline text-ink-soft">Justificativa do custo: </dt>
            <dd className="inline break-words">{premissas.cf_justificativa}</dd>
          </div>
        )}
      </dl>
      {resultados.faltas.length > 0 && (
        <Faixa tipo="info" className="mb-3">
          Falta: {resultados.faltas.join(', ')}.
        </Faixa>
      )}
      <ul className="grid gap-2">
        {resultados.linhas.map((linha) => (
          <li key={`${linha.canal_id}-${linha.volume}`} className="rounded-md border border-line p-3 text-[13px]">
            <p className="font-semibold">
              {nome(linha.canal_id)} · {formatarNumero(linha.volume)} clientes
            </p>
            <p className="tabular-nums">
              Sugerido {dinheiro(linha.preco_sugerido)} · Piso {dinheiro(linha.piso)} · Resultado {dinheiro(linha.resultado_mensal)}
            </p>
          </li>
        ))}
      </ul>
    </JanelaFormulario>
  );
}

/** T07.07: as salvas do produto. Elas não mudam: recalcular abre o simulador e salva outra versão. */
export function AbaSimulacoes({ produtoId }: { produtoId: string }) {
  const consulta = useConsulta(() => carregarSimulacoes(produtoId), [produtoId]);
  const [marcadas, setMarcadas] = useState<readonly string[]>([]);
  const [comparando, setComparando] = useState(false);
  const [detalhe, setDetalhe] = useState<LinhaDaSimulacao | null>(null);
  const [base, setBase] = useState<LinhaDaSimulacao | null>(null);
  const simulacoes = consulta.dados?.simulacoes;
  const selecionadas = useMemo(() => (simulacoes ?? []).filter((simulacao) => marcadas.includes(simulacao.id)), [simulacoes, marcadas]);

  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as simulações." aoTentarDeNovo={consulta.recarregar} />;
  const { ofertas } = consulta.dados;
  const lista = consulta.dados.simulacoes;
  const caminhoNova = `/produtos/simulador?produto=${produtoId}`;

  if (!lista.length) {
    return (
      <EstadoVazio
        icone={Calculator}
        titulo="Nenhuma simulação salva."
        texto="Simule canais e volumes para entender o preço. Salvar não aprova nada."
        acao={
          <LinkCentral href={caminhoNova} className={variantesBotao()}>
            Nova simulação
          </LinkCentral>
        }
      />
    );
  }

  function alternar(id: string, marcada: boolean) {
    setMarcadas((atuais) => (marcada ? [...atuais, id].slice(-2) : atuais.filter((item) => item !== id)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {lista.length === 1 ? '1 simulação' : `${lista.length} simulações`}
          <span className="font-normal text-ink-soft"> · {marcadas.length === 2 ? '2 marcadas' : 'marque 2 para comparar'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" disabled={marcadas.length !== 2} onClick={() => setComparando(true)}>
            <GitCompare aria-hidden />
            Comparar
          </Button>
          <LinkCentral href={caminhoNova} className={variantesBotao()}>
            Nova simulação
          </LinkCentral>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {lista.map((simulacao) => (
          <li key={simulacao.id} className="rounded-lg border border-line bg-paper p-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-[18px] shrink-0 accent-[var(--indigo-dk)] max-md:size-6" aria-label={`Marcar ${simulacao.nome} v${simulacao.versao} para comparar`} checked={marcadas.includes(simulacao.id)} onChange={(evento) => alternar(simulacao.id, evento.target.checked)} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">
                  {simulacao.nome} <span className="font-normal text-ink-soft">v{simulacao.versao}</span>
                </p>
                <p className="text-[13px] text-ink-soft">
                  <span className="tabular-nums">{simulacao.codigo}</span> · {formatarData(simulacao.criado_em)} · {simulacao.autor}
                  {simulacao.nomeDaOferta ? ` · ${simulacao.nomeDaOferta}` : ' · sem oferta'}
                </p>
                <p className="text-[13px] break-words text-ink-soft">{simulacao.premissas.canais.map((canal) => canal.nome).join(', ')}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium tabular-nums">Preço sugerido: {simulacao.precoPrincipal === null ? 'Não calculado' : `R$ ${valorParaCampo(simulacao.precoPrincipal)}`}</span>
                  {simulacao.usadaEmPreco ? <EtiquetaSituacao tipo="info">Usada em versão de preço</EtiquetaSituacao> : <EtiquetaLivre>Não usada em preço</EtiquetaLivre>}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2 max-md:[&>*]:flex-1">
              <Button variante="secundario" tamanho="pequeno" onClick={() => setDetalhe(simulacao)}>
                Ver
              </Button>
              <LinkCentral href={`${caminhoNova}&base=${simulacao.id}`} className={variantesBotao({ variante: 'secundario', tamanho: 'pequeno' })}>
                Recalcular como nova versão
              </LinkCentral>
              <Button variante="terciario" tamanho="pequeno" onClick={() => setBase(simulacao)}>
                Criar versão de preço
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {comparando && selecionadas.length === 2 && <JanelaComparar a={selecionadas[1] as LinhaDaSimulacao} b={selecionadas[0] as LinhaDaSimulacao} aoFechar={() => setComparando(false)} />}
      {detalhe && <JanelaDetalhe simulacao={detalhe} aoFechar={() => setDetalhe(null)} />}
      {base && <JanelaCriarVersao simulacao={base} ofertas={ofertas.filter((oferta) => oferta.situacao !== 'inativa')} produtoId={produtoId} aoFechar={() => setBase(null)} />}
    </div>
  );
}
