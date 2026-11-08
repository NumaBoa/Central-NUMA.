'use client';

/** T05.08 Orçamento por contexto (F0b, RN-05.17): contexto × mês, orçado editável, realizado rateado e % consumido. */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pencil } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { alertasDoMes, ALERTA_ATENCAO, carregarOrcamento, copiarDoMesAnterior, salvarOrcamentoDoContexto, textoDoOrcado, type CelulaDoOrcamento, type LinhaDoOrcamento } from '@/dominio/orcamento';
import { rotuloDoMes } from '@/dominio/lancamentos';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (competencia: string) => MES_CURTO[Number(competencia.slice(5, 7)) - 1]!;

const COR: Record<CelulaDoOrcamento['nivel'], string> = { sem_orcamento: 'bg-oat', ok: 'bg-ok', atencao: 'bg-warn', estourado: 'bg-err' };
const TEXTO_NIVEL: Record<CelulaDoOrcamento['nivel'], string> = { sem_orcamento: 'Sem orçamento', ok: 'Dentro', atencao: 'Atenção', estourado: 'Estourado' };

/** Texto + cor (RT: a cor nunca é a única informação). */
function Consumo({ celula, compacta = false }: { celula: CelulaDoOrcamento; compacta?: boolean }) {
  // Mês que ainda não chegou e sem despesa: nada realizado ainda, em vez de um R$ 0,00 que parece fechado.
  const futuro = celula.competencia.slice(0, 7) > hojeISO().slice(0, 7) && celula.realizado === 0;
  const realizado = futuro ? '—' : celula.realizado === null ? 'Falta câmbio' : formatarDinheiro(celula.realizado, 'BRL');
  const largura = celula.percentual === null ? (celula.nivel === 'estourado' ? 100 : 0) : Math.min(celula.percentual, 100);
  return (
    <div className="grid gap-1" data-nivel={celula.nivel} data-realizado={celula.realizado ?? ''}>
      <span className={cn('tabular-nums', compacta ? 'text-xs' : 'text-sm')}>
        {realizado}
        {celula.estimado && celula.realizado !== null ? ' (estimado)' : ''}
      </span>
      <span className="text-xs text-ink-soft tabular-nums">{celula.orcado === null ? 'Sem orçamento' : `de ${formatarDinheiro(celula.orcado, 'BRL')}`}</span>
      {celula.orcado !== null && (
        <>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-mist" aria-hidden>
            <span className={cn('block h-full rounded-full', COR[celula.nivel])} style={{ width: `${largura}%` }} />
          </span>
          <span className={cn('text-xs font-semibold', celula.nivel === 'estourado' ? 'text-err' : celula.nivel === 'atencao' ? 'text-warn' : 'text-ink-soft')}>
            {celula.percentual === null ? TEXTO_NIVEL[celula.nivel] : `${celula.percentual.toLocaleString('pt-BR')}% · ${TEXTO_NIVEL[celula.nivel]}`}
          </span>
        </>
      )}
    </div>
  );
}

function JanelaDoContexto({ linha, meses, aoFechar, aoSalvar }: { linha: LinhaDoOrcamento | null; meses: string[]; aoFechar: () => void; aoSalvar: () => void }) {
  const inicial = () => Object.fromEntries((linha?.celulas ?? []).map((celula) => [celula.competencia, textoDoOrcado(celula.orcado)]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [salvando, setSalvando] = useState(false);
  const alterado = linha !== null && JSON.stringify(valores) !== JSON.stringify(inicial());
  return (
    <JanelaFormulario
      colunas={2}
      aberto={linha !== null}
      aoFechar={aoFechar}
      titulo={`Orçamento de ${linha?.nome ?? ''}`}
      descricao="Limite mensal em reais. Vazio fica “Sem orçamento”, que é diferente de R$ 0,00."
      alterado={alterado}
      rotuloSalvar="Salvar orçamento"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        if (!linha) return;
        setSalvando(true);
        void salvarOrcamentoDoContexto(linha.produtoId, valores)
          .then((mudancas) => {
            aviso(mudancas ? 'Orçamento salvo.' : 'Nada mudou no orçamento.');
            aoSalvar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
        {meses.map((competencia) => (
          <Campo key={competencia} id={`orcamento-${competencia}`} rotulo={rotuloDoMes(competencia.slice(0, 7))}>
            {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="Sem orçamento" value={valores[competencia] ?? ''} onChange={(evento) => setValores((atual) => ({ ...atual, [competencia]: evento.target.value }))} />}
          </Campo>
        ))}
      </div>
    </JanelaFormulario>
  );
}

export function TelaOrcamento() {
  const { contexto } = useCentral();
  const hoje = hojeISO();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mesCelular, setMesCelular] = useState(`${hoje.slice(0, 7)}-01`);
  const [editando, setEditando] = useState<LinhaDoOrcamento | null>(null);
  const [copiando, setCopiando] = useState(false);
  const consulta = useConsulta(() => carregarOrcamento(ano, contexto.id), [ano, contexto.id]);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Orçamento</h1>
        <EstadoErro titulo="Não deu para ler o orçamento." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const tela = consulta.dados;
  const mesAtual = `${hoje.slice(0, 7)}-01`;
  const alertas = ano === Number(hoje.slice(0, 4)) ? alertasDoMes(tela, mesAtual) : [];
  const mesDoCelular = tela.meses.includes(mesCelular) ? mesCelular : tela.meses[0]!;

  async function copiar() {
    setCopiando(true);
    try {
      const quantos = await copiarDoMesAnterior(mesAtual);
      aviso(quantos ? `${quantos === 1 ? '1 contexto recebeu' : `${quantos} contextos receberam`} o orçamento do mês anterior.` : 'Todos os contextos já têm orçamento neste mês.');
      consulta.recarregar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setCopiando(false);
    }
  }

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Orçamento"
        resumo="Quanto cada contexto pode gastar por mês, e quanto já foi."
        acoes={
          <Button variante="secundario" carregando={copiando} onClick={() => void copiar()}>
            <Copy aria-hidden />
            Copiar do mês anterior
          </Button>
        }
      />
      <AbasFinanceiro ativa="orcamento" />
      {alertas.length > 0 && (
        <Faixa tipo="atencao" data-alertas-do-orcamento>
          Em {rotuloDoMes(mesAtual.slice(0, 7)).toLowerCase()}: {alertas.map((alerta) => `${alerta.nome} ${alerta.celula.percentual === null ? 'acima do orçamento' : `em ${alerta.celula.percentual.toLocaleString('pt-BR')}%`}`).join(' · ')}. Alerta a partir de {ALERTA_ATENCAO}%.
        </Faixa>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variante="icone" tamanho="icone" aria-label="Ano anterior" onClick={() => setAno(ano - 1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <strong className="min-w-12 text-center tabular-nums">{ano}</strong>
        <Button variante="icone" tamanho="icone" aria-label="Próximo ano" onClick={() => setAno(ano + 1)}>
          <ChevronRight aria-hidden />
        </Button>
        <span className="text-[13px] text-ink-soft">{contexto.nome} · realizado pelas despesas da competência, rateadas</span>
      </div>

      {/* Computador: a tabela contexto × mês, rolando dentro do próprio quadro. */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-paper md:block">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <caption className="sr-only">Orçamento por contexto e mês de {ano}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-soft">
              <th scope="col" className="sticky left-0 bg-paper px-3 py-2 font-semibold">
                Contexto
              </th>
              {tela.meses.map((competencia) => (
                <th key={competencia} scope="col" className={cn('px-2 py-2 font-semibold', competencia === mesAtual && 'text-indigo-dk')}>
                  {mesCurto(competencia)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tela.linhas.map((linha) => (
              <tr key={linha.contextoId} className="border-b border-line align-top last:border-0">
                <th scope="row" className="sticky left-0 bg-paper px-3 py-2.5 text-sm font-semibold">
                  <span className="block">{linha.nome}</span>
                  <Button className="mt-1" variante="terciario" tamanho="pequeno" onClick={() => setEditando(linha)}>
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                </th>
                {linha.celulas.map((celula) => (
                  <td key={celula.competencia} className="min-w-[84px] px-2 py-2.5">
                    <Consumo celula={celula} compacta />
                  </td>
                ))}
              </tr>
            ))}
            {tela.total && (
              <tr className="bg-mist align-top">
                <th scope="row" className="sticky left-0 bg-mist px-3 py-2.5 text-sm font-semibold">
                  Total
                </th>
                {tela.total.map((celula) => (
                  <td key={celula.competencia} className="px-2 py-2.5">
                    <Consumo celula={celula} compacta />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Celular: um mês por vez, em cartões. */}
      <div className="grid gap-3 md:hidden">
        <Campo id="orcamento-mes-celular" rotulo="Mês">
          {(controle) => (
            <Selecao {...controle} value={mesDoCelular} onChange={(evento) => setMesCelular(evento.target.value)}>
              {tela.meses.map((competencia) => (
                <option key={competencia} value={competencia}>
                  {rotuloDoMes(competencia.slice(0, 7))}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <ul className="grid gap-2">
          {tela.linhas.map((linha) => (
            <li key={linha.contextoId} className="rounded-lg border border-line bg-paper p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-sm">{linha.nome}</strong>
                <Button variante="terciario" tamanho="pequeno" onClick={() => setEditando(linha)}>
                  <Pencil aria-hidden />
                  Editar
                </Button>
              </div>
              <Consumo celula={linha.celulas.find((celula) => celula.competencia === mesDoCelular)!} />
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[13px] text-ink-soft">Rateios não são saídas adicionais de caixa: cada despesa conta uma vez no total. Valores em moeda estrangeira em aberto são estimados pelo câmbio de referência.</p>

      {editando && <JanelaDoContexto key={editando.contextoId} linha={editando} meses={tela.meses} aoFechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); consulta.recarregar(); }} />}
    </div>
  );
}
