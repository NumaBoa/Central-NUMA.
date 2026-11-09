import { describe, expect, it } from 'vitest';
import type { LinhaDocumentoLegal } from './legal';
import { resumoLegal } from './legal-do-produto';

const versao = (situacao: string) => ({ situacao }) as LinhaDocumentoLegal['atual'];
const documento = (id: string, tipo: string, produto: string | null, vigente: string | null, atual = vigente ?? 'rascunho') => ({ id, codigo: id, tipo, produto_id: produto, arquivado_em: null, vigente: vigente ? versao(vigente) : null, atual: versao(atual) }) as unknown as LinhaDocumentoLegal;

describe('Legal do produto, lido do M09', () => {
  const documentos = [documento('DL-1', 'termos_uso', 'kipi', 'publicado'), documento('DL-2', 'privacidade', 'kipi', null, 'em_validacao'), documento('DL-3', 'termos_uso', 'zupi', 'publicado')];
  const tratamentos = [{ id: 't1', nome: 'Cadastro de clientes', produto_id: 'kipi', arquivado_em: null }, { id: 't2', nome: 'Outro', produto_id: 'zupi', arquivado_em: null }];

  it('RN-09.02: com usuários reais, diz o que falta publicar', () => {
    const resumo = resumoLegal({ id: 'kipi', tem_usuarios_reais: true }, documentos, tratamentos);
    expect([resumo.pendente, resumo.texto]).toEqual([true, 'Falta publicar: Política de Privacidade']);
    expect(resumo.documentos.map((linha) => [linha.codigo, linha.publicado])).toEqual([['DL-1', true], ['DL-2', false]]);
    expect(resumo.tratamentos.map((linha) => linha.nome)).toEqual(['Cadastro de clientes']);
  });

  it('sem usuários reais, só conta; sem documento, diz que não há', () => {
    expect(resumoLegal({ id: 'kipi', tem_usuarios_reais: false }, documentos, tratamentos).texto).toBe('2 documentos, 1 publicado');
    expect(resumoLegal({ id: 'mimo', tem_usuarios_reais: false }, documentos, tratamentos)).toMatchObject({ texto: 'Nenhum documento legal', pendente: false, tratamentos: [] });
  });
});
