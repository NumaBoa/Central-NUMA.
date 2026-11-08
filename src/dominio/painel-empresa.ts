/** T06.01: o painel só lê. Nada aqui grava, e cada bloco leva à tela de onde o dado vem. */
import { repositorios } from '@/dados/repositorios';
import { hojeISO } from '@/lib/datas';
import { faltaTitularidade, versaoVigente } from './acordos';
import { carregarConstituicao, entidadePrincipal, progressoDoChecklist } from './constituicao';
import { carregarDadosDaJornada, marcosDaJornada } from './jornada';
import { carregarMarcas, linhasDasMarcas } from './marcas-inpi';
import { proximasObrigacoes } from './obrigacoes';
import { carregarReunioes } from './reunioes';
import { carregarSociedade, sociasAtivas } from './sociedade';
import { carregarSocias, resumoDaSocia } from './socias';

export async function carregarPainelDaEmpresa(hoje: string = hojeISO()) {
  const [jornada, sociedade, constituicao, marcas, reunioes, investimento, obrigacoes, ocorrencias, contrapartes] = await Promise.all([carregarDadosDaJornada(), carregarSociedade(), carregarConstituicao(), carregarMarcas(), carregarReunioes(), carregarSocias(hoje), repositorios.obrigacao_corporativa.listar(), repositorios.obrigacao_corporativa_ocorrencia.listar(), repositorios.contraparte.listar()]);
  const principal = sociedade.acordos.find((acordo) => (acordo.tipo === 'memorando' || acordo.tipo === 'acordo_socias') && versaoVigente(acordo.id, sociedade.versoes)) ?? sociedade.acordos.find((acordo) => acordo.tipo === 'memorando' || acordo.tipo === 'acordo_socias');
  return {
    marcos: marcosDaJornada(jornada, hoje),
    sociedade,
    socias: sociasAtivas(sociedade.socias, hoje),
    principal: principal ?? null,
    alertaDeTitularidade: faltaTitularidade(sociedade.versoes),
    entidade: entidadePrincipal(jornada.entidades) ?? null,
    contrapartes,
    constituicao,
    progresso: progressoDoChecklist(constituicao.itens),
    marcas: linhasDasMarcas(marcas),
    pendentes: constituicao.pendentesDeTransferencia,
    decisoes: [...reunioes.decisoes].sort((a, b) => b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo)).slice(0, 5),
    obrigacoes: proximasObrigacoes({ obrigacoes, ocorrencias }),
    investimentos: investimento.socias.map((socia) => resumoDaSocia(socia, investimento.movimentos, investimento.reembolsos)),
  };
}

export type DadosDoPainelDaEmpresa = Awaited<ReturnType<typeof carregarPainelDaEmpresa>>;
