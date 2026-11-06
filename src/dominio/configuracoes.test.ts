import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { listarHistorico } from '@/dados/historico';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { VALORES_PADRAO, type Configuracao } from '@/dados/tipos/configuracao';
import { hojeISO } from '@/lib/datas';
import {
  avancarFase,
  carregarTelaGeral,
  esquemaFormularioGeral,
  formularioDosValores,
  lerConfiguracoes,
  pessoasParaBackup,
  responsavelDisponivel,
  salvarFormularioGeral,
  valoresDoFormulario,
  voltarFase,
  type FormularioGeral,
} from './configuracoes';
import { analisarArquivo, aplicarImportacao, contagensAtuais, exportarTudo, limparExemplos, restaurarExemplos, resumoDosDados, type ArquivoDeDados } from './dados';
import { historicoRecente, ultimaMudancaDeFase } from './historico';
import { moduloDisponivel, MODULOS_EMPRESA, MODULOS_TOPO } from './navegacao';

const ID_BRUNA = '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03';
const ID_RAFAEL = '3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04';

let armazenamento: Driver;

function formularioValido(alteracoes: Partial<FormularioGeral> = {}): FormularioGeral {
  return { ...formularioDosValores(VALORES_PADRAO, [{ id: ID_CAMILA, tipo: 'interna', situacao: 'ativa', arquivado_em: null } as never]), ...alteracoes };
}

function mensagens(alteracoes: Partial<FormularioGeral>): string[] {
  const resultado = esquemaFormularioGeral.safeParse(formularioValido(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

describe('T02.01 Configurações gerais', () => {
  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-05T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  describe('padrões', () => {
    it('vêm da especificação, com e-mail e logotipo vazios', async () => {
      expect(await lerConfiguracoes()).toEqual({
        organizacao_nome: 'Numa',
        organizacao_logo_url: null,
        organizacao_email: null,
        fuso: 'America/Sao_Paulo',
        moeda_padrao: 'BRL',
        uf_padrao: 'RJ',
        municipio_padrao: 'Rio de Janeiro',
        fase_ativa: 'f0a',
        alerta_vencimento_dias: 3,
        alerta_renovacao_ferramenta_dias: 15,
        alerta_fim_teste_dias: 3,
        alerta_dominio_dias: 45,
        comprovante_obrigatorio: true,
        responsavel_backup_id: ID_CAMILA,
      });
    });

    it('o câmbio começa vazio, sem cotações inventadas', async () => {
      expect(await repositorios.cambio_referencia.listar()).toEqual([]);
    });

    it('uma linha por chave, nenhuma marcada como exemplo', async () => {
      await lerConfiguracoes();
      const linhas = JSON.parse(armazenamento.getItem(chaveDaTabela('configuracao'))!) as Configuracao[];
      expect(linhas.map((linha) => linha.chave).sort()).toEqual(Object.keys(VALORES_PADRAO).sort());
      expect(linhas.every((linha) => linha.exemplo === false && linha.descricao)).toBe(true);
    });

    it('chave faltando ou valor inválido volta ao padrão, sem quebrar a tela', async () => {
      await lerConfiguracoes();
      const chave = chaveDaTabela('configuracao');
      const linhas = (JSON.parse(armazenamento.getItem(chave)!) as Configuracao[]).filter((linha) => linha.chave !== 'moeda_padrao').map((linha) => (linha.chave === 'fuso' ? { ...linha, valor: 'Marte/Base' } : linha));
      armazenamento.setItem(chave, JSON.stringify(linhas));
      expect(await lerConfiguracoes()).toMatchObject({ moeda_padrao: 'BRL', fuso: 'America/Sao_Paulo' });
    });
  });

  describe('validação do formulário', () => {
    it('os valores padrão são válidos', () => {
      expect(mensagens({})).toEqual([]);
    });

    it('nome é obrigatório, mesmo só com espaços', () => {
      expect(mensagens({ organizacao_nome: '   ' })).toEqual(['Informe o nome da organização.']);
    });

    it('e-mail é opcional, mas precisa ser válido', () => {
      expect(mensagens({ organizacao_email: '' })).toEqual([]);
      expect(mensagens({ organizacao_email: 'contato@numa.com.br' })).toEqual([]);
      expect(mensagens({ organizacao_email: 'contato' })).toEqual(['Informe um e-mail válido.']);
    });

    it('logotipo é opcional, mas só aceita link do Drive', () => {
      expect(mensagens({ organizacao_logo_url: '' })).toEqual([]);
      expect(mensagens({ organizacao_logo_url: 'https://drive.google.com/file/d/abc' })).toEqual([]);
      expect(mensagens({ organizacao_logo_url: 'https://exemplo.com/logo.png' })).toEqual(['Use um link de drive.google.com ou docs.google.com.']);
    });

    it('antecedências aceitam só inteiros a partir de zero', () => {
      for (const ruim of ['', '  ', '-1', '1.5', '1,5', 'três', '10000']) {
        expect(mensagens({ alerta_vencimento_dias: ruim })).toEqual(['Informe a antecedência de vencimentos, em dias.']);
      }
      expect(mensagens({ alerta_vencimento_dias: '0' })).toEqual([]);
      expect(mensagens({ alerta_vencimento_dias: ' 7 ' })).toEqual([]);
    });

    it('cada antecedência tem a sua mensagem', () => {
      expect(mensagens({ alerta_renovacao_ferramenta_dias: '' })).toEqual(['Informe a antecedência de renovações, em dias.']);
      expect(mensagens({ alerta_fim_teste_dias: '' })).toEqual(['Informe a antecedência do fim de testes, em dias.']);
      expect(mensagens({ alerta_dominio_dias: '' })).toEqual(['Informe a antecedência de domínios, em dias.']);
    });

    it('fuso, moeda e responsável são obrigatórios; estado e município, não', () => {
      expect(mensagens({ fuso: 'Marte/Base' as never })).toEqual(['Escolha o fuso horário.']);
      expect(mensagens({ moeda_padrao: '' })).toEqual(['Escolha a moeda padrão.']);
      expect(mensagens({ responsavel_backup_id: '' })).toEqual(['Escolha a pessoa responsável pelo backup.']);
      expect(mensagens({ uf_padrao: '', municipio_padrao: '' })).toEqual([]);
    });
  });

  describe('conversão', () => {
    it('vazio vira vazio, não texto em branco nem zero (RT-08)', () => {
      expect(valoresDoFormulario(formularioValido({ organizacao_email: '', organizacao_logo_url: '' }))).toMatchObject({ organizacao_email: null, organizacao_logo_url: null });
    });

    it('antecedências viram números, inclusive o zero', () => {
      expect(valoresDoFormulario(formularioValido({ alerta_vencimento_dias: '0', alerta_dominio_dias: '30' }))).toMatchObject({ alerta_vencimento_dias: 0, alerta_dominio_dias: 30 });
    });

    it('sem estado, não há município', () => {
      expect(valoresDoFormulario(formularioValido({ uf_padrao: '', municipio_padrao: 'Rio de Janeiro' }))).toMatchObject({ uf_padrao: null, municipio_padrao: null });
    });

    it('estado sem município é permitido', () => {
      expect(valoresDoFormulario(formularioValido({ uf_padrao: 'SP', municipio_padrao: '' }))).toMatchObject({ uf_padrao: 'SP', municipio_padrao: null });
    });

    it('vazio no banco aparece vazio no campo', () => {
      expect(formularioValido()).toMatchObject({ organizacao_email: '', organizacao_logo_url: '', alerta_vencimento_dias: '3' });
    });
  });

  describe('responsável pelo backup', () => {
    it('lista todas as pessoas internas ativas: nem externas, nem arquivadas', async () => {
      const pessoas = await repositorios.pessoa.listar();
      expect(pessoasParaBackup(pessoas).map((pessoa) => pessoa.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima', 'Bruna Alves']);
      await repositorios.pessoa.arquivar(ID_BRUNA, 'Saiu da equipe');
      expect(pessoasParaBackup(await repositorios.pessoa.listar({ incluirArquivados: true })).map((pessoa) => pessoa.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima']);
    });

    it('se a pessoa escolhida sair da lista, o campo fica vazio, sem trocar sozinho', async () => {
      await salvarFormularioGeral(formularioDosValores(await lerConfiguracoes(), await repositorios.pessoa.listar()));
      await salvarFormularioGeral({ ...formularioDosValores(await lerConfiguracoes(), await repositorios.pessoa.listar()), responsavel_backup_id: ID_BRUNA });
      await limparExemplos();

      const valores = await lerConfiguracoes();
      expect(valores.responsavel_backup_id).toBe(ID_BRUNA);
      const pessoas = await repositorios.pessoa.listar();
      expect(responsavelDisponivel(ID_BRUNA, pessoas)).toBe(false);
      expect(formularioDosValores(valores, pessoas).responsavel_backup_id).toBe('');
    });

    it('não aceita salvar alguém fora da lista', async () => {
      const formulario = formularioDosValores(await lerConfiguracoes(), await repositorios.pessoa.listar());
      await expect(salvarFormularioGeral({ ...formulario, responsavel_backup_id: ID_RAFAEL })).rejects.toMatchObject({ tipo: 'validacao' });
      expect((await lerConfiguracoes()).responsavel_backup_id).toBe(ID_CAMILA);
    });
  });

  describe('salvar', () => {
    async function formularioAtual(alteracoes: Partial<FormularioGeral> = {}) {
      return { ...formularioDosValores(await lerConfiguracoes(), await repositorios.pessoa.listar()), ...alteracoes };
    }

    it('recarregar mantém o que foi salvo', async () => {
      await salvarFormularioGeral(await formularioAtual({ organizacao_nome: 'Numa Planejada', alerta_dominio_dias: '60' }));
      esquecerMetaEmMemoria();
      expect(await lerConfiguracoes()).toMatchObject({ organizacao_nome: 'Numa Planejada', alerta_dominio_dias: 60 });
    });

    it('sem nenhuma mudança, não grava nem registra nada', async () => {
      const antes = (await listarHistorico()).length;
      expect(await salvarFormularioGeral(await formularioAtual())).toBe(0);
      expect(await listarHistorico()).toHaveLength(antes);
    });

    it('registra cada campo alterado, com quem fez, o antes e o depois', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      expect(await salvarFormularioGeral(await formularioAtual({ moeda_padrao: 'USD', alerta_vencimento_dias: '5' }))).toBe(2);
      const eventos = await listarHistorico({ tabela: 'configuracao' });
      expect(eventos).toHaveLength(2);
      expect(eventos.every((evento) => evento.usuario_id === ID_CAMILA && evento.acao === 'alterou')).toBe(true);
      expect(eventos.map((evento) => evento.depois?.chave).sort()).toEqual(['alerta_vencimento_dias', 'moeda_padrao']);
      const moeda = eventos.find((evento) => evento.depois?.chave === 'moeda_padrao');
      expect(moeda).toMatchObject({ antes: { valor: 'BRL' }, depois: { valor: 'USD' } });
      const textos = (await historicoRecente(10)).map((linha) => linha.texto);
      expect(textos).toContain('Camila Lima alterou Moeda padrão: de BRL para USD');
      expect(textos).toContain('Camila Lima alterou Vencimentos financeiros: de 3 dias para 5 dias');
    });

    it('o histórico diz o nome, o fuso e o vazio por extenso', async () => {
      await salvarFormularioGeral(await formularioAtual({ responsavel_backup_id: ID_KIMBERLY, fuso: 'America/Manaus', organizacao_email: 'contato@numa.com.br' }));
      const textos = (await historicoRecente(10)).map((linha) => linha.texto);
      expect(textos).toContain('Kimberly Grebe alterou Responsável pelo backup semanal: de Camila Lima para Kimberly Grebe');
      expect(textos).toContain('Kimberly Grebe alterou Fuso horário: de Brasília · São Paulo (UTC−3) para Manaus (UTC−4)');
      expect(textos).toContain('Kimberly Grebe alterou E-mail institucional: de não informado para contato@numa.com.br');
    });

    it('sobe a versão de cada linha alterada e guarda o autor', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      await salvarFormularioGeral(await formularioAtual({ moeda_padrao: 'EUR' }));
      const linhas = JSON.parse(armazenamento.getItem(chaveDaTabela('configuracao'))!) as Configuracao[];
      expect(linhas.find((linha) => linha.chave === 'moeda_padrao')).toMatchObject({ valor: 'EUR', versao_registro: 2, atualizado_por: ID_CAMILA });
      expect(linhas.find((linha) => linha.chave === 'fuso')).toMatchObject({ versao_registro: 1 });
    });

    it('sem espaço no navegador, nada fica pela metade', async () => {
      const formulario = await formularioAtual({ moeda_padrao: 'USD' });
      const historicoAntes = armazenamento.getItem(chaveDaTabela('auditoria'));
      const setItem = armazenamento.setItem.bind(armazenamento);
      armazenamento.setItem = (chave: string, valor: string) => {
        if (chave.endsWith(':auditoria')) throw new DOMException('cheio', 'QuotaExceededError');
        setItem(chave, valor);
      };
      await expect(salvarFormularioGeral(formulario)).rejects.toMatchObject({ tipo: 'armazenamento' });
      armazenamento.setItem = setItem;
      expect((await lerConfiguracoes()).moeda_padrao).toBe('BRL');
      expect(armazenamento.getItem(chaveDaTabela('auditoria'))).toBe(historicoAntes);
    });

    it('recria a chave que tiver sumido', async () => {
      await lerConfiguracoes();
      const chave = chaveDaTabela('configuracao');
      armazenamento.setItem(chave, JSON.stringify((JSON.parse(armazenamento.getItem(chave)!) as Configuracao[]).filter((linha) => linha.chave !== 'moeda_padrao')));
      await salvarFormularioGeral(await formularioAtual({ moeda_padrao: 'EUR' }));
      expect((await lerConfiguracoes()).moeda_padrao).toBe('EUR');
    });

    it('recusa valor que não pode ser gravado', async () => {
      await expect(repositorios.configuracao.salvar({ alerta_vencimento_dias: -1 })).rejects.toMatchObject({ tipo: 'validacao' });
      await expect(repositorios.configuracao.salvar({ comprovante_obrigatorio: false as never })).rejects.toMatchObject({ tipo: 'validacao' });
    });
  });

  describe('fuso', () => {
    // 01:30 UTC do dia 6: ainda é dia 5 em São Paulo (22:30) e em Manaus (21:30).
    const FIM_DE_NOITE = new Date('2026-11-06T01:30:00.000Z');
    // 03:30 UTC do dia 6: já é dia 6 em São Paulo (00:30), mas ainda dia 5 em Manaus (23:30).
    const VIRADA = new Date('2026-11-06T03:30:00.000Z');

    it('"hoje" segue o fuso salvo (RT-06)', async () => {
      expect(hojeISO(VIRADA)).toBe('2026-11-06');
      await repositorios.configuracao.salvar({ fuso: 'America/Manaus' });
      expect(hojeISO(VIRADA)).toBe('2026-11-05');
      expect(hojeISO(FIM_DE_NOITE)).toBe('2026-11-05');
      await repositorios.configuracao.salvar({ fuso: 'America/Sao_Paulo' });
      expect(hojeISO(VIRADA)).toBe('2026-11-06');
    });

    it('com a tabela danificada, vale o padrão e nada quebra', async () => {
      armazenamento.setItem(chaveDaTabela('configuracao'), '{danificado');
      expect(hojeISO(VIRADA)).toBe('2026-11-06');
    });
  });

  describe('fase ativa', () => {
    it('avança uma fase de cada vez e registra quem avançou', async () => {
      expect(await avancarFase()).toBe('f0b');
      expect((await lerConfiguracoes()).fase_ativa).toBe('f0b');
      expect((await ultimaMudancaDeFase())?.texto).toBe('Kimberly Grebe avançou para a Fase 0b');
    });

    it('voltar exige motivo: sem ele, nada muda', async () => {
      await avancarFase();
      await expect(voltarFase('   ')).rejects.toMatchObject({ tipo: 'validacao' });
      expect((await lerConfiguracoes()).fase_ativa).toBe('f0b');
    });

    it('voltar registra o motivo e não apaga dados', async () => {
      await avancarFase();
      await repositorios.cambio_referencia.criar({ moeda: 'USD', valor_brl: 5.5, data_referencia: '2026-11-05', fonte: null });
      const antes = await resumoDosDados();
      expect(await voltarFase('  Ainda faltam telas da F0a  ')).toBe('f0a');
      expect((await lerConfiguracoes()).fase_ativa).toBe('f0a');
      expect((await ultimaMudancaDeFase())?.texto).toBe('Kimberly Grebe voltou para a Fase 0a. Motivo: Ainda faltam telas da F0a');
      expect((await resumoDosDados()).registros).toBe(antes.registros);
      expect(await repositorios.cambio_referencia.listar()).toHaveLength(1);
    });

    it('não passa das pontas', async () => {
      await expect(voltarFase('motivo')).rejects.toMatchObject({ tipo: 'validacao' });
      for (let i = 0; i < 4; i++) await avancarFase();
      expect((await lerConfiguracoes()).fase_ativa).toBe('f3');
      await expect(avancarFase()).rejects.toMatchObject({ tipo: 'validacao' });
    });

    it('sem mudança de fase, a seção não mostra nada', async () => {
      await salvarFormularioGeral({ ...formularioDosValores(await lerConfiguracoes(), await repositorios.pessoa.listar()), moeda_padrao: 'USD' });
      expect(await ultimaMudancaDeFase()).toBeNull();
    });

    it('mudar de fase nunca libera tela que não foi construída', async () => {
      for (let i = 0; i < 4; i++) await avancarFase();
      const { fase_ativa: fase } = await lerConfiguracoes();
      expect([...MODULOS_TOPO, ...MODULOS_EMPRESA].filter((modulo) => moduloDisponivel(modulo, fase))).toEqual([]);
    });
  });

  describe('com os outros dados', () => {
    it('carrega tudo o que a tela precisa, inclusive a lista oficial', async () => {
      const tela = await carregarTelaGeral();
      expect(tela.configuracoes.fase_ativa).toBe('f0a');
      expect(tela.pessoas).toHaveLength(4);
      expect(tela.cambios).toEqual([]);
      expect(tela.mudancaDeFase).toBeNull();
      expect(tela.municipios.ufs).toHaveLength(27);
    });

    it('configurações não contam como registros nem como exemplos', async () => {
      await lerConfiguracoes();
      expect(await resumoDosDados()).toMatchObject({ registros: 4, exemplos: 2 });
    });

    it('limpar exemplos não mexe nas configurações', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      await limparExemplos();
      expect((await lerConfiguracoes()).organizacao_nome).toBe('Numa Planejada');
    });

    it('restaurar exemplos volta aos padrões e limpa o câmbio', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada', fase_ativa: 'f1' });
      await repositorios.cambio_referencia.criar({ moeda: 'USD', valor_brl: 5.5, data_referencia: '2026-11-05', fonte: null });
      await restaurarExemplos();
      expect(await lerConfiguracoes()).toEqual(VALORES_PADRAO);
      expect(await repositorios.cambio_referencia.listar()).toEqual([]);
    });

    it('exportar e importar levam as configurações e o câmbio', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada', alerta_dominio_dias: 60 });
      await repositorios.cambio_referencia.criar({ moeda: 'USD', valor_brl: 5.5, data_referencia: '2026-11-05', fonte: 'Banco Central' });
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      await restaurarExemplos();
      await aplicarImportacao(arquivo);
      expect(await lerConfiguracoes()).toMatchObject({ organizacao_nome: 'Numa Planejada', alerta_dominio_dias: 60 });
      expect(await repositorios.cambio_referencia.listar()).toMatchObject([{ moeda: 'USD', valor_brl: 5.5, fonte: 'Banco Central' }]);
    });

    it('recusa um arquivo com configuração inválida, sem mudar nada', async () => {
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      const linhas = arquivo.tabelas.configuracao as Configuracao[];
      arquivo.tabelas.configuracao = linhas.map((linha) => (linha.chave === 'alerta_dominio_dias' ? { ...linha, valor: -5 } : linha));
      const analise = analisarArquivo(JSON.stringify(arquivo), contagensAtuais());
      expect(analise.ok).toBe(false);
      expect(!analise.ok && analise.erros.join(' ')).toContain('Configurações');
    });
  });

  describe('backup anterior às configurações', () => {
    async function arquivoDaVersao1() {
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      delete arquivo.tabelas.configuracao;
      delete arquivo.tabelas.cambio_referencia;
      arquivo.versao_dados = 1;
      return arquivo;
    }

    it('é aceito, avisa e as configurações voltam aos padrões', async () => {
      const arquivo = await arquivoDaVersao1();
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      const analise = analisarArquivo(JSON.stringify(arquivo), contagensAtuais());
      expect(analise.ok).toBe(true);
      if (!analise.ok) return;
      expect(analise.avisos.join(' ')).toContain('as configurações: elas voltam aos valores padrão');
      expect(analise.avisos.join(' ')).toContain('Câmbio de referência');

      await aplicarImportacao(analise.arquivo);
      expect(await lerConfiguracoes()).toEqual(VALORES_PADRAO);
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      const linhas = JSON.parse(armazenamento.getItem(chaveDaTabela('configuracao'))!) as Configuracao[];
      expect(linhas.length).toBeGreaterThan(0);
    });
  });

  describe('dados de quem já usava a versão anterior', () => {
    async function navegadorDaVersao1() {
      await repositorios.pessoa.listar();
      await repositorios.pessoa.criar({ nome_completo: 'Pessoa Real', nome_exibicao: null, tipo: 'interna', eh_socia: false, contraparte_id: null, papeis_contato: [], funcao: null, email: null, telefone: null, cpf: null, observacoes: null, situacao: 'ativa' });
      armazenamento.removeItem(chaveDaTabela('configuracao'));
      armazenamento.removeItem(chaveDaTabela('cambio_referencia'));
      gravarMeta({ versao_dados: 1 });
      esquecerMetaEmMemoria();
    }

    it('acrescenta as configurações sem tocar no que existia', async () => {
      await navegadorDaVersao1();
      expect(await lerConfiguracoes()).toEqual(VALORES_PADRAO);
      expect((await repositorios.pessoa.listar()).map((pessoa) => pessoa.nome_completo)).toContain('Pessoa Real');
      expect(armazenamento.getItem(chaveDaTabela('configuracao'))).not.toBeNull();
      expect(JSON.parse(armazenamento.getItem(chaveDaTabela('cambio_referencia'))!)).toEqual([]);
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('registra a atualização uma vez só', async () => {
      await navegadorDaVersao1();
      await lerConfiguracoes();
      await lerConfiguracoes();
      const migracoes = (await listarHistorico()).filter((evento) => evento.depois?.funcao === 'migrar_dados');
      expect(migracoes).toHaveLength(1);
      expect((await historicoRecente(1))[0]?.texto).toBe('Sistema atualizou os dados para a nova versão da Central');
    });

    it('com o histórico danificado, atualiza mesmo assim', async () => {
      await navegadorDaVersao1();
      armazenamento.setItem(chaveDaTabela('auditoria'), '{danificado');
      expect(await lerConfiguracoes()).toEqual(VALORES_PADRAO);
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      expect(armazenamento.getItem(chaveDaTabela('auditoria'))).toBe('{danificado');
    });

    it('não sobrescreve configurações que já estejam lá', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      gravarMeta({ versao_dados: 1 });
      esquecerMetaEmMemoria();
      expect((await lerConfiguracoes()).organizacao_nome).toBe('Numa Planejada');
    });
  });
});
