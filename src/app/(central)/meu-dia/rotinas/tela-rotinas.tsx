'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Archive, ArrowLeft, CalendarClock, Ellipsis, Info, Mail, Pause, Plus, Repeat, RefreshCw } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { CartoesDeResumo } from '@/componentes/padroes/cartoes-resumo';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Atividade } from '@/dados/tipos/atividade';
import { useConsulta } from '@/dados/use-consulta';
import { contextosDaAtividade, MINHAS, ROTULOS_PRIORIDADE_ATIVIDADE, ROTULOS_TIPO_ATIVIDADE } from '@/dominio/atividades';
import { rotuloDaFase } from '@/dominio/fases';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import {
  carregarRotinas,
  encerrarRotina,
  FILTROS_ROTINAS_INICIAIS,
  pausarRotina,
  quantasOcorrenciasFuturas,
  resumoDasRotinas,
  retomarRotina,
  rotinasVisiveis,
  ROTULOS_PERIODO_ROTINA,
  ROTULOS_SITUACAO_ROTINA,
  type FiltrosRotinas,
  type LinhaDaRotina,
  type PeriodoDaRotina,
} from '@/dominio/recorrencias';
import { fimPorExtenso, regraPorExtenso } from '@/dominio/repeticao';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { seletorDePeriodo, seletorDePessoa, textoDoPeriodo } from '../filtros-meu-dia';
import { FormularioDeRotina } from './formulario-rotina';

const CAMINHO = '/meu-dia/rotinas';
const NOVA = 'nova';
const TIPOS_DA_SITUACAO: Readonly<Record<LinhaDaRotina['situacao'], TipoSituacao>> = { ativa: 'sucesso', pausada: 'atencao', encerrada: 'neutro' };
const ICONES_DA_SITUACAO = { ativa: undefined, pausada: Pause, encerrada: Archive };

function SituacaoDaRotina({ rotina }: { rotina: LinhaDaRotina }) {
  if (rotina.aguardaFase && rotina.situacao === 'ativa') return <EtiquetaSituacao tipo="neutro">Começa na {rotuloDaFase(rotina.aguardaFase)}</EtiquetaSituacao>;
  return (
    <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[rotina.situacao]} icone={ICONES_DA_SITUACAO[rotina.situacao]}>
      {ROTULOS_SITUACAO_ROTINA[rotina.situacao]}
    </EtiquetaSituacao>
  );
}

const regraCompleta = (rotina: LinhaDaRotina) => {
  const fim = fimPorExtenso(rotina);
  return fim ? `${regraPorExtenso(rotina)}, ${fim}` : regraPorExtenso(rotina);
};

const textoDaProxima = (rotina: LinhaDaRotina) => (rotina.proxima ? `${formatarDiaISO(rotina.proxima)}${rotina.hora ? ` · ${rotina.hora}` : ''}` : '—');

/** RN-03.18: pergunta se cancela as ocorrências futuras abertas, com motivo. */
function DialogoDeEncerrar({ rotina, aoFechar }: { rotina: LinhaDaRotina; aoFechar: () => void }) {
  const consulta = useConsulta(() => quantasOcorrenciasFuturas(rotina.id), [rotina.id]);
  const quantas = consulta.dados ?? 0;
  const [escolha, setEscolha] = useState('manter');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const cancelar = quantas > 0 && escolha === 'cancelar';

  async function confirmar() {
    try {
      const canceladas = await encerrarRotina(rotina.id, { cancelarFuturas: cancelar, motivo });
      aviso(canceladas ? `Rotina encerrada e ${canceladas === 1 ? '1 ocorrência cancelada' : `${canceladas} ocorrências canceladas`}.` : 'Rotina encerrada.');
      aoFechar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Encerrar {rotina.titulo}?</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-3 text-sm leading-[1.6] text-ink-soft">Ela não gera mais ocorrências, e não volta. As passadas continuam como estão. Para só dar uma pausa, use Pausar.</div>
        </DialogDescription>
        {quantas > 0 && (
          <div className="mt-4 grid gap-4">
            <Pilulas
              rotulo={quantas === 1 ? 'Há 1 ocorrência futura aberta' : `Há ${quantas} ocorrências futuras abertas`}
              valor={escolha}
              aoMudar={setEscolha}
              opcoes={[
                { valor: 'manter', rotulo: 'Manter' },
                { valor: 'cancelar', rotulo: 'Cancelar' },
              ]}
            />
            {cancelar && (
              <Campo id="rotina-motivo" rotulo="Motivo" obrigatorio erro={erro ?? undefined}>
                {(controle) => <Textarea {...controle} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
              </Campo>
            )}
          </div>
        )}
        {erro && !cancelar && <MensagemErro>{erro}</MensagemErro>}
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button variante="perigo" onClick={() => void confirmar()}>
            Encerrar rotina
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LinhaDoMenu = ({ rotulo, dica, aoClicar, fechar }: { rotulo: string; dica?: string; aoClicar: () => void; fechar: () => void }) => (
  <button
    type="button"
    className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')}
    onClick={() => {
      fechar();
      aoClicar();
    }}
  >
    <span className="min-w-0">
      {rotulo}
      {dica && <span className="block text-xs text-ink-soft">{dica}</span>}
    </span>
  </button>
);

/** Pausar e retomar se desfazem: sem confirmação, com "Desfazer". Encerrar não volta: pergunta antes (RN-03.18). */
function MenuDaRotina({ rotina, aoEditar, aoEncerrar }: { rotina: LinhaDaRotina; aoEditar: () => void; aoEncerrar: () => void }) {
  const encerrada = rotina.situacao === 'encerrada';
  const trocar = (acao: () => Promise<void>, desfazer: () => Promise<void>, mensagem: string) =>
    void acao().then(
      () => aviso(mensagem, { acao: { rotulo: 'Desfazer', aoClicar: () => void desfazer().catch((erro: unknown) => aviso(mensagemDoErro(erro))) } }),
      (erro: unknown) => aviso(mensagemDoErro(erro)),
    );
  return (
    <MenuSobreposto
      titulo="Ações"
      largura={270}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={`Ações de ${rotina.titulo}`}>
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <div className="grid gap-0.5">
          <LinhaDoMenu rotulo={encerrada ? 'Abrir rotina' : 'Editar rotina'} fechar={fechar} aoClicar={aoEditar} />
          {rotina.situacao === 'ativa' && <LinhaDoMenu rotulo="Pausar" dica="Não gera novas. As criadas continuam no Meu dia." fechar={fechar} aoClicar={() => trocar(() => pausarRotina(rotina.id), () => retomarRotina(rotina.id), 'Rotina pausada. Ela não gera novas ocorrências.')} />}
          {rotina.situacao === 'pausada' && <LinhaDoMenu rotulo="Retomar" dica="Volta a gerar as próximas ocorrências." fechar={fechar} aoClicar={() => trocar(() => retomarRotina(rotina.id), () => pausarRotina(rotina.id), 'Rotina retomada.')} />}
          {!encerrada && <LinhaDoMenu rotulo="Encerrar…" dica="Não volta. Você escolhe o que fazer com as futuras." fechar={fechar} aoClicar={aoEncerrar} />}
        </div>
      )}
    </MenuSobreposto>
  );
}

const SELETOR_DE_PERIODO = seletorDePeriodo<FiltrosRotinas>({
  id: 'filtro-proxima',
  rotulo: 'Próxima ocorrência',
  icone: CalendarClock,
  largura: 196,
  rotulos: ROTULOS_PERIODO_ROTINA,
  ler: ({ periodo, proximaDe, proximaAte }) => ({ periodo, de: proximaDe, ate: proximaAte }),
  gravar: ({ periodo, de, ate }) => ({ periodo: periodo as PeriodoDaRotina, proximaDe: de, proximaAte: ate }),
});

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const TIPOS_DE_ROTINA = paraOpcoes({ tarefa: ROTULOS_TIPO_ATIVIDADE.tarefa, demanda: ROTULOS_TIPO_ATIVIDADE.demanda, lembrete: ROTULOS_TIPO_ATIVIDADE.lembrete });

/** T03.05: as regras de recorrência, com a regra legível, a próxima ocorrência e o que está aberto. */
export function TelaRotinas() {
  const { pessoa, contexto } = useCentral();
  const consulta = useConsulta(carregarRotinas);
  const dados = consulta.dados;
  const emEdicao = useSearchParams().get('rotina');
  const [filtros, setFiltros] = useState<FiltrosRotinas>(FILTROS_ROTINAS_INICIAIS);
  const [encerrando, setEncerrando] = useState<LinhaDaRotina | null>(null);

  const abrir = useCallback((id: string) => window.history.pushState(null, '', `${CAMINHO}?rotina=${id}`), []);
  const fechar = useCallback(() => window.history.pushState(null, '', CAMINHO), []);

  const nomeDaPessoa = useCallback((id: string) => dados?.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida', [dados]);
  const opcoes = useMemo(() => ({ hoje: hojeISO(), pessoaAtualId: pessoa.id, contextoGlobalId: contexto.id, nomeDaPessoa }), [pessoa.id, contexto.id, nomeDaPessoa]);
  const linhas = useMemo(() => rotinasVisiveis(dados?.rotinas ?? [], filtros, opcoes), [dados, filtros, opcoes]);
  const resumo = useMemo(() => resumoDasRotinas(dados?.rotinas ?? [], filtros, opcoes), [dados, filtros, opcoes]);
  const mudar = (parcial: Partial<FiltrosRotinas>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));

  const colunas = useMemo<readonly Coluna<LinhaDaRotina>[]>(
    () => [
      {
        id: 'titulo',
        titulo: 'Rotina',
        essencial: true,
        ordenar: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
        celula: (rotina) => (
          <span className="grid min-w-44 gap-1">
            <span className="text-[13px] font-semibold break-words">{rotina.titulo}</span>
            <span className="flex flex-wrap gap-1">
              {dados &&
                contextosDaAtividade({ produtos: rotina.modelo.produtos }, dados).map((item) => (
                  <EtiquetaContexto key={item.id} contexto={item} />
                ))}
            </span>
            <span className="text-xs text-ink-soft @min-[900px]:hidden">{regraCompleta(rotina)}</span>
          </span>
        ),
      },
      { id: 'responsavel', titulo: 'Responsável', essencial: true, classe: 'hidden @min-[1040px]:table-cell', celula: (rotina) => <NomeDaPessoa nome={nomeDaPessoa(rotina.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
      { id: 'regra', titulo: 'Repetição', essencial: true, classe: 'hidden @min-[900px]:table-cell', celula: (rotina) => <span className="block max-w-56 break-words">{regraCompleta(rotina)}</span> },
      { id: 'proxima', titulo: 'Próxima ocorrência', essencial: true, ordenar: (a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999'), celula: (rotina) => <span className="whitespace-nowrap tabular-nums">{textoDaProxima(rotina)}</span> },
      { id: 'abertas', titulo: 'Ocorrências abertas', essencial: true, numerica: true, classe: 'hidden @min-[900px]:table-cell', ordenar: (a, b) => a.abertas - b.abertas, celula: (rotina) => rotina.abertas },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (rotina) => <SituacaoDaRotina rotina={rotina} /> },
    ],
    [nomeDaPessoa, dados],
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Rotinas</h1>
        <EstadoErro titulo="Não deu para ler as rotinas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const rotinaEmEdicao = emEdicao && emEdicao !== NOVA ? (dados.rotinas.find((rotina) => rotina.id === emEdicao) ?? null) : null;
  const formularioAberto = emEdicao === NOVA || Boolean(rotinaEmEdicao);
  const pessoas = pessoasDoSeletor(dados.pessoas);
  const areas = dados.areas.filter((area) => !area.arquivado_em);
  const periodo = textoDoPeriodo({ periodo: filtros.periodo, de: filtros.proximaDe, ate: filtros.proximaAte }, ROTULOS_PERIODO_ROTINA);
  const nomeNoFiltro = filtros.pessoa === MINHAS ? 'Minhas' : nomeDaPessoa(filtros.pessoa);
  const ativos: FiltroAtivo[] = [
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: { ativa: 'Ativas', pausada: 'Pausadas', encerrada: 'Encerradas' }[filtros.situacao] }] : []),
    ...(filtros.pessoa ? [{ id: 'pessoa', rotulo: `Pessoa: ${nomeNoFiltro}${filtros.soResponsavel ? ' (só responsável)' : ''}` }] : []),
    ...(filtros.periodo ? [{ id: 'periodo', rotulo: `Próxima: ${periodo}` }] : []),
    ...(filtros.area ? [{ id: 'area', rotulo: `Área: ${dados.areas.find((area) => area.id === filtros.area)?.nome ?? ''}` }] : []),
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ATIVIDADE[filtros.tipo as Atividade['tipo']]}` }] : []),
    ...filtros.prioridades.map((prioridade) => ({ id: `prioridade:${prioridade}`, rotulo: `Prioridade: ${ROTULOS_PRIORIDADE_ATIVIDADE[prioridade as Atividade['prioridade']]}` })),
  ];

  function remover(id: string) {
    if (id.startsWith('prioridade:')) return mudar({ prioridades: filtros.prioridades.filter((item) => `prioridade:${item}` !== id) });
    if (id === 'pessoa') return mudar({ pessoa: '', soResponsavel: false });
    if (id === 'periodo') return mudar({ periodo: '', proximaDe: '', proximaAte: '' });
    mudar({ [id]: '' });
  }

  const limpar = () => setFiltros(FILTROS_ROTINAS_INICIAIS);
  const totalAbertas = linhas.reduce((soma, rotina) => soma + rotina.abertas, 0);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        migalhas={['Meu dia', 'Rotinas']}
        kicker="Meu dia"
        titulo="Rotinas e recorrências"
        resumo="O que se repete fica organizado por aqui: cada ocorrência vira uma atividade no Meu dia, até 30 dias à frente."
        acoes={
          <>
            <Button asChild variante="secundario">
              <LinkCentral href="/meu-dia">
                <ArrowLeft aria-hidden />
                Voltar ao Meu dia
              </LinkCentral>
            </Button>
            <Button onClick={() => abrir(NOVA)}>
              <Plus aria-hidden />
              Nova rotina
            </Button>
          </>
        }
      />

      <CartoesDeResumo
        rotulo="Resumo das rotinas"
        className="md:grid-cols-3"
        cartoes={[
          { id: 'ativa', rotulo: 'Ativas', valor: resumo.ativa, icone: RefreshCw, tom: 'sucesso' },
          { id: 'pausada', rotulo: 'Pausadas', valor: resumo.pausada, icone: Pause, tom: 'atencao' },
          { id: 'encerrada', rotulo: 'Encerradas', valor: resumo.encerrada, icone: Archive },
        ]}
        ativo={(id) => filtros.situacao === id}
        aoEscolher={(id) => mudar({ situacao: filtros.situacao === id ? '' : id })}
      />

      <FiltrosEmLinha
        filtros={filtros}
        aoMudar={mudar}
        aoLimpar={limpar}
        rotuloBusca="Buscar por título, responsável ou regra"
        seletores={[seletorDePessoa<FiltrosRotinas>(pessoas), SELETOR_DE_PERIODO]}
        avancados={(valor, mudarValor) => (
          <>
            <Campo rotulo="Área" id="filtro-area">
              {(controle) => (
                <Selecao {...controle} value={valor.area} onChange={(evento) => mudarValor({ area: evento.target.value })}>
                  <option value="">Todas</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Tipo" id="filtro-tipo">
              {(controle) => (
                <Selecao {...controle} value={valor.tipo} onChange={(evento) => mudarValor({ tipo: evento.target.value })}>
                  <option value="">Todos</option>
                  {TIPOS_DE_ROTINA.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <PilulasMultiplas rotulo="Prioridade" valores={valor.prioridades} aoMudar={(prioridades) => mudarValor({ prioridades })} opcoes={paraOpcoes(ROTULOS_PRIORIDADE_ATIVIDADE)} />
          </>
        )}
        quantosAvancados={(valor) => [valor.area, valor.tipo].filter(Boolean).length + valor.prioridades.length}
        ativos={ativos}
        aoRemoverAtivo={remover}
      />

      <Lista
        rotulo="Rotinas"
        linhas={linhas}
        colunas={colunas}
        chave={(rotina) => rotina.id}
        aoAbrir={(rotina) => abrir(rotina.id)}
        cartaoInterativo
        compacta
        acoesDaLinha={(rotina) => (
          <span className="inline-flex items-center justify-end gap-1">
            <Button variante="secundario" tamanho="pequeno" onClick={() => abrir(rotina.id)}>
              {rotina.situacao === 'encerrada' ? 'Abrir' : 'Editar'}
            </Button>
            <MenuDaRotina rotina={rotina} aoEditar={() => abrir(rotina.id)} aoEncerrar={() => setEncerrando(rotina)} />
          </span>
        )}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim())}
        aoLimparFiltros={limpar}
        rodape={
          <span className="font-normal text-ink-soft tabular-nums">
            {linhas.length === 1 ? '1 rotina' : `${linhas.length} rotinas`} · {totalAbertas === 1 ? '1 ocorrência aberta' : `${totalAbertas} ocorrências abertas`}
          </span>
        }
        vazio={<EstadoVazio icone={Repeat} titulo="Nenhuma rotina por aqui." texto="O que se repete fica aqui: backup, fechamento, revisões." />}
        cartao={(rotina) => (
          <div className="relative grid gap-1.5">
            <div className="absolute -top-2 -right-2">
              <MenuDaRotina rotina={rotina} aoEditar={() => abrir(rotina.id)} aoEncerrar={() => setEncerrando(rotina)} />
            </div>
            <button type="button" onClick={() => abrir(rotina.id)} className="flex min-h-11 w-full items-center pr-9 text-left font-semibold break-words underline-offset-2 hover:underline">
              {rotina.titulo}
            </button>
            <span className="text-[13px] break-words">{regraCompleta(rotina)}</span>
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              <SituacaoDaRotina rotina={rotina} />
              {rotina.proxima && <span>Próxima: {textoDaProxima(rotina)}</span>}
              <span>{rotina.abertas === 1 ? '1 aberta' : `${rotina.abertas} abertas`}</span>
            </span>
            <span className="text-[13px] text-ink-soft">{nomeDaPessoa(rotina.responsavel_id)}</span>
          </div>
        )}
      />

      <div className="grid gap-2 rounded-lg bg-mist px-4 py-3 text-[13px] leading-[20px] text-ink-soft md:flex md:items-center md:justify-between md:gap-3 md:px-5">
        <p className="flex min-w-0 items-start gap-2.5 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
          <Info aria-hidden />
          <span>
            Pausar interrompe novas ocorrências: as atividades já criadas continuam no Meu dia.
            <br className="max-md:hidden" /> Ao encerrar, você escolhe o que fazer com as ocorrências futuras em aberto.
          </span>
        </p>
        <Button asChild variante="terciario" tamanho="pequeno" className="justify-self-start md:shrink-0">
          <LinkCentral href="/meu-dia/resumo-diario">
            <Mail aria-hidden />
            Prévia do resumo diário
          </LinkCentral>
        </Button>
      </div>

      <FormularioDeRotina aberto={formularioAberto} aoFechar={fechar} rotina={rotinaEmEdicao} dados={dados} />
      {encerrando && <DialogoDeEncerrar rotina={encerrando} aoFechar={() => setEncerrando(null)} />}
    </div>
  );
}
