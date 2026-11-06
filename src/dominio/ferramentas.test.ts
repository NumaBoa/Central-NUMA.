import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_URBANA, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { parDoVinculo } from '@/dados/tipos/apoio';
import type { AssinaturaFerramenta, Ferramenta } from '@/dados/tipos/ferramenta';
import { CATEGORIAS_DE_FERRAMENTA_INICIAIS, EXEMPLOS_INICIAIS, FERRAMENTAS_INICIAIS, REGISTROS_INICIAIS } from './apoio-testes';
import { estaAberta } from './atividades';
import { buscarNaCentral } from './busca';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { arquivarContraparte } from './contrapartes';
import { limparExemplos, resumoDosDados } from './dados';
import {
  adicionarLinkDaFerramenta,
  arquivarFerramenta,
  cancelarFerramenta,
  carregarFerramentas,
  carregarFichaDaFerramenta,
  cobrancasPrevistas,
  conferirFerramenta,
  criarFerramenta,
  definirRateio,
  equivalenteMensalBrl,
  erroDoRateio,
  esquemaDadosPessoais,
  esquemaFormularioFerramenta,
  ferramentasDaContraparte,
  ferramentasDoProduto,
  filtrarFerramentas,
  FILTROS_FERRAMENTAS_INICIAIS,
  formularioDaFerramenta,
  formularioDosDadosPessoais,
  formularioFerramentaVazio,
  indicadoresDeFerramentas,
  linksDaFerramenta,
  mudarResponsavelTecnica,
  parteDoContexto,
  responsaveisPadrao,
  removerLinkDaFerramenta,
  restaurarFerramenta,
  salvarDadosPessoais,
  salvarFerramenta,
  situacaoParaModalidade,
  atualizarSituacoesDasFerramentas,
  ultimoCambio,
  valorMudou,
  vincularFerramentasAProduto,
  vinculosDaFerramenta,
  type FormularioFerramenta,
  type LinhaDaFerramenta,
} from './ferramentas';
import { historicoDaFerramenta } from './historico';
import { vinculosDaPessoa } from './pessoas';
import { arquivarProduto } from './produtos';
import { executarRotinas } from './rotinas';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc123/view';

const categoriaFinanceira = (nome: string) => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === nome)!.id;

function novaGratuita(alteracoes: Partial<FormularioFerramenta> = {}): FormularioFerramenta {
  return {
    ...formularioFerramentaVazio(ID_KIMBERLY, ID_CONSOLIDADA, { tecnica: ID_CAMILA, financeira: ID_KIMBERLY }),
    nome: 'Ferramenta Teste',
    categoria_id: 'categoria',
    finalidade: 'Testar',
    contextos: [ID_INSTITUCIONAL],
    modalidade: 'gratuita',
    ...alteracoes,
  };
}

function novaPaga(alteracoes: Partial<FormularioFerramenta> = {}): FormularioFerramenta {
  return novaGratuita({
    modalidade: 'paga',
    plano: 'Pro',
    valor: '50,00',
    periodicidade: 'mensal',
    proxima_cobranca: '2026-11-20',
    renovacao: 'automatica',
    conta_financeira_id: ID_CONTA_KIMBERLY,
    categoria_financeira_id: categoriaFinanceira('IA'),
    ...alteracoes,
  });
}

const problemas = (formulario: FormularioFerramenta) => {
  const resultado = esquemaFormularioFerramenta.safeParse(formulario);
  return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join('.'), problema.message]));
};

const ferramentaPorNome = async (nome: string) => (await repositorios.ferramenta.listar({ incluirArquivados: true })).find((ferramenta) => ferramenta.nome === nome)!;
const linhaPorNome = async (nome: string) => (await carregarFerramentas()).ferramentas.find((ferramenta) => ferramenta.nome === nome)!;
const ativa = async (id: string) => (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: id, situacao: 'ativa' } }))[0] ?? null;

async function formularioSalvo(nome: string): Promise<FormularioFerramenta> {
  const linha = await linhaPorNome(nome);
  return formularioDaFerramenta(linha, linha.contextos, linha.assinatura);
}

const filtrar = async (filtros: Partial<typeof FILTROS_FERRAMENTAS_INICIAIS> = {}, contextoGlobalId: string = ID_CONSOLIDADA) => {
  const dados = await carregarFerramentas();
  const nomeDaCategoria = (id: string) => dados.categorias.find((categoria) => categoria.id === id)?.nome ?? '';
  return filtrarFerramentas(dados.ferramentas, { ...FILTROS_FERRAMENTAS_INICIAIS, ...filtros }, { contextoGlobalId, hoje: HOJE, nomeDaCategoria }).map((ferramenta) => ferramenta.nome);
};

describe('T04.01 a T04.03: ferramentas', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('carga', () => {
    it('traz as ferramentas de exemplo e as categorias, que são reais', async () => {
      expect(await repositorios.ferramenta.listar()).toHaveLength(FERRAMENTAS_INICIAIS);
      const categorias = await repositorios.categoria_ferramenta.listar();
      expect(categorias).toHaveLength(CATEGORIAS_DE_FERRAMENTA_INICIAIS);
      expect(categorias.every((categoria) => !categoria.exemplo)).toBe(true);
      expect((await repositorios.ferramenta.listar()).every((ferramenta) => ferramenta.exemplo)).toBe(true);
    });

    it('a contagem inclui ferramentas e categorias, mas não as ligações', async () => {
      const resumo = await resumoDosDados();
      expect(resumo.registros).toBe(REGISTROS_INICIAIS);
      expect(resumo.exemplos).toBe(EXEMPLOS_INICIAIS);
    });

    it('sugere crítica nas categorias da especificação', async () => {
      const categorias = await repositorios.categoria_ferramenta.listar();
      const criticas = categorias.filter((categoria) => categoria.critica_sugerida).map((categoria) => categoria.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      expect(criticas).toEqual(['Armazenamento (Drive)', 'Banco de dados', 'Domínio e DNS', 'E-mail e produtividade', 'Hospedagem e nuvem', 'Lojas de aplicativos', 'Repositório e CI']);
    });

    it('a categoria financeira sugerida existe na árvore, e só Jurídico/contábil fica sem', async () => {
      const categorias = await repositorios.categoria_ferramenta.listar();
      const semSugestao = categorias.filter((categoria) => !categoria.categoria_financeira_id).map((categoria) => categoria.nome);
      expect(semSugestao).toEqual(['Jurídico/contábil']);
      const ids = new Set(CATEGORIAS_INICIAIS.map((categoria) => categoria.id));
      expect(categorias.every((categoria) => !categoria.categoria_financeira_id || ids.has(categoria.categoria_financeira_id))).toBe(true);
    });

    it('migra quem veio da versão anterior, com exemplos', async () => {
      for (const tabela of ['categoria_ferramenta', 'ferramenta', 'ferramenta_contexto', 'assinatura_ferramenta', 'assinatura_valor_historico']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 10 });
      garantirCarga();
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      expect(await repositorios.ferramenta.listar()).toHaveLength(FERRAMENTAS_INICIAIS);
      expect(await repositorios.categoria_ferramenta.listar()).toHaveLength(CATEGORIAS_DE_FERRAMENTA_INICIAIS);
    });

    it('quem já limpou os exemplos não recebe ferramentas fictícias, mas recebe as categorias', async () => {
      await limparExemplos();
      for (const tabela of ['categoria_ferramenta', 'ferramenta', 'ferramenta_contexto', 'assinatura_ferramenta', 'assinatura_valor_historico']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 10 });
      garantirCarga();
      expect(await repositorios.ferramenta.listar()).toEqual([]);
      expect(await repositorios.categoria_ferramenta.listar()).toHaveLength(CATEGORIAS_DE_FERRAMENTA_INICIAIS);
    });

    it('migrar não mexe em quem já tem ferramenta', async () => {
      const criada = await criarFerramenta(novaGratuita({ nome: 'Minha' }));
      gravarMeta({ versao_dados: 10 });
      garantirCarga();
      expect(await repositorios.ferramenta.obter(criada.id)).not.toBeNull();
    });
  });

  describe('RN-04.07 e RN-04.08: equivalente mensal', () => {
    const cambios = [
      { moeda: 'USD', valor_brl: 5, data_referencia: '2026-10-31' },
      { moeda: 'USD', valor_brl: 5.5, data_referencia: '2026-11-01' },
      { moeda: 'EUR', valor_brl: 6, data_referencia: '2026-11-01' },
    ];
    const assinatura = (alteracoes: Partial<AssinaturaFerramenta>) => ({ modalidade: 'paga' as const, valor: 120, moeda: 'BRL', periodicidade: 'mensal' as const, ...alteracoes });

    it('usa o câmbio mais recente da moeda', () => {
      expect(ultimoCambio('USD', cambios)).toBe(5.5);
      expect(ultimoCambio('JPY', cambios)).toBeNull();
    });

    it('mensal em reais vale o próprio valor', () => {
      expect(equivalenteMensalBrl(assinatura({}), [])).toBe(120);
    });

    it('anual, semestral e trimestral são divididos, mas a obrigação segue como está', () => {
      expect(equivalenteMensalBrl(assinatura({ periodicidade: 'anual' }), [])).toBe(10);
      expect(equivalenteMensalBrl(assinatura({ periodicidade: 'semestral' }), [])).toBe(20);
      expect(equivalenteMensalBrl(assinatura({ periodicidade: 'trimestral' }), [])).toBe(40);
    });

    it('moeda estrangeira passa pelo câmbio', () => {
      expect(equivalenteMensalBrl(assinatura({ valor: 20, moeda: 'USD' }), cambios)).toBe(110);
    });

    it('sem câmbio, sem valor, por uso, gratuita ou teste: não dá para saber', () => {
      expect(equivalenteMensalBrl(assinatura({ moeda: 'JPY' }), cambios)).toBeNull();
      expect(equivalenteMensalBrl(assinatura({ valor: null }), cambios)).toBeNull();
      expect(equivalenteMensalBrl(assinatura({ periodicidade: 'por_uso' }), cambios)).toBeNull();
      expect(equivalenteMensalBrl(assinatura({ modalidade: 'gratuita' }), cambios)).toBeNull();
      expect(equivalenteMensalBrl(assinatura({ modalidade: 'teste' }), cambios)).toBeNull();
    });
  });

  describe('RN-04.02 e RN-04.03: cobranças previstas', () => {
    const paga = { modalidade: 'paga' as const, valor: 50, periodicidade: 'mensal' as const, proxima_cobranca: '2026-11-20', gerar_titulos: true };

    it('CA-04.03: gratuita não tem cobrança, nem de valor zero', () => {
      expect(cobrancasPrevistas({ ...paga, modalidade: 'gratuita', valor: null }, HOJE)).toEqual([]);
    });

    it('mensal: até 3 meses à frente', () => {
      expect(cobrancasPrevistas(paga, HOJE)).toEqual(['2026-11-20', '2026-12-20', '2027-01-20']);
    });

    it('anual, semestral e trimestral: só a próxima', () => {
      expect(cobrancasPrevistas({ ...paga, periodicidade: 'anual' }, HOJE)).toEqual(['2026-11-20']);
      expect(cobrancasPrevistas({ ...paga, periodicidade: 'semestral' }, HOJE)).toEqual(['2026-11-20']);
      expect(cobrancasPrevistas({ ...paga, periodicidade: 'trimestral' }, HOJE)).toEqual(['2026-11-20']);
    });

    it('com a geração desligada, ou sem data, não prevê nada', () => {
      expect(cobrancasPrevistas({ ...paga, gerar_titulos: false }, HOJE)).toEqual([]);
      expect(cobrancasPrevistas({ ...paga, proxima_cobranca: null }, HOJE)).toEqual([]);
    });

    it('dia 31 respeita os meses mais curtos, sem perder o dia', () => {
      expect(cobrancasPrevistas({ ...paga, proxima_cobranca: '2026-12-31' }, '2026-12-01')).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
    });

    it('cobrança mais longe que 3 meses ainda aparece, uma vez', () => {
      expect(cobrancasPrevistas({ ...paga, proxima_cobranca: '2027-06-01' }, HOJE)).toEqual(['2027-06-01']);
    });

    it('prever de novo dá a mesma lista: é o que impede duplicar títulos (CA-04.04)', () => {
      expect(cobrancasPrevistas(paga, HOJE)).toEqual(cobrancasPrevistas(paga, HOJE));
    });
  });

  describe('T04.03: formulário', () => {
    it('gratuita só precisa do básico', () => {
      expect(problemas(novaGratuita())).toEqual({});
    });

    it('o custo pode ficar para depois: cada etapa é salvável', () => {
      expect(problemas(novaGratuita({ modalidade: '' }))).toEqual({});
    });

    it('nome, categoria, finalidade, contexto e técnica são obrigatórios', () => {
      expect(problemas(novaGratuita({ nome: ' ', categoria_id: '', finalidade: '', contextos: [], responsavel_tecnico_id: '' }))).toMatchObject({
        nome: 'Informe o nome.',
        categoria_id: 'Escolha a categoria.',
        finalidade: 'Diga para que usamos.',
        contextos: 'Escolha ao menos um: a Numa ou um produto.',
        responsavel_tecnico_id: 'Escolha a responsável técnica.',
      });
    });

    it('endereço precisa ser completo', () => {
      expect(problemas(novaGratuita({ url_acesso: 'exemplo.com', url_admin: 'ftp://exemplo.com' }))).toEqual({ url_acesso: 'Use um endereço completo, com https://.', url_admin: 'Use um endereço completo, com https://.' });
      expect(problemas(novaGratuita({ url_acesso: 'https://exemplo.com' }))).toEqual({});
    });

    it('titular pessoa física precisa da sócia; terceiro, do nome; desejado é obrigatório', () => {
      expect(problemas(novaGratuita({ titular_atual_pessoa_id: '' })).titular_atual_pessoa_id).toBe('Diga de qual sócia é a conta.');
      expect(problemas(novaGratuita({ titular_atual_tipo: 'terceiro' })).titular_atual_texto).toBe('Diga de quem é a conta.');
      expect(problemas(novaGratuita({ titular_desejado: '' })).titular_desejado).toBe('Diga em nome de quem a conta deveria estar.');
    });

    it('o padrão é pessoa física de quem cadastra, com a Numa como desejado (RN-04.14)', () => {
      const vazio = formularioFerramentaVazio(ID_KIMBERLY, ID_PRODUTO_KIPI, { tecnica: ID_CAMILA, financeira: ID_KIMBERLY });
      expect(vazio).toMatchObject({ titular_atual_tipo: 'pessoa_fisica', titular_atual_pessoa_id: ID_KIMBERLY, titular_desejado: 'Numa', contextos: [ID_PRODUTO_KIPI], gerar_titulos: true });
    });

    it('no contexto Consolidada, o contexto começa vazio', () => {
      expect(formularioFerramentaVazio(ID_KIMBERLY, ID_CONSOLIDADA, { tecnica: '', financeira: '' }).contextos).toEqual([]);
    });

    it('paga exige plano, periodicidade, cobrança, renovação, conta, categoria e financeira', () => {
      expect(problemas(novaPaga({ plano: '', periodicidade: '', proxima_cobranca: '', renovacao: '', conta_financeira_id: '', categoria_financeira_id: '', responsavel_financeiro_id: '' }))).toEqual({
        plano: 'Informe o plano.',
        periodicidade: 'Escolha a periodicidade.',
        proxima_cobranca: 'Informe a próxima cobrança.',
        renovacao: 'Escolha a renovação.',
        conta_financeira_id: 'Escolha a conta de pagamento.',
        categoria_financeira_id: 'Escolha a categoria financeira.',
        responsavel_financeiro_id: 'Paga precisa de responsável financeira.',
      });
    });

    it('paga aceita valor vazio, "a confirmar", mas não valor inválido', () => {
      expect(problemas(novaPaga({ valor: '' }))).toEqual({});
      expect(problemas(novaPaga({ valor: 'abc' })).valor).toBe('Use só números, como 0,00.');
    });

    it('por uso não pede data nem renovação', () => {
      expect(problemas(novaPaga({ periodicidade: 'por_uso', proxima_cobranca: '', renovacao: '' }))).toEqual({});
    });

    it('RN-04.09: teste exige a data de fim, e a situação acompanha', () => {
      expect(problemas(novaGratuita({ modalidade: 'teste', situacao: 'teste', plano: 'Avaliação' })).fim_teste).toBe('Informe quando o teste acaba.');
      expect(problemas(novaGratuita({ situacao: 'teste' })).modalidade).toBe('Em teste, a modalidade é Teste, com a data de fim.');
      expect(problemas(novaGratuita({ modalidade: 'teste', situacao: 'ativa', plano: 'Avaliação', fim_teste: '2026-12-01' })).situacao).toContain('Esta assinatura está em teste');
      expect(problemas(novaGratuita({ modalidade: 'teste', situacao: 'teste', plano: 'Avaliação', fim_teste: '2026-12-01' }))).toEqual({});
    });

    it('a situação acompanha a modalidade', () => {
      expect(situacaoParaModalidade('ativa', 'teste')).toBe('teste');
      expect(situacaoParaModalidade('avaliacao', 'teste')).toBe('teste');
      expect(situacaoParaModalidade('teste_expirado', 'teste')).toBe('teste_expirado');
      expect(situacaoParaModalidade('teste', 'paga')).toBe('ativa');
      expect(situacaoParaModalidade('teste_expirado', 'gratuita')).toBe('ativa');
      expect(situacaoParaModalidade('avaliacao', 'paga')).toBe('avaliacao');
      expect(situacaoParaModalidade('teste', '')).toBe('teste');
    });

    it('avisos e licenças precisam de número inteiro', () => {
      expect(problemas(novaPaga({ aviso_cancelamento_dias: '1,5', licencas: 'duas' }))).toEqual({ aviso_cancelamento_dias: 'Use um número inteiro de dias.', licencas: 'Use um número inteiro.' });
    });

    it('os padrões vêm das responsáveis de Tecnologia e Financeiro', async () => {
      const dados = await carregarFerramentas();
      const { tecnica, financeira } = responsaveisPadrao(dados.areas, dados.pessoas);
      expect(tecnica).toBe(ID_CAMILA);
      expect(financeira).toBe(ID_KIMBERLY);
    });

    it('quem não pode ser escolhida não vira padrão', async () => {
      const dados = await carregarFerramentas();
      const semCamila = dados.pessoas.map((pessoa) => (pessoa.id === ID_CAMILA ? { ...pessoa, situacao: 'inativa' as const } : pessoa));
      expect(responsaveisPadrao(dados.areas, semCamila).tecnica).toBe('');
    });
  });

  describe('T04.03: conferência antes de gravar', () => {
    const existentes = [
      { id: 'a', nome: 'Nuvem Clara Hosting', arquivado_em: null, situacao: 'ativa' as const },
      { id: 'b', nome: 'Antiga', arquivado_em: '2026-01-01T00:00:00.000Z', situacao: 'ativa' as const },
      { id: 'c', nome: 'Cancelada', arquivado_em: null, situacao: 'cancelada' as const },
    ];

    it('nome igual ao de outra ativa barra, sem olhar maiúsculas e acentos', () => {
      expect(conferirFerramenta(novaGratuita({ nome: 'NUVEM clara hosting' }), existentes).nomeRepetido).toBe(true);
    });

    it('a própria não conta como repetida', () => {
      expect(conferirFerramenta(novaGratuita({ nome: 'Nuvem Clara Hosting' }), existentes, 'a').nomeRepetido).toBe(false);
    });

    it('arquivada e cancelada não seguram o nome', () => {
      expect(conferirFerramenta(novaGratuita({ nome: 'Antiga' }), existentes).nomeRepetido).toBe(false);
      expect(conferirFerramenta(novaGratuita({ nome: 'Cancelada' }), existentes).nomeRepetido).toBe(false);
    });

    it('nome parecido só avisa', () => {
      const { nomeRepetido, avisos } = conferirFerramenta(novaGratuita({ nome: 'Nuvem Clara Hostin' }), existentes);
      expect(nomeRepetido).toBe(false);
      expect(avisos).toContain('Já existe uma ferramenta com nome parecido: Nuvem Clara Hosting.');
    });

    it('crítica sem segunda etapa avisa', () => {
      expect(conferirFerramenta(novaGratuita({ critica: true, mfa_conta: 'nao' }), []).avisos).toContain('Esta ferramenta é crítica, e a conta está sem segunda etapa.');
      expect(conferirFerramenta(novaGratuita({ critica: false, mfa_conta: 'nao' }), []).avisos).toEqual([]);
      expect(conferirFerramenta(novaGratuita({ critica: true, mfa_conta: 'desconhecido' }), []).avisos).toEqual([]);
    });

    it('paga sem valor avisa que fica de fora do custo', () => {
      expect(conferirFerramenta(novaPaga({ valor: '' }), []).avisos).toContain('Sem valor, ela fica de fora do custo mensal, como “a confirmar”.');
    });

    it('CA-04.05: "senha: abc123" nas observações avisa e pede confirmação', () => {
      expect(conferirFerramenta(novaGratuita({ observacoes: 'senha: abc123' }), []).avisos.join(' ')).toContain('senha');
    });

    it('referência ao cofre comum não avisa', () => {
      expect(conferirFerramenta(novaGratuita({ referencia_cofre: 'Bitwarden › Numa › Supabase' }), []).avisos).toEqual([]);
    });
  });

  describe('gravar', () => {
    it('cria a ferramenta com código, contextos e assinatura ativa', async () => {
      const ferramenta = await criarFerramenta(novaPaga({ contextos: [ID_PRODUTO_KIPI, ID_INSTITUCIONAL] }), HOJE);
      expect(ferramenta.codigo).toMatch(/^FER-2026-\d{4}$/);
      expect(ferramenta.exemplo).toBe(false);
      const contextos = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      expect(contextos.map((ligacao) => ligacao.produto_id).sort()).toEqual([ID_PRODUTO_KIPI, null].sort());
      expect(await ativa(ferramenta.id)).toMatchObject({ modalidade: 'paga', valor: 50, moeda: 'BRL', dia_cobranca: 20, inicio: HOJE, situacao: 'ativa', gerar_titulos: true });
    });

    it('sem modalidade, não cria assinatura: o custo fica a definir', async () => {
      const ferramenta = await criarFerramenta(novaGratuita({ modalidade: '' }));
      expect(await ativa(ferramenta.id)).toBeNull();
      expect((await linhaPorNome('Ferramenta Teste')).assinatura).toBeNull();
    });

    it('CA-04.03: gratuita não guarda valor nem gera títulos, mesmo com o formulário preenchido', async () => {
      const ferramenta = await criarFerramenta(novaGratuita({ valor: '99,00', periodicidade: 'mensal', proxima_cobranca: '2026-12-01', gerar_titulos: true }));
      expect(await ativa(ferramenta.id)).toMatchObject({ modalidade: 'gratuita', valor: null, periodicidade: null, proxima_cobranca: null, gerar_titulos: false });
    });

    it('conta de login, cofre e recuperação são gravados como texto, sem senha', async () => {
      const ferramenta = await criarFerramenta(novaGratuita({ email_login_conta: 'numa@exemplo.com', referencia_cofre: 'Bitwarden › Numa › Teste', caminho_recuperacao: 'Pedir ao suporte', mfa_conta: 'sim' }));
      expect(ferramenta).toMatchObject({ email_login_conta: 'numa@exemplo.com', referencia_cofre: 'Bitwarden › Numa › Teste', caminho_recuperacao: 'Pedir ao suporte', mfa_conta: 'sim' });
    });

    it('só o titular do tipo escolhido é guardado', async () => {
      const ferramenta = await criarFerramenta(novaGratuita({ titular_atual_tipo: 'numa', titular_atual_pessoa_id: ID_KIMBERLY, titular_atual_texto: 'sobra' }));
      expect(ferramenta).toMatchObject({ titular_atual_tipo: 'numa', titular_atual_pessoa_id: null, titular_atual_texto: null });
    });

    it('salvar e ler de novo dá o mesmo formulário', async () => {
      const original = novaPaga({ nome: 'Ida e volta', licencas: '3', aviso_cancelamento_dias: '7', valor: '1.234,50', moeda: 'USD' });
      await criarFerramenta(original, HOJE);
      expect(await formularioSalvo('Ida e volta')).toEqual({ ...original, valor: '1.234,50' });
    });

    it('editar muda o cadastro e mantém a mesma assinatura', async () => {
      const ferramenta = await criarFerramenta(novaPaga(), HOJE);
      const assinatura = await ativa(ferramenta.id);
      await salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Ferramenta Teste')), finalidade: 'Outra', plano: 'Max' }, { hoje: HOJE });
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.finalidade).toBe('Outra');
      expect(await ativa(ferramenta.id)).toMatchObject({ id: assinatura!.id, plano: 'Max' });
    });

    it('quem tinha o custo a definir ganha a assinatura ao preencher', async () => {
      const ferramenta = await criarFerramenta(novaGratuita({ modalidade: '' }));
      await salvarFerramenta(ferramenta.id, novaPaga(), { hoje: HOJE });
      expect(await ativa(ferramenta.id)).toMatchObject({ modalidade: 'paga', valor: 50 });
    });

    it('mudar os contextos desfaz o rateio, porque a soma muda (RN-04.05)', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      const formulario = await formularioSalvo('Nuvem Clara Hosting');
      await salvarFerramenta(ferramenta.id, { ...formulario, contextos: [...formulario.contextos, ID_PRODUTO_URBANA] }, { hoje: HOJE });
      const ligacoes = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      expect(ligacoes).toHaveLength(3);
      expect(ligacoes.every((ligacao) => ligacao.percentual_rateio === null)).toBe(true);
    });

    it('sem mudar os contextos, o rateio fica', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      await salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Nuvem Clara Hosting')), finalidade: 'Outra' }, { hoje: HOJE });
      const ligacoes = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      expect(ligacoes.map((ligacao) => ligacao.percentual_rateio).sort()).toEqual([40, 60]);
    });

    it('uma falha no meio não deixa nada pela metade', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      const formulario = await formularioSalvo('Nuvem Clara Hosting');
      await expect(salvarFerramenta(ferramenta.id, { ...formulario, finalidade: 'Nunca', valor: '99,00' }, { hoje: HOJE })).rejects.toThrow('Informe o motivo da mudança de valor.');
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.finalidade).toBe('Hospedar os apps Kipi e Zupi');
    });
  });

  describe('RN-04.17: reajuste', () => {
    it('só pede motivo quando uma assinatura em uso muda de valor', async () => {
      const assinatura = { modalidade: 'paga', valor: 20 } as AssinaturaFerramenta;
      expect(valorMudou({ modalidade: 'paga', valor: '25,00' }, assinatura)).toBe(true);
      expect(valorMudou({ modalidade: 'paga', valor: '20,00' }, assinatura)).toBe(false);
      expect(valorMudou({ modalidade: 'paga', valor: '25,00' }, { ...assinatura, valor: null })).toBe(false);
      expect(valorMudou({ modalidade: 'paga', valor: '25,00' }, null)).toBe(false);
      expect(valorMudou({ modalidade: 'gratuita', valor: '' }, assinatura)).toBe(false);
      expect(valorMudou({ modalidade: 'paga', valor: '' }, assinatura)).toBe(false);
    });

    it('guarda o valor anterior, o novo, a data e o motivo', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      const antes = await ativa(ferramenta.id);
      await salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Traço Editor')), valor: '99,90' }, { motivoDoValor: 'Reajuste anual', hoje: HOJE });
      expect(await ativa(ferramenta.id)).toMatchObject({ id: antes!.id, valor: 99.9 });
      const { valores } = await carregarFichaDaFerramenta(ferramenta.id);
      expect(valores).toEqual([expect.objectContaining({ valor_anterior: 89.9, valor_novo: 99.9, moeda: 'BRL', efeito_em: HOJE, motivo: 'Reajuste anual' })]);
    });

    it('sem motivo, não salva', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      await expect(salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Traço Editor')), valor: '99,90' }, { motivoDoValor: '  ', hoje: HOJE })).rejects.toThrow('Informe o motivo');
      expect((await ativa(ferramenta.id))?.valor).toBe(89.9);
    });

    it('informar o valor que estava a confirmar não é reajuste', async () => {
      const ferramenta = await ferramentaPorNome('Quadro Fácil');
      await salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Quadro Fácil')), valor: '30,00' }, { hoje: HOJE });
      expect((await ativa(ferramenta.id))?.valor).toBe(30);
      expect((await carregarFichaDaFerramenta(ferramenta.id)).valores).toEqual([]);
    });

    it('trocar de moeda, sem trocar de plano, é barrado: o histórico guarda uma moeda só', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      await expect(salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Traço Editor')), moeda: 'USD' }, { hoje: HOJE })).rejects.toThrow('Para trocar a moeda, use Trocar plano.');
    });
  });

  describe('Trocar plano', () => {
    it('encerra a atual, cria a nova e guarda a anterior', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      const antes = await ativa(ferramenta.id);
      await salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Traço Editor')), plano: 'Empresa', valor: '150,00', moeda: 'USD' }, { trocarPlano: true, hoje: '2026-11-10' });
      const depois = await ativa(ferramenta.id);
      expect(depois).toMatchObject({ plano: 'Empresa', valor: 150, moeda: 'USD', inicio: '2026-11-10' });
      expect(depois?.id).not.toBe(antes?.id);
      expect(await repositorios.assinatura_ferramenta.obter(antes!.id)).toMatchObject({ situacao: 'encerrada', fim: '2026-11-10', plano: 'Equipe', valor: 89.9 });
    });

    it('só uma assinatura ativa por vez', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      await salvarFerramenta(ferramenta.id, await formularioSalvo('Traço Editor'), { trocarPlano: true, hoje: HOJE });
      await salvarFerramenta(ferramenta.id, await formularioSalvo('Traço Editor'), { trocarPlano: true, hoje: HOJE });
      expect(await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id, situacao: 'ativa' } })).toHaveLength(1);
      expect(await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } })).toHaveLength(3);
    });

    it('sem modalidade, não troca', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      await expect(salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Traço Editor')), modalidade: '' }, { trocarPlano: true, hoje: HOJE })).rejects.toThrow('Escolha a modalidade do novo plano.');
    });

    it('editar para outra modalidade também encerra a atual e guarda o que havia', async () => {
      const ferramenta = await ferramentaPorNome('Repositório Aberto');
      const antes = await ativa(ferramenta.id);
      await salvarFerramenta(ferramenta.id, { ...novaPaga(), nome: 'Repositório Aberto', categoria_id: ferramenta.categoria_id }, { hoje: HOJE });
      expect(await ativa(ferramenta.id)).toMatchObject({ modalidade: 'paga' });
      expect(await repositorios.assinatura_ferramenta.obter(antes!.id)).toMatchObject({ situacao: 'encerrada', modalidade: 'gratuita' });
    });
  });

  describe('RN-04.09: teste', () => {
    it('sem decisão, vira "Teste expirado" no dia seguinte ao fim', async () => {
      const ferramenta = await ferramentaPorNome('Luma IA');
      const fim = (await ativa(ferramenta.id))!.fim_teste!;
      await atualizarSituacoesDasFerramentas(fim);
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.situacao).toBe('teste');
      const depois = new Date(`${fim}T00:00:00Z`);
      depois.setUTCDate(depois.getUTCDate() + 1);
      await atualizarSituacoesDasFerramentas(depois.toISOString().slice(0, 10));
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.situacao).toBe('teste_expirado');
    });

    it('a rotina do dia atualiza as situações', async () => {
      const ferramenta = await ferramentaPorNome('Luma IA');
      await repositorios.assinatura_ferramenta.atualizar((await ativa(ferramenta.id))!.id, { fim_teste: '2026-11-01' });
      gravarMeta({ ultima_rotina_em: null });
      await executarRotinas();
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.situacao).toBe('teste_expirado');
    });

    it('rodar de novo não muda nada', async () => {
      await atualizarSituacoesDasFerramentas('2027-01-01');
      expect(await atualizarSituacoesDasFerramentas('2027-01-01')).toBe(0);
    });

    it('assinar decide o teste: a ferramenta fica ativa', async () => {
      const ferramenta = await ferramentaPorNome('Luma IA');
      await atualizarSituacoesDasFerramentas('2027-01-01');
      const expirada = await formularioSalvo('Luma IA');
      expect(expirada.situacao).toBe('teste_expirado');
      await salvarFerramenta(ferramenta.id, { ...novaPaga(), ...{ nome: expirada.nome, categoria_id: expirada.categoria_id, finalidade: expirada.finalidade, contextos: expirada.contextos, situacao: expirada.situacao } }, { trocarPlano: true, hoje: '2027-01-02' });
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.situacao).toBe('ativa');
      expect(await ativa(ferramenta.id)).toMatchObject({ modalidade: 'paga' });
    });

    it('estender o teste volta para "Teste"', async () => {
      const ferramenta = await ferramentaPorNome('Luma IA');
      await atualizarSituacoesDasFerramentas('2027-01-01');
      await salvarFerramenta(ferramenta.id, { ...(await formularioSalvo('Luma IA')), fim_teste: '2027-02-01' }, { hoje: '2027-01-02' });
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.situacao).toBe('teste');
    });

    it('cobrança automática que passou anda para a próxima, e a manual fica', async () => {
      const automatica = await ferramentaPorNome('Traço Editor');
      const manual = await ferramentaPorNome('Estúdio Verde Registro');
      await repositorios.assinatura_ferramenta.atualizar((await ativa(automatica.id))!.id, { proxima_cobranca: '2026-10-31', dia_cobranca: 31 });
      await repositorios.assinatura_ferramenta.atualizar((await ativa(manual.id))!.id, { proxima_cobranca: '2026-10-31' });
      await atualizarSituacoesDasFerramentas('2026-11-15');
      expect((await ativa(automatica.id))?.proxima_cobranca).toBe('2026-11-30');
      expect((await ativa(manual.id))?.proxima_cobranca).toBe('2026-10-31');
      await atualizarSituacoesDasFerramentas('2026-12-05');
      expect((await ativa(automatica.id))?.proxima_cobranca).toBe('2026-12-31');
    });
  });

  describe('RN-04.10: cancelar', () => {
    it('exige data e motivo', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      await expect(cancelarFerramenta(ferramenta.id, { data: '', motivo: 'Não usamos' })).rejects.toThrow('Informe a data efetiva do cancelamento.');
      await expect(cancelarFerramenta(ferramenta.id, { data: HOJE, motivo: ' ' })).rejects.toThrow('Informe o motivo do cancelamento.');
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.situacao).toBe('ativa');
    });

    it('encerra a assinatura, e guarda a anterior e o motivo', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      const assinatura = await ativa(ferramenta.id);
      await cancelarFerramenta(ferramenta.id, { data: '2026-11-30', motivo: 'Não usamos mais' });
      expect(await repositorios.ferramenta.obter(ferramenta.id)).toMatchObject({ situacao: 'cancelada', cancelada_em: '2026-11-30', cancelamento_motivo: 'Não usamos mais' });
      expect(await repositorios.assinatura_ferramenta.obter(assinatura!.id)).toMatchObject({ situacao: 'encerrada', fim: '2026-11-30' });
      expect(await ativa(ferramenta.id)).toBeNull();
    });

    it('cancelada sai dos indicadores e libera o nome', async () => {
      const ferramenta = await ferramentaPorNome('Traço Editor');
      const antes = indicadoresDeFerramentas((await carregarFerramentas()).ferramentas, HOJE);
      await cancelarFerramenta(ferramenta.id, { data: HOJE, motivo: 'Não usamos mais' });
      const depois = indicadoresDeFerramentas((await carregarFerramentas()).ferramentas, HOJE);
      expect(depois.ativas).toBe(antes.ativas - 1);
      expect(depois.pagas).toBe(antes.pagas - 1);
      expect(conferirFerramenta(novaGratuita({ nome: 'Traço Editor' }), (await carregarFerramentas()).ferramentas).nomeRepetido).toBe(false);
    });

    it('cancelada deixa de segurar a responsável, a conta e o fornecedor', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      expect((await vinculosDaPessoa(ID_CAMILA)).join(' ')).toContain('Nuvem Clara Hosting');
      await cancelarFerramenta(ferramenta.id, { data: HOJE, motivo: 'Não usamos mais' });
      expect((await vinculosDaPessoa(ID_CAMILA)).join(' ')).not.toContain('Nuvem Clara Hosting');
    });
  });

  describe('arquivar', () => {
    it('sem vínculos, arquiva e restaura', async () => {
      const ferramenta = await ferramentaPorNome('Quadro Fácil');
      await arquivarFerramenta(ferramenta.id);
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.arquivado_em).not.toBeNull();
      expect(await filtrar()).not.toContain('Quadro Fácil');
      expect(await filtrar({ arquivadas: true })).toEqual(['Quadro Fácil']);
      await restaurarFerramenta(ferramenta.id);
      expect((await repositorios.ferramenta.obter(ferramenta.id))?.arquivado_em).toBeNull();
    });

    it('com atividade aberta vinculada, não arquiva e diz o motivo', async () => {
      const ferramenta = await ferramentaPorNome('Quadro Fácil');
      const atividade = (await repositorios.atividade.listar()).find(estaAberta)!;
      await repositorios.vinculo.criar(parDoVinculo({ tipo: 'atividade', id: atividade.id }, { tipo: 'ferramenta', id: ferramenta.id }));
      expect(await vinculosDaFerramenta(ferramenta.id)).toEqual(['1 atividade aberta']);
      await expect(arquivarFerramenta(ferramenta.id)).rejects.toThrow('Esta ferramenta tem 1 atividade aberta.');
    });

    it('não restaura se outra ativa já usa o nome', async () => {
      const ferramenta = await ferramentaPorNome('Quadro Fácil');
      await arquivarFerramenta(ferramenta.id);
      await criarFerramenta(novaGratuita({ nome: 'Quadro Fácil' }));
      await expect(restaurarFerramenta(ferramenta.id)).rejects.toThrow('Já existe uma ferramenta ativa com esse nome.');
    });
  });

  describe('RN-04.05: rateio', () => {
    it('soma 100, ou tudo vazio', () => {
      expect(erroDoRateio([{ percentual: '60' }, { percentual: '40' }])).toBeNull();
      expect(erroDoRateio([{ percentual: '33,33' }, { percentual: '33,33' }, { percentual: '33,34' }])).toBeNull();
      expect(erroDoRateio([{ percentual: '' }, { percentual: ' ' }])).toBeNull();
    });

    it('diz o que falta', () => {
      expect(erroDoRateio([{ percentual: '60' }, { percentual: '30' }])).toBe('A soma precisa dar 100%. Está em 90%.');
      expect(erroDoRateio([{ percentual: '60' }, { percentual: '' }])).toBe('Preencha todos os percentuais, ou deixe todos vazios.');
      expect(erroDoRateio([{ percentual: '120' }, { percentual: '-20' }])).toBe('Use percentuais de 0 a 100.');
      expect(erroDoRateio([{ percentual: 'abc' }, { percentual: '100' }])).toBe('Use percentuais de 0 a 100.');
    });

    it('grava os percentuais e a data de início', async () => {
      const ferramenta = await ferramentaPorNome('Repositório Aberto');
      const ligacoes = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      await definirRateio(ligacoes.map((ligacao, indice) => ({ ligacaoId: ligacao.id, percentual: indice === 0 ? '70' : '30' })), '2026-12-01');
      const depois = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      expect(depois.map((ligacao) => ligacao.percentual_rateio).sort()).toEqual([30, 70]);
      expect(depois.every((ligacao) => ligacao.vigente_desde === '2026-12-01')).toBe(true);
    });

    it('não grava soma errada nem sem data', async () => {
      const ligacoes = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: (await ferramentaPorNome('Repositório Aberto')).id } });
      await expect(definirRateio(ligacoes.map((ligacao) => ({ ligacaoId: ligacao.id, percentual: '10' })), HOJE)).rejects.toThrow('A soma precisa dar 100%');
      await expect(definirRateio(ligacoes.map((ligacao) => ({ ligacaoId: ligacao.id, percentual: '' })), '')).rejects.toThrow('Informe a partir de quando vale.');
    });
  });

  describe('RN-04.15: dados pessoais', () => {
    const dadosOk = { trata_dados_pessoais: true, tipos_dados: ['contato' as const], regiao_dados: 'Brasil', acordo_dados_situacao: 'termos_padrao', acordo_dados_url: '', dados_revisado_em: '' };
    const erros = (dados: typeof dadosOk) => {
      const resultado = esquemaDadosPessoais.safeParse(dados);
      return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join('.'), problema.message]));
    };

    it('quem trata precisa dizer tipos e acordo', () => {
      expect(erros({ ...dadosOk, tipos_dados: [], acordo_dados_situacao: '' })).toEqual({ tipos_dados: 'Escolha ao menos um tipo de dado.', acordo_dados_situacao: 'Diga a situação do acordo.' });
    });

    it('região é só se for conhecida', () => {
      expect(erros({ ...dadosOk, regiao_dados: '' })).toEqual({});
    });

    it('quem não trata não precisa de nada', () => {
      expect(erros({ ...dadosOk, trata_dados_pessoais: false, tipos_dados: [], acordo_dados_situacao: '' })).toEqual({});
    });

    it('os apps afetados são os produtos: sem produto, não salva', async () => {
      const ferramenta = await ferramentaPorNome('Quadro Fácil');
      await expect(salvarDadosPessoais(ferramenta.id, dadosOk)).rejects.toThrow('vincule a ferramenta a pelo menos um produto');
    });

    it('grava com produto, e deixar de tratar limpa o resto', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      await salvarDadosPessoais(ferramenta.id, dadosOk);
      expect(await repositorios.ferramenta.obter(ferramenta.id)).toMatchObject({ trata_dados_pessoais: true, tipos_dados: ['contato'], regiao_dados: 'Brasil', acordo_dados_situacao: 'termos_padrao' });
      await salvarDadosPessoais(ferramenta.id, { ...formularioDosDadosPessoais((await repositorios.ferramenta.obter(ferramenta.id)) as Ferramenta), trata_dados_pessoais: false });
      expect(await repositorios.ferramenta.obter(ferramenta.id)).toMatchObject({ trata_dados_pessoais: false, tipos_dados: [], regiao_dados: null, acordo_dados_situacao: null });
    });
  });

  describe('CA-04.01: um cadastro, vários produtos', () => {
    it('aparece uma vez na lista geral e uma vez na ficha de cada produto', async () => {
      expect((await filtrar()).filter((nome) => nome === 'Nuvem Clara Hosting')).toHaveLength(1);
      expect((await ferramentasDoProduto(ID_PRODUTO_KIPI)).filter((ferramenta) => ferramenta.nome === 'Nuvem Clara Hosting')).toHaveLength(1);
      expect((await ferramentasDoProduto(ID_PRODUTO_ZUPI)).filter((ferramenta) => ferramenta.nome === 'Nuvem Clara Hosting')).toHaveLength(1);
    });

    it('é o mesmo registro nas fichas', async () => {
      const [kipi] = (await ferramentasDoProduto(ID_PRODUTO_KIPI)).filter((ferramenta) => ferramenta.nome === 'Nuvem Clara Hosting');
      const [zupi] = await ferramentasDoProduto(ID_PRODUTO_ZUPI);
      expect(kipi?.id).toBe(zupi?.id);
    });

    it('na ficha da contraparte, as que ela fornece', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      expect((await ferramentasDaContraparte(ferramenta.fornecedor_id as string)).map((item) => item.id)).toEqual([ferramenta.id]);
    });
  });

  describe('CA-04.02: custo mensal', () => {
    const linha = (alteracoes: Partial<LinhaDaFerramenta>) => ({ situacao: 'ativa', arquivado_em: null, assinatura: { modalidade: 'paga', proxima_cobranca: null }, equivalenteMensal: 10, ...alteracoes }) as LinhaDaFerramenta;

    it('soma o equivalente em reais', () => {
      expect(indicadoresDeFerramentas([linha({}), linha({ equivalenteMensal: 5.5 })], HOJE).custoMensal).toBe(15.5);
    });

    it('quem não tem valor fica de fora e é contada', () => {
      const indicadores = indicadoresDeFerramentas([linha({}), linha({ equivalenteMensal: null })], HOJE);
      expect(indicadores.custoMensal).toBe(10);
      expect(indicadores.naoIncluidas).toBe(1);
    });

    it('moeda sem câmbio informado não soma: fica como não incluída', async () => {
      const { ferramentas } = await carregarFerramentas();
      const nuvem = ferramentas.find((ferramenta) => ferramenta.nome === 'Nuvem Clara Hosting')!;
      expect(nuvem.assinatura?.moeda).toBe('USD');
      const semCambio = equivalenteMensalBrl(nuvem.assinatura as AssinaturaFerramenta, []);
      expect(semCambio).toBeNull();
    });

    it('os exemplos: 3 pagas com valor em reais somam, e a sem valor fica de fora', async () => {
      const { ferramentas } = await carregarFerramentas();
      const indicadores = indicadoresDeFerramentas(ferramentas, HOJE);
      expect(indicadores.ativas).toBe(4);
      expect(indicadores.pagas).toBe(4);
      expect(indicadores.emTeste).toBe(1);
      expect(indicadores.naoIncluidas).toBeGreaterThanOrEqual(1);
    });

    describe('RN-04.05: no contexto de um produto', () => {
      const ligacao = (produto_id: string | null, percentual_rateio: number | null) => ({ produto_id, percentual_rateio }) as LinhaDaFerramenta['contextos'][number];

      it('a Numa consolidada vê o custo inteiro', () => {
        expect(parteDoContexto({ contextos: [ligacao(ID_PRODUTO_KIPI, 60), ligacao(ID_PRODUTO_ZUPI, 40)] })).toBe(1);
      });

      it('com rateio, cada produto vê a sua parte', () => {
        const contextos = [ligacao(ID_PRODUTO_KIPI, 60), ligacao(ID_PRODUTO_ZUPI, 40)];
        expect(parteDoContexto({ contextos }, ID_PRODUTO_KIPI)).toBe(0.6);
        expect(parteDoContexto({ contextos }, ID_PRODUTO_ZUPI)).toBe(0.4);
      });

      it('sem rateio, tudo fica com o contexto principal', () => {
        const contextos = [ligacao(null, null), ligacao(ID_PRODUTO_KIPI, null)];
        expect(parteDoContexto({ contextos }, ID_INSTITUCIONAL)).toBe(1);
        expect(parteDoContexto({ contextos }, ID_PRODUTO_KIPI)).toBe(0);
      });

      it('quem não está no contexto não entra', () => {
        expect(parteDoContexto({ contextos: [ligacao(ID_PRODUTO_KIPI, null)] }, ID_PRODUTO_ZUPI)).toBe(0);
      });

      it('o custo do indicador usa a parte do contexto', () => {
        const nuvem = linha({ equivalenteMensal: 100, contextos: [ligacao(ID_PRODUTO_KIPI, 60), ligacao(ID_PRODUTO_ZUPI, 40)] });
        expect(indicadoresDeFerramentas([nuvem], HOJE, ID_PRODUTO_ZUPI).custoMensal).toBe(40);
        expect(indicadoresDeFerramentas([nuvem], HOJE).custoMensal).toBe(100);
      });
    });

    it('arquivada e cancelada não contam', () => {
      const indicadores = indicadoresDeFerramentas([linha({ arquivado_em: '2026-01-01T00:00:00.000Z' }), linha({ situacao: 'cancelada' })], HOJE);
      expect(indicadores).toMatchObject({ ativas: 0, pagas: 0, custoMensal: 0, naoIncluidas: 0 });
    });

    it('renovações em 30 dias', () => {
      const proxima = (dia: string) => linha({ assinatura: { modalidade: 'paga', proxima_cobranca: dia } as AssinaturaFerramenta });
      expect(indicadoresDeFerramentas([proxima('2026-11-06'), proxima('2026-12-06'), proxima('2026-12-07'), proxima('2026-11-05')], HOJE).renovacoes30).toBe(2);
    });
  });

  describe('lista e filtros', () => {
    it('vem em ordem de nome', async () => {
      const nomes = await filtrar();
      expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      expect(nomes).toHaveLength(FERRAMENTAS_INICIAIS);
    });

    it('busca por nome, código, finalidade e categoria, sem acento', async () => {
      expect(await filtrar({ busca: 'traco' })).toEqual(['Traço Editor']);
      expect(await filtrar({ busca: 'hospedar os apps' })).toEqual(['Nuvem Clara Hosting']);
      expect(await filtrar({ busca: 'dominio e dns' })).toEqual(['Estúdio Verde Registro']);
      const { codigo } = await ferramentaPorNome('Luma IA');
      expect(await filtrar({ busca: codigo })).toEqual(['Luma IA']);
    });

    it('filtra por contexto, e o da tela prevalece sobre o global', async () => {
      expect(await filtrar({ contexto: ID_PRODUTO_ZUPI })).toEqual(['Nuvem Clara Hosting']);
      expect(await filtrar({}, ID_PRODUTO_URBANA)).toEqual(['Luma IA']);
      expect(await filtrar({ contexto: ID_PRODUTO_ZUPI }, ID_PRODUTO_URBANA)).toEqual(['Nuvem Clara Hosting']);
      expect(await filtrar({ contexto: ID_INSTITUCIONAL })).toEqual(['Estúdio Verde Registro', 'Quadro Fácil', 'Repositório Aberto', 'Traço Editor']);
    });

    it('filtra por situação, modalidade, crítica, titular e dados pessoais', async () => {
      expect(await filtrar({ situacao: 'teste' })).toEqual(['Luma IA']);
      expect(await filtrar({ modalidade: 'gratuita' })).toEqual(['Repositório Aberto']);
      expect(await filtrar({ critica: 'sim' })).toEqual(['Estúdio Verde Registro', 'Nuvem Clara Hosting', 'Repositório Aberto']);
      expect(await filtrar({ titular: 'numa' })).toEqual(['Repositório Aberto']);
      expect(await filtrar({ dados: 'sim' })).toEqual(['Luma IA']);
    });

    it('"A definir" acha quem ainda não tem custo', async () => {
      expect(await filtrar({ modalidade: 'a_definir' })).toEqual([]);
      await criarFerramenta(novaGratuita({ nome: 'Sem custo', modalidade: '' }));
      expect(await filtrar({ modalidade: 'a_definir' })).toEqual(['Sem custo']);
    });

    it('filtra pelo vencimento, sem contar o que já passou', async () => {
      expect(await filtrar({ venceEm: '7' })).toEqual(['Traço Editor']);
      expect(await filtrar({ venceEm: '30' })).toEqual(['Estúdio Verde Registro', 'Nuvem Clara Hosting', 'Quadro Fácil', 'Traço Editor']);
    });
  });

  describe('ações em lote', () => {
    it('vincula a um produto sem duplicar quem já tinha, e desfaz o rateio de quem ganhou', async () => {
      const nuvem = await ferramentaPorNome('Nuvem Clara Hosting');
      const traco = await ferramentaPorNome('Traço Editor');
      await vincularFerramentasAProduto([nuvem.id, traco.id], ID_PRODUTO_KIPI);
      const daNuvem = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: nuvem.id } });
      expect(daNuvem).toHaveLength(2);
      expect(daNuvem.map((ligacao) => ligacao.percentual_rateio).sort()).toEqual([40, 60]);
      expect((await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: traco.id } })).map((ligacao) => ligacao.produto_id)).toContain(ID_PRODUTO_KIPI);
      await vincularFerramentasAProduto([nuvem.id], ID_PRODUTO_URBANA);
      expect((await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: nuvem.id } })).every((ligacao) => ligacao.percentual_rateio === null)).toBe(true);
    });

    it('vincula à Numa', async () => {
      const luma = await ferramentaPorNome('Luma IA');
      await vincularFerramentasAProduto([luma.id], ID_INSTITUCIONAL);
      expect((await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: luma.id } })).map((ligacao) => ligacao.produto_id)).toContain(null);
    });

    it('muda a responsável técnica de todas', async () => {
      const ids = [(await ferramentaPorNome('Luma IA')).id, (await ferramentaPorNome('Repositório Aberto')).id];
      await mudarResponsavelTecnica(ids, ID_KIMBERLY);
      for (const id of ids) expect((await repositorios.ferramenta.obter(id))?.responsavel_tecnico_id).toBe(ID_KIMBERLY);
    });
  });

  describe('vínculos nos outros cadastros (RN-02.04)', () => {
    it('quem é responsável não sai sem passar a responsabilidade', async () => {
      expect(await vinculosDaPessoa(ID_CAMILA)).toEqual(expect.arrayContaining(['Responsável técnica de Nuvem Clara Hosting']));
      expect(await vinculosDaPessoa(ID_KIMBERLY)).toEqual(expect.arrayContaining(['Responsável financeira de Nuvem Clara Hosting']));
    });

    it('produto com ferramenta não arquiva', async () => {
      // Sem as atividades, que barrariam antes.
      armazenamento.setItem(chaveDaTabela('atividade'), '[]');
      await expect(arquivarProduto(ID_PRODUTO_ZUPI)).rejects.toThrow('1 ferramenta vinculada');
    });

    it('fornecedor de ferramenta não arquiva', async () => {
      const { fornecedor_id } = await ferramentaPorNome('Nuvem Clara Hosting');
      await expect(arquivarContraparte(fornecedor_id as string)).rejects.toThrow('Fornecedor de Nuvem Clara Hosting');
    });

    it('a conta de uma cancelada deixa de contar', async () => {
      const ferramenta = await ferramentaPorNome('Nuvem Clara Hosting');
      expect((await ativa(ferramenta.id))?.conta_financeira_id).toBe(ID_CONTA_CAMILA);
      await cancelarFerramenta(ferramenta.id, { data: HOJE, motivo: 'Não usamos mais' });
      expect(await ativa(ferramenta.id)).toBeNull();
    });
  });

  describe('Limpar exemplos', () => {
    it('leva as ferramentas fictícias e as ligações delas, e deixa as categorias', async () => {
      await limparExemplos();
      expect(await repositorios.ferramenta.listar({ incluirArquivados: true })).toEqual([]);
      expect(await repositorios.ferramenta_contexto.listar({ incluirArquivados: true })).toEqual([]);
      expect(await repositorios.assinatura_ferramenta.listar({ incluirArquivados: true })).toEqual([]);
      expect(await repositorios.categoria_ferramenta.listar()).toHaveLength(CATEGORIAS_DE_FERRAMENTA_INICIAIS);
    });

    it('ferramenta de verdade fica, sem nada de fictício', async () => {
      const { fornecedor_id } = await ferramentaPorNome('Nuvem Clara Hosting');
      const criada = await criarFerramenta(novaPaga({ nome: 'De verdade', fornecedor_id: fornecedor_id as string, conta_financeira_id: ID_CONTA_KIMBERLY }), HOJE);
      await limparExemplos();
      expect(await repositorios.ferramenta.obter(criada.id)).toMatchObject({ nome: 'De verdade', fornecedor_id: null });
      expect((await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: criada.id } })).length).toBe(1);
      expect((await ativa(criada.id))?.conta_financeira_id).toBeNull();
    });

    it('sócias continuam responsáveis pelo que era delas', async () => {
      const criada = await criarFerramenta(novaGratuita({ nome: 'De verdade' }));
      await limparExemplos();
      expect(await repositorios.ferramenta.obter(criada.id)).toMatchObject({ responsavel_tecnico_id: ID_CAMILA, responsavel_financeiro_id: ID_KIMBERLY, titular_atual_pessoa_id: ID_KIMBERLY });
    });
  });

  describe('busca global', () => {
    it('acha por nome, código e finalidade, no grupo Ferramentas', async () => {
      const grupo = async (termo: string) => (await buscarNaCentral(termo)).find((item) => item.tipo === 'ferramentas');
      expect((await grupo('nuvem clara'))?.itens[0]).toMatchObject({ titulo: 'Nuvem Clara Hosting', detalhe: 'Ativa' });
      const { codigo, id } = await ferramentaPorNome('Traço Editor');
      const achada = await grupo(codigo);
      expect(achada?.itens[0]).toMatchObject({ titulo: 'Traço Editor', href: `/ferramentas/${id}` });
      expect((await grupo('hospedar os apps'))?.itens[0]?.titulo).toBe('Nuvem Clara Hosting');
    });
  });

  describe('arquivos e histórico', () => {
    it('só aceita link do Drive, e tira quando pedem', async () => {
      const ferramenta = await ferramentaPorNome('Quadro Fácil');
      await expect(adicionarLinkDaFerramenta(ferramenta.id, 'https://exemplo.com/arquivo')).rejects.toThrow();
      await adicionarLinkDaFerramenta(ferramenta.id, DRIVE);
      const [link] = await linksDaFerramenta(ferramenta.id);
      expect(link?.url).toBe(DRIVE);
      await removerLinkDaFerramenta(link!.id);
      expect(await linksDaFerramenta(ferramenta.id)).toEqual([]);
    });

    it('o histórico conta a criação, as mudanças e o reajuste, por extenso', async () => {
      const criada = await criarFerramenta(novaPaga({ nome: 'Com histórico' }), HOJE);
      await salvarFerramenta(criada.id, { ...(await formularioSalvo('Com histórico')), finalidade: 'Outra', valor: '60,00' }, { motivoDoValor: 'Reajuste', hoje: HOJE });
      const historico = await historicoDaFerramenta(criada.id);
      const textos = historico.map((linha) => linha.texto).join(' | ');
      expect(textos).toContain('a ferramenta Com histórico');
      expect(textos).toContain('Finalidade');
      expect(textos).toContain('a assinatura de Com histórico');
      expect(textos).toContain('Valor');
    });

    it('não mostra login, cofre nem recuperação no histórico', async () => {
      const criada = await criarFerramenta(novaGratuita({ nome: 'Discreta' }));
      await salvarFerramenta(criada.id, { ...(await formularioSalvo('Discreta')), referencia_cofre: 'Cofre › segredo-do-cofre', caminho_recuperacao: 'caminho-secreto', email_login_conta: 'login-secreto@exemplo.com' }, { hoje: HOJE });
      const textos = (await historicoDaFerramenta(criada.id)).map((linha) => linha.texto).join(' | ');
      expect(textos).toContain('Referência ao cofre');
      expect(textos).not.toContain('segredo-do-cofre');
      expect(textos).not.toContain('caminho-secreto');
      expect(textos).not.toContain('login-secreto');
    });

    it('cada linha diz quem fez e quais campos mudaram, para os filtros', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      const criada = await criarFerramenta(novaGratuita({ nome: 'Filtrável' }));
      await salvarFerramenta(criada.id, { ...(await formularioSalvo('Filtrável')), finalidade: 'Outra' }, { hoje: HOJE });
      const [ultima] = await historicoDaFerramenta(criada.id);
      expect(ultima?.quem).toBe('Camila Lima');
      expect(ultima?.campos).toContain('Finalidade');
    });
  });
});
