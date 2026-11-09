'use client';

import { useMemo, useState } from 'react';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { executar } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { JanelaHoras, LancamentoRapido } from '@/componentes/operacao/formulario-horas';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Indicador } from '@/componentes/padroes/indicador';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Button } from '@/componentes/ui/button';
import type { ApontamentoHoras } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from '@/dominio/contextos';
import { carregarHoras, formatarHoras, formularioDoApontamento, horasDoRegistro, horasEReceita, horasPorPessoaEProduto, HREF_DO_REGISTRO, mesDoApontamento, opcoesDeVinculo, removerApontamento, ROTULOS_REGISTRO_HORAS, somarHoras, type DadosDasHoras } from '@/dominio/horas';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const NOMES_DOS_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeDoMes = (mes: string) => `${NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

/** T12.06: lançamento rápido, apontamentos e os relatórios por pessoa × produto × mês, por registro e horas × receita. */
export function TelaHoras() {
  const { pessoa, contexto } = useCentral();
  const consulta = useConsulta(() => carregarHoras());
  const dados = consulta.dados;
  const hoje = hojeISO();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [pessoaFiltro, setPessoaFiltro] = useState('');
  const [editando, setEditando] = useState<ApontamentoHoras | null>(null);
  const [removendo, setRemovendo] = useState<ApontamentoHoras | null>(null);

  // O contexto global recorta tudo (18 §10.2): a Numa institucional são as horas sem produto.
  const doContexto = useMemo(() => (dados?.apontamentos ?? []).filter((linha) => contexto.id === ID_CONSOLIDADA || (linha.produto_id ?? ID_INSTITUCIONAL) === contexto.id), [dados, contexto.id]);
  const doMes = doContexto.filter((linha) => mesDoApontamento(linha) === mes);
  const linhas = doMes.filter((linha) => !pessoaFiltro || linha.pessoa_id === pessoaFiltro).sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
  const nomeDaPessoa = (id: string) => dados?.pessoas.find((linha) => linha.id === id)?.nome_completo ?? 'Pessoa removida';
  const nomeDoContexto = (id: string | null) => (!id || id === ID_INSTITUCIONAL ? 'Numa institucional' : (dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  const opcoes = useMemo(() => (dados ? opcoesDeVinculo(dados, hoje) : []), [dados, hoje]);
  const rotuloDoVinculo = (linha: ApontamentoHoras) => {
    if (!linha.registro_tipo || !linha.registro_id) return null;
    const opcao = opcoes.find((item) => item.valor === `${linha.registro_tipo}:${linha.registro_id}`);
    return { texto: opcao?.rotulo ?? `${ROTULOS_REGISTRO_HORAS[linha.registro_tipo]} encerrado ou removido`, href: HREF_DO_REGISTRO[linha.registro_tipo](linha.registro_id) };
  };

  const colunas: readonly Coluna<ApontamentoHoras>[] = [
    { id: 'data', titulo: 'Data', essencial: true, ordenar: (a, b) => a.data.localeCompare(b.data), celula: (linha) => formatarDiaISO(linha.data) },
    { id: 'pessoa', titulo: 'Pessoa', essencial: true, celula: (linha) => nomeDaPessoa(linha.pessoa_id) },
    { id: 'horas', titulo: 'Horas', essencial: true, numerica: true, ordenar: (a, b) => a.horas - b.horas, celula: (linha) => formatarHoras(linha.horas) },
    { id: 'contexto', titulo: 'Contexto', celula: (linha) => nomeDoContexto(linha.produto_id) },
    {
      id: 'vinculo',
      titulo: 'Vínculo',
      celula: (linha) => {
        const vinculo = rotuloDoVinculo(linha);
        return vinculo ? (
          <LinkCentral href={vinculo.href} className="underline" onClick={(evento) => evento.stopPropagation()}>
            {vinculo.texto}
          </LinkCentral>
        ) : (
          '—'
        );
      },
    },
    { id: 'descricao', titulo: 'Descrição', celula: (linha) => linha.descricao ?? '—' },
  ];

  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as horas." aoTentarDeNovo={consulta.recarregar} />;

  const tabela = horasPorPessoaEProduto(doContexto, mes);
  const suasNoMes = somarHoras(doMes.filter((linha) => linha.pessoa_id === pessoa.id));
  const registros = dados ? registrosComHoras(dados, doContexto, mes) : [];
  const receitas = dados ? receitasDosContratos(dados, doContexto) : [];

  return (
    <>
      <CabecalhoPagina comoUsar="/ajuda/operacao/apontar-horas" kicker="Operação" titulo="Horas" resumo="O esforço real de cada produto e contrato. A média apontada alimenta as horas do simulador de preço (D20)." />
      <AbasOperacao ativa="horas" />
      <div className="mt-5 space-y-4">
        {dados && <LancamentoRapido dados={dados} pessoaId={pessoa.id} aoSalvar={consulta.recarregar} />}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Indicador titulo={`Horas em ${nomeDoMes(mes)}`} valor={formatarHoras(tabela.total)} contexto={contexto.id === ID_CONSOLIDADA ? 'Todos os contextos' : contexto.nome} />
          <Indicador titulo="Suas horas no mês" valor={formatarHoras(suasNoMes)} contexto={pessoa.nome} />
          <Indicador titulo="Pessoas que apontaram" valor={String(tabela.pessoas.length)} className="max-lg:col-span-2" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Campo id="horas-mes" rotulo="Mês">
            {(controle) => <input {...controle} type="month" className="campo w-[190px]" value={mes} max={hoje.slice(0, 7)} onChange={(evento) => evento.target.value && setMes(evento.target.value)} />}
          </Campo>
          <Campo id="horas-pessoa" rotulo="Pessoa">
            {(controle) => (
              <Selecao {...controle} className="w-[220px]" value={pessoaFiltro} onChange={(evento) => setPessoaFiltro(evento.target.value)}>
                <option value="">Todas</option>
                {(dados?.pessoas ?? []).filter((linha) => doContexto.some((apontamento) => apontamento.pessoa_id === linha.id)).map((linha) => (
                  <option key={linha.id} value={linha.id}>
                    {linha.nome_completo}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <Tabs defaultValue="apontamentos">
          <TabsList aria-label="Relatórios de horas">
            <TabsTrigger value="apontamentos">Apontamentos</TabsTrigger>
            <TabsTrigger value="pessoa-produto">Pessoa × produto</TabsTrigger>
            <TabsTrigger value="registros">Implantações e contratos</TabsTrigger>
            <TabsTrigger value="receita">Horas × receita</TabsTrigger>
          </TabsList>
          <TabsContent value="apontamentos" className="mt-4">
            <Lista
              rotulo="Apontamentos de horas"
              linhas={linhas}
              colunas={colunas}
              chave={(linha) => linha.id}
              estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
              filtrando={Boolean(pessoaFiltro) || mes !== hoje.slice(0, 7)}
              aoLimparFiltros={() => {
                setPessoaFiltro('');
                setMes(hoje.slice(0, 7));
              }}
              aoAbrir={(linha) => setEditando(linha)}
              acoesDaLinha={(linha) => (
                <span className="flex gap-1">
                  <Button variante="icone" tamanho="icone" aria-label={`Editar o apontamento de ${formatarDiaISO(linha.data)}`} onClick={() => setEditando(linha)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variante="icone" tamanho="icone" aria-label={`Remover o apontamento de ${formatarDiaISO(linha.data)}`} onClick={() => setRemovendo(linha)}>
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              )}
              cartao={(linha) => (
                <span className="grid gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{formatarHoras(linha.horas)}</span>
                    <span className="text-[13px] text-ink-soft">{formatarDiaISO(linha.data)}</span>
                  </span>
                  <span className="text-[13px] text-ink-soft">
                    {nomeDaPessoa(linha.pessoa_id)} · {nomeDoContexto(linha.produto_id)}
                  </span>
                  {linha.descricao && <span className="text-[13px]">{linha.descricao}</span>}
                </span>
              )}
              rodape={linhas.length ? <p className="text-[13px] font-semibold tabular-nums">Total: {formatarHoras(somarHoras(linhas))}</p> : undefined}
              vazio={<EstadoVazio icone={Clock} titulo={`Nenhuma hora em ${nomeDoMes(mes)}.`} texto="Use o lançamento rápido, acima. Cada apontamento conta para o produto e para o vínculo escolhido." />}
            />
          </TabsContent>
          <TabsContent value="pessoa-produto" className="mt-4">
            {tabela.pessoas.length ? (
              <section aria-label={`Horas por pessoa e produto em ${nomeDoMes(mes)}`}>
                <div className="hidden overflow-x-auto rounded-lg border border-line bg-paper md:block">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-ink-soft">
                        <th className="px-4 py-2.5 font-semibold">Pessoa</th>
                        {tabela.contextos.map((id) => (
                          <th key={id} className="px-4 py-2.5 text-right font-semibold">
                            {nomeDoContexto(id)}
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabela.pessoas.map((id) => (
                        <tr key={id} className="border-b border-line last:border-0">
                          <th scope="row" className="px-4 py-2.5 text-left font-medium">
                            {nomeDaPessoa(id)}
                          </th>
                          {tabela.contextos.map((contextoId) => (
                            <td key={contextoId} className="px-4 py-2.5 text-right tabular-nums">
                              {tabela.celula(id, contextoId) ? formatarHoras(tabela.celula(id, contextoId)) : '—'}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatarHoras(tabela.totalDaPessoa(id))}</td>
                        </tr>
                      ))}
                      <tr className="bg-hover">
                        <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                          Total
                        </th>
                        {tabela.contextos.map((id) => (
                          <td key={id} className="px-4 py-2.5 text-right font-semibold tabular-nums">
                            {formatarHoras(tabela.totalDoContexto(id))}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatarHoras(tabela.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="grid gap-2 md:hidden">
                  {tabela.pessoas.map((id) => (
                    <li key={id} className="rounded-lg border border-line bg-paper p-4">
                      <p className="flex justify-between font-semibold">
                        <span>{nomeDaPessoa(id)}</span>
                        <span className="tabular-nums">{formatarHoras(tabela.totalDaPessoa(id))}</span>
                      </p>
                      <ul className="mt-2 grid gap-1 text-[13px] text-ink-soft">
                        {tabela.contextos
                          .filter((contextoId) => tabela.celula(id, contextoId))
                          .map((contextoId) => (
                            <li key={contextoId} className="flex justify-between">
                              <span>{nomeDoContexto(contextoId)}</span>
                              <span className="tabular-nums">{formatarHoras(tabela.celula(id, contextoId))}</span>
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <EstadoVazio icone={Clock} titulo={`Nenhuma hora em ${nomeDoMes(mes)}.`} texto="O relatório mostra só quem apontou e onde." />
            )}
          </TabsContent>
          <TabsContent value="registros" className="mt-4">
            {registros.length ? (
              <ul aria-label="Horas por implantação e contrato" className="grid gap-2">
                {registros.map((registro) => (
                  <li key={registro.chave} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-4 py-3">
                    <span className="grid min-w-0">
                      <LinkCentral href={registro.href} className="font-semibold underline">
                        {registro.rotulo}
                      </LinkCentral>
                      <span className="text-xs text-ink-soft">{registro.tipo}</span>
                    </span>
                    <span className="text-right text-[13px] tabular-nums">
                      <span className="block font-semibold">{formatarHoras(registro.total)}</span>
                      <span className="text-xs text-ink-soft">{formatarHoras(registro.noMes)} em {nomeDoMes(mes)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVazio icone={Clock} titulo="Nenhuma hora vinculada a implantação ou contrato." texto="No contrato contam também as horas das implantações e solicitações dele." />
            )}
          </TabsContent>
          <TabsContent value="receita" className="mt-4 space-y-3">
            <Faixa>Informação financeira (FIN). Nesta etapa local, sem permissões, aparece para todas (D27). A receita é a dos lançamentos a receber do contrato, sem os cancelados.</Faixa>
            {receitas.length ? (
              <ul aria-label="Horas e receita dos contratos" className="grid gap-2">
                {receitas.map((linha) => (
                  <li key={linha.contrato.id} className="grid gap-2 rounded-lg border border-line bg-paper px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] md:items-center">
                    <LinkCentral href={`/contratos/${linha.contrato.id}`} className="font-semibold underline">
                      {linha.contrato.codigo} · {linha.contrato.titulo}
                    </LinkCentral>
                    <Valor rotulo="Horas" valor={formatarHoras(linha.horas)} />
                    <Valor rotulo="Receita contratada" valor={linha.receitaContratada === null ? 'Sem lançamentos' : formatarDinheiro(linha.receitaContratada, linha.contrato.moeda)} />
                    <Valor rotulo="Recebido" valor={formatarDinheiro(linha.recebido, linha.contrato.moeda)} />
                    <Valor rotulo="Receita por hora" valor={linha.porHora === null ? '—' : formatarDinheiro(linha.porHora, linha.contrato.moeda)} />
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVazio icone={Clock} titulo="Nenhum contrato com horas apontadas." texto="Aponte horas no contrato, ou nas implantações e solicitações dele, para medir a rentabilidade do sob medida." />
            )}
          </TabsContent>
        </Tabs>
      </div>
      {editando && dados && <JanelaHoras dados={dados} pessoaId={pessoa.id} inicial={formularioDoApontamento(editando)} apontamentoId={editando.id} titulo="Editar apontamento" aoFechar={() => setEditando(null)} aoSalvar={consulta.recarregar} />}
      <Confirmacao
        aberto={Boolean(removendo)}
        aoFechar={() => setRemovendo(null)}
        titulo="Remover este apontamento?"
        texto={removendo ? `${formatarHoras(removendo.horas)} em ${formatarDiaISO(removendo.data)}. Ele sai dos relatórios e fica no histórico.` : ''}
        rotuloConfirmar="Remover"
        perigo
        aoConfirmar={async () => {
          if (removendo && (await executar(() => removerApontamento(removendo.id), 'Apontamento removido.'))) consulta.recarregar();
          setRemovendo(null);
        }}
      />
    </>
  );
}

function Valor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span className="flex justify-between gap-2 text-[13px] md:block md:text-right">
      <span className="text-xs text-ink-soft md:block">{rotulo}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
    </span>
  );
}

function registrosComHoras(dados: DadosDasHoras, linhas: readonly ApontamentoHoras[], mes: string) {
  const ligados = { implantacoes: dados.implantacoes, solicitacoes: dados.solicitacoes };
  const nomeDoProduto = (id: string) => dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido';
  const montar = (tipo: 'implantacao' | 'contrato', id: string, rotulo: string) => {
    const doRegistro = horasDoRegistro(linhas, tipo, id, ligados);
    return { chave: `${tipo}:${id}`, tipo: ROTULOS_REGISTRO_HORAS[tipo], rotulo, href: HREF_DO_REGISTRO[tipo](id), total: somarHoras(doRegistro), noMes: 0, linhas: doRegistro };
  };
  return [...dados.implantacoes.map((linha) => montar('implantacao', linha.id, `${linha.codigo} · ${nomeDoProduto(linha.produto_id)}`)), ...dados.contratos.map((linha) => montar('contrato', linha.id, `${linha.codigo} · ${linha.titulo}`))]
    .filter((registro) => registro.total > 0)
    .map((registro) => ({ ...registro, noMes: somarHoras(registro.linhas.filter((linha) => mesDoApontamento(linha) === mes)) }));
}

function receitasDosContratos(dados: DadosDasHoras, linhas: readonly ApontamentoHoras[]) {
  const ligados = { implantacoes: dados.implantacoes, solicitacoes: dados.solicitacoes };
  return dados.contratos
    .map((contrato) => horasEReceita(contrato, somarHoras(horasDoRegistro(linhas, 'contrato', contrato.id, ligados)), dados.titulos.filter((titulo) => titulo.origem_id === contrato.id), (titulo) => dados.recebidos.get(titulo.id) ?? 0))
    .filter((linha) => linha.horas > 0);
}
