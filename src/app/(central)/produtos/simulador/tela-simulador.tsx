'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, FileText, Plus, Save, Stamp, Trash2, TriangleAlert, X } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { AbasProdutos, textoDoPrecoComPeriodo, ValorOuFalta } from '@/componentes/produtos/aparencia';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { GraficoLinhas } from '@/componentes/produtos/grafico-linhas';
import { HorasApontadasNoSimulador } from '@/componentes/operacao/horas-no-simulador';
import { Button, variantesBotao } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Oferta, Premissas, Resultados, Simulacao } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from '@/dominio/contextos';
import { carregarSimulador, textoDoCusto, type DadosDoSimulador } from '@/dominio/portfolio';
import { alertaDoCanal, canalParaSimulacao, criarRascunhoDaSimulacao, entradasDaSimulacao, entradasVazias, esquemaFormularioConcorrente, formatarPercentual, FORMULARIO_CONCORRENTE_VAZIO, PERIODICIDADES_DE_PRECO, precoVigente, premissasDasEntradas, removerConcorrente, ROTULOS_PERIODICIDADE_PRECO, salvarConcorrente, salvarSimulacao, tabelaParaExportar, type EntradasDoSimulador, type FormularioConcorrente } from '@/dominio/precificacao';
import { AVISO_ESTIMATIVA, calcularSimulacao, cenarioPrincipal, custoFixoFoiSubstituido, MAXIMO_DE_CANAIS, MAXIMO_DE_VOLUMES, mesesDaCobranca, pontosDoGrafico, precoDaCobranca, precoMensal } from '@/dominio/simulador';
import { hojeISO } from '@/lib/datas';
import { baixarArquivo } from '@/lib/baixar-arquivo';
import { gerarCsv } from '@/lib/csv';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';

const dinheiro = (valor: number) => formatarDinheiro(valor, 'BRL');

function dinheiroCurto(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: Math.abs(valor) >= 100 ? 0 : 2 });
}

/** Número em destaque do resultado. Sem valor, diz o que falta: nunca zero. */
function Destaque({ titulo, valor, contexto }: { titulo: string; valor: ReactNode; contexto?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-paper p-3">
      <p className="text-xs font-semibold text-ink-soft">{titulo}</p>
      <p className="mt-1 font-display text-lg leading-6 font-semibold tabular-nums">{valor}</p>
      {contexto && <p className="mt-0.5 text-xs text-ink-soft">{contexto}</p>}
    </div>
  );
}

function TabelaDeResultados({ premissas, resultados }: { premissas: Premissas; resultados: Resultados }) {
  const principal = cenarioPrincipal(premissas);
  const anual = premissas.periodicidade === 'anual';
  const CabecalhoPreco = anual ? ' (equiv. mensal)' : '';
  return (
    <div className="grid gap-4">
      {premissas.canais.map((canal) => {
        const linhas = resultados.linhas.filter((linha) => linha.canal_id === canal.canal_id);
        const bloqueado = resultados.bloqueios.some((item) => item.canal_id === canal.canal_id);
        return (
          <section key={canal.canal_id} aria-label={`Resultados em ${canal.nome}`}>
            <h4 className="mb-1.5 text-[13px] font-semibold break-words">
              {canal.nome} <span className="font-normal text-ink-soft">· {canal.taxa_percentual === null ? 'taxa não informada' : formatarPercentual(canal.taxa_percentual)} + {canal.taxa_fixa === null ? 'fixa não informada' : dinheiro(canal.taxa_fixa)}</span>
            </h4>
            <div className="faixa-rolagem hidden rounded-md border border-line md:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-mist text-ink-soft">
                    <th scope="col" className="px-3 py-2 text-left font-semibold">
                      Clientes
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Preço sugerido{CabecalhoPreco}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Piso{CabecalhoPreco}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Receita líquida
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Contribuição
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Resultado mensal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => {
                    const destacada = principal?.canal_id === canal.canal_id && principal.volume === linha.volume;
                    return (
                      <tr key={linha.volume} className={cn('border-t border-line', destacada && 'bg-indigo-wash')}>
                        <th scope="row" className="px-3 py-2 text-left font-semibold tabular-nums">
                          {formatarNumero(linha.volume)}
                          {destacada && <span className="sr-only"> (cenário principal)</span>}
                        </th>
                        <td className="px-3 py-2 text-right">{bloqueado ? <span className="text-xs text-err">Bloqueado</span> : <ValorOuFalta valor={linha.preco_sugerido} />}</td>
                        <td className="px-3 py-2 text-right">
                          <ValorOuFalta valor={linha.piso} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ValorOuFalta valor={linha.receita_liquida} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ValorOuFalta valor={linha.margem_contribuicao} />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          <ValorOuFalta valor={linha.resultado_mensal} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-2 md:hidden">
              {linhas.map((linha) => {
                const destacada = principal?.canal_id === canal.canal_id && principal.volume === linha.volume;
                return (
                  <li key={linha.volume} className={cn('rounded-md border border-line p-3 text-[13px]', destacada && 'bg-indigo-wash')}>
                    <p className="font-semibold tabular-nums">
                      {formatarNumero(linha.volume)} clientes{destacada ? ' · principal' : ''}
                    </p>
                    <dl className="mt-1 grid gap-0.5">
                      {[
                        [`Preço sugerido${CabecalhoPreco}`, bloqueado ? null : linha.preco_sugerido],
                        [`Piso${CabecalhoPreco}`, linha.piso],
                        ['Receita líquida', linha.receita_liquida],
                        ['Contribuição', linha.margem_contribuicao],
                        ['Resultado mensal', linha.resultado_mensal],
                      ].map(([rotulo, valor]) => (
                        <div key={String(rotulo)} className="flex justify-between gap-3">
                          <dt className="text-ink-soft">{rotulo}</dt>
                          <dd>{bloqueado && String(rotulo).startsWith('Preço') ? <span className="text-xs text-err">Bloqueado</span> : <ValorOuFalta valor={valor as number | null} />}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ListaDeEquilibrio({ premissas, resultados }: { premissas: Premissas; resultados: Resultados }) {
  return (
    <ul className="grid gap-1 text-[13px]">
      {resultados.equilibrio.map((item) => {
        const canal = premissas.canais.find((linha) => linha.canal_id === item.canal_id);
        const texto = item.situacao === 'calculado' ? `${formatarNumero(item.clientes as number)} ${item.clientes === 1 ? 'cliente' : 'clientes'}` : item.situacao === 'sem_equilibrio' ? 'Não há equilíbrio com este preço' : item.situacao === 'bloqueado' ? 'Bloqueado: taxas e tributos somam 100% ou mais' : 'Falta dado';
        return (
          <li key={item.canal_id} className="flex flex-wrap justify-between gap-x-3">
            <span className="min-w-0 break-words text-ink-soft">{canal?.nome}</span>
            <span className={cn('font-semibold tabular-nums', item.situacao !== 'calculado' && 'text-xs font-medium text-ink-soft')}>{texto}</span>
          </li>
        );
      })}
    </ul>
  );
}

function FormularioConcorrenteEmbutido({ produtoId }: { produtoId: string }) {
  const [dados, setDados] = useState<FormularioConcorrente>(FORMULARIO_CONCORRENTE_VAZIO);
  const [erros, setErros] = useState<Readonly<Record<string, string>>>({});
  const mudar = (parcial: Partial<FormularioConcorrente>) => setDados((atuais) => ({ ...atuais, ...parcial }));

  async function adicionar() {
    const validado = esquemaFormularioConcorrente.safeParse(dados);
    if (!validado.success) {
      setErros(Object.fromEntries(validado.error.issues.map((falha) => [String(falha.path[0]), falha.message])));
      return;
    }
    try {
      await salvarConcorrente(produtoId, validado.data);
      setDados(FORMULARIO_CONCORRENTE_VAZIO);
      setErros({});
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  return (
    <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
      <Campo id="concorrente-nome" rotulo="Nome" obrigatorio erro={erros.nome}>
        {(controle) => <Input {...controle} autoComplete="off" value={dados.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />}
      </Campo>
      <Campo id="concorrente-preco" rotulo="Preço" erro={erros.preco}>
        {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.preco} onChange={(evento) => mudar({ preco: evento.target.value })} />}
      </Campo>
      <Campo rotulo="Moeda">{(controle) => <SelecaoMoeda {...controle} value={dados.moeda} onChange={(evento) => mudar({ moeda: evento.target.value })} />}</Campo>
      <Campo rotulo="Periodicidade">
        {(controle) => (
          <Selecao {...controle} value={dados.periodicidade} onChange={(evento) => mudar({ periodicidade: evento.target.value })}>
            {PERIODICIDADES_DE_PRECO.map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULOS_PERIODICIDADE_PRECO[opcao]}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo id="concorrente-link" rotulo="Link" erro={erros.link}>
        {(controle) => <Input {...controle} type="url" autoComplete="off" value={dados.link} onChange={(evento) => mudar({ link: evento.target.value })} />}
      </Campo>
      <Campo rotulo="Data da consulta">{(controle) => <EntradaData {...controle} value={dados.data} onChange={(evento) => mudar({ data: evento.target.value })} />}</Campo>
      <div className="sm:col-span-2">
        <Button variante="secundario" tamanho="pequeno" onClick={() => void adicionar()}>
          <Plus aria-hidden />
          Adicionar concorrente
        </Button>
      </div>
    </div>
  );
}

function JanelaSalvar({ aberto, aoFechar, sugestao, anterior, aoSalvar }: { aberto: boolean; aoFechar: () => void; sugestao: string; anterior: Simulacao | null; aoSalvar: (nome: string, observacao: string) => Promise<void> }) {
  const [nome, setNome] = useState(sugestao);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const credencial = useAvisoDeCredencial();

  useEffect(() => {
    if (aberto) {
      setNome(sugestao);
      setObservacao('');
      setErro(undefined);
      credencial.limpar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomeça a cada vez que abre
  }, [aberto, sugestao]);

  async function enviar() {
    if (salvando) return;
    if (!nome.trim()) {
      setErro('Dê um nome à simulação.');
      return;
    }
    if (!credencial.conferir([nome, observacao])) return;
    setSalvando(true);
    try {
      await aoSalvar(nome, observacao);
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
      titulo={anterior ? `Salvar como v${anterior.versao + 1}` : 'Salvar simulação'}
      descricao={anterior ? `A ${anterior.codigo} v${anterior.versao} continua como está.` : 'Guarda as premissas e os resultados de agora. Não aprova preço.'}
      rotuloSalvar="Salvar simulação"
      salvando={salvando}
      erros={erro ? [{ campoId: 'simulacao-nome', mensagem: erro }] : []}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void enviar();
      }}
    >
      {credencial.faixa}
      <div className="grid gap-[18px]">
        <Campo id="simulacao-nome" rotulo="Nome" obrigatorio erro={erro}>
          {(controle) => <Input {...controle} autoComplete="off" value={nome} onChange={(evento) => setNome(evento.target.value)} />}
        </Campo>
        <Campo rotulo="Observação">{(controle) => <Textarea {...controle} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />}</Campo>
      </div>
    </JanelaFormulario>
  );
}

/** PDF interno: uma página simples, para o navegador imprimir ou salvar. Sem biblioteca nova. */
function abrirParaImprimir(titulo: string, premissas: Premissas, resultados: Resultados) {
  const esc = (texto: string) => texto.replace(/[&<>"]/g, (letra) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[letra] as string);
  const { cabecalho, linhas } = tabelaParaExportar(premissas, resultados);
  const celula = (valor: number | null, formato: (numero: number) => string) => (valor === null ? 'Não informado' : formato(valor));
  const janela = window.open('', '_blank');
  if (!janela) {
    aviso('O navegador bloqueou a janela de impressão. Permita pop-ups e tente de novo.');
    return;
  }
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font:13px/1.5 system-ui,sans-serif;color:#2B2421;margin:32px}h1{font-size:22px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #E5DFD7;padding:6px 8px;text-align:left}th{background:#EFEAE3}p{margin:4px 0}</style></head><body><h1>${esc(titulo)}</h1><p><strong>${esc(AVISO_ESTIMATIVA)}.</strong> Uso interno.</p><p>Custo fixo: ${celula(premissas.cf, dinheiro)} · Custo variável: ${celula(premissas.cv, dinheiro)} · Tributos: ${celula(premissas.tributos_pct, formatarPercentual)} · Margem: ${celula(premissas.margem_pct, formatarPercentual)} · Horas: ${premissas.incluir_horas ? `${celula(premissas.horas, String)} × ${celula(premissas.valor_hora, dinheiro)}` : 'não incluídas'} · Preço de teste: ${celula(premissas.preco_teste, dinheiro)}</p><p>Canais: ${esc(premissas.canais.map((canal) => `${canal.nome} (${canal.taxa_percentual === null ? 'taxa não informada' : formatarPercentual(canal.taxa_percentual)}${canal.taxa_fixa === null ? ', fixa não informada' : ` + ${dinheiro(canal.taxa_fixa)}`})`).join('; '))}</p><table><thead><tr>${cabecalho.map((item) => `<th>${esc(item)}</th>`).join('')}</tr></thead><tbody>${linhas.map((linha) => `<tr>${linha.map((item) => `<td>${esc(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
  janela.document.close();
  janela.focus();
  janela.print();
}

/** T07.06: um por produto. Trocar de produto remonta tudo: nada é herdado de outro (RN-07.01). */
function SimuladorDoProduto({ dados, ofertaInicial, hoje }: { dados: DadosDoSimulador & { produto: NonNullable<DadosDoSimulador['produto']> }; ofertaInicial: string; hoje: string }) {
  const roteador = useRouter();
  const celular = useEhCelular();
  const { produto, ofertas, canais, cambios, custo, concorrentes, precos, base } = dados;
  const cfCalculado = custo?.valor ?? null;
  const canaisAtivos = canais.filter((canal) => canal.situacao === 'ativo' || base?.premissas.canais.some((item) => item.canal_id === canal.id));
  const [entradas, setEntradas] = useState<EntradasDoSimulador>(() => (base ? entradasDaSimulacao(base) : entradasVazias(cfCalculado)));
  const [congelados, setCongelados] = useState(() => base?.premissas.canais ?? []);
  const [ofertaId, setOfertaId] = useState(base?.oferta_id ?? ofertaInicial);
  const [editandoCf, setEditandoCf] = useState(Boolean(base && custoFixoFoiSubstituido(base.premissas)) || cfCalculado === null);
  const [painel, setPainel] = useState<'premissas' | 'resultados'>('premissas');
  const [salvando, setSalvando] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salva, setSalva] = useState<{ simulacao: Simulacao; assinatura: string } | null>(null);
  const [alterou, setAlterou] = useState(false);
  useAlteracoesPendentes(alterou);

  const mudar = (parcial: Partial<EntradasDoSimulador>) => {
    setEntradas((atuais) => ({ ...atuais, ...parcial }));
    setAlterou(true);
  };
  const { premissas, erros } = useMemo(() => premissasDasEntradas(entradas, { canais, cambios, cfCalculado: base?.premissas.cf_calculado ?? cfCalculado, canaisCongelados: congelados }), [entradas, canais, cambios, cfCalculado, congelados, base]);
  const resultados = useMemo(() => calcularSimulacao(premissas), [premissas]);
  const principal = cenarioPrincipal(premissas);
  const linha = principal ? resultados.linhas.find((item) => item.canal_id === principal.canal_id && item.volume === principal.volume) : undefined;
  const equilibrioPrincipal = resultados.equilibrio.find((item) => item.canal_id === principal?.canal_id);
  const assinatura = JSON.stringify({ premissas, ofertaId });
  const salvaAtual = salva && salva.assinatura === assinatura ? salva.simulacao : null;
  const canalDoPrincipal = premissas.canais.find((canal) => canal.canal_id === principal?.canal_id);
  const anual = premissas.periodicidade === 'anual';
  const semEquivalencia = premissas.periodicidade === 'unica' || premissas.periodicidade === 'por_uso';
  const serie = useMemo(() => pontosDoGrafico(premissas, resultados), [premissas, resultados]);
  const marcas = resultados.equilibrio.flatMap((item) => (item.clientes !== null && item.clientes > 0 ? [{ x: item.clientes, rotulo: `Equilíbrio em ${premissas.canais.find((canal) => canal.canal_id === item.canal_id)?.nome}: ${item.clientes} clientes` }] : []));
  const desatualizados = congelados.filter((congelado) => {
    const atual = canais.find((canal) => canal.id === congelado.canal_id);
    if (!atual) return false;
    const novo = canalParaSimulacao(atual, cambios);
    return novo.taxa_percentual !== congelado.taxa_percentual || novo.taxa_fixa !== congelado.taxa_fixa;
  });
  const vigente = ofertaId ? precoVigente(precos.filter((preco) => preco.oferta_id === ofertaId), principal?.canal_id ?? null, hoje) : null;
  const errosVisiveis = tentouSalvar ? erros : Object.fromEntries(Object.entries(erros).filter(([campo]) => campo !== 'cf_justificativa'));
  const oferta: Oferta | undefined = ofertas.find((item) => item.id === ofertaId);

  function alternarCanal(id: string) {
    if (entradas.canais.includes(id)) {
      setCongelados((atuais) => atuais.filter((canal) => canal.canal_id !== id));
      mudar({ canais: entradas.canais.filter((item) => item !== id) });
    } else if (entradas.canais.length < MAXIMO_DE_CANAIS) mudar({ canais: [...entradas.canais, id] });
  }

  async function salvarAgora(nome: string, observacao: string) {
    const simulacao = await salvarSimulacao({ produto_id: produto.id, oferta_id: ofertaId || null, nome, observacao, premissas, anterior_id: base?.id ?? null });
    setSalva({ simulacao, assinatura });
    setAlterou(false);
    aviso(`Simulação ${simulacao.codigo} salva. Isso não aprova preço.`, { acao: { rotulo: 'Ver salvas', aoClicar: () => roteador.push(`/produtos/${produto.id}?aba=simulacoes`) } });
  }

  function pedirSalvar() {
    setTentouSalvar(true);
    const invalido = Object.keys(erros)[0];
    if (invalido) {
      if (celular) setPainel('premissas');
      requestAnimationFrame(() => document.getElementById(`sim-${invalido}`)?.focus());
      return;
    }
    if (resultados.bloqueios.length) {
      aviso('Taxas, tributos e margem somam 100% ou mais. Ajuste antes de salvar.');
      return;
    }
    if (!premissas.canais.length) {
      aviso('Escolha ao menos um canal antes de salvar.');
      return;
    }
    setSalvando(true);
  }

  async function usarComoBase() {
    if (!salvaAtual || !ofertaId) return;
    try {
      const rascunho = await criarRascunhoDaSimulacao(salvaAtual.id, ofertaId);
      aviso('Rascunho criado. Revise e aprove: a simulação sozinha não define preço.');
      setAlterou(false);
      roteador.push(`/produtos/${produto.id}/ofertas/${ofertaId}?aprovar=${rascunho.id}`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  function exportarCsv() {
    const { cabecalho, linhas } = tabelaParaExportar(premissas, resultados);
    baixarArquivo(`simulacao-${produto.codigo_curto.toLowerCase()}.csv`, gerarCsv(cabecalho, linhas), 'text/csv;charset=utf-8');
  }

  const painelDePremissas = (
    <section aria-label="Premissas da simulação" className={cn('grid content-start gap-4 rounded-lg border border-line bg-paper p-4 md:p-5', celular && painel !== 'premissas' && 'hidden')}>
      <h2 className="text-[17px] leading-6">Premissas</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Campo id="sim-oferta" rotulo="Oferta">
          {(controle) => (
            <Selecao
              {...controle}
              value={ofertaId}
              onChange={(evento) => {
                setOfertaId(evento.target.value);
                setAlterou(true);
              }}
            >
              <option value="">Sem oferta</option>
              {ofertas
                .filter((item) => item.situacao !== 'inativa')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
            </Selecao>
          )}
        </Campo>
        <Campo id="sim-periodicidade" rotulo="Periodicidade">
          {(controle) => (
            <Selecao {...controle} value={entradas.periodicidade} onChange={(evento) => mudar({ periodicidade: evento.target.value as Premissas['periodicidade'] })}>
              {PERIODICIDADES_DE_PRECO.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {ROTULOS_PERIODICIDADE_PRECO[opcao]}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      </div>
      {anual && <p className="text-xs text-ink-soft">Plano anual: o preço de teste é o valor do ano, comparado por 1/12. A taxa fixa cai uma vez por cobrança.</p>}
      {semEquivalencia && <Faixa tipo="atencao">Cobrança {ROTULOS_PERIODICIDADE_PRECO[entradas.periodicidade].toLocaleLowerCase('pt-BR')}: as fórmulas tratam o preço como se fosse por cliente e por mês. Leia com cuidado.</Faixa>}

      <div className="rounded-md border border-line p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="texto-rotulo">Custo fixo mensal (CF)</p>
            <p className="text-[13px] text-ink-soft">{custo ? `Base: ${textoDoCusto(custo, dinheiro)}` : 'Base: sem dados'}</p>
            {custo?.situacao === 'calculado' && custo.mesesComCusto < 3 && <p className="text-xs text-warn">Só {custo.mesesComCusto} de 3 meses têm lançamento.</p>}
          </div>
          {cfCalculado !== null && !editandoCf && (
            <Button variante="terciario" tamanho="pequeno" onClick={() => setEditandoCf(true)}>
              Alterar
            </Button>
          )}
        </div>
        {editandoCf ? (
          <div className="mt-2.5 grid gap-3">
            <Campo id="sim-cf" rotulo="Valor manual" erro={errosVisiveis.cf}>
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.cf} onChange={(evento) => mudar({ cf: evento.target.value })} />}
            </Campo>
            <Campo id="sim-cf_justificativa" rotulo="Justificativa" obrigatorio={custoFixoFoiSubstituido(premissas)} erro={errosVisiveis.cf_justificativa} ajuda="Exigida quando o valor é diferente da média.">
              {(controle) => <Textarea {...controle} value={entradas.cf_justificativa} onChange={(evento) => mudar({ cf_justificativa: evento.target.value })} />}
            </Campo>
          </div>
        ) : (
          <p className="mt-1 font-semibold tabular-nums">{premissas.cf === null ? 'Falta informar' : `${dinheiro(premissas.cf)}/mês`}</p>
        )}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Campo id="sim-cv" rotulo="Custo variável por cliente/mês (CV)" erro={errosVisiveis.cv}>
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.cv} onChange={(evento) => mudar({ cv: evento.target.value })} />}
        </Campo>
        <Campo id="sim-tributos" rotulo="Tributos estimados (%)" erro={errosVisiveis.tributos} ajuda="Estimativa a validar com contador.">
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.tributos} onChange={(evento) => mudar({ tributos: evento.target.value })} />}
        </Campo>
        <Campo id="sim-margem" rotulo="Margem desejada sobre a receita (%)" erro={errosVisiveis.margem}>
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.margem} onChange={(evento) => mudar({ margem: evento.target.value })} />}
        </Campo>
        <Campo id="sim-preco_teste" rotulo={anual ? 'Preço de teste (por ano)' : 'Preço de teste'} erro={errosVisiveis.preco_teste} ajuda="Para o equilíbrio e o resultado.">
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.preco_teste} onChange={(evento) => mudar({ preco_teste: evento.target.value })} />}
        </Campo>
      </div>

      <div className="grid gap-2.5">
        <label className="flex min-h-11 items-center gap-2.5 text-[13px] font-semibold md:min-h-8">
          <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={entradas.incluir_horas} onChange={(evento) => mudar({ incluir_horas: evento.target.checked })} />
          Incluir horas das fundadoras
        </label>
        {entradas.incluir_horas && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo id="sim-horas" rotulo="Horas por mês (H)" erro={errosVisiveis.horas}>
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.horas} onChange={(evento) => mudar({ horas: evento.target.value })} />}
            </Campo>
            <Campo id="sim-valor_hora" rotulo="Valor-hora (vh)" erro={errosVisiveis.valor_hora} ajuda="Sem valor padrão: informe nesta simulação.">
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={entradas.valor_hora} onChange={(evento) => mudar({ valor_hora: evento.target.value })} />}
            </Campo>
            <HorasApontadasNoSimulador produtoId={produto.id} aoUsar={(horas) => mudar({ horas })} />
          </div>
        )}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 texto-rotulo">Canais (até {MAXIMO_DE_CANAIS})</legend>
        {canaisAtivos.length ? (
          <ul className="grid gap-1.5">
            {canaisAtivos.map((canal) => {
              const marcado = entradas.canais.includes(canal.id);
              const alerta = alertaDoCanal(canal, hoje);
              return (
                <li key={canal.id} className="rounded-md border border-line px-3 py-2 text-[13px]">
                  <label className="flex min-h-11 items-center gap-2.5 md:min-h-7">
                    <input type="checkbox" className="size-[18px] shrink-0 accent-[var(--indigo-dk)]" checked={marcado} disabled={!marcado && entradas.canais.length >= MAXIMO_DE_CANAIS} onChange={() => alternarCanal(canal.id)} />
                    <span className="min-w-0 flex-1 font-medium break-words">{canal.nome}</span>
                  </label>
                  <p className="text-xs text-ink-soft">
                    {canal.taxa_percentual === null ? 'Percentual não informado' : formatarPercentual(canal.taxa_percentual)} + {canal.taxa_fixa === null ? 'fixa não informada' : formatarDinheiro(canal.taxa_fixa, canal.taxa_fixa_moeda ?? 'BRL')} · {canal.verificado_em ? `verificado em ${formatarDiaISO(canal.verificado_em)}` : 'sem verificação'}
                  </p>
                  {alerta === 'vencida' && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-warn">
                      <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                      Verificado há mais de 12 meses.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Faixa
            tipo="atencao"
            acao={
              <LinkCentral href="/produtos/canais" className="underline">
                Cadastrar canal
              </LinkCentral>
            }
          >
            Nenhum canal cadastrado. As taxas são informadas por vocês.
          </Faixa>
        )}
        {desatualizados.length > 0 && (
          <Faixa
            tipo="atencao"
            acao={
              <Button
                variante="terciario"
                tamanho="pequeno"
                onClick={() => {
                  setCongelados([]);
                  setAlterou(true);
                }}
              >
                Usar taxas atuais
              </Button>
            }
          >
            A simulação de origem usou taxas diferentes das atuais em {desatualizados.map((canal) => canal.nome).join(', ')}.
          </Faixa>
        )}
      </fieldset>

      <fieldset id="sim-volumes" tabIndex={-1} className="grid gap-2">
        <legend className="mb-1 texto-rotulo">Volumes de clientes (até {MAXIMO_DE_VOLUMES})</legend>
        <div className="flex flex-wrap gap-2">
          {entradas.volumes.map((volume, indice) => (
            <span key={indice} className="flex items-center gap-1">
              <Input aria-label={`Volume ${indice + 1}`} inputMode="numeric" autoComplete="off" className="w-[84px]" value={volume} onChange={(evento) => mudar({ volumes: entradas.volumes.map((item, posicao) => (posicao === indice ? evento.target.value : item)) })} />
              {entradas.volumes.length > 1 && (
                <Button variante="icone" tamanho="icone" aria-label={`Remover volume ${volume}`} onClick={() => mudar({ volumes: entradas.volumes.filter((_, posicao) => posicao !== indice) })}>
                  <X aria-hidden />
                </Button>
              )}
            </span>
          ))}
          {entradas.volumes.length < MAXIMO_DE_VOLUMES && (
            <Button variante="terciario" tamanho="pequeno" onClick={() => mudar({ volumes: [...entradas.volumes, ''] })}>
              <Plus aria-hidden />
              Volume
            </Button>
          )}
        </div>
        {errosVisiveis.volumes && <p className="text-xs text-err">{errosVisiveis.volumes}</p>}
      </fieldset>

      {premissas.canais.length > 0 && premissas.volumes.length > 0 && (
        <details className="rounded-md border border-line px-3 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold md:min-h-8">Cenário principal</summary>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <Campo rotulo="Canal">
              {(controle) => (
                <Selecao {...controle} value={principal?.canal_id ?? ''} onChange={(evento) => mudar({ principal_canal: evento.target.value, principal_volume: String(principal?.volume ?? '') })}>
                  {premissas.canais.map((canal) => (
                    <option key={canal.canal_id} value={canal.canal_id}>
                      {canal.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Volume">
              {(controle) => (
                <Selecao {...controle} value={String(principal?.volume ?? '')} onChange={(evento) => mudar({ principal_volume: evento.target.value, principal_canal: principal?.canal_id ?? '' })}>
                  {premissas.volumes.map((volume) => (
                    <option key={volume} value={volume}>
                      {formatarNumero(volume)} clientes
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
          <p className="pb-1 text-xs text-ink-soft">O piso deste volume é o que vale na aprovação do preço.</p>
        </details>
      )}
    </section>
  );

  const painelDeResultados = (
    <section aria-label="Resultados da simulação" className={cn('grid min-w-0 content-start gap-4 rounded-lg border border-line bg-paper p-4 md:p-5', celular && painel !== 'resultados' && 'hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] leading-6">Resultados</h2>
        <EtiquetaSituacao tipo="atencao">{AVISO_ESTIMATIVA}</EtiquetaSituacao>
      </div>
      <p className="text-[13px] text-ink-soft">
        {principal && canalDoPrincipal ? (
          <>
            Cenário: {formatarNumero(principal.volume)} clientes em {canalDoPrincipal.nome} ({canalDoPrincipal.taxa_percentual === null ? 'taxa não informada' : formatarPercentual(canalDoPrincipal.taxa_percentual)} + {canalDoPrincipal.taxa_fixa === null ? 'fixa não informada' : dinheiro(canalDoPrincipal.taxa_fixa)}), tributos {premissas.tributos_pct === null ? 'não informados' : formatarPercentual(premissas.tributos_pct)}, margem {premissas.margem_pct === null ? 'não informada' : formatarPercentual(premissas.margem_pct)}{premissas.preco_teste !== null ? `, teste a ${dinheiro(premissas.preco_teste)}` : ''}.
          </>
        ) : (
          'Escolha ao menos um canal e um volume.'
        )}
      </p>
      {resultados.bloqueios.length > 0 && (
        <div role="alert">
          <Faixa tipo="erro">
            {resultados.bloqueios[0]?.mensagem}: {resultados.bloqueios.map((item) => premissas.canais.find((canal) => canal.canal_id === item.canal_id)?.nome).join(', ')}. O preço sugerido não é calculado até ajustar.
          </Faixa>
        </div>
      )}
      {resultados.faltas.length > 0 && (
        <div role="status">
          <Faixa tipo="info">Falta: {resultados.faltas.join(', ')}.</Faixa>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Destaque titulo={anual ? 'Preço sugerido (equiv. mensal)' : 'Preço sugerido'} valor={resultados.bloqueios.some((item) => item.canal_id === principal?.canal_id) ? <span className="text-xs text-err">Bloqueado</span> : <ValorOuFalta valor={linha?.preco_sugerido} />} contexto={anual && linha?.preco_sugerido ? `${dinheiro(precoDaCobranca(linha.preco_sugerido, 'anual'))} por ano` : undefined} />
        <Destaque titulo={anual ? 'Piso, margem 0 (equiv. mensal)' : 'Piso (margem 0)'} valor={<ValorOuFalta valor={linha?.piso} />} />
        <Destaque titulo="Receita líquida por cliente" valor={<ValorOuFalta valor={linha?.receita_liquida} />} />
        <Destaque titulo="Contribuição por cliente" valor={<ValorOuFalta valor={linha?.margem_contribuicao} />} />
        <Destaque titulo="Ponto de equilíbrio" valor={equilibrioPrincipal?.situacao === 'calculado' ? `${formatarNumero(equilibrioPrincipal.clientes as number)} clientes` : equilibrioPrincipal?.situacao === 'sem_equilibrio' ? <span className="text-xs font-medium">Não há equilíbrio com este preço</span> : <ValorOuFalta valor={null} />} />
        <Destaque titulo="Resultado mensal" valor={<ValorOuFalta valor={linha?.resultado_mensal} />} contexto={principal ? `Com ${formatarNumero(principal.volume)} clientes` : undefined} />
        <Destaque titulo="Acréscimo sobre o custo" valor={<ValorOuFalta valor={linha?.markup} formato="percentual" />} contexto="Não é a margem sobre a receita." />
        {anual && premissas.preco_teste !== null && <Destaque titulo="Preço de teste (equiv. mensal)" valor={dinheiro(precoMensal(premissas.preco_teste, 'anual'))} contexto={`${dinheiro(premissas.preco_teste)} ÷ ${mesesDaCobranca('anual')}`} />}
      </div>

      {premissas.canais.length > 0 && premissas.volumes.length > 0 && <TabelaDeResultados premissas={premissas} resultados={resultados} />}

      {premissas.preco_teste !== null && resultados.equilibrio.length > 0 && (
        <section aria-label="Ponto de equilíbrio por canal">
          <h3 className="mb-1.5 text-sm font-semibold">Ponto de equilíbrio por canal</h3>
          <ListaDeEquilibrio premissas={premissas} resultados={resultados} />
        </section>
      )}

      {serie.length > 0 && serie.some((item) => item.pontos.length > 1) && (
        <section aria-label="Gráfico do resultado">
          <h3 className="mb-1.5 text-sm font-semibold">Resultado mensal × clientes{premissas.preco_teste !== null ? `, a ${dinheiro(premissas.preco_teste)}` : ''}</h3>
          <GraficoLinhas rotulo="Resultado mensal por número de clientes, uma linha por canal" series={serie.map((item) => ({ id: item.canal_id, nome: item.nome, pontos: item.pontos }))} formatarY={dinheiroCurto} formatarX={(valor) => formatarNumero(valor)} rotuloX="Clientes" linhaZero continuo marcas={marcas} altura={celular ? 240 : 300} />
        </section>
      )}

      <section aria-label="Comparação do preço de teste" className="grid gap-2 rounded-md bg-mist p-3 text-[13px]">
        <h3 className="text-sm font-semibold">Comparar o preço de teste</h3>
        <div className="flex flex-wrap justify-between gap-x-3">
          <span className="text-ink-soft">Preço de teste</span>
          <span className="font-semibold tabular-nums">{premissas.preco_teste === null ? 'Não informado' : `${dinheiro(premissas.preco_teste)}${anual ? ' por ano' : ''}`}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3">
          <span className="text-ink-soft">Preço vigente{oferta ? ` de ${oferta.nome}` : ''}</span>
          <span className="tabular-nums">{oferta ? textoDoPrecoComPeriodo(vigente) : 'Escolha a oferta'}</span>
        </div>
        {concorrentes.map((concorrente) => (
          <div key={concorrente.id} className="flex flex-wrap items-center justify-between gap-x-3">
            <span className="min-w-0 break-words text-ink-soft">
              {concorrente.link ? (
                <a href={concorrente.link} target="_blank" rel="noreferrer" className="underline">
                  {concorrente.nome}
                </a>
              ) : (
                concorrente.nome
              )}
              {concorrente.data ? ` · ${formatarDiaISO(concorrente.data)}` : ''}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              {concorrente.preco === null ? 'Não informado' : `${formatarDinheiro(concorrente.preco, concorrente.moeda ?? 'BRL')}${concorrente.periodicidade ? ` · ${ROTULOS_PERIODICIDADE_PRECO[concorrente.periodicidade].toLocaleLowerCase('pt-BR')}` : ''}`}
              <Button variante="icone" tamanho="icone" aria-label={`Remover ${concorrente.nome}`} onClick={() => void removerConcorrente(concorrente.id)}>
                <Trash2 aria-hidden />
              </Button>
            </span>
          </div>
        ))}
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold md:min-h-8">Concorrentes de referência</summary>
          <div className="pt-1">
            <FormularioConcorrenteEmbutido produtoId={produto.id} />
          </div>
        </details>
      </section>
    </section>
  );

  return (
    <div className="space-y-4">
      {base && (
        <Faixa tipo="info">
          Recalculando {base.codigo} v{base.versao}: salvar cria a v{base.versao + 1}, e a anterior continua igual.
        </Faixa>
      )}
      {celular && (
        <Pilulas
          rotulo="Mostrar"
          rotuloOculto
          valor={painel}
          aoMudar={(valor) => setPainel(valor as typeof painel)}
          opcoes={[
            { valor: 'premissas', rotulo: 'Premissas' },
            { valor: 'resultados', rotulo: 'Resultados' },
          ]}
        />
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        {painelDePremissas}
        {painelDeResultados}
      </div>
      {celular && painel === 'premissas' && (
        <Button variante="secundario" className="w-full" onClick={() => setPainel('resultados')}>
          Ver resultados
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper p-3 max-md:[&>*]:flex-1 md:justify-end">
        <p className="text-[13px] text-ink-soft md:mr-auto">{salvaAtual ? `Salva como ${salvaAtual.codigo}. Pronta para virar rascunho.` : !ofertaId ? 'Para usar como base de preço, escolha a oferta e salve.' : 'Para usar como base de preço, salve antes.'}</p>
        <Button variante="terciario" onClick={exportarCsv} disabled={!resultados.linhas.length}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
        <Button variante="terciario" onClick={() => abrirParaImprimir(`Simulação de ${produto.nome}`, premissas, resultados)} disabled={!resultados.linhas.length}>
          <FileText aria-hidden />
          PDF interno
        </Button>
        <Button variante="secundario" onClick={() => void usarComoBase()} disabled={!salvaAtual || !ofertaId}>
          <Stamp aria-hidden />
          Usar como base de preço
        </Button>
        <Button onClick={pedirSalvar}>
          <Save aria-hidden />
          Salvar simulação
        </Button>
      </div>
      <JanelaSalvar aberto={salvando} aoFechar={() => setSalvando(false)} sugestao={base?.nome ?? `Simulação de ${produto.nome}`} anterior={base} aoSalvar={salvarAgora} />
    </div>
  );
}

/** T07.06: premissas à esquerda e resultados à direita; no celular, um de cada vez. */
export function TelaSimulador() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const { contexto, contextos } = useCentral();
  const hoje = hojeISO();
  const doContexto = contexto.id !== ID_CONSOLIDADA && contexto.id !== ID_INSTITUCIONAL ? contexto.id : '';
  const produtoId = parametros.get('produto') ?? doContexto;
  const baseId = parametros.get('base');
  const ofertaInicial = parametros.get('oferta') ?? '';
  const consulta = useConsulta(() => carregarSimulador(produtoId || null, baseId, hoje), [produtoId, baseId, hoje]);
  const opcoes = contextos.filter((item) => item.id !== ID_CONSOLIDADA && item.id !== ID_INSTITUCIONAL);
  const dados = consulta.dados;
  const chave = `${produtoId}-${baseId ?? ''}-${ofertaInicial}`;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        comoUsar="/ajuda/produtos/simulador"
        kicker="Produtos"
        titulo="Simulador de preços"
        resumo="Uma simulação não é preço: serve para entender o cenário antes de decidir."
        acoes={
          produtoId ? (
            <LinkCentral href={`/produtos/${produtoId}?aba=simulacoes`} className={variantesBotao({ variante: 'secundario' })}>
              Simulações salvas
            </LinkCentral>
          ) : undefined
        }
      />
      <AbasProdutos ativa="simulador" />
      <Campo id="sim-produto" rotulo="Produto" obrigatorio className="max-w-sm" ajuda="Cada produto tem as próprias simulações.">
        {(controle) => (
          <Selecao {...controle} value={produtoId} onChange={(evento) => roteador.push(evento.target.value ? `/produtos/simulador?produto=${evento.target.value}` : '/produtos/simulador')}>
            <option value="">Escolha o produto</option>
            {opcoes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
            {dados?.produto && !opcoes.some((item) => item.id === dados.produto?.id) && <option value={dados.produto.id}>{dados.produto.nome}</option>}
          </Selecao>
        )}
      </Campo>
      {consulta.estado === 'carregando' ? (
        <EstadoCarregando />
      ) : consulta.estado === 'erro' ? (
        <EstadoErro titulo="Não deu para abrir o simulador." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      ) : !dados?.produto ? (
        <EstadoVazio icone={Stamp} titulo="Escolha o produto." texto="O custo fixo, as ofertas e as simulações salvas são de cada produto." />
      ) : (
        <SimuladorDoProduto key={chave} dados={dados as DadosDoSimulador & { produto: NonNullable<DadosDoSimulador['produto']> }} ofertaInicial={ofertaInicial} hoje={hoje} />
      )}
    </div>
  );
}
