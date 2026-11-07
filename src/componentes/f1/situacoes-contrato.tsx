import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import type { Contrato } from '@/dados/tipos/contrato';
import { ROTULOS_DOCUMENTAL, ROTULOS_FINANCEIRA, ROTULOS_RENOVACAO, ROTULOS_VIGENCIA } from '@/dominio/contratos';

const DOCUMENTAL: Readonly<Record<Contrato['situacao_documental'], TipoSituacao>> = { rascunho: 'neutro', em_revisao: 'info', aprovado_envio: 'info', enviado_assinatura: 'atencao', assinado: 'sucesso', recusado: 'erro', cancelado: 'neutro' };
const VIGENCIA: Readonly<Record<keyof typeof ROTULOS_VIGENCIA, TipoSituacao>> = { sem_vigencia: 'neutro', futuro: 'info', vigente: 'sucesso', suspenso: 'atencao', encerrado: 'neutro' };
const FINANCEIRA: Readonly<Record<keyof typeof ROTULOS_FINANCEIRA, TipoSituacao>> = { sem_programacao: 'neutro', em_dia: 'sucesso', parcial: 'atencao', com_vencidos: 'erro', quitado: 'sucesso' };
const RENOVACAO: Readonly<Record<Contrato['renovacao_situacao'], TipoSituacao>> = { nao_se_aplica: 'neutro', em_analise: 'atencao', renovar: 'info', nao_renovar: 'neutro', renovado: 'sucesso' };

/** As quatro situações, independentes (13-M11 §3), sempre com o nome da dimensão no texto. */
export function SituacoesDoContrato({ documental, vigencia, financeira, renovacao, compacto = false }: { documental: Contrato['situacao_documental']; vigencia: keyof typeof ROTULOS_VIGENCIA; financeira: keyof typeof ROTULOS_FINANCEIRA; renovacao: Contrato['renovacao_situacao']; compacto?: boolean }) {
  const rotulo = (nome: string) => (compacto ? <span className="sr-only">{nome}: </span> : `${nome}: `);
  return (
    <span className="flex flex-wrap gap-1">
      <EtiquetaSituacao tipo={DOCUMENTAL[documental]}>{rotulo('Documental')}{ROTULOS_DOCUMENTAL[documental]}</EtiquetaSituacao>
      <EtiquetaSituacao tipo={VIGENCIA[vigencia]}>{rotulo('Vigência')}{ROTULOS_VIGENCIA[vigencia]}</EtiquetaSituacao>
      <EtiquetaSituacao tipo={FINANCEIRA[financeira]}>{rotulo('Financeiro')}{ROTULOS_FINANCEIRA[financeira]}</EtiquetaSituacao>
      {!compacto && <EtiquetaSituacao tipo={RENOVACAO[renovacao]}>{rotulo('Renovação')}{ROTULOS_RENOVACAO[renovacao]}</EtiquetaSituacao>}
    </span>
  );
}
