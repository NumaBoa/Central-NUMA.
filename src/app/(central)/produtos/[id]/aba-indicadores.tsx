'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { CartaoDaFicha, Indisponivel } from '@/componentes/produtos/aparencia';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { GraficoLinhas } from '@/componentes/produtos/grafico-linhas';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { KpiDefinicao } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { somarMeses } from '@/dominio/cobrancas';
import { primeiroDiaDoMes } from '@/dominio/custos-produto';
import { carregarKpis, DEFINICAO_PENDENTE, errosDoKpiMensal, KPI_USUARIOS_ATIVOS, kpisDoProduto, MAXIMO_DE_KPIS_PROPRIOS, removerKpiProprio, salvarKpiMensal, salvarKpiProprio, serieDoKpi } from '@/dominio/kpis';
import { rotuloDaCompetencia } from '@/dominio/titulos';
import { formatarNumero } from '@/lib/formatacao';

const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** T07.08: escolher o mês traz o que já existe; salvar de novo altera o mesmo registro. */
export function FormularioKpi({ aberto, aoFechar, produtoId, nomeDoProduto, hoje }: { aberto: boolean; aoFechar: () => void; produtoId: string; nomeDoProduto: string; hoje: string }) {
  const consulta = useConsulta(() => carregarKpis(produtoId), [produtoId]);
  const [mes, setMes] = useState('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [observacao, setObservacao] = useState('');
  const [fonte, setFonte] = useState('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const credencial = useAvisoDeCredencial();
  const kpis = kpisDoProduto(consulta.dados?.definicoes ?? []);
  const competencia = mes ? `${mes}-01` : '';
  const existente = consulta.dados?.registros.find((registro) => registro.competencia === competencia);

  useEffect(() => {
    if (!aberto) return;
    setMes(somarMeses(primeiroDiaDoMes(hoje), -1).slice(0, 7));
    setTentou(false);
    credencial.limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomeça a cada vez que abre
  }, [aberto, hoje]);

  useEffect(() => {
    if (!aberto) return;
    const paraCampo = (valor: number | null | undefined) => (valor === null || valor === undefined ? '' : valor.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 4 }));
    setValores(Object.fromEntries(Object.entries(existente?.valores ?? {}).map(([codigo, valor]) => [codigo, paraCampo(valor)])));
    setObservacao(existente?.observacao ?? '');
    setFonte(existente?.fonte_url ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- troca junto com a competência
  }, [aberto, existente?.id, mes]);

  const dados = { competencia, valores, observacao, fonte_url: fonte };
  const erros = errosDoKpiMensal(dados, kpis, hoje);
  const visiveis: Readonly<Record<string, string>> = tentou ? erros : {};
  const idDe = (campo: string) => (campo === 'competencia' ? 'kpi-competencia' : campo === 'fonte_url' ? 'kpi-fonte' : `kpi-${campo}`);
  const listaDeErros: ErroDeCampo[] = Object.entries(visiveis).map(([campo, mensagem]) => ({ campoId: idDe(campo), mensagem }));

  async function enviar() {
    if (salvando) return;
    setTentou(true);
    const primeiro = Object.keys(erros)[0];
    if (primeiro) {
      requestAnimationFrame(() => document.getElementById(idDe(primeiro))?.focus());
      return;
    }
    if (!credencial.conferir([observacao])) return;
    setSalvando(true);
    try {
      await salvarKpiMensal(produtoId, dados, hoje);
      aviso(existente ? 'Indicadores do mês atualizados.' : 'Indicadores do mês registrados.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Registrar indicadores"
      descricao={`${nomeDoProduto}: um registro por mês. Vazio fica sem registro; zero é zero.`}
      alterado={Object.values(valores).some(Boolean) && !existente}
      rotuloSalvar={existente ? 'Salvar alterações' : 'Salvar'}
      salvando={salvando}
      erros={listaDeErros}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void enviar();
      }}
    >
      {credencial.faixa}
      <div className="grid gap-[18px]">
        <Campo id="kpi-competencia" rotulo="Competência" obrigatorio erro={visiveis.competencia} ajuda={existente ? 'Este mês já tem registro: você está alterando.' : 'Editável até o fechamento da competência, que chega na F1.'}>
          {(controle) => <Input {...controle} type="month" max={hoje.slice(0, 7)} value={mes} onChange={(evento) => setMes(evento.target.value)} />}
        </Campo>
        {kpis.map((kpi) => (
          <Campo key={kpi.codigo} id={`kpi-${kpi.codigo}`} rotulo={kpi.unidade ? `${kpi.nome} (${kpi.unidade})` : kpi.nome} erro={visiveis[kpi.codigo]} ajuda={kpi.ajuda ?? kpi.definicao ?? undefined}>
            {(controle) => <Input {...controle} inputMode={kpi.tipo === 'inteiro' ? 'numeric' : 'decimal'} autoComplete="off" value={valores[kpi.codigo] ?? ''} onChange={(evento) => setValores((atuais) => ({ ...atuais, [kpi.codigo]: evento.target.value }))} />}
          </Campo>
        ))}
        <Campo id="kpi-fonte" rotulo="Fonte (link)" erro={visiveis.fonte_url} ajuda="Print ou relatório no Drive.">
          {(controle) => <Input {...controle} type="url" autoComplete="off" value={fonte} onChange={(evento) => setFonte(evento.target.value)} />}
        </Campo>
        <Campo rotulo="Observações do mês">{(controle) => <Textarea {...controle} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />}</Campo>
      </div>
    </JanelaFormulario>
  );
}

function FormularioKpiProprio({ aberto, aoFechar, produtoId }: { aberto: boolean; aoFechar: () => void; produtoId: string }) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('');
  const [definicao, setDefinicao] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setNome('');
      setUnidade('');
      setDefinicao('');
      setErro(undefined);
    }
  }, [aberto]);

  async function enviar() {
    if (salvando) return;
    if (!nome.trim()) {
      setErro('Informe o nome do indicador.');
      return;
    }
    setSalvando(true);
    try {
      await salvarKpiProprio(produtoId, { nome: nome.trim(), unidade: unidade.trim(), definicao: definicao.trim() });
      aviso('Indicador criado.');
      aoFechar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo indicador do produto"
      descricao={`Cada produto pode ter até ${MAXIMO_DE_KPIS_PROPRIOS}, como “pontos cadastrados”.`}
      alterado={Boolean(nome)}
      salvando={salvando}
      erros={erro ? [{ campoId: 'kpi-proprio-nome', mensagem: erro }] : []}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void enviar();
      }}
    >
      <div className="grid gap-[18px]">
        <Campo id="kpi-proprio-nome" rotulo="Nome" obrigatorio erro={erro}>
          {(controle) => <Input {...controle} autoComplete="off" value={nome} onChange={(evento) => setNome(evento.target.value)} />}
        </Campo>
        <Campo rotulo="Unidade">{(controle) => <Input {...controle} autoComplete="off" value={unidade} onChange={(evento) => setUnidade(evento.target.value)} />}</Campo>
        <Campo rotulo="Definição">{(controle) => <Textarea {...controle} value={definicao} onChange={(evento) => setDefinicao(evento.target.value)} />}</Campo>
      </div>
    </JanelaFormulario>
  );
}

/** T07.08: um gráfico por KPI, de 12 meses, desenhado dos registros. Mês sem registro é um buraco, não zero. */
export function AbaIndicadores({ produto, aoRegistrar, aoEditarDefinicao, hoje }: { produto: { id: string; definicao_usuario_ativo?: string | null }; aoRegistrar: () => void; aoEditarDefinicao: () => void; hoje: string }) {
  const consulta = useConsulta(() => carregarKpis(produto.id), [produto.id]);
  const [escolhido, setEscolhido] = useState(KPI_USUARIOS_ATIVOS);
  const [novoProprio, setNovoProprio] = useState(false);
  const [removendo, setRemovendo] = useState<KpiDefinicao | null>(null);

  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler os indicadores." aoTentarDeNovo={consulta.recarregar} />;
  const { definicoes, registros } = consulta.dados;
  const kpis = kpisDoProduto(definicoes);
  const kpi = kpis.find((item) => item.codigo === escolhido) ?? kpis[0];
  const serie = kpi ? serieDoKpi(registros, kpi.codigo, hoje) : [];
  const temValor = serie.some((ponto) => ponto.valor !== null);
  const rotulos = serie.map((ponto) => rotuloDaCompetencia(ponto.competencia));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px]">
          <span className="font-semibold">Usuário ativo: </span>
          {produto.definicao_usuario_ativo ?? <span className="text-ink-soft">{DEFINICAO_PENDENTE}</span>}{' '}
          <Button variante="terciario" tamanho="pequeno" onClick={aoEditarDefinicao}>
            {produto.definicao_usuario_ativo ? 'Alterar' : 'Definir'}
          </Button>
        </div>
        <Button onClick={aoRegistrar}>
          <Plus aria-hidden />
          Registrar indicadores
        </Button>
      </div>

      {!registros.length ? (
        <EstadoVazio icone={BarChart3} titulo="Nenhum indicador registrado." texto="O registro é manual, um por mês. Sem registro não quer dizer zero." acao={<Button onClick={aoRegistrar}>Registrar indicadores</Button>} />
      ) : (
        <>
          <CartaoDaFicha titulo="Últimos 12 meses">
            <Pilulas className="mb-3" rotulo="Indicador" rotuloOculto valor={kpi?.codigo ?? ''} aoMudar={setEscolhido} opcoes={kpis.map((item) => ({ valor: item.codigo, rotulo: item.nome }))} />
            {temValor ? (
              <GraficoLinhas rotulo={`${kpi?.nome} nos últimos 12 meses`} series={[{ id: kpi?.codigo ?? '', nome: kpi?.nome ?? '', pontos: serie.map((ponto, indice) => ({ x: indice, y: ponto.valor })) }]} formatarY={numero} formatarX={(indice) => rotulos[indice] ?? ''} rotuloX="Competência" altura={240} />
            ) : (
              <p className="py-6 text-center text-[13px] text-ink-soft">Sem registro deste indicador nos últimos 12 meses.</p>
            )}
          </CartaoDaFicha>
          <section aria-label="Registros por mês" className="grid gap-2.5">
            <h2 className="text-[17px] leading-6">Registros por mês</h2>
            <div className="faixa-rolagem hidden rounded-lg border border-line bg-paper md:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-mist text-left text-ink-soft">
                    <th scope="col" className="px-3.5 py-2.5 font-semibold whitespace-nowrap">
                      Competência
                    </th>
                    {kpis.map((item) => (
                      <th key={item.codigo} scope="col" className="px-3.5 py-2.5 text-right font-semibold">
                        {item.nome}
                      </th>
                    ))}
                    <th scope="col" className="px-3.5 py-2.5 font-semibold">
                      Fonte
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr key={registro.id} className="border-t border-line">
                      <th scope="row" className="px-3.5 py-2.5 text-left font-medium whitespace-nowrap">
                        {rotuloDaCompetencia(registro.competencia)}
                      </th>
                      {kpis.map((item) => (
                        <td key={item.codigo} className="px-3.5 py-2.5 text-right tabular-nums">
                          {registro.valores[item.codigo] === null || registro.valores[item.codigo] === undefined ? <span className="text-ink-soft">Sem registro</span> : formatarNumero(registro.valores[item.codigo] as number)}
                        </td>
                      ))}
                      <td className="px-3.5 py-2.5">
                        {registro.fonte_url ? (
                          <a href={registro.fonte_url} target="_blank" rel="noreferrer" className="underline">
                            Abrir
                          </a>
                        ) : (
                          <span className="text-ink-soft">Não informada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-2 md:hidden">
              {registros.map((registro) => (
                <li key={registro.id} className="rounded-lg border border-line bg-paper p-4 text-[13px]">
                  <p className="font-semibold">{rotuloDaCompetencia(registro.competencia)}</p>
                  <dl className="mt-1 grid gap-0.5">
                    {kpis.map((item) => (
                      <div key={item.codigo} className="flex justify-between gap-3">
                        <dt className="text-ink-soft">{item.nome}</dt>
                        <dd className="tabular-nums">{registro.valores[item.codigo] === null || registro.valores[item.codigo] === undefined ? 'Sem registro' : formatarNumero(registro.valores[item.codigo] as number)}</dd>
                      </div>
                    ))}
                  </dl>
                  {registro.observacao && <p className="mt-1 break-words text-ink-soft">{registro.observacao}</p>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <CartaoDaFicha
        titulo="Indicadores próprios"
        acao={
          definicoes.length < MAXIMO_DE_KPIS_PROPRIOS ? (
            <Button variante="terciario" tamanho="pequeno" onClick={() => setNovoProprio(true)}>
              <Plus aria-hidden />
              Novo indicador
            </Button>
          ) : undefined
        }
      >
        {definicoes.length ? (
          <ul className="grid gap-1.5">
            {definicoes.map((definicao) => (
              <li key={definicao.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 break-words">
                  <strong className="font-semibold">{definicao.nome}</strong>
                  {definicao.unidade ? ` (${definicao.unidade})` : ''}
                  {definicao.definicao ? ` · ${definicao.definicao}` : ''}
                </span>
                <Button variante="terciario" tamanho="pequeno" aria-label={`Remover ${definicao.nome}`} onClick={() => setRemovendo(definicao)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhum ainda. Cada produto pode ter até {MAXIMO_DE_KPIS_PROPRIOS}, como “pontos cadastrados”.</p>
        )}
      </CartaoDaFicha>
      <Indisponivel titulo="Listas de espera">Vêm do M08, que ainda não existe. Assinantes pagantes entram na F1.</Indisponivel>
      <Faixa tipo="info">O alerta “KPI não preenchido” (dia 10) ainda não está ligado no Meu dia.</Faixa>

      <FormularioKpiProprio aberto={novoProprio} aoFechar={() => setNovoProprio(false)} produtoId={produto.id} />
      <Confirmacao
        aberto={removendo !== null}
        aoFechar={() => setRemovendo(null)}
        titulo={`Remover ${removendo?.nome ?? 'indicador'}?`}
        texto="Ele sai do formulário e do gráfico. Os valores já registrados continuam guardados."
        rotuloConfirmar="Remover indicador"
        perigo
        aoConfirmar={() => {
          const alvo = removendo;
          setRemovendo(null);
          if (alvo) removerKpiProprio(alvo.id).then(() => aviso('Indicador removido.'), (erro: unknown) => aviso(mensagemDoErro(erro)));
        }}
      />
    </div>
  );
}
