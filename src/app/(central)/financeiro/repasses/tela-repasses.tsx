'use client';

/** T05.13 Repasses a parceiros (F2, RN-05.22): vendas de origem, cálculo do período com prévia e o título a pagar. */
import { useState } from 'react';
import { Calculator, Handshake, Pencil, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { executar } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { calcularPrevia, cancelarRepasse, carregarRepasses, FORMULARIO_VENDA_VAZIO, gerarRepasse, removerVenda, salvarVenda, type FormularioVenda, type LinhaDaVenda, type PreviaDoRepasse, type TelaDeRepasses } from '@/dominio/repasses';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const ROTULOS_SITUACAO = { calculado: 'Calculado', aprovado: 'A pagar', pago: 'Pago', cancelado: 'Cancelado' } as const;

function mesPassado(hoje: string) {
  const [ano, mes] = hoje.split('-').map(Number) as [number, number];
  return { inicio: new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10), fim: new Date(Date.UTC(ano, mes - 1, 0)).toISOString().slice(0, 10) };
}

function JanelaDaVenda({ venda, tela, aoFechar }: { venda: LinhaDaVenda | null; tela: TelaDeRepasses; aoFechar: () => void }) {
  const inicial = (): FormularioVenda => (venda ? { contrato_id: venda.contrato_id, item_contrato_id: venda.item_contrato_id, data: venda.data, descricao: venda.descricao, moeda: venda.moeda, valor_bruto: String(venda.valor_bruto).replace('.', ','), taxas: venda.taxas ? String(venda.taxas).replace('.', ',') : '', referencia: venda.referencia ?? '' } : { ...FORMULARIO_VENDA_VAZIO, contrato_id: tela.contratos.length === 1 ? (tela.contratos[0]?.id ?? '') : '', item_contrato_id: tela.contratos.length === 1 && tela.contratos[0]?.itens.length === 1 ? (tela.contratos[0].itens[0]?.id ?? '') : '' });
  const [dados, setDados] = useState<FormularioVenda>(inicial);
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<FormularioVenda>) => setDados((atual) => ({ ...atual, ...parcial }));
  const contrato = tela.contratos.find((item) => item.id === dados.contrato_id);
  return (
    <JanelaFormulario
      colunas={2}
      aberto
      aoFechar={aoFechar}
      titulo={venda ? 'Editar venda do parceiro' : 'Lançar venda do parceiro'}
      descricao="A venda entra no repasse do período pelos termos da versão do contrato vigente na data dela."
      alterado={JSON.stringify(dados) !== JSON.stringify(inicial())}
      rotuloSalvar={venda ? 'Salvar alterações' : 'Lançar venda'}
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        void salvarVenda({ ...dados, moeda: contrato?.moeda ?? dados.moeda }, venda?.id)
          .then(() => {
            aviso(venda ? 'Venda atualizada.' : 'Venda lançada.');
            aoFechar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <Campo id="venda-contrato" rotulo="Contrato do parceiro" obrigatorio>
        {(controle) => (
          <Selecao {...controle} value={dados.contrato_id} onChange={(evento) => mudar({ contrato_id: evento.target.value, item_contrato_id: tela.contratos.find((item) => item.id === evento.target.value)?.itens.length === 1 ? (tela.contratos.find((item) => item.id === evento.target.value)?.itens[0]?.id ?? '') : '' })}>
            <option value="">Escolha</option>
            {tela.contratos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.parceiro} · {item.codigo} {item.titulo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo id="venda-item" rotulo="Item com termos de repasse" obrigatorio>
        {(controle) => (
          <Selecao {...controle} value={dados.item_contrato_id} disabled={!contrato} onChange={(evento) => mudar({ item_contrato_id: evento.target.value })}>
            <option value="">Escolha</option>
            {contrato?.itens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.descricao} · {item.termos}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo id="venda-data" rotulo="Data da venda" obrigatorio>
        {(controle) => <Input {...controle} type="date" max={hojeISO()} value={dados.data} onChange={(evento) => mudar({ data: evento.target.value })} />}
      </Campo>
      <Campo id="venda-descricao" rotulo="Descrição" obrigatorio ajuda="Ex.: vendas do dia, pedido 123.">
        {(controle) => <Input {...controle} autoComplete="off" value={dados.descricao} onChange={(evento) => mudar({ descricao: evento.target.value })} />}
      </Campo>
      <Campo id="venda-bruto" rotulo={`Valor bruto${contrato ? ` (${contrato.moeda})` : ''}`} obrigatorio>
        {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.valor_bruto} onChange={(evento) => mudar({ valor_bruto: evento.target.value })} />}
      </Campo>
      <Campo id="venda-taxas" rotulo="Taxas" ajuda="Só contam quando o repasse é sobre a venda líquida.">
        {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.taxas} onChange={(evento) => mudar({ taxas: evento.target.value })} />}
      </Campo>
      <Campo id="venda-referencia" rotulo="Referência" ajuda="Relatório do parceiro, número do pedido…">
        {(controle) => <Input {...controle} autoComplete="off" value={dados.referencia} onChange={(evento) => mudar({ referencia: evento.target.value })} />}
      </Campo>
    </JanelaFormulario>
  );
}

function JanelaDoCalculo({ tela, aoFechar }: { tela: TelaDeRepasses; aoFechar: () => void }) {
  const { pessoa } = useCentral();
  const periodo = mesPassado(hojeISO());
  const [dados, setDados] = useState({ parceiroId: tela.parceiros.length === 1 ? (tela.parceiros[0]?.id ?? '') : '', inicio: periodo.inicio, fim: periodo.fim, vencimento: '', categoriaId: '' });
  const [previa, setPrevia] = useState<PreviaDoRepasse | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<typeof dados>, refazer = false) => {
    setDados((atual) => ({ ...atual, ...parcial }));
    if (refazer) setPrevia(null);
  };
  return (
    <JanelaFormulario
      colunas={2}
      aberto
      aoFechar={aoFechar}
      titulo="Calcular repasses do período"
      descricao="Primeiro a prévia, venda a venda. Ao confirmar, o repasse e o título a pagar ao parceiro são gerados uma única vez para o parceiro e o período."
      alterado={Boolean(previa || dados.vencimento || dados.categoriaId)}
      rotuloSalvar={previa ? 'Gerar repasse' : 'Ver prévia'}
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        const acao = previa
          ? gerarRepasse(dados, pessoa.id).then(() => {
              aviso('Repasse gerado, com o título a pagar ao parceiro.');
              aoFechar();
            })
          : calcularPrevia(dados.parceiroId, dados.inicio, dados.fim).then(setPrevia);
        void acao.catch((erro) => aviso(mensagemDoErro(erro))).finally(() => setSalvando(false));
      }}
    >
      <Campo id="calculo-parceiro" rotulo="Parceiro" obrigatorio>
        {(controle) => (
          <Selecao {...controle} value={dados.parceiroId} onChange={(evento) => mudar({ parceiroId: evento.target.value }, true)}>
            <option value="">Escolha</option>
            {tela.parceiros.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="calculo-inicio" rotulo="De" obrigatorio>
          {(controle) => <Input {...controle} type="date" value={dados.inicio} onChange={(evento) => mudar({ inicio: evento.target.value }, true)} />}
        </Campo>
        <Campo id="calculo-fim" rotulo="Até" obrigatorio>
          {(controle) => <Input {...controle} type="date" value={dados.fim} onChange={(evento) => mudar({ fim: evento.target.value }, true)} />}
        </Campo>
      </div>
      {previa && (
        <>
          <div className="overflow-x-auto rounded-md border border-line md:col-span-2" data-previa-do-repasse>
            <table className="w-full border-collapse text-left text-[13px]">
              <caption className="sr-only">Prévia do repasse, venda a venda</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  {['Venda', 'Versão', 'Base', '%', 'Retido', 'A repassar'].map((titulo) => (
                    <th key={titulo} scope="col" className="px-2.5 py-1.5 font-semibold">
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previa.linhas.map((linha) => (
                  <tr key={linha.venda_id} className="border-b border-line last:border-0">
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{formatarDiaISO(linha.data)} · {previa.vendas.find((venda) => venda.id === linha.venda_id)?.descricao}</td>
                    <td className="px-2.5 py-1.5">{linha.versao_numero}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{formatarDinheiro(linha.base, previa.moeda)}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{linha.percentual.toLocaleString('pt-BR')}%</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{formatarDinheiro(linha.retencao, previa.moeda)}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">{formatarDinheiro(linha.valor, previa.moeda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-2.5 py-2 text-[13px] font-semibold" data-total-do-repasse>
              A repassar: {formatarDinheiro(previa.valor, previa.moeda)} · retido para estornos: {formatarDinheiro(previa.retencao, previa.moeda)}
            </p>
          </div>
          <Campo id="calculo-vencimento" rotulo="Vencimento do repasse" obrigatorio ajuda="O prazo de pagamento combinado com o parceiro.">
            {(controle) => <Input {...controle} type="date" value={dados.vencimento} onChange={(evento) => mudar({ vencimento: evento.target.value })} />}
          </Campo>
          <Campo id="calculo-categoria" rotulo="Categoria da despesa" obrigatorio>
            {(controle) => (
              <Selecao {...controle} value={dados.categoriaId} onChange={(evento) => mudar({ categoriaId: evento.target.value })}>
                <option value="">Escolha</option>
                {tela.categorias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </>
      )}
    </JanelaFormulario>
  );
}

const celula = 'px-3 py-2.5';

export function TelaRepasses() {
  const consulta = useConsulta(() => carregarRepasses(), []);
  const [venda, setVenda] = useState<{ linha: LinhaDaVenda | null } | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);

  if (consulta.estado === 'carregando' && !consulta.dados) return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Repasses a parceiros</h1>
        <EstadoErro titulo="Não deu para ler os repasses." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const tela = consulta.dados;
  const semContrato = !tela.contratos.length;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Repasses a parceiros"
        resumo="As vendas dos parceiros e o que cabe a cada um, pelos termos do contrato vigentes na data de cada venda."
        acoes={
          <>
            <Button variante="secundario" disabled={semContrato} onClick={() => setVenda({ linha: null })}>
              <Plus aria-hidden />
              Lançar venda
            </Button>
            <Button disabled={!tela.vendas.some((linha) => !linha.repasse_id)} onClick={() => setCalculando(true)}>
              <Calculator aria-hidden />
              Calcular repasses do período
            </Button>
          </>
        }
      />
      <AbasFinanceiro ativa="repasses" />

      {semContrato && (
        <EstadoVazio
          icone={Handshake}
          titulo="Nenhum contrato de parceiro com termos de repasse em vigor."
          texto="Crie o contrato na família Parceiro, informe os termos de repasse nos itens (percentual, base e retenção) e registre a assinatura. Depois, lance aqui as vendas."
          acao={<LinkCentral href="/contratos/novo" className="text-sm underline underline-offset-2">Novo contrato</LinkCentral>}
        />
      )}

      <section aria-labelledby="repasses-titulo" className="space-y-2">
        <h2 id="repasses-titulo" className="text-base font-semibold">
          Repasses
        </h2>
        {tela.repasses.length ? (
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="w-full border-collapse text-left text-sm" data-repasses>
              <caption className="sr-only">Repasses por parceiro e período</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  {['Período', 'Parceiro', 'Base', '%', 'Retido', 'A repassar', 'Título', 'Situação', ''].map((titulo) => (
                    <th key={titulo} scope="col" className="px-3 py-2 font-semibold">
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tela.repasses.map((linha) => (
                  <tr key={linha.id} className="border-b border-line last:border-0" data-repasse={linha.situacaoExibida}>
                    <td className={`${celula} whitespace-nowrap`}>{formatarDiaISO(linha.periodo_inicio)} a {formatarDiaISO(linha.periodo_fim)}</td>
                    <td className={celula}>{linha.parceiro}</td>
                    <td className={`${celula} whitespace-nowrap tabular-nums`}>{formatarDinheiro(linha.base_calculo, linha.moeda)}</td>
                    <td className={`${celula} tabular-nums`}>{linha.percentual === null ? 'Vários' : `${linha.percentual.toLocaleString('pt-BR')}%`}</td>
                    <td className={`${celula} whitespace-nowrap tabular-nums`}>{formatarDinheiro(linha.retencao, linha.moeda)}</td>
                    <td className={`${celula} whitespace-nowrap font-semibold tabular-nums`}>{formatarDinheiro(linha.valor, linha.moeda)}</td>
                    <td className={`${celula} whitespace-nowrap`}>{linha.titulo ? <LinkCentral href={`/financeiro/${linha.titulo.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">Vence {formatarDiaISO(linha.titulo.vencimento)}</LinkCentral> : '—'}</td>
                    <td className={celula}>{ROTULOS_SITUACAO[linha.situacaoExibida]}{linha.cancelado_motivo ? ` · ${linha.cancelado_motivo}` : ''}</td>
                    <td className={celula}>
                      {linha.situacaoExibida === 'aprovado' && (
                        <Button variante="secundario" tamanho="pequeno" onClick={() => setCancelando(linha.id)}>
                          Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhum repasse calculado ainda.</p>
        )}
      </section>

      <section aria-labelledby="vendas-titulo" className="space-y-2">
        <h2 id="vendas-titulo" className="text-base font-semibold">
          Vendas dos parceiros
        </h2>
        {tela.vendas.length ? (
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="w-full border-collapse text-left text-sm" data-vendas>
              <caption className="sr-only">Vendas lançadas</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  {['Data', 'Parceiro · contrato', 'Venda', 'Bruto', 'Taxas', 'Situação', ''].map((titulo) => (
                    <th key={titulo} scope="col" className="px-3 py-2 font-semibold">
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tela.vendas.map((linha) => (
                  <tr key={linha.id} className="border-b border-line last:border-0">
                    <td className={`${celula} whitespace-nowrap`}>{formatarDiaISO(linha.data)}</td>
                    <td className={celula}>
                      <span className="font-medium">{linha.parceiro}</span> · {linha.contrato}
                    </td>
                    <td className={celula}>
                      {linha.descricao}
                      <span className="block text-xs text-ink-soft">{linha.item}</span>
                    </td>
                    <td className={`${celula} whitespace-nowrap tabular-nums`}>{formatarDinheiro(linha.valor_bruto, linha.moeda)}</td>
                    <td className={`${celula} whitespace-nowrap tabular-nums`}>{formatarDinheiro(linha.taxas, linha.moeda)}</td>
                    <td className={celula}>{linha.repasse_id ? 'Em repasse' : 'Aguardando repasse'}</td>
                    <td className={celula}>
                      {!linha.repasse_id && (
                        <span className="flex">
                          <Button variante="icone" tamanho="icone" aria-label={`Editar ${linha.descricao}`} onClick={() => setVenda({ linha })}>
                            <Pencil aria-hidden />
                          </Button>
                          <Button variante="icone" tamanho="icone" aria-label={`Tirar ${linha.descricao}`} onClick={() => void executar(() => removerVenda(linha.id), 'Venda retirada.')}>
                            <Trash2 aria-hidden />
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhuma venda lançada.</p>
        )}
      </section>

      {venda && <JanelaDaVenda venda={venda.linha} tela={tela} aoFechar={() => setVenda(null)} />}
      {calculando && <JanelaDoCalculo tela={tela} aoFechar={() => setCalculando(false)} />}
      <Confirmacao
        aberto={cancelando !== null}
        aoFechar={() => setCancelando(null)}
        titulo="Cancelar este repasse?"
        texto="O título a pagar é cancelado e as vendas voltam a aguardar repasse. O motivo fica no histórico."
        rotuloConfirmar="Cancelar repasse"
        rotuloCancelar="Voltar"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          const id = cancelando;
          setCancelando(null);
          if (id) void executar(() => cancelarRepasse(id, motivo ?? ''), 'Repasse cancelado.');
        }}
      />
    </div>
  );
}
