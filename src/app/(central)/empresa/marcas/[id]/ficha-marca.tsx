'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { BadgeCheck, Check, ExternalLink, FilePlus2, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { SituacaoDoProcesso, VoltarPara } from '@/componentes/empresa/aparencia';
import { JanelaDaPesquisa, JanelaDoPrazo, JanelaDoProcesso } from '@/componentes/empresa/formularios-marca';
import { MenuDeAcoes } from '@/componentes/empresa/menu-de-acoes';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaColorida, EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CartaoDaFicha } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { MarcaPrazo, MarcaProcesso } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { historicoDaMarca } from '@/dominio/historico';
import { AVISO_NOME_PROVISORIO, carregarMarcas, cumprirPrazo, desvincularTituloDoProcesso, marcaPrecisaDeAviso, NOTA_PESQUISA_MANUAL, pesquisasDaMarca, processosDaMarca, reabrirPrazo, removerPesquisa, removerPrazo, removerProcesso, ROTULOS_APRESENTACAO, titulosDoProcesso, vincularTituloAoProcesso, type DadosDasMarcas } from '@/dominio/marcas-inpi';
import { nomeDaPessoa } from '@/dominio/sociedade';
import { ROTULOS_SITUACAO_TITULO } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { ResultadoDaPesquisa } from '../tela-marcas';

async function executar(acao: () => Promise<unknown>, mensagem: string) {
  try {
    await acao();
    aviso(mensagem);
  } catch (erro) {
    aviso(mensagemDoErro(erro));
  }
}

function PrazosDoProcesso({ processo, dados }: { processo: MarcaProcesso; dados: DadosDasMarcas }) {
  const [novo, setNovo] = useState(false);
  const hoje = hojeISO();
  const prazos = dados.prazos.filter((prazo) => prazo.processo_id === processo.id).sort((a, b) => a.data_limite.localeCompare(b.data_limite));
  const linha = (prazo: MarcaPrazo) => (
    <li key={prazo.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0 first:pt-0">
      <span className="min-w-0 text-[13px]">
        <span className="block font-medium break-words">{prazo.descricao}</span>
        <span className="block text-ink-soft">
          {formatarDiaISO(prazo.data_limite)} · {nomeDaPessoa(dados.pessoas, prazo.responsavel_id)}
          {prazo.cumprido_em ? ` · cumprido em ${formatarDiaISO(prazo.cumprido_em)}` : prazo.data_limite < hoje ? ' · atrasado' : ''}
        </span>
      </span>
      <span className="flex items-center gap-1">
        {prazo.cumprido_em ? (
          <Button variante="terciario" tamanho="pequeno" onClick={() => void executar(() => reabrirPrazo(prazo.id), 'Prazo reaberto.')}>
            <RotateCcw aria-hidden />
            Reabrir
          </Button>
        ) : (
          <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => cumprirPrazo(prazo.id, hoje, hoje), 'Prazo cumprido.')}>
            <Check aria-hidden />
            Cumprido
          </Button>
        )}
        <Button variante="icone" tamanho="icone" aria-label={`Tirar o prazo ${prazo.descricao}`} onClick={() => void executar(() => removerPrazo(prazo.id), 'Prazo removido.')}>
          <Trash2 aria-hidden />
        </Button>
      </span>
    </li>
  );
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="texto-rotulo">Prazos</h4>
        <Button variante="terciario" tamanho="pequeno" onClick={() => setNovo(true)}>
          <Plus aria-hidden />
          Novo prazo
        </Button>
      </div>
      {prazos.length ? <ul>{prazos.map(linha)}</ul> : <p className="text-[13px] text-ink-soft">Nenhum prazo cadastrado.</p>}
      {novo && <JanelaDoPrazo dados={dados} processoId={processo.id} aoFechar={() => setNovo(false)} />}
    </div>
  );
}

function CustosDoProcesso({ processo, dados }: { processo: MarcaProcesso; dados: DadosDasMarcas }) {
  const [escolhido, setEscolhido] = useState('');
  const titulos = titulosDoProcesso(processo.id, dados);
  const opcoes = dados.titulos.filter((titulo) => titulo.natureza === 'pagar' && titulo.situacao !== 'cancelado' && !titulos.some((vinculado) => vinculado.id === titulo.id));
  return (
    <div className="grid gap-2">
      <h4 className="texto-rotulo">Custos</h4>
      {titulos.length ? (
        <ul className="grid gap-1">
          {titulos.map((titulo) => (
            <li key={titulo.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <LinkCentral href={`/financeiro/${titulo.id}`} className="inline-flex min-h-11 min-w-0 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
                <ExternalLink aria-hidden />
                <span className="truncate">
                  {titulo.codigo} · {titulo.descricao}
                </span>
              </LinkCentral>
              <span className="flex items-center gap-2 text-ink-soft tabular-nums">
                {formatarDinheiro(titulo.valor, titulo.moeda)} · {ROTULOS_SITUACAO_TITULO[titulo.situacao]}
                <Button variante="icone" tamanho="icone" aria-label={`Desvincular ${titulo.codigo}`} onClick={() => void executar(() => desvincularTituloDoProcesso(processo.id, titulo.id), 'Título desvinculado.')}>
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">Nenhum título vinculado. Os custos ficam nos lançamentos do Financeiro.</p>
      )}
      {opcoes.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Campo id={`titulo-${processo.id}`} rotulo="Vincular lançamento">
            {(controle) => (
              <Selecao {...controle} value={escolhido} onChange={(evento) => setEscolhido(evento.target.value)}>
                <option value="">Escolha</option>
                {opcoes.map((titulo) => (
                  <option key={titulo.id} value={titulo.id}>
                    {titulo.codigo} · {titulo.descricao}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Button
            variante="secundario"
            disabled={!escolhido}
            onClick={() => {
              void executar(() => vincularTituloAoProcesso(processo.id, escolhido), 'Título vinculado.');
              setEscolhido('');
            }}
          >
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}

function CartaoDoProcesso({ processo, dados }: { processo: MarcaProcesso; dados: DadosDasMarcas }) {
  const [editando, setEditando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const titular = dados.entidades.find((entidade) => entidade.id === processo.titular_entidade_id);
  const procurador = dados.contrapartes.find((contraparte) => contraparte.id === processo.procurador_id);
  return (
    <section aria-label={`Processo da classe ${processo.classes}`} className="grid gap-4 rounded-lg border border-line bg-paper p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] leading-6">Classe {processo.classes}</h3>
          <SituacaoDoProcesso situacao={processo.situacao} />
        </div>
        <MenuDeAcoes
          rotulo={`Mais ações do processo da classe ${processo.classes}`}
          acoes={[
            { rotulo: 'Editar processo', icone: Pencil, aoClicar: () => setEditando(true) },
            { rotulo: 'Tirar o processo', icone: Trash2, aoClicar: () => setRemovendo(true), perigo: true },
          ]}
        />
      </div>
      <dl className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold text-ink-soft">Apresentação</dt>
          <dd>{ROTULOS_APRESENTACAO[processo.apresentacao]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-soft">Titular</dt>
          <dd>{titular?.nome ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-soft">Número do processo</dt>
          <dd className="tabular-nums">{processo.numero_processo ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-soft">Data do depósito</dt>
          <dd>{processo.data_deposito ? formatarDiaISO(processo.data_deposito) : 'Não informada'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-soft">Procurador ou escritório</dt>
          <dd>{procurador ? nomeDaContraparte(procurador) : 'Não informado'}</dd>
        </div>
        {processo.observacoes && (
          <div>
            <dt className="text-xs font-semibold text-ink-soft">Observações</dt>
            <dd className="break-words">{processo.observacoes}</dd>
          </div>
        )}
      </dl>
      <PrazosDoProcesso processo={processo} dados={dados} />
      <CustosDoProcesso processo={processo} dados={dados} />
      {editando && <JanelaDoProcesso dados={dados} processo={processo} aoFechar={() => setEditando(false)} />}
      <Confirmacao
        aberto={removendo}
        aoFechar={() => setRemovendo(false)}
        titulo="Tirar este processo?"
        texto="O processo e os prazos dele saem da lista, e o histórico guarda."
        rotuloConfirmar="Tirar processo"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          setRemovendo(false);
          void executar(() => removerProcesso(processo.id, motivo), 'Processo removido.');
        }}
      />
    </section>
  );
}

function HistoricoDaMarca({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaMarca(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T06.05: a marca por dentro. O cadastro continua em T02.04: aqui ficam pesquisas, processos, prazos e custos. */
export function FichaDaMarca() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarMarcas);
  const [pesquisando, setPesquisando] = useState(false);
  const [criandoProcesso, setCriandoProcesso] = useState(false);
  const [removendoPesquisa, setRemovendoPesquisa] = useState<string | null>(null);
  const voltar = <VoltarPara href="/empresa/marcas" rotulo="Marcas e processos" />;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta marca." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const marca = dados.marcas.find((item) => item.id === id);
  if (!marca) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={BadgeCheck} titulo="Essa marca não existe mais." texto="Ela pode ter sido arquivada em Cadastros base." />
      </>
    );
  }
  const pesquisas = pesquisasDaMarca(marca.id, dados.pesquisas);
  const processos = processosDaMarca(marca.id, dados.processos);
  const acoes = (
    <>
      <Button onClick={() => setPesquisando(true)}>
        <Search aria-hidden />
        Registrar pesquisa
      </Button>
      <Button variante="secundario" onClick={() => setCriandoProcesso(true)}>
        <FilePlus2 aria-hidden />
        Novo processo
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      {voltar}
      <Ficha
        tituloDePagina
        titulo={marca.nome}
        etiquetas={
          <>
            <EtiquetaColorida nome={marca.nome} cor={marca.cor_hex} />
            {marca.provisorio && <EtiquetaLivre>Nome provisório</EtiquetaLivre>}
          </>
        }
        acoes={acoes}
        acoesCelular={acoes}
        abas={[
          {
            id: 'pesquisas',
            rotulo: `Pesquisas (${pesquisas.length})`,
            conteudo: (
              <div className="grid gap-3">
                {marcaPrecisaDeAviso(marca, dados.pesquisas) && <Faixa tipo="atencao">{AVISO_NOME_PROVISORIO}.</Faixa>}
                <Faixa tipo="info">{NOTA_PESQUISA_MANUAL}</Faixa>
                {pesquisas.length ? (
                  <ul className="grid gap-2.5">
                    {pesquisas.map((pesquisa) => (
                      <li key={pesquisa.id} className="grid gap-1.5 rounded-lg border border-line bg-paper p-4 text-[13px]">
                        <div className="flex items-start justify-between gap-2">
                          <ResultadoDaPesquisa pesquisa={pesquisa} />
                          <Button variante="icone" tamanho="icone" aria-label={`Tirar a pesquisa de ${formatarDiaISO(pesquisa.data)}`} onClick={() => setRemovendoPesquisa(pesquisa.id)}>
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                        <p className="text-ink-soft">Feita por {nomeDaPessoa(dados.pessoas, pesquisa.feita_por)}</p>
                        {pesquisa.bases && <p>Bases: {pesquisa.bases}</p>}
                        {pesquisa.observacoes && <p className="break-words">{pesquisa.observacoes}</p>}
                        {pesquisa.evidencia_url && (
                          <a href={pesquisa.evidencia_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
                            <ExternalLink aria-hidden />
                            Evidência
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EstadoVazio icone={Search} titulo="Nenhuma pesquisa registrada." texto="Registre a pesquisa de anterioridade antes do pedido." />
                )}
              </div>
            ),
          },
          {
            id: 'processos',
            rotulo: `Processos (${processos.length})`,
            conteudo: processos.length ? (
              <div className="grid gap-3">
                {processos.map((processo) => (
                  <CartaoDoProcesso key={processo.id} processo={processo} dados={dados} />
                ))}
              </div>
            ) : (
              <EstadoVazio icone={FilePlus2} titulo="Nenhum processo cadastrado." texto="Cada classe tem o seu processo, com situação, prazos e custos." />
            ),
          },
          { id: 'historico', rotulo: 'Histórico', conteudo: <HistoricoDaMarca id={marca.id} /> },
        ]}
        lateral={
          <CartaoDaFicha titulo="Cadastro da marca">
            <p className="text-ink-soft">Nome, cor e nome provisório ficam em Cadastros base.</p>
            <LinkCentral href="/configuracoes/cadastros/marcas" className="mt-2 inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
              Abrir Marcas e produtos
            </LinkCentral>
          </CartaoDaFicha>
        }
      />
      {pesquisando && <JanelaDaPesquisa dados={dados} marcaId={marca.id} aoFechar={() => setPesquisando(false)} />}
      {criandoProcesso && <JanelaDoProcesso dados={dados} marcaId={marca.id} aoFechar={() => setCriandoProcesso(false)} />}
      <Confirmacao
        aberto={Boolean(removendoPesquisa)}
        aoFechar={() => setRemovendoPesquisa(null)}
        titulo="Tirar esta pesquisa?"
        texto="Ela sai da lista, e o histórico guarda. Se era a única de um nome provisório, o aviso volta."
        rotuloConfirmar="Tirar pesquisa"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          const alvo = removendoPesquisa as string;
          setRemovendoPesquisa(null);
          void executar(() => removerPesquisa(alvo, motivo), 'Pesquisa removida.');
        }}
      />
    </div>
  );
}
