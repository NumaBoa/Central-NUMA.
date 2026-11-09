'use client';

import { useState } from 'react';
import { ArrowLeftRight, ExternalLink, Plus, Undo2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { DialogoDeTransferencia } from '@/componentes/financeiro/dialogo-transferencia';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { BotaoExportarCsv } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Transferencia } from '@/dados/tipos/transferencia';
import { useConsulta } from '@/dados/use-consulta';
import { carregarSaldos, estornarTransferencia, filtrarTransferencias, FILTROS_TRANSFERENCIAS_INICIAIS, situacaoDaTransferencia, type FiltrosTransferencias } from '@/dominio/saldos';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';

const cotacao = (valor: number) => String(valor).replace('.', ',');

/** T05.06: dinheiro que muda de conta, sem ser receita nem despesa (RN-05.10). */
export function TelaTransferencias() {
  const consulta = useConsulta(carregarSaldos);
  const [filtros, setFiltros] = useState<FiltrosTransferencias>(FILTROS_TRANSFERENCIAS_INICIAIS);
  const [nova, setNova] = useState(false);
  const [estornando, setEstornando] = useState<Transferencia | null>(null);
  const dados = consulta.dados;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Transferências</h1>
        <EstadoErro titulo="Não deu para ler as transferências." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const nomeDaConta = (id: string) => dados.contas.find((conta) => conta.id === id)?.nome ?? 'Conta removida';
  const linhas = filtrarTransferencias(dados.transferencias, filtros, nomeDaConta);
  const mudar = (parcial: Partial<FiltrosTransferencias>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const usadas = dados.contas.filter((conta) => dados.transferencias.some((item) => item.conta_origem_id === conta.id || item.conta_destino_id === conta.id));
  const ativos: FiltroAtivo[] = filtros.conta ? [{ id: 'conta', rotulo: `Conta: ${nomeDaConta(filtros.conta)}` }] : [];
  const comprovante = (item: Transferencia) =>
    item.comprovante_url ? (
      <a href={item.comprovante_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 underline md:min-h-0 [&_svg]:size-[14px]">
        <ExternalLink aria-hidden />
        Abrir
      </a>
    ) : null;

  const situacao = (item: Transferencia) => situacaoDaTransferencia(item, dados.transferencias);
  const etiqueta = (item: Transferencia) => {
    const qual = situacao(item);
    if (qual === 'estornada') return <EtiquetaSituacao tipo="neutro">Estornada</EtiquetaSituacao>;
    if (qual === 'estorno') return <EtiquetaSituacao tipo="info">Estorno</EtiquetaSituacao>;
    return null;
  };
  const botaoDeEstorno = (item: Transferencia) =>
    situacao(item) === 'normal' ? (
      <Button variante="terciario" tamanho="pequeno" aria-label={`Estornar a transferência de ${formatarDiaISO(item.data)}`} onClick={() => setEstornando(item)}>
        <Undo2 aria-hidden />
        Estornar
      </Button>
    ) : null;

  const colunas: readonly Coluna<Transferencia>[] = [
    { id: 'data', titulo: 'Data', essencial: true, ordenar: (a, b) => a.data.localeCompare(b.data), texto: (t) => formatarDiaISO(t.data), celula: (t) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(t.data)}</span> },
    { id: 'origem', titulo: 'Origem', essencial: true, ordenar: (a, b) => nomeDaConta(a.conta_origem_id).localeCompare(nomeDaConta(b.conta_origem_id), 'pt-BR'), texto: (t) => nomeDaConta(t.conta_origem_id), celula: (t) => nomeDaConta(t.conta_origem_id) },
    { id: 'destino', titulo: 'Destino', essencial: true, ordenar: (a, b) => nomeDaConta(a.conta_destino_id).localeCompare(nomeDaConta(b.conta_destino_id), 'pt-BR'), texto: (t) => nomeDaConta(t.conta_destino_id), celula: (t) => nomeDaConta(t.conta_destino_id) },
    { id: 'saiu', titulo: 'Saiu', numerica: true, essencial: true, ordenar: (a, b) => a.valor_origem - b.valor_origem, texto: (t) => formatarDinheiro(t.valor_origem, t.moeda_origem), celula: (t) => <span className="whitespace-nowrap">{formatarDinheiro(t.valor_origem, t.moeda_origem)}</span> },
    { id: 'chegou', titulo: 'Chegou', numerica: true, texto: (t) => formatarDinheiro(t.valor_destino, t.moeda_destino), celula: (t) => <span className="whitespace-nowrap">{formatarDinheiro(t.valor_destino, t.moeda_destino)}</span> },
    { id: 'cambio', titulo: 'Câmbio', numerica: true, texto: (t) => (t.cambio === null ? '' : cotacao(t.cambio)), celula: (t) => (t.cambio === null ? '—' : cotacao(t.cambio)) },
    { id: 'comprovante', titulo: 'Comprovante', texto: (t) => t.comprovante_url ?? '', celula: (t) => comprovante(t) ?? '—' },
    { id: 'observacao', titulo: 'Observação', texto: (t) => t.observacao ?? '', celula: (t) => t.observacao ?? '—' },
    { id: 'situacao', titulo: 'Situação', essencial: true, texto: (t) => ({ normal: '', estornada: 'Estornada', estorno: 'Estorno' })[situacao(t)], celula: (t) => etiqueta(t) ?? '—' },
  ];

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        comoUsar="/ajuda/financeiro/transferencias"
        kicker="Financeiro"
        titulo="Transferências"
        resumo="Dinheiro que muda de conta. Sai de uma, entra na outra, e não conta como receita nem despesa."
        acoes={
          <Button onClick={() => setNova(true)}>
            <Plus aria-hidden />
            Nova transferência
          </Button>
        }
      />
      <AbasFinanceiro ativa="transferencias" />
      <BarraFiltros
        busca={filtros.busca}
        aoBuscar={(busca) => mudar({ busca })}
        rotuloBusca="Buscar por conta ou observação"
        ativos={ativos}
        aoRemoverAtivo={() => mudar({ conta: '' })}
        aoLimpar={() => mudar({ conta: '' })}
        filtrosDetalhados={
          <div className="grid gap-4 px-1 pb-2 md:px-3">
            <Campo rotulo="Conta" id="filtro-conta">
              {(controle) => (
                <Selecao {...controle} value={filtros.conta} onChange={(evento) => mudar({ conta: evento.target.value })}>
                  <option value="">Todas</option>
                  {usadas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
        }
        acoes={<BotaoExportarCsv nomeDoArquivo="transferencias" colunas={colunas} linhas={linhas} />}
      />
      <Lista
        rotulo="Transferências"
        linhas={linhas}
        colunas={colunas}
        chave={(item) => item.id}
        acoesDaLinha={botaoDeEstorno}
        cartaoInterativo
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim())}
        aoLimparFiltros={() => setFiltros(FILTROS_TRANSFERENCIAS_INICIAIS)}
        vazio={<EstadoVazio icone={ArrowLeftRight} titulo="Nenhuma transferência ainda." texto="Registre aqui o dinheiro que passa de uma conta da Numa para outra." acao={<Button onClick={() => setNova(true)}>Nova transferência</Button>} />}
        cartao={(item) => (
          <span className="grid gap-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold tabular-nums">{formatarDiaISO(item.data)}</span>
              <span className="font-semibold tabular-nums">{formatarDinheiro(item.valor_origem, item.moeda_origem)}</span>
            </span>
            <span className="text-[13px] break-words text-ink-soft">
              {nomeDaConta(item.conta_origem_id)} → {nomeDaConta(item.conta_destino_id)}
            </span>
            {item.moeda_origem !== item.moeda_destino && (
              <span className="text-[13px] text-ink-soft tabular-nums">
                Chegou {formatarDinheiro(item.valor_destino, item.moeda_destino)}
                {item.cambio === null ? '' : ` · câmbio ${cotacao(item.cambio)}`}
              </span>
            )}
            {item.observacao && <span className="text-[13px] text-ink-soft">{item.observacao}</span>}
            {comprovante(item) && <span className="text-[13px]">{comprovante(item)}</span>}
            {(etiqueta(item) || botaoDeEstorno(item)) && (
              <span className="mt-1 flex flex-wrap items-center gap-2">
                {etiqueta(item)}
                {botaoDeEstorno(item)}
              </span>
            )}
          </span>
        )}
      />
      {dados.transferencias.length > 0 && <p className="text-xs text-ink-soft">{formatarNumero(linhas.length)} de {formatarNumero(dados.transferencias.length)} transferências.</p>}
      {nova && <DialogoDeTransferencia contas={dados.contas} aoFechar={() => setNova(false)} />}
      <Confirmacao
        aberto={Boolean(estornando)}
        aoFechar={() => setEstornando(null)}
        titulo="Estornar transferência"
        texto={estornando ? `Lança hoje a transferência inversa, de ${nomeDaConta(estornando.conta_destino_id)} para ${nomeDaConta(estornando.conta_origem_id)}, ligada a esta. A original fica como está, marcada como estornada.` : ''}
        rotuloConfirmar="Estornar"
        pedirMotivo
        mensagemSemMotivo="Diga por que está estornando."
        aoConfirmar={(motivo) => {
          const alvo = estornando;
          setEstornando(null);
          if (!alvo) return;
          estornarTransferencia(alvo.id, motivo)
            .then(() => aviso('Transferência estornada.'))
            .catch((erro: unknown) => aviso(mensagemDoErro(erro)));
        }}
      />
    </div>
  );
}
