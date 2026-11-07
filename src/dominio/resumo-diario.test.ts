import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_BRUNA, ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { criarAtividade, formularioAtividadeVazio, type FormularioAtividade } from './atividades-formulario';
import { ID_CONSOLIDADA } from './contextos';
import { assuntoDoResumo, carregarResumoDiario, MAXIMO_POR_SECAO } from './resumo-diario';

const HOJE = '2026-11-06';
const novo = (alteracoes: Partial<FormularioAtividade> = {}): FormularioAtividade => ({ ...formularioAtividadeVazio('tarefa', ID_BRUNA, ID_CONSOLIDADA), titulo: 'Atividade', ...alteracoes });

describe('T03.06: resumo diário', () => {
  beforeEach(async () => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00.000Z'), toFake: ['Date'] });
    // Bruna é a pessoa sem atividades de hoje na carga inicial, para começar do zero.
    for (const atividade of await repositorios.atividade.listar({ onde: { responsavel_id: ID_BRUNA } })) await repositorios.atividade.arquivar(atividade.id);
    for (const ligacao of await repositorios.atividade_participante.listar({ onde: { pessoa_id: ID_BRUNA } })) await repositorios.atividade_participante.arquivar(ligacao.id);
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  const resumo = () => carregarResumoDiario(ID_BRUNA, 'Bruna Alves', HOJE);

  it('o assunto, como em T03.06', () => {
    expect(assuntoDoResumo(4, 2)).toBe('Seu dia na Numa — 4 itens, 2 atrasados');
    expect(assuntoDoResumo(1, 1)).toBe('Seu dia na Numa — 1 item, 1 atrasado');
    expect(assuntoDoResumo(0, 1)).toBe('Seu dia na Numa — 1 atrasado');
    expect(assuntoDoResumo(0, 0)).toBe('Seu dia na Numa — nada para hoje');
  });

  it('atrasadas, para hoje e o acompanhamento de hoje, só da pessoa', async () => {
    await criarAtividade(novo({ titulo: 'Atrasada', prazo: '2026-11-01' }));
    await criarAtividade(novo({ titulo: 'De hoje', prazo: HOJE }));
    await criarAtividade(novo({ titulo: 'Outra pessoa', prazo: HOJE, responsavel_id: ID_CAMILA }));
    await criarAtividade(novo({ titulo: 'Participo', prazo: HOJE, responsavel_id: ID_CAMILA, participantes: [ID_BRUNA] }));
    await criarAtividade(novo({ titulo: 'Da semana que vem', prazo: '2026-11-12' }));
    const acompanhar = await criarAtividade(novo({ titulo: 'Acompanhar', prazo: '2026-11-20' }));
    await repositorios.atividade.atualizar(acompanhar.id, { situacao: 'aguardando', aguardando_de_texto: 'Fornecedor', aguardando_desde: HOJE, acompanhamento_em: HOJE });
    const { assunto, atrasadas, paraHoje, aguardando, nome } = await resumo();
    expect(nome).toBe('Bruna');
    expect(atrasadas.itens.map((item) => item.titulo)).toEqual(['Atrasada']);
    expect(paraHoje.itens.map((item) => item.titulo)).toEqual(['De hoje', 'Participo']);
    expect(aguardando.itens.map((item) => [item.titulo, item.detalhe])).toEqual([['Acompanhar', 'Aguardando: Fornecedor']]);
    // O acompanhamento conta nos itens de hoje.
    expect(assunto).toBe('Seu dia na Numa — 3 itens, 1 atrasado');
  });

  it('até 10 por seção, dizendo quantas são', async () => {
    for (let numero = 0; numero < MAXIMO_POR_SECAO + 2; numero += 1) await criarAtividade(novo({ titulo: `Atrasada ${numero}`, prazo: '2026-11-01' }));
    const { atrasadas } = await resumo();
    expect(atrasadas.total).toBe(MAXIMO_POR_SECAO + 2);
    expect(atrasadas.itens).toHaveLength(MAXIMO_POR_SECAO);
  });

  it('próximos 7 dias: vencimentos, renovações, fim de testes e domínios, sem valores', async () => {
    const [titulo] = await repositorios.titulo.listar({ onde: { natureza: 'pagar' } });
    await repositorios.titulo.atualizar(titulo!.id, { responsavel_id: ID_BRUNA, situacao: 'aberto', vencimento: '2026-11-10' });
    const [dominio] = (await repositorios.ativo_digital.listar()).filter((ativo) => ativo.tipo === 'dominio');
    await repositorios.ativo_digital.atualizar(dominio!.id, { responsavel_id: ID_BRUNA, vencimento: '2026-11-08' });
    const [ferramenta] = await repositorios.ferramenta.listar();
    await repositorios.ferramenta.atualizar(ferramenta!.id, { situacao: 'ativa', responsavel_financeiro_id: ID_BRUNA, responsavel_tecnico_id: ID_BRUNA });
    const [assinatura] = await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta!.id } });
    await repositorios.assinatura_ferramenta.atualizar(assinatura!.id, { situacao: 'ativa', modalidade: 'paga', periodicidade: 'anual', renovacao: 'automatica', proxima_cobranca: '2026-11-12', fim_teste: null });
    const { proximos, periodoDosProximos } = await resumo();
    expect(periodoDosProximos).toBe('07/11 a 13/11');
    expect(proximos.map((evento) => evento.dia)).toEqual(['2026-11-08', '2026-11-10', '2026-11-12']);
    expect(proximos.map((evento) => evento.acao)).toEqual(['Abrir ativo', 'Ver lançamento', 'Revisar']);
    expect(JSON.stringify(proximos)).not.toMatch(/R\$|valor/i);
    // Hoje e depois da janela ficam de fora.
    await repositorios.titulo.atualizar(titulo!.id, { vencimento: HOJE });
    await repositorios.ativo_digital.atualizar(dominio!.id, { vencimento: '2026-11-14' });
    expect((await resumo()).proximos.map((evento) => evento.dia)).toEqual(['2026-11-12']);
  });

  it('mensal automática não aparece como renovação, como nos alertas', async () => {
    const [ferramenta] = await repositorios.ferramenta.listar();
    await repositorios.ferramenta.atualizar(ferramenta!.id, { situacao: 'ativa', responsavel_financeiro_id: ID_BRUNA });
    const [assinatura] = await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta!.id } });
    await repositorios.assinatura_ferramenta.atualizar(assinatura!.id, { situacao: 'ativa', modalidade: 'paga', periodicidade: 'mensal', renovacao: 'automatica', proxima_cobranca: '2026-11-12', fim_teste: null });
    expect((await resumo()).proximos.filter((evento) => evento.titulo.startsWith('Renovação'))).toEqual([]);
  });

  it('quem não tem nada, tem um resumo vazio', async () => {
    const { atrasadas, paraHoje, aguardando, assunto } = await carregarResumoDiario(ID_KIMBERLY, 'Kimberly Grebe', '2030-01-01');
    expect(paraHoje.total).toBe(0);
    expect(aguardando.total).toBe(0);
    expect(assunto).toContain(`${atrasadas.total}`);
  });
});
