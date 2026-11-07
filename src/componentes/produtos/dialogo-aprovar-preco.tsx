'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { CanalVenda, Oferta, PrecoVersao, Simulacao } from '@/dados/tipos/precificacao';
import { valorParaCampo } from '@/dominio/dinheiro';
import { novaDecisaoVazia, type EntradaDecisao } from '@/dominio/decisoes';
import { aprovarPreco, avaliarPiso, diaAnterior, errosDaAprovacao, lerValorDoCampo, PERIODICIDADES_DE_PRECO, ROTULOS_PERIODICIDADE_PRECO, TODOS_OS_CANAIS, ultimoInicioAprovado, type DadosDaAprovacao } from '@/dominio/precificacao';
import { AVISO_ESTIMATIVA } from '@/dominio/simulador';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { CampoDecisao } from './campo-decisao';
import { useAvisoDeCredencial } from './aviso-credencial-m07';

type Props = { preco: PrecoVersao | null; aoFechar: () => void; oferta: Oferta; precos: readonly PrecoVersao[]; canais: readonly CanalVenda[]; simulacoes: readonly Simulacao[]; nomeDoProduto: string };

const CAMPOS: Readonly<Record<string, string>> = {
  valor: 'aprovar-valor',
  moeda: 'aprovar-moeda',
  valido_de: 'aprovar-inicio',
  simulacao_id: 'aprovar-simulacao',
  justificativa_excecao: 'aprovar-justificativa',
  decisao_decisao_id: 'aprovar-decisao-decisao_id',
  decisao_titulo: 'aprovar-decisao-titulo',
  decisao_descricao: 'aprovar-decisao-descricao',
  decisao_data: 'aprovar-decisao-data',
  decisao_decisores: 'aprovar-decisao-decisores',
  conferi: 'aprovar-conferi',
};

/** T07.09 (P5): tudo o que RN-07.04 pede à vista, a comparação com o piso e o que muda ao aprovar. */
export function DialogoAprovarPreco({ preco, aoFechar, oferta, precos, canais, simulacoes, nomeDoProduto }: Props) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const gratuidade = oferta.tipo === 'gratuidade';
  const [canalId, setCanalId] = useState('');
  const [valorTexto, setValorTexto] = useState('');
  const [moeda, setMoeda] = useState('BRL');
  const [periodicidade, setPeriodicidade] = useState<PrecoVersao['periodicidade']>('mensal');
  const [inicio, setInicio] = useState('');
  const [simulacaoId, setSimulacaoId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [decisao, setDecisao] = useState<EntradaDecisao>(() => novaDecisaoVazia(hoje, [pessoa.id]));
  const [conferi, setConferi] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const credencial = useAvisoDeCredencial();

  useEffect(() => {
    if (!preco) return;
    setCanalId(preco.canal_id ?? '');
    setValorTexto(preco.valor === null ? (gratuidade ? '0,00' : '') : valorParaCampo(preco.valor));
    setMoeda(preco.moeda);
    setPeriodicidade(preco.periodicidade);
    setInicio(preco.valido_de ?? '');
    setSimulacaoId(preco.simulacao_id ?? '');
    setJustificativa('');
    setDecisao(novaDecisaoVazia(hoje, [pessoa.id]));
    setConferi(false);
    setTentou(false);
    credencial.limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- começa do rascunho, a cada vez que abre
  }, [preco?.id]);

  const valorLido = lerValorDoCampo(valorTexto);
  const simulacao = simulacoes.find((item) => item.id === simulacaoId) ?? null;
  const dados: DadosDaAprovacao = { canal_id: canalId || null, valor: valorLido ?? null, moeda, periodicidade, valido_de: inicio || null, simulacao_id: simulacaoId || null, decisao, justificativa_excecao: justificativa };
  const avaliacao = gratuidade ? null : avaliarPiso(dados, simulacao);
  const abaixo = Boolean(avaliacao?.abaixo);
  const erros = useMemo(() => {
    const base: Record<string, string> = { ...errosDaAprovacao(oferta, dados, simulacao, { ultimoInicio: ultimoInicioAprovado([...precos], dados.canal_id, preco?.id) }, hoje) };
    if (valorLido === undefined) base.valor = 'Use um valor como 19,90.';
    if (!conferi) base.conferi = 'Marque que conferiu as premissas e os impactos.';
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os dados são refeitos a cada digitação
  }, [oferta, dados.canal_id, dados.valor, moeda, periodicidade, inicio, simulacaoId, decisao, justificativa, conferi, precos, preco?.id, hoje, valorLido, simulacao]);
  const visiveis: Readonly<Record<string, string>> = tentou ? erros : {};
  const listaDeErros: ErroDeCampo[] = Object.entries(visiveis).map(([campo, mensagem]) => ({ campoId: CAMPOS[campo] ?? 'aprovar-valor', mensagem }));

  const anterior = precos.find((item) => item.id !== preco?.id && item.canal_id === dados.canal_id && item.situacao === 'aprovada');

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando || !preco) return;
    setTentou(true);
    const primeiro = Object.keys(erros)[0];
    if (primeiro) {
      requestAnimationFrame(() => document.getElementById(CAMPOS[primeiro] ?? 'aprovar-valor')?.focus());
      return;
    }
    const nova = decisao.modo === 'registrar' ? decisao : null;
    if (!credencial.conferir([justificativa, nova?.titulo ?? '', nova?.descricao ?? '', nova?.motivo ?? ''])) return;
    setSalvando(true);
    try {
      await aprovarPreco(preco.id, dados, pessoa.id, hoje);
      aviso(inicio > hoje ? `Preço aprovado. A oferta passa a Aprovada em ${formatarDiaISO(inicio)}.` : 'Preço aprovado. A oferta está Aprovada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario larga aberto={preco !== null} aoFechar={aoFechar} titulo="Aprovar versão de preço" descricao={`${nomeDoProduto} · ${oferta.nome} · v${preco?.versao ?? ''} rascunho`} alterado={Boolean(justificativa) || conferi} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar="Aprovar preço" salvando={salvando} erros={listaDeErros}>
      {credencial.faixa}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-4" aria-label="Dados da versão">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Canal" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={canalId} onChange={(evento) => setCanalId(evento.target.value)}>
                  <option value="">{TODOS_OS_CANAIS}</option>
                  {canais
                    .filter((canal) => canal.situacao === 'ativo' || canal.id === canalId)
                    .map((canal) => (
                      <option key={canal.id} value={canal.id}>
                        {canal.nome}
                      </option>
                    ))}
                </Selecao>
              )}
            </Campo>
            <Campo id={CAMPOS.valor} rotulo="Valor" obrigatorio erro={visiveis.valor} ajuda={gratuidade ? 'Gratuidade: R$ 0,00 explícito.' : undefined}>
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={valorTexto} onChange={(evento) => setValorTexto(evento.target.value)} />}
            </Campo>
            <Campo id={CAMPOS.moeda} rotulo="Moeda" obrigatorio erro={visiveis.moeda}>
              {(controle) => <SelecaoMoeda {...controle} value={moeda} onChange={(evento) => setMoeda(evento.target.value)} />}
            </Campo>
            <Campo rotulo="Periodicidade" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={periodicidade} onChange={(evento) => setPeriodicidade(evento.target.value as PrecoVersao['periodicidade'])}>
                  {PERIODICIDADES_DE_PRECO.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {ROTULOS_PERIODICIDADE_PRECO[opcao]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo id={CAMPOS.valido_de} rotulo="Início da validade" obrigatorio erro={visiveis.valido_de}>
              {(controle) => <EntradaData {...controle} value={inicio} onChange={(evento) => setInicio(evento.target.value)} />}
            </Campo>
            <Campo id={CAMPOS.simulacao_id} rotulo="Simulação vinculada" obrigatorio={!gratuidade} erro={visiveis.simulacao_id} ajuda={gratuidade ? 'Gratuidade dispensa a simulação.' : undefined}>
              {(controle) => (
                <Selecao {...controle} value={simulacaoId} onChange={(evento) => setSimulacaoId(evento.target.value)}>
                  <option value="">{gratuidade ? 'Sem simulação' : 'Escolha'}</option>
                  {simulacoes
                    .filter((item) => !item.oferta_id || item.oferta_id === oferta.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codigo} · {item.nome} v{item.versao}
                      </option>
                    ))}
                </Selecao>
              )}
            </Campo>
          </div>
          {simulacao && (
            <div className="rounded-md bg-mist p-3 text-xs leading-5 text-ink-soft">
              <p className="font-semibold text-ink">Premissas salvas em {simulacao.codigo}</p>
              <p>
                {simulacao.premissas.cf === null ? 'CF não informado' : `CF ${formatarDinheiro(simulacao.premissas.cf, 'BRL')}`} · {simulacao.premissas.cv === null ? 'CV não informado' : `CV ${formatarDinheiro(simulacao.premissas.cv, 'BRL')}`} · tributos {simulacao.premissas.tributos_pct ?? '—'}% · margem {simulacao.premissas.margem_pct ?? '—'}% · {simulacao.premissas.canais.map((canal) => `${canal.nome} ${canal.taxa_percentual ?? '—'}%`).join(', ')}
              </p>
              <p className="mt-1">{AVISO_ESTIMATIVA}.</p>
            </div>
          )}
          {abaixo && (
            <Campo id={CAMPOS.justificativa_excecao} rotulo="Justificativa da exceção" obrigatorio erro={visiveis.justificativa_excecao}>
              {(controle) => <Textarea {...controle} value={justificativa} onChange={(evento) => setJustificativa(evento.target.value)} />}
            </Campo>
          )}
        </section>

        <section className="grid content-start gap-4 rounded-md border border-line p-3.5" aria-label="Resumo da aprovação">
          <dl className="grid gap-1.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Preço proposto</dt>
              <dd className="font-semibold tabular-nums">{valorLido === null || valorLido === undefined ? 'Não definido' : formatarDinheiro(valorLido, moeda)}</dd>
            </div>
            {periodicidade === 'anual' && avaliacao?.equivalenteMensal !== null && avaliacao?.equivalenteMensal !== undefined && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Equivalente mensal (÷ 12)</dt>
                <dd className="tabular-nums">{formatarDinheiro(avaliacao.equivalenteMensal, moeda)}</dd>
              </div>
            )}
            {!gratuidade && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Piso{avaliacao?.volume ? ` (${avaliacao.volume} clientes)` : ''}</dt>
                <dd className="font-semibold tabular-nums">{avaliacao?.piso === null || avaliacao?.piso === undefined ? 'Sem simulação' : formatarDinheiro(avaliacao.piso, 'BRL')}</dd>
              </div>
            )}
            {oferta.tipo === 'gratuidade' && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Piso</dt>
                <dd>Não se aplica</dd>
              </div>
            )}
          </dl>
          {avaliacao?.piso !== null && avaliacao?.piso !== undefined && avaliacao.equivalenteMensal !== null && (
            <p className={`flex items-center gap-2 rounded-campo px-3 py-2 text-[13px] font-semibold ${abaixo ? 'bg-err-wash text-err' : 'bg-ok-wash text-ok'}`}>
              {abaixo ? <TriangleAlert aria-hidden className="size-4 shrink-0" /> : <CheckCircle2 aria-hidden className="size-4 shrink-0" />}
              {abaixo ? 'Abaixo do piso: exige justificativa e decisão de exceção.' : 'Acima do piso.'}
            </p>
          )}
          <CampoDecisao valor={decisao} aoMudar={setDecisao} regras={{ produto_id: oferta.produto_id, assunto: abaixo ? 'excecao_preco' : 'preco', exigirAssunto: abaixo }} erros={visiveis} prefixo="aprovar-decisao" pessoaId={pessoa.id} rotulo={abaixo ? 'Decisão de exceção' : 'Decisão'} />
          <div className="text-[13px]">
            <p className="mb-1 texto-rotulo">Aprovado por</p>
            <p>{pessoa.nome}</p>
          </div>
          <div className="text-[13px]">
            <p className="mb-1 texto-rotulo">O que muda</p>
            {anterior ? (
              <p>
                A v{anterior.versao} ({formatarDinheiro(anterior.valor ?? 0, anterior.moeda)}) {inicio ? `termina em ${formatarDiaISO(diaAnterior(inicio))}` : 'termina no dia anterior ao início'} e fica Substituída.
              </p>
            ) : (
              <p>Primeira versão aprovada neste canal.</p>
            )}
            <p className="mt-1">{inicio > hoje ? `A oferta só passa a Aprovada em ${formatarDiaISO(inicio)}.` : 'A oferta fica Aprovada.'}</p>
            <p className="mt-1">Propostas e contratos existentes não mudam.</p>
          </div>
        </section>
      </div>

      <Faixa tipo="info" className="mt-4">
        Nesta etapa local não há login: a aprovação registra quem está em “Você é”, e isso não é uma autorização segura. A recusa no servidor sem permissão (CA-07.05) entra na etapa com servidor.
      </Faixa>
      <label id={CAMPOS.conferi} tabIndex={-1} className="mt-4 flex min-h-11 items-center gap-2.5 text-[13px] font-medium">
        <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={conferi} onChange={(evento) => setConferi(evento.target.checked)} />
        Conferi as premissas e os impactos.
      </label>
      {visiveis.conferi && <p className="text-xs text-err">{visiveis.conferi}</p>}
    </JanelaFormulario>
  );
}
