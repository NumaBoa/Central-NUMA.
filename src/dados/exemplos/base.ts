/**
 * Estrutura real da Numa: sócias (D18), áreas (D11), marcas e produtos (T02.04).
 */
export const ID_KIMBERLY = '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01';
export const ID_CAMILA = '1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02';

/**
 * Áreas de T02.03 e D11: dados reais, não são exemplo. Quem atua em cada uma vem da mesma tabela;
 * Produto é compartilhada entre as duas sócias (decisão de 05/11/2026).
 */
export const AREAS_INICIAIS = [
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b01', nome: 'Tecnologia', responsavel: ID_CAMILA, compartilhada: false, pessoas: [ID_CAMILA] },
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b02', nome: 'Financeiro', responsavel: ID_KIMBERLY, compartilhada: false, pessoas: [ID_KIMBERLY] },
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b03', nome: 'Social media / Marketing', responsavel: ID_KIMBERLY, compartilhada: false, pessoas: [ID_KIMBERLY] },
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b04', nome: 'Jurídico e privacidade', responsavel: ID_KIMBERLY, compartilhada: false, pessoas: [ID_KIMBERLY] },
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b05', nome: 'Comercial', responsavel: null, compartilhada: true, pessoas: [ID_KIMBERLY, ID_CAMILA] },
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b06', nome: 'Gestão geral', responsavel: null, compartilhada: true, pessoas: [ID_KIMBERLY, ID_CAMILA] },
  { id: 'a2c0e1d4-7b3f-4a10-8c01-0f1e2d3c4b07', nome: 'Produto', responsavel: null, compartilhada: true, pessoas: [ID_KIMBERLY, ID_CAMILA] },
] as const;

export const ID_MARCA_NUMA = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e01';
export const ID_MARCA_URBANA = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e02';
export const ID_MARCA_KIPI = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e03';
export const ID_MARCA_ZUPI = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e04';
export const ID_MARCA_ZARPA = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e05';
export const ID_MARCA_MIMO = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e06';

/** Marcas de T02.04, com as cores oficiais de 18 §3.2: dados reais, não são exemplo. */
export const MARCAS_INICIAIS = [
  { id: ID_MARCA_NUMA, nome: 'Numa', cor: '#6366F1', provisorio: false, institucional: true },
  { id: ID_MARCA_URBANA, nome: 'Sobrevivência Urbana', cor: '#D9962B', provisorio: false, institucional: false },
  { id: ID_MARCA_KIPI, nome: 'Kipi', cor: '#A8693A', provisorio: false, institucional: false },
  { id: ID_MARCA_ZUPI, nome: 'Zupi', cor: '#4E9A72', provisorio: false, institucional: false },
  { id: ID_MARCA_ZARPA, nome: 'Zarpa', cor: '#3478B8', provisorio: true, institucional: false },
  { id: ID_MARCA_MIMO, nome: 'Mimo', cor: '#C2668A', provisorio: true, institucional: false },
] as const;

export const ID_PRODUTO_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';

/** T02.05: criada na carga inicial, para permitir rascunhos. Dado real, não é exemplo. */
export const ID_ENTIDADE_PLANEJADA = 'd5f3b4a7-ae62-4d43-9f34-3c4d5e6f7a01';

/** Contraparte fictícia ligada ao contador de exemplo. */
export const ID_CONTRAPARTE_CONTABILIDADE = 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b01';

/** Contas de exemplo de `17 §6`: os nomes reais só vêm com o uso (`04-M02 §4`). */
export const ID_CONTA_KIMBERLY = 'a8c6e7da-d195-4a76-8c67-6f7a8b9c0d01';
export const ID_CONTA_CAMILA = 'a8c6e7da-d195-4a76-8c67-6f7a8b9c0d02';

const GRUPOS_DE_CATEGORIAS = [
  { nome: 'Infraestrutura e software', tipo: 'despesa', categorias: ['Hospedagem e nuvem', 'Banco de dados', 'Domínios', 'E-mail e produtividade', 'Design e criação', 'IA', 'Desenvolvimento (repositório, CI)', 'Lojas de aplicativos (contas de desenvolvedor)', 'Outras assinaturas'] },
  { nome: 'Serviços de terceiros', tipo: 'despesa', categorias: ['Contabilidade', 'Jurídico', 'Design/freelancer', 'Desenvolvimento/freelancer', 'Registro de marca'] },
  { nome: 'Marketing', tipo: 'despesa', categorias: ['Anúncios pagos', 'Produção de conteúdo', 'Eventos', 'Brindes e materiais'] },
  { nome: 'Administrativo', tipo: 'despesa', categorias: ['Tarifas bancárias', 'Juros e multas', 'Taxas e impostos (informativo)', 'Certificado digital', 'Cartório e registros', 'Outros'] },
  { nome: 'Pessoal / sócias', tipo: 'despesa', categorias: ['Reembolso de despesas'] },
  { nome: 'Receitas', tipo: 'receita', categorias: ['Assinaturas', 'Implantação/setup', 'Serviços sob medida', 'Comissões', 'Patrocínio/apoio', 'Outras receitas'] },
  { nome: 'Movimentos societários', tipo: 'movimento_societario', categorias: ['Aporte de capital', 'Retirada', 'Distribuição'] },
  { nome: 'Transferências', tipo: 'transferencia', categorias: ['Entre contas próprias'] },
] as const;

const idDeCategoria = (grupo: number, categoria: number) => `f7b5d6c9-c084-4f65-9b56-5e6f7a8b${String(grupo + 1).padStart(2, '0')}${String(categoria).padStart(2, '0')}`;

/**
 * Carga inicial sugerida de T02.07: dados reais e editáveis, não são exemplo. Grupo vem antes das
 * suas categorias. O tipo vem do grupo; a natureza do custo fica vazia, porque a especificação não
 * diz qual é (Mapa, "A revisar por Kimberly").
 */
export const CATEGORIAS_INICIAIS = GRUPOS_DE_CATEGORIAS.flatMap((grupo, g) => [
  { id: idDeCategoria(g, 0), nome: grupo.nome, tipo: grupo.tipo, pai: null as string | null },
  ...grupo.categorias.map((nome, c) => ({ id: idDeCategoria(g, c + 1), nome, tipo: grupo.tipo, pai: idDeCategoria(g, 0) as string | null })),
]);

/**
 * Produtos de T02.04 e M07 §6. O que a especificação não diz fica em "A revisar por Kimberly", no
 * Mapa: responsável (vazio), tipo de Zarpa e Mimo (Outro), usuários reais do Sobrevivência Urbana.
 */
export const PRODUTOS_INICIAIS = [
  { id: 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f02', marca: ID_MARCA_URBANA, nome: 'Sobrevivência Urbana', codigo: 'SURB', tipo: 'app_mobile', estagio: 'em_uso', fila: null, usuarios: true, contextoAntigo: 'urb' },
  { id: ID_PRODUTO_KIPI, marca: ID_MARCA_KIPI, nome: 'Kipi', codigo: 'KIPI', tipo: 'app_mobile', estagio: 'em_uso', fila: null, usuarios: true, contextoAntigo: 'kipi' },
  { id: 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f04', marca: ID_MARCA_ZUPI, nome: 'Zupi', codigo: 'ZUPI', tipo: 'app_mobile', estagio: 'ideia', fila: 1, usuarios: false, contextoAntigo: 'zupi' },
  { id: 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f05', marca: ID_MARCA_ZARPA, nome: 'Zarpa', codigo: 'ZARPA', tipo: 'outro', estagio: 'ideia', fila: 2, usuarios: false, contextoAntigo: 'zarpa' },
  { id: 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f06', marca: ID_MARCA_MIMO, nome: 'Mimo', codigo: 'MIMO', tipo: 'outro', estagio: 'ideia', fila: 3, usuarios: false, contextoAntigo: 'mimo' },
] as const;
