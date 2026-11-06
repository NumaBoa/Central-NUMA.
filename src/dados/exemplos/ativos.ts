import { hojeISO } from '@/lib/datas';
import { montarCodigo } from '@/lib/ids';
import type { AtivoDigital } from '../tipos/ativo';
import { ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_URBANA } from './base';
import { controle } from './controle';
import { ferramentasDeExemplo } from './ferramentas';

const idDoAtivo = (numero: number) => `dbf9fa03-4e5f-4061-8c73-4d5e6f7a${String(numero).padStart(4, '0')}`;

function diasDepois(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Ativos fictícios de `17 §6`, com um domínio vencendo. Os nomes dizem que são de exemplo. */
export function ativosDeExemplo(agora: string) {
  const hoje = hojeISO(new Date(agora));
  const ano = hoje.slice(0, 4);
  const { ferramenta, assinatura_ferramenta } = ferramentasDeExemplo(agora);
  const idDaFerramentaDeExemplo = (nome: string) => ferramenta.find((item) => item.nome === nome)?.id ?? null;
  const idDaAssinaturaDeExemplo = (nome: string) => assinatura_ferramenta.find((item) => item.ferramenta_id === idDaFerramentaDeExemplo(nome))?.id ?? null;
  const exemplos: readonly (Pick<AtivoDigital, 'tipo' | 'identificador' | 'responsavel_id' | 'critico'> & Partial<AtivoDigital>)[] = [
    {
      tipo: 'dominio',
      identificador: 'kipi-exemplo.com.br',
      produto_id: ID_PRODUTO_KIPI,
      // Registrador da carga de ferramentas.
      ferramenta_id: idDaFerramentaDeExemplo('Estúdio Verde Registro'),
      assinatura_id: idDaAssinaturaDeExemplo('Estúdio Verde Registro'),
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_KIMBERLY,
      transferencia_situacao: 'pendente',
      requisito_transferencia: 'Exige o CNPJ da Numa',
      registrado_em: diasDepois(hoje, -340),
      vencimento: diasDepois(hoje, 25),
      renovacao_automatica: false,
      critico: true,
      responsavel_id: ID_CAMILA,
    },
    {
      tipo: 'dominio',
      identificador: 'urbana-exemplo.com.br',
      produto_id: ID_PRODUTO_URBANA,
      ferramenta_id: idDaFerramentaDeExemplo('Estúdio Verde Registro'),
      titular_atual_tipo: 'numa',
      transferencia_situacao: 'nao_necessaria',
      vencimento: diasDepois(hoje, 200),
      renovacao_automatica: true,
      critico: true,
      responsavel_id: ID_CAMILA,
    },
    {
      tipo: 'loja_apple',
      identificador: 'Apple Developer — Numa (exemplo)',
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_CAMILA,
      transferencia_situacao: 'impedida',
      requisito_transferencia: 'Exige CNPJ e D-U-N-S',
      vencimento: diasDepois(hoje, 120),
      renovacao_automatica: true,
      critico: true,
      responsavel_id: ID_CAMILA,
    },
    {
      tipo: 'repositorio',
      identificador: 'numa-studio-exemplo',
      ferramenta_id: idDaFerramentaDeExemplo('Repositório Aberto'),
      titular_atual_tipo: 'numa',
      transferencia_situacao: 'nao_necessaria',
      critico: true,
      responsavel_id: ID_CAMILA,
    },
    {
      tipo: 'rede_social',
      identificador: '@kipi.exemplo',
      produto_id: ID_PRODUTO_KIPI,
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_KIMBERLY,
      transferencia_situacao: 'em_andamento',
      critico: false,
      responsavel_id: ID_KIMBERLY,
    },
  ];
  const ativo_digital: AtivoDigital[] = exemplos.map((dados, indice) => ({
    ...controle(idDoAtivo(indice + 1), true, agora),
    codigo: montarCodigo('ATI', ano, indice + 1),
    produto_id: null,
    ferramenta_id: null,
    titular_atual_tipo: 'numa',
    titular_atual_pessoa_id: null,
    titular_atual_texto: null,
    titular_desejado: 'Numa',
    transferencia_situacao: 'nao_necessaria',
    requisito_transferencia: null,
    registrado_em: null,
    vencimento: null,
    renovacao_automatica: null,
    assinatura_id: null,
    evidencia_transferencia_url: null,
    transferido_em: null,
    observacoes: null,
    ...dados,
  }));
  return { ativo_digital };
}
