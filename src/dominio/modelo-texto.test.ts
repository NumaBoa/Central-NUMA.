import { describe, expect, it } from 'vitest';
import { BLOCOS_MOD_SAAS_LIC } from '@/dados/referencia/mod-saas-lic';
import { analisarTexto, avaliarCondicao, renderizarTexto, textoDoDocumento } from './modelo-texto';

const texto = (fonte: string, dados: unknown) => textoDoDocumento(renderizarTexto(fonte, dados).nos);

describe('motor de modelos', () => {
  it('preenche variáveis e aponta as vazias, sem inventar', () => {
    const resultado = renderizarTexto('Contrato de {{contraparte.nome}}, CPF {{contraparte.cpf}}.', { contraparte: { nome: 'Ana' } });
    expect(resultado.vazias).toEqual(['contraparte.cpf']);
    expect(textoDoDocumento(resultado.nos)).toBe('Contrato de Ana, CPF [contraparte.cpf].');
  });

  it('variável em trecho que não entrou não bloqueia', () => {
    expect(renderizarTexto('[SE a]{{b.c}}[FIM SE]fim', { a: false }).vazias).toEqual([]);
  });

  it('condições: igualdade, diferença, número, contém e verdadeiro', () => {
    const escopo = { dados: { a: 'x', n: 3, l: ['Android'], v: '', o: {} } };
    expect(avaliarCondicao('a = "x"', escopo)).toBe(true);
    expect(avaliarCondicao('a ≠ "x"', escopo)).toBe(false);
    expect(avaliarCondicao('n > 0', escopo)).toBe(true);
    expect(avaliarCondicao('l contém "Android"', escopo)).toBe(true);
    expect(avaliarCondicao('v', escopo)).toBe(false);
    expect(avaliarCondicao('o', escopo)).toBe(true);
    expect(avaliarCondicao('nada', escopo)).toBe(false);
  });

  it('não lê nada fora dos dados: nem protótipo, nem código', () => {
    expect(renderizarTexto('{{constructor.name}}', {}).vazias).toEqual(['constructor.name']);
    expect(renderizarTexto('{{__proto__.x}}', {}).vazias).toEqual(['__proto__.x']);
    expect(analisarTexto('[SE alert(1)]x[FIM SE]').erros[0]).toContain('Condição não reconhecida');
    expect(analisarTexto('{{a;b}}').erros[0]).toContain('Variável inválida');
  });

  it('o conteúdo digitado é texto: script e formatação ficam como escritos', () => {
    const resultado = renderizarTexto('Nome: {{a}}', { a: '<script>alert(1)</script> **x** | y' });
    expect(textoDoDocumento(resultado.nos)).toBe('Nome: <script>alert(1)</script> **x** | y');
  });

  it('aponta início e fim que não casam', () => {
    expect(analisarTexto('[SE a]x').erros).toEqual(['[SE a] sem [FIM SE].']);
    expect(analisarTexto('x[FIM SE]').erros).toEqual(['[FIM SE] sem o início correspondente.']);
    expect(analisarTexto('[PARA CADA a]x[FIM SE]').erros.length).toBeGreaterThan(0);
  });

  it('repete listas; em tabela, cada item é uma linha', () => {
    expect(texto('[PARA CADA l]{{item.n}};[FIM PARA]', { l: [{ n: 'a' }, { n: 'b' }] })).toBe('a;b;');
    const doc = renderizarTexto('| R | I |\n|---|---|\n| [PARA CADA l] {{item.n}} | {{item.i}} [FIM PARA] |', { l: [{ n: 'a', i: 'x' }, { n: 'b', i: 'y' }] });
    const tabela = doc.nos[0];
    expect(tabela?.tipo === 'tabela' && tabela.linhas.length).toBe(3);
  });

  it('vazia dentro de uma lista diz qual lista', () => {
    expect(renderizarTexto('[PARA CADA l]{{item.cpf}}[FIM PARA]', { l: [{ cpf: '' }] }).vazias).toEqual(['l[].cpf']);
  });

  it('bloco ausente deixa "(não aplicável)", sem renumerar e sem repetir', () => {
    const fonte = '18.2. Antes.\n[SE p = "anual"]\n[SE r = "x"]\n18.3. A.\n[FIM SE]\n[SE r = "y"]\n18.3. B.\n[FIM SE]\n[FIM SE]\n18.4. Depois.';
    expect(texto(fonte, { p: 'mensal' })).toBe('18.2. Antes.\n18.3. (não aplicável)\n18.4. Depois.');
    expect(texto(fonte, { p: 'anual', r: 'x' })).toBe('18.2. Antes.\n18.3. A.\n18.4. Depois.');
  });

  it('[DESTAQUE] sai em negrito e sem a marca (RN-11.40)', () => {
    const [no] = renderizarTexto('13.2. **[DESTAQUE]** Não garantem.', {}).nos;
    expect(no?.tipo === 'paragrafo' && no.destaque).toBe(true);
    expect(no?.tipo === 'paragrafo' && no.trechos.every((trecho) => trecho.negrito)).toBe(true);
    expect(no?.tipo === 'paragrafo' && no.trechos.map((t) => t.texto).join('')).toBe('13.2. Não garantem.');
  });

  it('linha de tabela sem conteúdo some', () => {
    const [tabela] = renderizarTexto('| | |\n|---|---|\n| Plano | X |\n| [SE f] Fidelidade | 1 [FIM SE] |', { f: false }).nos;
    expect(tabela?.tipo === 'tabela' && tabela.linhas.length).toBe(1);
  });

  it('o texto completo de MOD-SAAS-LIC não tem erro de estrutura', () => {
    const fonte = BLOCOS_MOD_SAAS_LIC.map((bloco) => bloco.conteudo).join('\n');
    expect(analisarTexto(fonte).erros).toEqual([]);
  });

  it('CA-11.14: mensal tira 8.3 e 18.3 e mantém a numeração', () => {
    const fonte = BLOCOS_MOD_SAAS_LIC.map((bloco) => bloco.conteudo).join('\n');
    const mensal = texto(fonte, { contrato: { periodicidade: 'mensal' }, entidade: { tipo: 'Pessoa jurídica' } });
    expect(mensal).toContain('8.3. (não aplicável)');
    expect(mensal).toContain('18.3. (não aplicável)');
    expect(mensal).toContain('18.4. Em caso de atraso');
    const anual = texto(fonte, { contrato: { periodicidade: 'anual' }, entidade: { tipo: 'Pessoa jurídica' } });
    expect(anual).not.toContain('18.3. (não aplicável)');
    expect(anual).toContain('18.3. No plano anual, o valor do Período é cobrado uma única vez');
    // Só a seção de cessão da entidade certa.
    expect(mensal).toContain('21. CESSÃO');
    expect(mensal).not.toContain('CESSÃO E FORMALIZAÇÃO');
  });
});
