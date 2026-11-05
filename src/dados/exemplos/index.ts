import type { Configuracoes, Controle, Estado, Pessoa, Produto } from '../tipos';
export const KIMBERLY = '00000000-0000-4000-8000-000000000001';
export const CAMILA = '00000000-0000-4000-8000-000000000002';
export const configuracoesIniciais: Configuracoes = { organizacao_nome: 'Numa', organizacao_email: '', organizacao_logo_url: '', fuso: 'America/Sao_Paulo', moeda_padrao: 'BRL', uf_padrao: 'RJ', municipio_padrao: 'Rio de Janeiro', fase_ativa: 'f0a', alerta_vencimento_dias: 3, alerta_renovacao_ferramenta_dias: 15, alerta_fim_teste_dias: 3, alerta_dominio_dias: 45, comprovante_obrigatorio: true, responsavel_backup_id: CAMILA };
export function criarEstadoInicial(): Estado {
  const agora = new Date().toISOString();
  const controle = (id: string, exemplo = false): Controle => ({ id, criado_em: agora, criado_por: null, atualizado_em: agora, atualizado_por: null, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo });
  const pessoas: Pessoa[] = [
    { ...controle(KIMBERLY), nome_completo: 'Kimberly Grebe', nome_exibicao: 'Kimberly', tipo: 'interna', eh_socia: true, funcao: 'Financeiro, marketing e jurídico', situacao: 'ativa' },
    { ...controle(CAMILA), nome_completo: 'Camila Lima', nome_exibicao: 'Camila', tipo: 'interna', eh_socia: true, funcao: 'Tecnologia', situacao: 'ativa' },
    { ...controle('00000000-0000-4000-8000-000000000003', true), nome_completo: 'Renata Alves (exemplo)', nome_exibicao: 'Renata', tipo: 'externa', eh_socia: false, funcao: 'Contabilidade — pessoa fictícia', situacao: 'ativa' },
    { ...controle('00000000-0000-4000-8000-000000000004', true), nome_completo: 'Luiza Santos (exemplo)', nome_exibicao: 'Luiza', tipo: 'interna', eh_socia: false, funcao: 'Freelancer — pessoa fictícia', situacao: 'ativa' },
  ];
  const produtos: Produto[] = (['Sobrevivência Urbana', 'Kipi', 'Zupi', 'Zarpa', 'Mimo'] as const).map((nome, index) => ({ ...controle(`00000000-0000-4000-8000-00000000001${index}`), nome, codigo_curto: ['SURB', 'KIPI', 'ZUPI', 'ZARPA', 'MIMO'][index], cor: (['urb', 'kipi', 'zupi', 'zarpa', 'mimo'] as const)[index], provisorio: index > 2, situacao: 'ativo' }));
  return { dados: { pessoa: pessoas, produto: produtos, configuracao: Object.entries(configuracoesIniciais).map(([chave, valor], index) => ({ ...controle(`00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`), chave, valor, descricao: chave })), cambio_referencia: [], auditoria: [] }, meta: { versao: 1, pessoa_atual: KIMBERLY, contexto: 'consolidada', sidebar_recolhida: false, ultima_abertura: null, ultima_rotina: null, ultimo_backup: null, ultimo_backup_por: null, contadores: {} } };
}
