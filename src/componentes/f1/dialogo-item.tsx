'use client';

import { useEffect, useMemo, useState } from 'react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Produto } from '@/dados/tipos/marca';
import { ITEM_VAZIO, ROTULOS_PERIODICIDADE_VALOR, type DadosDoItem } from '@/dominio/comercial';
import { MENSAGEM_CATALOGO_AUSENTE, precoVigente, type CanalDoCatalogo, type OfertaDoCatalogo, type PrecoDoCatalogo } from '@/dominio/integracoes/catalogo-comercial';
import { catalogoComercial } from '@/dominio/integracoes/conexoes';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';
import { paraOpcoes } from './apoio';

export type ItemParaEditar = { id: string; dados: DadosDoItem; desconto_por: string | null; desconto_em: string | null };

/** T10.05, etapa 2: só ofertas Aprovadas; o preço vem do catálogo, sem campo para digitar (RN-10.08). */
export function DialogoItem({ produtos, item, aoSalvar, aoFechar, nomeDaPessoa }: { produtos: readonly Produto[]; item: ItemParaEditar | { id: null; dados: DadosDoItem }; aoSalvar: (dados: DadosDoItem, id: string | null) => Promise<void>; aoFechar: () => void; nomeDaPessoa: (id: string | null) => string }) {
  const [dados, setDados] = useState<DadosDoItem>(item.dados);
  const [ofertas, setOfertas] = useState<readonly OfertaDoCatalogo[]>([]);
  const [canais, setCanais] = useState<readonly CanalDoCatalogo[]>([]);
  const [precos, setPrecos] = useState<readonly PrecoDoCatalogo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const catalogo = catalogoComercial();
  const mudar = (parcial: Partial<DadosDoItem>) => setDados((atual) => ({ ...atual, ...parcial }));

  useEffect(() => {
    void catalogo.canais().then(setCanais);
  }, [catalogo]);
  useEffect(() => {
    if (!dados.produto_id) return setOfertas([]);
    void catalogo.ofertasDoProduto(dados.produto_id).then(setOfertas);
  }, [catalogo, dados.produto_id]);
  useEffect(() => {
    if (!dados.oferta_id) return setPrecos([]);
    void catalogo.precosDaOferta(dados.oferta_id).then(setPrecos);
  }, [catalogo, dados.oferta_id]);

  const preco = useMemo(() => precoVigente(precos, { canalId: dados.canal_id || null, periodicidade: dados.periodicidade, naData: dados.inicio_previsto || hojeISO() }), [precos, dados.canal_id, dados.periodicidade, dados.inicio_previsto]);
  const oferta = ofertas.find((linha) => linha.id === dados.oferta_id);
  const planejados = oferta?.recursos.filter((recurso) => recurso.planejado) ?? [];

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(dados, item.id);
      aoFechar();
    } catch (problema) {
      setErro(mensagemDoErro(problema));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={item.id ? 'Editar item' : dados.tipo_item === 'oferta' ? 'Adicionar oferta' : 'Item sob medida'} alterado={JSON.stringify(dados) !== JSON.stringify(item.dados)} aoEnviar={(evento) => void salvar(evento)} salvando={salvando}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="item-produto" rotulo="Produto" obrigatorio={dados.tipo_item === 'oferta'}>
          {(controle) => (
            <Selecao {...controle} value={dados.produto_id} onChange={(evento) => mudar({ produto_id: evento.target.value, oferta_id: '' })}>
              <option value="">{dados.tipo_item === 'oferta' ? 'Escolha' : 'Numa (institucional)'}</option>
              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        {dados.tipo_item === 'oferta' ? (
          <>
            {catalogo.estado === 'ausente' && <Faixa tipo="atencao">{MENSAGEM_CATALOGO_AUSENTE}</Faixa>}
            <Campo id="item-oferta" rotulo="Oferta" obrigatorio ajuda="Só ofertas Aprovadas entram na proposta.">
              {(controle) => (
                <Selecao {...controle} value={dados.oferta_id} onChange={(evento) => mudar({ oferta_id: evento.target.value })}>
                  <option value="">{ofertas.length ? 'Escolha' : 'Nenhuma oferta no catálogo'}</option>
                  {ofertas.map((linha) => (
                    <option key={linha.id} value={linha.id} disabled={linha.situacao !== 'aprovada'}>
                      {linha.nome}
                      {linha.situacao !== 'aprovada' ? ' (não aprovada)' : ''}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo id="item-canal" rotulo="Canal" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={dados.canal_id} onChange={(evento) => mudar({ canal_id: evento.target.value })}>
                  <option value="">Escolha</option>
                  {canais.filter((canal) => canal.situacao === 'ativa').map((canal) => (
                    <option key={canal.id} value={canal.id}>
                      {canal.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </>
        ) : (
          <>
            <Campo id="item-descricao" rotulo="Descrição" obrigatorio>
              {(controle) => <Input {...controle} autoComplete="off" value={dados.descricao} onChange={(evento) => mudar({ descricao: evento.target.value })} />}
            </Campo>
            <Campo id="item-valor" rotulo="Valor unitário (R$)" obrigatorio ajuda="Informado para item sob medida, com justificativa.">
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="Não definido" value={dados.valor_unitario} onChange={(evento) => mudar({ valor_unitario: evento.target.value })} />}
            </Campo>
            <Campo id="item-justificativa" rotulo="Justificativa do valor" obrigatorio>
              {(controle) => <Textarea {...controle} rows={2} value={dados.justificativa_valor} onChange={(evento) => mudar({ justificativa_valor: evento.target.value })} />}
            </Campo>
            <Campo id="item-horas" rotulo="Horas estimadas" ajuda="Da viabilidade, se houver.">
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.horas_estimadas} onChange={(evento) => mudar({ horas_estimadas: evento.target.value })} />}
            </Campo>
          </>
        )}
        <Campo id="item-periodicidade" rotulo="Periodicidade" obrigatorio>
          {(controle) => (
            <Selecao {...controle} value={dados.periodicidade} onChange={(evento) => mudar({ periodicidade: evento.target.value })}>
              {paraOpcoes(ROTULOS_PERIODICIDADE_VALOR).map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        {dados.tipo_item === 'oferta' && (
          <div className="rounded-md bg-linen p-3 text-[13px]">
            <p className="texto-rotulo">Preço vigente</p>
            <p className="mt-1 font-semibold">{preco?.valor !== null && preco?.valor !== undefined ? `${formatarDinheiro(preco.valor, preco.moeda)} · versão ${preco.versao}${preco.valido_de ? `, desde ${preco.valido_de.split('-').reverse().join('/')}` : ''}` : 'Não definido: sem preço aprovado neste canal e periodicidade. O item fica sem valor e bloqueia a emissão final.'}</p>
          </div>
        )}
        <Campo id="item-quantidade" rotulo="Quantidade" obrigatorio>
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.quantidade} onChange={(evento) => mudar({ quantidade: evento.target.value })} />}
        </Campo>
        <Campo id="item-inicio" rotulo="Início previsto">
          {(controle) => <EntradaData {...controle} value={dados.inicio_previsto} onChange={(evento) => mudar({ inicio_previsto: evento.target.value })} />}
        </Campo>
        <fieldset className="grid gap-3 rounded-md border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">Desconto</legend>
          <Selecao aria-label="Tipo de desconto" value={dados.desconto_tipo} onChange={(evento) => mudar({ desconto_tipo: evento.target.value as DadosDoItem['desconto_tipo'] })}>
            <option value="">Sem desconto</option>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor (R$)</option>
          </Selecao>
          {dados.desconto_tipo && (
            <>
              <Input aria-label="Desconto" inputMode="decimal" autoComplete="off" value={dados.desconto} onChange={(evento) => mudar({ desconto: evento.target.value })} />
              <Campo id="item-desconto-justificativa" rotulo="Justificativa do desconto" obrigatorio ajuda="Sem limite de desconto (D22): basta a justificativa. Quem concedeu e quando ficam registrados.">
                {(controle) => <Textarea {...controle} rows={2} value={dados.desconto_justificativa} onChange={(evento) => mudar({ desconto_justificativa: evento.target.value })} />}
              </Campo>
              {'desconto_por' in item && item.desconto_por && <p className="text-xs text-ink-soft">Concedido por {nomeDaPessoa(item.desconto_por)} em {item.desconto_em?.split('-').reverse().join('/')}</p>}
            </>
          )}
        </fieldset>
        {(planejados.length > 0 || dados.recurso_planejado) && (
          <fieldset className="grid gap-3 rounded-md border border-line p-3">
            <legend className="px-1 text-[13px] font-semibold">Recurso planejado</legend>
            <p className="text-xs text-ink-soft">Recurso que ainda não existe só entra com data, como “previsto para” (RN-10.07).</p>
            <Selecao aria-label="Recurso planejado" value={dados.recurso_planejado} onChange={(evento) => mudar({ recurso_planejado: evento.target.value })}>
              <option value="">Nenhum</option>
              {planejados.map((recurso) => (
                <option key={recurso.id} value={recurso.nome}>
                  {recurso.nome}
                </option>
              ))}
            </Selecao>
            {dados.recurso_planejado && (
              <Campo id="item-previsto" rotulo="Previsto para" obrigatorio>
                {(controle) => <EntradaData {...controle} value={dados.recurso_previsto_para} onChange={(evento) => mudar({ recurso_previsto_para: evento.target.value })} />}
              </Campo>
            )}
          </fieldset>
        )}
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

export function dadosDoItemExistente(item: { tipo_item?: 'oferta' | 'sob_medida'; produto_id: string | null; oferta_id: string | null; canal_id: string | null; periodicidade: string | null; quantidade: number; descricao: string; valor_unitario: number | null; justificativa_valor: string | null; desconto_percentual: number | null; desconto_justificativa: string | null; inicio_previsto?: string | null; inicio?: string | null; horas_estimadas?: number | null; recurso_planejado?: string | null; recurso_previsto_para?: string | null }, descontoValor: number | null): DadosDoItem {
  const numero = (valor: number | null | undefined) => (valor === null || valor === undefined ? '' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
  return { ...ITEM_VAZIO, tipo_item: item.tipo_item ?? 'oferta', produto_id: item.produto_id ?? '', oferta_id: item.oferta_id ?? '', canal_id: item.canal_id ?? '', periodicidade: item.periodicidade ?? 'unica', quantidade: numero(item.quantidade), descricao: item.descricao, valor_unitario: numero(item.valor_unitario), justificativa_valor: item.justificativa_valor ?? '', horas_estimadas: numero(item.horas_estimadas), desconto_tipo: item.desconto_percentual !== null ? 'percentual' : descontoValor !== null ? 'valor' : '', desconto: numero(item.desconto_percentual ?? descontoValor), desconto_justificativa: item.desconto_justificativa ?? '', inicio_previsto: item.inicio_previsto ?? item.inicio ?? '', recurso_planejado: item.recurso_planejado ?? '', recurso_previsto_para: item.recurso_previsto_para ?? '' };
}
