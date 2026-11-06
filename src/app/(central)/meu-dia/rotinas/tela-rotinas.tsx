'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Ellipsis, Plus, Repeat } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_TIPO_ATIVIDADE } from '@/dominio/atividades';
import { normalizarTexto } from '@/dominio/duplicidade';
import { rotuloDaFase } from '@/dominio/fases';
import { carregarRotinas, encerrarRotina, pausarRotina, quantasOcorrenciasFuturas, retomarRotina, ROTULOS_SITUACAO_ROTINA, type LinhaDaRotina } from '@/dominio/recorrencias';
import { fimPorExtenso, regraPorExtenso } from '@/dominio/repeticao';
import { cn } from '@/lib/utils';
import { formatarDiaISO } from '@/lib/formatacao';
import { FormularioDeRotina } from './formulario-rotina';

const CAMINHO = '/meu-dia/rotinas';
const NOVA = 'nova';
const TIPOS_DA_SITUACAO: Readonly<Record<LinhaDaRotina['situacao'], TipoSituacao>> = { ativa: 'sucesso', pausada: 'atencao', encerrada: 'neutro' };

function SituacaoDaRotina({ rotina }: { rotina: LinhaDaRotina }) {
  if (rotina.aguardaFase && rotina.situacao === 'ativa') return <EtiquetaSituacao tipo="neutro">Começa na {rotuloDaFase(rotina.aguardaFase)}</EtiquetaSituacao>;
  return <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[rotina.situacao]}>{ROTULOS_SITUACAO_ROTINA[rotina.situacao]}</EtiquetaSituacao>;
}

const regraCompleta = (rotina: LinhaDaRotina) => {
  const fim = fimPorExtenso(rotina);
  return fim ? `${regraPorExtenso(rotina)}, ${fim}` : regraPorExtenso(rotina);
};

const textoDaProxima = (rotina: LinhaDaRotina) => (rotina.proxima ? formatarDiaISO(rotina.proxima) : '—');

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
          <div className="mt-3 text-sm leading-[1.6] text-ink-soft">Ela não gera mais ocorrências. As passadas continuam como estão.</div>
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

function MenuDaRotina({ rotina, aoEditar, aoEncerrar }: { rotina: LinhaDaRotina; aoEditar: () => void; aoEncerrar: () => void }) {
  const mudarSituacao = (acao: () => Promise<void>, mensagem: string) => acao().then(() => aviso(mensagem), (erro: unknown) => aviso(mensagemDoErro(erro)));
  const linha = (rotulo: string, aoClicar: () => void, fechar: () => void) => (
    <button
      type="button"
      className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')}
      onClick={() => {
        fechar();
        aoClicar();
      }}
    >
      {rotulo}
    </button>
  );
  if (rotina.situacao === 'encerrada') return null;
  return (
    <MenuSobreposto
      titulo="Ações"
      largura={220}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={`Ações de ${rotina.titulo}`}>
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <div className="grid gap-0.5">
          {linha('Editar', aoEditar, fechar)}
          {rotina.situacao === 'ativa' ? linha('Pausar', () => void mudarSituacao(() => pausarRotina(rotina.id), 'Rotina pausada. Ela não gera novas ocorrências.'), fechar) : linha('Retomar', () => void mudarSituacao(() => retomarRotina(rotina.id), 'Rotina retomada.'), fechar)}
          {linha('Encerrar', aoEncerrar, fechar)}
        </div>
      )}
    </MenuSobreposto>
  );
}

type FiltroDeSituacao = '' | LinhaDaRotina['situacao'] | 'todas';
const ROTULOS_FILTRO: Readonly<Record<Exclude<FiltroDeSituacao, ''>, string>> = { ativa: 'Ativas', pausada: 'Pausadas', encerrada: 'Encerradas', todas: 'Todas' };

/** T03.05: as regras de recorrência, com a regra legível, a próxima ocorrência e o que está aberto. */
export function TelaRotinas() {
  const consulta = useConsulta(carregarRotinas);
  const dados = consulta.dados;
  const emEdicao = useSearchParams().get('rotina');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<FiltroDeSituacao>('');
  const [encerrando, setEncerrando] = useState<LinhaDaRotina | null>(null);

  const abrir = useCallback((id: string) => window.history.pushState(null, '', `${CAMINHO}?rotina=${id}`), []);
  const fechar = useCallback(() => window.history.pushState(null, '', CAMINHO), []);

  const nomeDaPessoa = useCallback((id: string) => dados?.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida', [dados]);
  const linhas = useMemo(() => {
    const texto = normalizarTexto(busca);
    return (dados?.rotinas ?? [])
      .filter((rotina) => (situacao === 'todas' ? true : situacao ? rotina.situacao === situacao : rotina.situacao !== 'encerrada'))
      .filter((rotina) => !texto || normalizarTexto(`${rotina.titulo} ${nomeDaPessoa(rotina.responsavel_id)} ${regraPorExtenso(rotina)}`).includes(texto))
      .sort((a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [dados, busca, situacao, nomeDaPessoa]);

  const colunas = useMemo<readonly Coluna<LinhaDaRotina>[]>(
    () => [
      {
        id: 'titulo',
        titulo: 'Rotina',
        essencial: true,
        ordenar: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
        celula: (rotina) => (
          <span className="grid min-w-44 gap-0.5">
            <span className="font-medium break-words">{rotina.titulo}</span>
            <span className="text-xs text-ink-soft">{ROTULOS_TIPO_ATIVIDADE[rotina.modelo.tipo]}</span>
          </span>
        ),
      },
      { id: 'responsavel', titulo: 'Responsável', celula: (rotina) => <NomeDaPessoa nome={nomeDaPessoa(rotina.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
      { id: 'regra', titulo: 'Regra', essencial: true, celula: (rotina) => <span className="block max-w-64 break-words">{regraCompleta(rotina)}</span> },
      { id: 'proxima', titulo: 'Próxima', essencial: true, ordenar: (a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999'), celula: (rotina) => <span className="whitespace-nowrap tabular-nums">{textoDaProxima(rotina)}</span> },
      { id: 'abertas', titulo: 'Abertas', numerica: true, ordenar: (a, b) => a.abertas - b.abertas, celula: (rotina) => rotina.abertas },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (rotina) => <SituacaoDaRotina rotina={rotina} /> },
    ],
    [nomeDaPessoa],
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

  const abrirLinha = (rotina: LinhaDaRotina) => (rotina.situacao === 'encerrada' ? aviso('Esta rotina está encerrada.') : abrir(rotina.id));
  const rotinaEmEdicao = emEdicao && emEdicao !== NOVA ? (dados.rotinas.find((rotina) => rotina.id === emEdicao) ?? null) : null;
  const formularioAberto = emEdicao === NOVA || Boolean(rotinaEmEdicao && rotinaEmEdicao.situacao !== 'encerrada');
  const ativos: FiltroAtivo[] = situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_FILTRO[situacao]}` }] : [];
  const limpar = () => {
    setBusca('');
    setSituacao('');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <LinkCentral href="/meu-dia" className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
            <ArrowLeft aria-hidden />
            Meu dia
          </LinkCentral>
          <h1>Rotinas</h1>
          <p className="mt-1 text-sm text-ink-soft">O que se repete: cada ocorrência vira uma atividade no Meu dia, até 30 dias à frente.</p>
        </div>
        <Button onClick={() => abrir(NOVA)}>
          <Plus aria-hidden />
          Nova rotina
        </Button>
      </header>

      <BarraFiltros
        busca={busca}
        aoBuscar={setBusca}
        rotuloBusca="Buscar por título, responsável ou regra"
        ativos={ativos}
        aoRemoverAtivo={() => setSituacao('')}
        aoLimpar={limpar}
        filtrosDetalhados={
          <div className="grid gap-4 px-1 pb-2 md:px-3">
            <Campo rotulo="Situação" id="filtro-situacao-rotina">
              {(controle) => (
                <Selecao {...controle} value={situacao} onChange={(evento) => setSituacao(evento.target.value as FiltroDeSituacao)}>
                  <option value="">Em uso</option>
                  {Object.entries(ROTULOS_FILTRO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
        }
      />

      <Lista
        rotulo="Rotinas"
        linhas={linhas}
        colunas={colunas}
        chave={(rotina) => rotina.id}
        aoAbrir={abrirLinha}
        cartaoInterativo
        acoesDaLinha={(rotina) => <MenuDaRotina rotina={rotina} aoEditar={() => abrir(rotina.id)} aoEncerrar={() => setEncerrando(rotina)} />}
        filtrando={ativos.length > 0 || Boolean(busca.trim())}
        aoLimparFiltros={limpar}
        vazio={<EstadoVazio icone={Repeat} titulo="Nenhuma rotina por aqui." texto="O que se repete fica aqui: backup, fechamento, revisões." />}
        cartao={(rotina) => (
          <div className="relative grid gap-1.5">
            <div className="absolute -top-2 -right-2">
              <MenuDaRotina rotina={rotina} aoEditar={() => abrir(rotina.id)} aoEncerrar={() => setEncerrando(rotina)} />
            </div>
            <button type="button" onClick={() => abrirLinha(rotina)} className="flex min-h-11 w-full items-center pr-9 text-left font-semibold break-words underline-offset-2 hover:underline">
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
      <FormularioDeRotina aberto={formularioAberto} aoFechar={fechar} rotina={rotinaEmEdicao} dados={dados} />
      {encerrando && <DialogoDeEncerrar rotina={encerrando} aoFechar={() => setEncerrando(null)} />}
    </div>
  );
}
