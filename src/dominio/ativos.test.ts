import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { parDoVinculo } from '@/dados/tipos/apoio';
import { esquemaAtivoDigital } from '@/dados/tipos/ativo';
import { ATIVOS_INICIAIS } from './apoio-testes';
import { estaAberta } from './atividades';
import {
  adicionarLinkDoAtivo,
  arquivarAtivo,
  ativosDaFerramenta,
  carregarAtivos,
  conferirAtivo,
  contadoresDasAbas,
  criarAtivo,
  diasParaVencer,
  esquemaFormularioAtivo,
  filtrarAtivos,
  FILTROS_ATIVOS_INICIAIS,
  formularioAtivoVazio,
  formularioDoAtivo,
  formularioTransferenciaVazio,
  linksDoAtivo,
  registrarTransferencia,
  restaurarAtivo,
  salvarAtivo,
  situacaoDaTransferencia,
  tipoSugereCritico,
  vinculosDoAtivo,
  type FormularioAtivo,
} from './ativos';
import { buscarNaCentral } from './busca';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { limparExemplos } from './dados';
import { vinculosDaFerramenta, cancelarFerramenta, arquivarFerramenta } from './ferramentas';
import { historicoDoAtivo } from './historico';
import { vinculosDaPessoa } from './pessoas';
import { arquivarProduto } from './produtos';
import { titularEhODesejado } from './titularidade';

const HOJE = '2026-11-06';
const PESSOAS = [
  { id: ID_KIMBERLY, nome_completo: 'Kimberly Grebe' },
  { id: ID_CAMILA, nome_completo: 'Camila Lima' },
];
const DRIVE = 'https://drive.google.com/file/d/abc123/view';

function novoAtivo(alteracoes: Partial<FormularioAtivo> = {}): FormularioAtivo {
  return { ...formularioAtivoVazio(ID_KIMBERLY, ID_CONSOLIDADA, ID_CAMILA), identificador: 'novo-teste.com.br', contexto: ID_INSTITUCIONAL, vencimento: '2027-06-01', ...alteracoes };
}

const problemas = (formulario: FormularioAtivo) => {
  const resultado = esquemaFormularioAtivo.safeParse(formulario);
  return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join('.'), problema.message]));
};

const ativoPorIdentificador = async (identificador: string) => (await repositorios.ativo_digital.listar({ incluirArquivados: true })).find((ativo) => ativo.identificador === identificador)!;

const filtrar = async (filtros: Partial<typeof FILTROS_ATIVOS_INICIAIS> = {}, contextoGlobalId: string = ID_CONSOLIDADA) => {
  const dados = await carregarAtivos();
  return filtrarAtivos(dados.ativos, { ...FILTROS_ATIVOS_INICIAIS, ...filtros }, { contextoGlobalId, hoje: HOJE, pessoas: dados.pessoas, nomeDaFerramenta: (id) => dados.ferramentas.find((ferramenta) => ferramenta.id === id)?.nome ?? '' }).map((ativo) => ativo.identificador);
};

describe('T04.04 e T04.05: ativos digitais', () => {
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
    it('traz os exemplos, marcados como exemplo, com um domínio vencendo', async () => {
      const ativos = await repositorios.ativo_digital.listar();
      expect(ativos).toHaveLength(ATIVOS_INICIAIS);
      expect(ativos.every((ativo) => ativo.exemplo)).toBe(true);
      expect(ativos.some((ativo) => ativo.tipo === 'dominio' && (diasParaVencer(ativo, HOJE) as number) <= 45)).toBe(true);
    });

    it('todos os exemplos passam nas regras da própria linha', async () => {
      for (const ativo of await repositorios.ativo_digital.listar()) expect(esquemaAtivoDigital.safeParse(ativo).success).toBe(true);
    });

    it('migra quem veio da versão anterior', async () => {
      armazenamento.removeItem(chaveDaTabela('ativo_digital'));
      gravarMeta({ versao_dados: 11 });
      garantirCarga();
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      expect(await repositorios.ativo_digital.listar()).toHaveLength(ATIVOS_INICIAIS);
    });

    it('quem já limpou os exemplos não recebe ativos fictícios', async () => {
      await limparExemplos();
      armazenamento.removeItem(chaveDaTabela('ativo_digital'));
      gravarMeta({ versao_dados: 11 });
      garantirCarga();
      expect(await repositorios.ativo_digital.listar()).toEqual([]);
    });
  });

  describe('T04.05: formulário', () => {
    it('com o básico, passa', () => {
      expect(problemas(novoAtivo())).toEqual({});
    });

    it('identificador, contexto e responsável são obrigatórios', () => {
      expect(problemas(novoAtivo({ identificador: ' ', contexto: '', responsavel_id: '' }))).toEqual({ identificador: 'Informe o identificador.', contexto: 'Escolha a Numa ou um produto.', responsavel_id: 'Escolha a responsável.' });
    });

    it('CA-04.06: domínio sem vencimento não salva; outro tipo, sim', () => {
      expect(problemas(novoAtivo({ vencimento: '' })).vencimento).toBe('Domínio precisa da data de vencimento.');
      expect(problemas(novoAtivo({ tipo: 'rede_social', vencimento: '' }))).toEqual({});
    });

    it('CA-04.06 vale também para um arquivo importado', async () => {
      const dominio = await ativoPorIdentificador('kipi-exemplo.com.br');
      expect(esquemaAtivoDigital.safeParse({ ...dominio, vencimento: null }).success).toBe(false);
    });

    it('titular pessoa física precisa da sócia; terceiro, do nome; desejado é obrigatório', () => {
      expect(problemas(novoAtivo({ titular_atual_pessoa_id: '' })).titular_atual_pessoa_id).toBe('Diga de qual sócia é a conta.');
      expect(problemas(novoAtivo({ titular_atual_tipo: 'terceiro' })).titular_atual_texto).toBe('Diga de quem é a conta.');
      expect(problemas(novoAtivo({ titular_desejado: '' })).titular_desejado).toBe('Diga em nome de quem deveria estar.');
    });

    it('o tipo sugere se é crítico', () => {
      expect(tipoSugereCritico('dominio')).toBe(true);
      expect(tipoSugereCritico('loja_google')).toBe(true);
      expect(tipoSugereCritico('rede_social')).toBe(false);
      expect(formularioAtivoVazio(ID_KIMBERLY, ID_CONSOLIDADA, ID_CAMILA, 'analytics').critico).toBe(false);
    });

    it('no contexto de um produto, o ativo já começa nele', () => {
      expect(formularioAtivoVazio(ID_KIMBERLY, ID_PRODUTO_KIPI, ID_CAMILA).contexto).toBe(ID_PRODUTO_KIPI);
    });
  });

  describe('conferência antes de gravar', () => {
    const existentes = [
      { id: 'a', tipo: 'dominio' as const, identificador: 'kipi.com.br', arquivado_em: null },
      { id: 'b', tipo: 'rede_social' as const, identificador: '@Kipi', arquivado_em: '2026-01-01T00:00:00.000Z' },
    ];

    it('único por tipo, sem olhar maiúsculas', () => {
      expect(conferirAtivo(novoAtivo({ identificador: 'KIPI.com.br' }), existentes, undefined, HOJE).erroIdentificador).toContain('Já existe domínio com esse identificador');
    });

    it('o mesmo texto em outro tipo pode', () => {
      expect(conferirAtivo(novoAtivo({ tipo: 'email', identificador: 'kipi.com.br' }), existentes, undefined, HOJE).erroIdentificador).toBeNull();
    });

    it('o próprio não conta, e arquivado segura o nome dizendo onde está', () => {
      expect(conferirAtivo(novoAtivo({ identificador: 'kipi.com.br' }), existentes, 'a', HOJE).erroIdentificador).toBeNull();
      expect(conferirAtivo(novoAtivo({ tipo: 'rede_social', identificador: '@kipi' }), existentes, undefined, HOJE).erroIdentificador).toContain('em Arquivados');
    });

    it('avisa domínio estranho, vencimento passado e credencial, sem barrar', () => {
      const { erroIdentificador, avisos } = conferirAtivo(novoAtivo({ identificador: 'sem ponto', vencimento: '2026-01-01', observacoes: 'senha: abc123' }), [], undefined, HOJE);
      expect(erroIdentificador).toBeNull();
      expect(avisos).toHaveLength(3);
    });
  });

  describe('T04.05: situação da transferência', () => {
    it('titular igual ao desejado: não necessária', () => {
      expect(situacaoDaTransferencia(novoAtivo({ titular_atual_tipo: 'numa' }), PESSOAS)).toBe('nao_necessaria');
    });

    it('diferente: vale o que foi escolhido, começando em pendente', () => {
      expect(situacaoDaTransferencia(novoAtivo(), PESSOAS)).toBe('pendente');
      expect(situacaoDaTransferencia(novoAtivo({ transferencia_situacao: 'impedida' }), PESSOAS)).toBe('impedida');
    });

    it('o desejado pode ser outra pessoa, pelo nome', () => {
      expect(situacaoDaTransferencia(novoAtivo({ titular_desejado: 'kimberly grebe' }), PESSOAS)).toBe('nao_necessaria');
      expect(titularEhODesejado({ titular_atual_tipo: 'terceiro', titular_atual_pessoa_id: null, titular_atual_texto: 'Fulano' }, 'fulano', PESSOAS)).toBe(true);
      expect(titularEhODesejado({ titular_atual_tipo: 'numa', titular_atual_pessoa_id: null, titular_atual_texto: null }, 'Numa (PJ)', PESSOAS)).toBe(true);
    });

    it('quem já concluiu continua concluída', () => {
      expect(situacaoDaTransferencia(novoAtivo({ titular_atual_tipo: 'numa' }), PESSOAS, { transferencia_situacao: 'concluida' })).toBe('concluida');
    });
  });

  describe('gravar', () => {
    it('cria com código, sem marca de exemplo, e domínio em minúsculas', async () => {
      const ativo = await criarAtivo(novoAtivo({ identificador: 'NOVO-Teste.com.BR', contexto: ID_PRODUTO_KIPI }), PESSOAS);
      expect(ativo).toMatchObject({ exemplo: false, identificador: 'novo-teste.com.br', produto_id: ID_PRODUTO_KIPI, transferencia_situacao: 'pendente', titular_atual_pessoa_id: ID_KIMBERLY });
      expect(ativo.codigo).toMatch(/^ATI-2026-\d{4}$/);
    });

    it('a Numa fica sem produto', async () => {
      expect((await criarAtivo(novoAtivo(), PESSOAS)).produto_id).toBeNull();
    });

    it('salvar e ler de novo dá o mesmo formulário', async () => {
      const original = novoAtivo({ ferramenta_id: 'x', requisito_transferencia: 'Exige CNPJ', registrado_em: '2026-01-01', renovacao_automatica: 'sim', observacoes: 'Oi', critico: false });
      expect(formularioDoAtivo(await criarAtivo(original, PESSOAS))).toEqual(original);
    });

    it('editar recalcula a situação', async () => {
      const ativo = await criarAtivo(novoAtivo(), PESSOAS);
      const salvo = await salvarAtivo(ativo.id, { ...formularioDoAtivo(ativo), titular_atual_tipo: 'numa' }, PESSOAS);
      expect(salvo).toMatchObject({ titular_atual_tipo: 'numa', titular_atual_pessoa_id: null, transferencia_situacao: 'nao_necessaria' });
    });
  });

  describe('T04.05: registrar transferência', () => {
    it('CA-04.07: sem evidência é bloqueado, e nada muda', async () => {
      const ativo = await ativoPorIdentificador('kipi-exemplo.com.br');
      await expect(registrarTransferencia(ativo.id, formularioTransferenciaVazio(HOJE))).rejects.toThrow('Sem o link da evidência');
      expect((await repositorios.ativo_digital.obter(ativo.id))?.transferencia_situacao).toBe('pendente');
    });

    it('a evidência precisa ser um link do Drive', async () => {
      const ativo = await ativoPorIdentificador('kipi-exemplo.com.br');
      await expect(registrarTransferencia(ativo.id, { ...formularioTransferenciaVazio(HOJE), evidencia: 'https://exemplo.com/x' })).rejects.toThrow('drive.google.com');
    });

    it('CA-04.07 vale também para um arquivo importado', async () => {
      const ativo = await ativoPorIdentificador('kipi-exemplo.com.br');
      expect(esquemaAtivoDigital.safeParse({ ...ativo, transferencia_situacao: 'concluida' }).success).toBe(false);
    });

    it('fica concluída, com o novo titular, a data e a evidência', async () => {
      const ativo = await ativoPorIdentificador('kipi-exemplo.com.br');
      await registrarTransferencia(ativo.id, { ...formularioTransferenciaVazio('2026-11-05'), evidencia: DRIVE, observacao: 'Protocolo 123' });
      expect(await repositorios.ativo_digital.obter(ativo.id)).toMatchObject({ titular_atual_tipo: 'numa', titular_atual_pessoa_id: null, transferencia_situacao: 'concluida', transferido_em: '2026-11-05', evidencia_transferencia_url: DRIVE });
    });

    it('o histórico guarda o que mudou e a observação', async () => {
      const ativo = await ativoPorIdentificador('kipi-exemplo.com.br');
      await registrarTransferencia(ativo.id, { ...formularioTransferenciaVazio(HOJE), evidencia: DRIVE, observacao: 'Protocolo 123' });
      const [ultima] = await historicoDoAtivo(ativo.id);
      expect(ultima?.texto).toContain('Titular atual');
      expect(ultima?.texto).toContain('Protocolo 123');
      expect(ultima?.campos).toContain('Situação da transferência');
    });

    it('para outra sócia ou um terceiro, precisa dizer quem', async () => {
      const ativo = await ativoPorIdentificador('kipi-exemplo.com.br');
      await expect(registrarTransferencia(ativo.id, { ...formularioTransferenciaVazio(HOJE), evidencia: DRIVE, titular_tipo: 'terceiro' })).rejects.toThrow('Diga para quem.');
      const salvo = await registrarTransferencia(ativo.id, { ...formularioTransferenciaVazio(HOJE), evidencia: DRIVE, titular_tipo: 'pessoa_fisica', titular_pessoa_id: ID_CAMILA });
      expect(salvo).toMatchObject({ titular_atual_tipo: 'pessoa_fisica', titular_atual_pessoa_id: ID_CAMILA });
    });
  });

  describe('T04.04: lista', () => {
    it('em ordem de identificador', async () => {
      const lista = await filtrar();
      expect(lista).toHaveLength(ATIVOS_INICIAIS);
      expect(lista).toEqual([...lista].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    });

    it('abas por tipo, com contadores que seguem os outros filtros', async () => {
      expect(await filtrar({ aba: 'dominios' })).toEqual(['kipi-exemplo.com.br', 'urbana-exemplo.com.br']);
      expect(await filtrar({ aba: 'lojas' })).toEqual(['Apple Developer — Numa (exemplo)']);
      const dados = await carregarAtivos();
      const opcoes = { contextoGlobalId: ID_CONSOLIDADA, hoje: HOJE, pessoas: dados.pessoas, nomeDaFerramenta: () => '' };
      expect(contadoresDasAbas(dados.ativos, FILTROS_ATIVOS_INICIAIS, opcoes)).toMatchObject({ todos: ATIVOS_INICIAIS, dominios: 2, lojas: 1, repositorios: 1, redes: 1, emails: 0 });
      expect(contadoresDasAbas(dados.ativos, { ...FILTROS_ATIVOS_INICIAIS, contexto: ID_PRODUTO_KIPI }, opcoes)).toMatchObject({ todos: 2, dominios: 1, redes: 1, lojas: 0 });
    });

    it('filtra por contexto, e o da tela prevalece sobre o global', async () => {
      expect(await filtrar({}, ID_PRODUTO_KIPI)).toEqual(['@kipi.exemplo', 'kipi-exemplo.com.br']);
      expect(await filtrar({ contexto: ID_INSTITUCIONAL }, ID_PRODUTO_KIPI)).toEqual(['Apple Developer — Numa (exemplo)', 'numa-studio-exemplo']);
      expect(await filtrar({ contexto: ID_PRODUTO_ZUPI })).toEqual([]);
    });

    it('filtra por situação, titular diferente e vencimento', async () => {
      expect(await filtrar({ situacao: 'impedida' })).toEqual(['Apple Developer — Numa (exemplo)']);
      expect(await filtrar({ titularDiferente: true })).toEqual(['@kipi.exemplo', 'Apple Developer — Numa (exemplo)', 'kipi-exemplo.com.br']);
      expect(await filtrar({ venceEm: '30' })).toEqual(['kipi-exemplo.com.br']);
    });

    it('busca pelo identificador, pelo código e pela ferramenta, sem acento', async () => {
      expect(await filtrar({ busca: 'URBANA' })).toEqual(['urbana-exemplo.com.br']);
      expect(await filtrar({ busca: 'estudio verde' })).toEqual(['kipi-exemplo.com.br', 'urbana-exemplo.com.br']);
      const { codigo } = await ativoPorIdentificador('@kipi.exemplo');
      expect(await filtrar({ busca: codigo })).toEqual(['@kipi.exemplo']);
    });

    it('dias para vencer: negativo é vencido, sem data é nulo', () => {
      expect(diasParaVencer({ vencimento: '2026-11-16' }, HOJE)).toBe(10);
      expect(diasParaVencer({ vencimento: '2026-11-01' }, HOJE)).toBe(-5);
      expect(diasParaVencer({ vencimento: null }, HOJE)).toBeNull();
    });
  });

  describe('arquivar', () => {
    it('sem vínculos, arquiva e restaura', async () => {
      const ativo = await ativoPorIdentificador('@kipi.exemplo');
      await arquivarAtivo(ativo.id);
      expect(await filtrar()).not.toContain('@kipi.exemplo');
      expect(await filtrar({ arquivados: true })).toEqual(['@kipi.exemplo']);
      await restaurarAtivo(ativo.id);
      expect(await filtrar()).toContain('@kipi.exemplo');
    });

    it('com atividade aberta vinculada, não arquiva', async () => {
      const ativo = await ativoPorIdentificador('@kipi.exemplo');
      const atividade = (await repositorios.atividade.listar()).find(estaAberta)!;
      await repositorios.vinculo.criar(parDoVinculo({ tipo: 'atividade', id: atividade.id }, { tipo: 'ativo_digital', id: ativo.id }));
      expect(await vinculosDoAtivo(ativo.id)).toEqual(['1 atividade aberta']);
      await expect(arquivarAtivo(ativo.id)).rejects.toThrow('Este ativo tem 1 atividade aberta.');
    });
  });

  describe('nas outras telas', () => {
    it('T04.02: a ferramenta mostra os ativos hospedados', async () => {
      const estudio = (await repositorios.ferramenta.listar()).find((ferramenta) => ferramenta.nome === 'Estúdio Verde Registro')!;
      expect((await ativosDaFerramenta(estudio.id)).map((ativo) => ativo.identificador)).toEqual(['kipi-exemplo.com.br', 'urbana-exemplo.com.br']);
    });

    it('ferramenta com ativo hospedado não arquiva e diz quantos, mas pode ser cancelada', async () => {
      const repositorio = (await repositorios.ferramenta.listar()).find((ferramenta) => ferramenta.nome === 'Repositório Aberto')!;
      expect(await vinculosDaFerramenta(repositorio.id)).toEqual(['1 ativo hospedado']);
      await expect(arquivarFerramenta(repositorio.id)).rejects.toThrow('1 ativo hospedado');
      await cancelarFerramenta(repositorio.id, { data: HOJE, motivo: 'Trocamos' });
      expect((await repositorios.ferramenta.obter(repositorio.id))?.situacao).toBe('cancelada');
    });

    it('produto com ativo não arquiva', async () => {
      armazenamento.setItem(chaveDaTabela('atividade'), '[]');
      armazenamento.setItem(chaveDaTabela('ferramenta_contexto'), '[]');
      armazenamento.setItem(chaveDaTabela('titulo_rateio'), '[]');
      await expect(arquivarProduto(ID_PRODUTO_KIPI)).rejects.toThrow('2 ativos');
    });

    it('quem é responsável não sai sem passar a responsabilidade', async () => {
      expect(await vinculosDaPessoa(ID_KIMBERLY)).toContain('Responsável por @kipi.exemplo');
    });

    it('a busca global acha, no grupo Ativos', async () => {
      const grupo = (await buscarNaCentral('urbana-exemplo')).find((item) => item.tipo === 'ativos');
      const ativo = await ativoPorIdentificador('urbana-exemplo.com.br');
      expect(grupo?.itens[0]).toMatchObject({ titulo: 'urbana-exemplo.com.br', href: `/ferramentas/ativos/${ativo.id}` });
    });

    it('só aceita link do Drive nos arquivos', async () => {
      const ativo = await ativoPorIdentificador('@kipi.exemplo');
      await expect(adicionarLinkDoAtivo(ativo.id, 'https://exemplo.com/x')).rejects.toThrow('drive.google.com');
      await adicionarLinkDoAtivo(ativo.id, DRIVE);
      expect((await linksDoAtivo(ativo.id)).map((link) => link.url)).toEqual([DRIVE]);
    });
  });

  describe('Limpar exemplos', () => {
    it('leva os ativos fictícios', async () => {
      await limparExemplos();
      expect(await repositorios.ativo_digital.listar({ incluirArquivados: true })).toEqual([]);
    });

    it('ativo de verdade fica, sem o que era fictício', async () => {
      const estudio = (await repositorios.ferramenta.listar()).find((ferramenta) => ferramenta.nome === 'Estúdio Verde Registro')!;
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: estudio.id } }))[0]!;
      const criado = await criarAtivo(novoAtivo({ ferramenta_id: estudio.id, assinatura_id: assinatura.id }), PESSOAS);
      await limparExemplos();
      expect(await repositorios.ativo_digital.obter(criado.id)).toMatchObject({ ferramenta_id: null, assinatura_id: null, responsavel_id: ID_CAMILA, titular_atual_pessoa_id: ID_KIMBERLY });
    });
  });
});
