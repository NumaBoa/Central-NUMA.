import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { carregarMeuDia, FILTROS_MEU_DIA_INICIAIS, passaNosFiltrosComuns } from './atividades';
import { ID_CONSOLIDADA } from './contextos';
import { limparExemplos } from './dados';
import { arquivarEtiqueta, definirEtiquetasDoRegistro, etiquetasPorRegistro, FORMULARIO_ETIQUETA_VAZIO, mesclarEtiquetas, salvarEtiqueta, type FormularioEtiqueta } from './etiquetas';
import { carregarFerramentas, filtrarFerramentas, FILTROS_FERRAMENTAS_INICIAIS } from './ferramentas';

const HOJE = '2026-11-06';
const etiqueta = (alteracoes: Partial<FormularioEtiqueta> = {}) => salvarEtiqueta({ ...FORMULARIO_ETIQUETA_VAZIO, nome: 'Urgente da semana', cor: '#4F52D9', ...alteracoes });
const vinculosDe = async (tipo: string, id: string) => (await repositorios.etiqueta_vinculo.listar({ onde: { registro_tipo: tipo, registro_id: id } })).map((vinculo) => vinculo.etiqueta_id).sort();
const umaAtividade = async () => (await repositorios.atividade.listar()).find((atividade) => atividade.titulo === 'Definir o preço da oferta anual')!;
const umaFerramenta = async (nome = 'Traço Editor') => (await repositorios.ferramenta.listar()).find((ferramenta) => ferramenta.nome === nome)!;

describe('etiquetas nas atividades e nas ferramentas (decisão de Kimberly em 06/11/2026)', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('põe as novas e tira as que saíram, sem repetir', async () => {
    const a = await etiqueta({ nome: 'A' });
    const b = await etiqueta({ nome: 'B' });
    const atividade = await umaAtividade();
    await definirEtiquetasDoRegistro('atividade', atividade.id, [a.id, b.id, a.id]);
    expect(await vinculosDe('atividade', atividade.id)).toEqual([a.id, b.id].sort());
    await definirEtiquetasDoRegistro('atividade', atividade.id, [b.id]);
    expect(await vinculosDe('atividade', atividade.id)).toEqual([b.id]);
    await definirEtiquetasDoRegistro('atividade', atividade.id, []);
    expect(await vinculosDe('atividade', atividade.id)).toEqual([]);
  });

  it('só as do módulo: etiqueta só do Financeiro não entra numa atividade', async () => {
    const financeiro = await etiqueta({ nome: 'Só financeiro', escopo: 'alguns', modulos: ['financeiro'] });
    const atividades = await etiqueta({ nome: 'Só atividades', escopo: 'alguns', modulos: ['atividades'] });
    const atividade = await umaAtividade();
    const ferramenta = await umaFerramenta();
    await expect(definirEtiquetasDoRegistro('atividade', atividade.id, [financeiro.id])).rejects.toThrow('não está disponível aqui');
    await definirEtiquetasDoRegistro('atividade', atividade.id, [atividades.id]);
    await expect(definirEtiquetasDoRegistro('ferramenta', ferramenta.id, [atividades.id])).rejects.toThrow('não está disponível aqui');
    expect(await vinculosDe('ferramenta', ferramenta.id)).toEqual([]);
  });

  it('a que foi arquivada continua no registro que já a tinha, e não entra em outro', async () => {
    const velha = await etiqueta({ nome: 'Velha' });
    const atividade = await umaAtividade();
    const outra = (await repositorios.atividade.listar()).find((item) => item.id !== atividade.id)!;
    await definirEtiquetasDoRegistro('atividade', atividade.id, [velha.id]);
    await mesclarEtiquetas(velha.id, (await etiqueta({ nome: 'Nova' })).id);
    expect(await repositorios.etiqueta.obter(velha.id)).toMatchObject({ arquivado_em: expect.any(String) });
    await expect(definirEtiquetasDoRegistro('atividade', outra.id, [velha.id])).rejects.toThrow('não está disponível aqui');
  });

  it('em uso não arquiva (T02.10)', async () => {
    const a = await etiqueta({ nome: 'Em uso' });
    await definirEtiquetasDoRegistro('ferramenta', (await umaFerramenta()).id, [a.id]);
    await expect(arquivarEtiqueta(a.id)).rejects.toThrow();
  });

  it('o mapa de etiquetas por registro ignora as tiradas e os outros tipos', () => {
    const mapa = etiquetasPorRegistro(
      [
        { registro_tipo: 'atividade', registro_id: 'x', etiqueta_id: 'a', arquivado_em: null },
        { registro_tipo: 'atividade', registro_id: 'x', etiqueta_id: 'b', arquivado_em: '2026-11-01T12:00:00.000Z' },
        { registro_tipo: 'ferramenta', registro_id: 'x', etiqueta_id: 'c', arquivado_em: null },
      ],
      'atividade',
    );
    expect(mapa.get('x')).toEqual(['a']);
  });

  it('o Meu dia carrega e filtra por etiqueta', async () => {
    const a = await etiqueta({ nome: 'Lançamento' });
    const atividade = await umaAtividade();
    await definirEtiquetasDoRegistro('atividade', atividade.id, [a.id]);
    const dados = await carregarMeuDia();
    expect(dados.etiquetas.map((item) => item.id)).toContain(a.id);
    expect(dados.atividades.find((item) => item.id === atividade.id)?.etiquetas).toEqual([a.id]);
    const opcoes = { hoje: HOJE, pessoaAtualId: ID_KIMBERLY, contextoGlobalId: ID_CONSOLIDADA, nomeDaPessoa: () => '' };
    const filtradas = dados.atividades.filter((item) => passaNosFiltrosComuns(item, { ...FILTROS_MEU_DIA_INICIAIS, etiqueta: a.id }, opcoes));
    expect(filtradas.map((item) => item.id)).toEqual([atividade.id]);
  });

  it('a lista de ferramentas carrega e filtra por etiqueta', async () => {
    const a = await etiqueta({ nome: 'Revisar no trimestre' });
    const traco = await umaFerramenta();
    await definirEtiquetasDoRegistro('ferramenta', traco.id, [a.id]);
    const dados = await carregarFerramentas();
    expect(dados.ferramentas.find((item) => item.id === traco.id)?.etiquetas).toEqual([a.id]);
    const filtradas = filtrarFerramentas(dados.ferramentas, { ...FILTROS_FERRAMENTAS_INICIAIS, etiqueta: a.id }, { contextoGlobalId: ID_CONSOLIDADA, hoje: HOJE, nomeDaCategoria: () => '' });
    expect(filtradas.map((item) => item.id)).toEqual([traco.id]);
  });

  it('limpar os exemplos tira as etiquetas dos registros que saíram, e a etiqueta fica', async () => {
    const a = await etiqueta({ nome: 'Fica' });
    await definirEtiquetasDoRegistro('ferramenta', (await umaFerramenta()).id, [a.id]);
    await limparExemplos();
    expect(await repositorios.etiqueta_vinculo.listar()).toEqual([]);
    expect(await repositorios.etiqueta.obter(a.id)).toMatchObject({ nome: 'Fica', arquivado_em: null });
  });
});
