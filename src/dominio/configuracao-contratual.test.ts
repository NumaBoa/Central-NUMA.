import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { catalogoDoM07 } from './integracoes/catalogo-m07';
import { camposVaziosDaConfiguracao } from './integracoes/catalogo-comercial';
import {
  devolverConfiguracao,
  enviarParaValidacao,
  errosDoFormulario,
  FORMULARIO_CONFIGURACAO_VAZIO,
  formularioInicial,
  pendenciasDaConfiguracao,
  salvarRascunhoDaConfiguracao,
  validarConfiguracao,
  versoesDaConfiguracao,
  type FormularioConfiguracao,
} from './configuracao-contratual';
import { FORMULARIO_OFERTA_VAZIO, salvarOferta } from './precificacao';

/** Preenchido só para o teste: nenhum destes valores é da Numa. */
const COMPLETO: FormularioConfiguracao = {
  ...FORMULARIO_CONFIGURACAO_VAZIO,
  nome_maiusculo: 'KIPI',
  descricao_contratual: 'Teste',
  funcoes_de_apoio: 'Teste',
  url_termos: 'https://exemplo.com.br/termos',
  url_privacidade: 'https://exemplo.com.br/privacidade',
  url_ajuda: 'https://exemplo.com.br/ajuda',
  email_contato: 'teste@exemplo.com.br',
  prazo_reembolso_dias: '7',
  aviso_alteracao_dias: '30',
  aviso_manutencao_horas: '24',
  aviso_suboperador_dias: '10',
  prazo_encaminhar_titular_dias: '5',
  prazo_aviso_incidente_horas: '48',
  prazo_reativacao_horas: '24',
  aviso_resilicao_dias: '30',
  prazo_cura_dias: '10',
  aviso_cessao_dias: '30',
  prazo_exportacao_dias: '30',
  prazo_exclusao_dias: '30',
  prazo_expurgo_backup_dias: '90',
  categorias_dados_operador: 'Teste',
  categorias_titulares: 'Teste',
  categorias_dados_controlador: 'Teste',
  provedor_infraestrutura: 'Teste',
  local_armazenamento: 'Teste',
  transferencia_internacional_texto: 'Não',
  medidas_seguranca: 'Teste',
  backup_frequencia: 'Diária',
  backup_retencao_dias: '30',
  procedimento_recuperacao: 'Teste',
  canal_privacidade: 'teste@exemplo.com.br',
  canal_incidentes: 'teste@exemplo.com.br',
  modalidades: ['Navegador'],
  formatos_exportacao: ['CSV'],
  suboperadores: [{ nome: 'Teste', finalidade: 'Hospedagem', pais: 'Brasil' }],
};

describe('T07.10: configuração contratual do produto (RN-11.30)', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-07T15:00:00.000Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    usarDriverDeTeste(null);
  });

  it('começa vazia: só o nome em maiúsculas vem do produto', async () => {
    const inicial = await formularioInicial(ID_PRODUTO_KIPI);
    expect(inicial.nome_maiusculo).toBe('KIPI');
    expect(inicial.descricao_contratual).toBe('');
    expect(await catalogoDoM07.configuracaoValidada(ID_PRODUTO_KIPI)).toBeNull();
  });

  it('rascunho com campos vazios pode ser salvo; enviar exige tudo o que a emissão exige', async () => {
    const rascunho = await salvarRascunhoDaConfiguracao(ID_PRODUTO_KIPI, { ...FORMULARIO_CONFIGURACAO_VAZIO, nome_maiusculo: 'KIPI' });
    expect(rascunho).toMatchObject({ versao: 1, situacao: 'rascunho', descricao_contratual: null, prazo_reembolso_dias: null });
    await expect(enviarParaValidacao(ID_PRODUTO_KIPI, { ...FORMULARIO_CONFIGURACAO_VAZIO, nome_maiusculo: 'KIPI' }, null)).rejects.toThrow('Falta preencher');
    expect((await catalogoDoM07.configuracaoMaisRecente(ID_PRODUTO_KIPI))?.situacao).toBe('rascunho');
    // Salvar de novo edita o mesmo rascunho, sem criar versão.
    await salvarRascunhoDaConfiguracao(ID_PRODUTO_KIPI, { ...FORMULARIO_CONFIGURACAO_VAZIO, nome_maiusculo: 'KIPI', descricao_contratual: 'X' });
    expect(await versoesDaConfiguracao(ID_PRODUTO_KIPI)).toHaveLength(1);
  });

  it('rascunho → em validação → validada; mudar uma validada cria V2, e a V1 fica Substituída ao validar a V2', async () => {
    const enviada = await enviarParaValidacao(ID_PRODUTO_KIPI, COMPLETO, null);
    expect(enviada.situacao).toBe('em_validacao');
    await expect(salvarRascunhoDaConfiguracao(ID_PRODUTO_KIPI, COMPLETO)).rejects.toThrow('em validação');
    await validarConfiguracao(enviada.id, null);
    const validada = await catalogoDoM07.configuracaoValidada(ID_PRODUTO_KIPI);
    expect(validada).toMatchObject({ versao: 1, situacao: 'validada', prazo_reembolso_dias: 7 });
    expect(camposVaziosDaConfiguracao(validada!)).toEqual([]);

    const v2 = await salvarRascunhoDaConfiguracao(ID_PRODUTO_KIPI, { ...COMPLETO, prazo_reembolso_dias: '14' });
    expect(v2).toMatchObject({ versao: 2, situacao: 'rascunho' });
    expect((await catalogoDoM07.configuracaoValidada(ID_PRODUTO_KIPI))?.versao).toBe(1);
    const enviadaV2 = await enviarParaValidacao(ID_PRODUTO_KIPI, { ...COMPLETO, prazo_reembolso_dias: '14' }, null);
    await validarConfiguracao(enviadaV2.id, null);
    const versoes = await versoesDaConfiguracao(ID_PRODUTO_KIPI);
    expect(versoes.map((versao) => [versao.versao, versao.situacao])).toEqual([
      [2, 'validada'],
      [1, 'substituida'],
    ]);
  });

  it('devolver volta para rascunho e exige motivo', async () => {
    const enviada = await enviarParaValidacao(ID_PRODUTO_KIPI, COMPLETO, null);
    await expect(devolverConfiguracao(enviada.id, ' ')).rejects.toThrow('motivo');
    expect(await devolverConfiguracao(enviada.id, 'Conferir o Anexo II')).toMatchObject({ situacao: 'rascunho', devolucao_motivo: 'Conferir o Anexo II' });
  });

  it('mínimos de 19 §4: alteração e encerramento com 30 dias ou mais, incidente em até 72 horas', () => {
    expect(errosDoFormulario({ ...COMPLETO, aviso_alteracao_dias: '15', prazo_aviso_incidente_horas: '96', url_ajuda: 'exemplo.com' })).toMatchObject({ aviso_alteracao_dias: expect.stringContaining('30'), prazo_aviso_incidente_horas: expect.stringContaining('72'), url_ajuda: expect.stringContaining('https') });
    expect(errosDoFormulario(COMPLETO)).toEqual({});
  });

  it('condicionais: com teste grátis, pede o plano após o teste; com plano anual, o aviso de renovação', async () => {
    await salvarOferta(ID_PRODUTO_KIPI, { ...FORMULARIO_OFERTA_VAZIO, nome: 'Ateliê anual', periodicidade: 'anual', teste_dias: '14' });
    expect(await pendenciasDaConfiguracao(ID_PRODUTO_KIPI, COMPLETO)).toEqual(['Plano após o fim do teste', 'Aviso de renovação anual']);
    expect(await pendenciasDaConfiguracao(ID_PRODUTO_KIPI, { ...COMPLETO, plano_apos_teste: 'x', aviso_renovacao_anual_dias: '30' })).toEqual([]);
  });
});
