import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { esquemaFormularioCanal, FORMULARIO_CANAL_VAZIO, FORMULARIO_OFERTA_VAZIO, salvarCanal, salvarOferta } from '../precificacao';
import { precoVigente } from './catalogo-comercial';
import { catalogoDoM07, limiteDoTexto } from './catalogo-m07';
import { catalogoComercial } from './conexoes';

describe('catálogo do M07 para M10 e M11', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-07T15:00:00.000Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    usarDriverDeTeste(null);
  });

  it('é o catálogo padrão fora do exemplo, e está conectado', () => {
    expect(catalogoComercial()).toBe(catalogoDoM07);
    expect(catalogoDoM07.estado).toBe('conectado');
  });

  it('decisão vigente 4: só número vira limite; vazio e texto livre ficam "não informado", nunca ilimitado', () => {
    expect(limiteDoTexto('15')).toEqual({ tipo: 'limitado', valor: 15, unidade: null });
    expect(limiteDoTexto('1.000')).toEqual({ tipo: 'limitado', valor: 1000, unidade: null });
    expect(limiteDoTexto('200 por mês')).toEqual({ tipo: 'limitado', valor: 200, unidade: 'por mês' });
    expect(limiteDoTexto('Ilimitado')).toEqual({ tipo: 'ilimitado' });
    expect(limiteDoTexto('Não se aplica')).toEqual({ tipo: 'nao_se_aplica' });
    expect(limiteDoTexto('')).toEqual({ tipo: 'nao_informado' });
    expect(limiteDoTexto(null)).toEqual({ tipo: 'nao_informado' });
    expect(limiteDoTexto('até 3')).toEqual({ tipo: 'nao_informado' });
  });

  it('lê ofertas, recursos, canais e preços do M07, sem inventar os campos que o M07 ainda não tem', async () => {
    const oferta = await salvarOferta(ID_PRODUTO_KIPI, { ...FORMULARIO_OFERTA_VAZIO, nome: 'Revenda', formalizacao: 'ambos', recursos: [{ id: '', nome: 'Revendedoras ativas', incluido: true, limite: '15', observacao: '' }, { id: '', nome: 'Pedidos', incluido: true, limite: '', observacao: '' }] });
    const canal = await salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Pix direto', tipo: 'direto', taxa_percentual: '0', taxa_fixa: '0,00', verificado_em: '2026-10-01', fonte_url: 'https://exemplo.com.br/taxas' }));
    await repositorios.preco_versao.criar({ oferta_id: oferta.id, canal_id: canal.id, versao: 1, valor: 59.9, moeda: 'BRL', periodicidade: 'mensal', valido_de: '2026-11-01', valido_ate: null, situacao: 'aprovada', simulacao_id: null, decisao_id: null, aprovado_por: null, aprovado_em: null, justificativa_excecao: null, snapshot: null, exemplo: false });

    const [lida] = await catalogoDoM07.ofertasDoProduto(ID_PRODUTO_KIPI);
    expect(lida).toMatchObject({ id: oferta.id, nome: 'Revenda', formalizacao: 'ambos', situacao: 'em_estudo', regras_uso: null, suporte: null, teste_dias: null, adicionais_ids: [] });
    expect(lida!.recursos.map((recurso) => [recurso.nome, recurso.limite.tipo])).toEqual([['Revendedoras ativas', 'limitado'], ['Pedidos', 'nao_informado']]);
    expect(await catalogoDoM07.oferta(oferta.id)).toEqual(lida);

    const [canalLido] = await catalogoDoM07.canais();
    expect(canalLido).toMatchObject({ id: canal.id, cobranca: 'Direto', situacao: 'ativa', gateway_nome: null });

    const precos = await catalogoDoM07.precosDaOferta(oferta.id);
    expect(precoVigente(precos, { canalId: canal.id, periodicidade: 'mensal', naData: '2026-11-07' })?.valor).toBe(59.9);
  });

  it('sem T07.10 construída, nenhum produto tem configuração contratual', async () => {
    expect(await catalogoDoM07.configuracaoValidada(ID_PRODUTO_KIPI)).toBeNull();
    expect(await catalogoDoM07.configuracaoMaisRecente(ID_PRODUTO_KIPI)).toBeNull();
  });
});
