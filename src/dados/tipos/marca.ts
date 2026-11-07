import { z } from 'zod';
import { esquemaControle } from './controle';

/** `marca` (16 §4.2). Só a marca "Numa" é institucional. */
export const esquemaMarca = esquemaControle.extend({
  nome: z.string().trim().min(1),
  provisorio: z.boolean(),
  cor_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logo_url: z.string().nullable(),
  institucional: z.boolean(),
  situacao: z.enum(['ativa', 'pausada', 'encerrada']),
});

export type Marca = z.infer<typeof esquemaMarca>;

/**
 * `produto` (16 §4.2), com o cadastro básico de T02.04; os demais campos entram com M07 (F0b).
 * `responsavel_id` é obrigatório no formulário, mas a carga inicial não o define: a especificação
 * não diz quem é, e o sistema não inventa (RT-08). A tela mostra o que falta escolher.
 */
export const esquemaProduto = esquemaControle.extend({
  marca_id: z.uuid(),
  nome: z.string().trim().min(1),
  codigo_curto: z.string().regex(/^[A-Z]{3,6}$/),
  tipo: z.enum(['app_mobile', 'web', 'site', 'servico', 'outro']),
  descricao_curta: z.string().max(200).nullable(),
  estagio: z.enum(['ideia', 'validacao', 'mvp', 'em_uso', 'crescimento', 'pausado', 'descontinuado']),
  ordem_fila: z.int().nonnegative().nullable(),
  responsavel_id: z.uuid().nullable(),
  entidade_id: z.uuid().nullable(),
  tem_usuarios_reais: z.boolean(),
  data_inicio: z.iso.date().nullable(),
  situacao: z.enum(['ativo', 'pausado', 'descontinuado']),
  // Ficha do M07 (T07.02). Opcionais: produto cadastrado antes do M07 e backups antigos não os têm, e vazio fica vazio.
  descricao: z.string().nullable().optional(),
  proposta_valor: z.string().nullable().optional(),
  publico: z.string().nullable().optional(),
  problema: z.string().nullable().optional(),
  como_nasceu: z.string().nullable().optional(),
  links: z.array(z.object({ rotulo: z.string(), url: z.string() })).optional(),
  /** D21: cada app define depois; sem ela, o KPI mostra "Definição pendente". */
  definicao_usuario_ativo: z.string().nullable().optional(),
});

export type Produto = z.infer<typeof esquemaProduto>;
