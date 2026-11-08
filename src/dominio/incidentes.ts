/**
 * T12.05 Incidentes de disponibilidade (RN-12.10 e RN-12.11). A disponibilidade mensal é um indicador gerencial,
 * com o critério à vista: 1 − (minutos de quedas totais + 50% das parciais) ÷ minutos do mês. Degradado não
 * conta. A meta vem do contrato (exceção) ou da oferta (M07), sem cópia; abaixo dela, créditos possíveis,
 * para decidir à mão. O incidente de segurança (M09, T09.05) ficou fora do que será construído: a resposta
 * sobre dados pessoais fica registrada, como pendência, e o vínculo espera.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Contrato } from '@/dados/tipos/contrato';
import { IMPACTOS_INCIDENTE, type IncidenteDisponibilidade } from '@/dados/tipos/operacao';
import { diaEHoraNoFuso, instanteNoFuso } from '@/lib/datas';
import { produtosDoContrato } from './horas';
import { catalogoComercial } from './integracoes/conexoes';
import { indiceDoDia, paraMinuto } from './sla';

export const ROTULOS_IMPACTO: Readonly<Record<IncidenteDisponibilidade['impacto'], string>> = { total: 'Total', parcial: 'Parcial', degradado: 'Degradado' };
export const CRITERIO_DA_DISPONIBILIDADE = 'Disponibilidade = 1 − (minutos de quedas totais + 50% dos minutos de quedas parciais) ÷ minutos do mês. Degradado não entra na conta.';
export const PENDENCIA_SEGURANCA = 'Envolve dados pessoais: precisa também de um registro de incidente de segurança (M09). A tela de incidentes de segurança não faz parte do que será construído (decisão de 07/11/2026), então o vínculo não é criado: avise o Jurídico e guarde a evidência nos arquivos deste incidente.';

const hora = /^([01]\d|2[0-3]):[0-5]\d$/;

export const esquemaFormularioIncidente = z
  .object({
    produto_id: z.string().min(1, 'Escolha o produto.'),
    titulo: z.string().trim().min(1, 'Dê um título curto.').max(140, 'Até 140 caracteres.'),
    inicio_dia: z.string().min(1, 'Informe o dia do início.'),
    inicio_hora: z.string().regex(hora, 'Informe a hora do início.'),
    fim_dia: z.string(),
    fim_hora: z.string(),
    impacto: z.enum(IMPACTOS_INCIDENTE, { error: 'Escolha o impacto.' }),
    causa: z.string().trim(),
    acoes: z.string().trim(),
    comunicado: z.boolean(),
    comunicado_dia: z.string(),
    comunicado_hora: z.string(),
    canal: z.string().trim(),
    envolve_dados_pessoais: z.enum(['sim', 'nao'], { error: 'Responda se envolve dados pessoais.' }),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (Boolean(dados.fim_dia) !== Boolean(dados.fim_hora)) falha(dados.fim_dia ? 'fim_hora' : 'fim_dia', 'Informe o dia e a hora do fim, ou deixe os dois vazios enquanto durar.');
    if (dados.fim_hora && !hora.test(dados.fim_hora)) falha('fim_hora', 'Use a hora como 14:30.');
    if (dados.fim_dia && dados.fim_hora && `${dados.fim_dia}T${dados.fim_hora}` <= `${dados.inicio_dia}T${dados.inicio_hora}`) falha('fim_dia', 'O fim vem depois do início.');
    if (dados.comunicado) {
      if (!dados.comunicado_dia || !hora.test(dados.comunicado_hora)) falha('comunicado_dia', 'Diga quando os clientes foram comunicados.');
      if (!dados.canal) falha('canal', 'Diga por qual canal.');
      if (dados.comunicado_dia && hora.test(dados.comunicado_hora) && `${dados.comunicado_dia}T${dados.comunicado_hora}` < `${dados.inicio_dia}T${dados.inicio_hora}`) falha('comunicado_dia', 'A comunicação vem depois do início.');
    }
  });
export type FormularioIncidente = z.infer<typeof esquemaFormularioIncidente>;

export function formularioIncidenteVazio(responsavelId: string, agora: string = new Date().toISOString()): FormularioIncidente {
  const { dia, hora: horaAtual } = diaEHoraNoFuso(agora);
  return { produto_id: '', titulo: '', inicio_dia: dia, inicio_hora: horaAtual, fim_dia: '', fim_hora: '', impacto: 'total', causa: '', acoes: '', comunicado: false, comunicado_dia: '', comunicado_hora: '', canal: '', envolve_dados_pessoais: '' as never, responsavel_id: responsavelId };
}

export function formularioDoIncidente(incidente: IncidenteDisponibilidade): FormularioIncidente {
  const parte = (instante: string | null) => (instante ? diaEHoraNoFuso(instante) : { dia: '', hora: '' });
  const inicio = parte(incidente.inicio);
  const fim = parte(incidente.fim);
  const comunicado = parte(incidente.comunicado_em);
  return { produto_id: incidente.produto_id, titulo: incidente.titulo, inicio_dia: inicio.dia, inicio_hora: inicio.hora, fim_dia: fim.dia, fim_hora: fim.hora, impacto: incidente.impacto, causa: incidente.causa ?? '', acoes: incidente.acoes ?? '', comunicado: incidente.comunicado, comunicado_dia: comunicado.dia, comunicado_hora: comunicado.hora, canal: incidente.canal ?? '', envolve_dados_pessoais: incidente.envolve_dados_pessoais === null ? ('' as never) : incidente.envolve_dados_pessoais ? 'sim' : 'nao', responsavel_id: incidente.responsavel_id };
}

/** RN-12.10. Não registra o futuro: início, fim e comunicação vão até agora. */
export async function salvarIncidente(formulario: FormularioIncidente, id?: string, agora: string = new Date().toISOString()): Promise<IncidenteDisponibilidade> {
  const dados = esquemaFormularioIncidente.parse(formulario);
  const inicio = instanteNoFuso(dados.inicio_dia, dados.inicio_hora);
  const fim = dados.fim_dia ? instanteNoFuso(dados.fim_dia, dados.fim_hora) : null;
  const comunicadoEm = dados.comunicado ? instanteNoFuso(dados.comunicado_dia, dados.comunicado_hora) : null;
  if (inicio > agora || (fim && fim > agora) || (comunicadoEm && comunicadoEm > agora)) throw new ErroDeRegra('Registre o que já aconteceu: as datas vão até agora.');
  const registro = { produto_id: dados.produto_id, titulo: dados.titulo, inicio, fim, impacto: dados.impacto, causa: dados.causa || null, acoes: dados.acoes || null, comunicado: dados.comunicado, comunicado_em: comunicadoEm, canal: dados.comunicado ? dados.canal : null, envolve_dados_pessoais: dados.envolve_dados_pessoais === 'sim', responsavel_id: dados.responsavel_id };
  if (!id) return repositorios.incidente_disponibilidade.criar({ ...registro, incidente_seguranca_id: null });
  const atual = await repositorios.incidente_disponibilidade.obter(id);
  if (!atual) throw new ErroDeRegra('Este incidente não existe mais.');
  if (atual.produto_id !== dados.produto_id && (await repositorios.solicitacao_suporte.listar({ onde: { incidente_id: id } })).length) throw new ErroDeRegra('Há solicitações vinculadas a este incidente: o produto não muda.');
  return repositorios.incidente_disponibilidade.atualizar(id, registro);
}

/** Encerrar: o fim, agora ou no horário informado. */
export async function encerrarIncidente(id: string, fim: string, agora: string = new Date().toISOString()): Promise<IncidenteDisponibilidade> {
  const atual = await repositorios.incidente_disponibilidade.obter(id);
  if (!atual) throw new ErroDeRegra('Este incidente não existe mais.');
  if (atual.fim) throw new ErroDeRegra('Este incidente já foi encerrado.');
  if (fim <= atual.inicio) throw new ErroDeRegra('O fim vem depois do início.');
  if (fim > agora) throw new ErroDeRegra('O fim vai até agora.');
  return repositorios.incidente_disponibilidade.atualizar(id, { fim });
}

export async function removerIncidente(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Remover exige motivo.');
  if ((await repositorios.solicitacao_suporte.listar({ onde: { incidente_id: id } })).length) throw new ErroDeRegra('Há solicitações vinculadas: tire os vínculos antes.');
  await repositorios.incidente_disponibilidade.arquivar(id, motivo.trim());
}

// ---------- Disponibilidade mensal (RN-12.11) ----------

const MINUTOS_NO_DIA = 1440;

/** O mês aaaa-mm em minutos locais: [início, fim). */
function janelaDoMes(mes: string): [number, number] {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  const proximo = numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`;
  return [indiceDoDia(`${mes}-01`) * MINUTOS_NO_DIA, indiceDoDia(`${proximo}-01`) * MINUTOS_NO_DIA];
}

export type Disponibilidade = { mes: string; produtoId: string; minutosDoMes: number; minutosTotais: number; minutosParciais: number; disponibilidade: number; emAndamento: boolean; incidentes: number };

/** Só a parte de cada incidente que cai no mês; o que ainda não terminou conta até agora. */
export function disponibilidadeDoMes(incidentes: readonly Pick<IncidenteDisponibilidade, 'produto_id' | 'inicio' | 'fim' | 'impacto' | 'arquivado_em'>[], produtoId: string, mes: string, agora: string, fuso?: string): Disponibilidade {
  const [inicioMes, fimMes] = janelaDoMes(mes);
  const agoraLocal = paraMinuto(agora, fuso);
  let totais = 0;
  let parciais = 0;
  let contados = 0;
  let emAndamento = false;
  for (const incidente of incidentes) {
    if (incidente.arquivado_em || incidente.produto_id !== produtoId || incidente.impacto === 'degradado') continue;
    const a = Math.max(paraMinuto(incidente.inicio, fuso), inicioMes);
    const b = Math.min(incidente.fim ? paraMinuto(incidente.fim, fuso) : agoraLocal, fimMes);
    if (b <= a) continue;
    contados += 1;
    if (!incidente.fim) emAndamento = true;
    if (incidente.impacto === 'total') totais += b - a;
    else parciais += b - a;
  }
  const minutosDoMes = fimMes - inicioMes;
  return { mes, produtoId, minutosDoMes, minutosTotais: totais, minutosParciais: parciais, disponibilidade: 1 - (totais + parciais * 0.5) / minutosDoMes, emAndamento, incidentes: contados };
}

export function textoDaDisponibilidade(valor: number): string {
  return `${(valor * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;
}

export type CompromissoDeDisponibilidade = { origem: 'contrato' | 'oferta'; rotulo: string; meta: number; creditos: string | null; contrato: Contrato | null; abaixo: boolean };

/**
 * As metas que valem para o produto: as exceções de contrato com disponibilidade mínima e as metas das ofertas
 * aprovadas (M07). Abaixo da meta: créditos possíveis, decisão manual (RN-11.11 e RN-12.11).
 */
export async function compromissosDoProduto(produtoId: string, disponibilidade: number): Promise<CompromissoDeDisponibilidade[]> {
  const [regras, contratos, itens, ofertas] = await Promise.all([repositorios.sla_regra.listar(), repositorios.contrato.listar(), repositorios.item_contrato.listar(), catalogoComercial().ofertasDoProduto(produtoId)]);
  const lista: CompromissoDeDisponibilidade[] = [];
  for (const contrato of contratos) {
    if (contrato.encerrado_em || contrato.situacao_documental === 'cancelado' || !produtosDoContrato(contrato, itens).includes(produtoId)) continue;
    const excecao = regras.find((regra) => regra.contrato_id === contrato.id && regra.disponibilidade_minima !== null);
    if (excecao) lista.push({ origem: 'contrato', rotulo: `${contrato.codigo} · ${contrato.titulo}`, meta: excecao.disponibilidade_minima as number, creditos: excecao.creditos, contrato, abaixo: disponibilidade * 100 < (excecao.disponibilidade_minima as number) });
  }
  for (const oferta of ofertas) {
    if (oferta.situacao !== 'aprovada' || oferta.disponibilidade_meta === null) continue;
    lista.push({ origem: 'oferta', rotulo: `Oferta ${oferta.nome}`, meta: oferta.disponibilidade_meta, creditos: oferta.disponibilidade_compensacao, contrato: null, abaixo: disponibilidade * 100 < oferta.disponibilidade_meta });
  }
  return lista;
}

// ---------- Ler ----------

export async function carregarIncidentes() {
  const [incidentes, produtos, pessoas, solicitacoes] = await Promise.all([repositorios.incidente_disponibilidade.listar(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.solicitacao_suporte.listar()]);
  return { incidentes: incidentes.sort((a, b) => b.inicio.localeCompare(a.inicio)), produtos, pessoas, solicitacoes };
}

/** A disponibilidade do mês de cada produto com incidente, e as metas que valem para ele. */
export async function painelDeDisponibilidade(mes: string, agora: string = new Date().toISOString()) {
  const [incidentes, produtos] = await Promise.all([repositorios.incidente_disponibilidade.listar(), repositorios.produto.listar()]);
  const linhas = [];
  for (const produto of produtos) {
    const conta = disponibilidadeDoMes(incidentes, produto.id, mes, agora);
    const compromissos = await compromissosDoProduto(produto.id, conta.disponibilidade);
    if (!conta.incidentes && !compromissos.length) continue;
    linhas.push({ produto, conta, compromissos });
  }
  return linhas;
}

export async function carregarIncidente(id: string) {
  const incidente = await repositorios.incidente_disponibilidade.obter(id);
  if (!incidente) return null;
  const [solicitacoes, produtos, pessoas] = await Promise.all([repositorios.solicitacao_suporte.listar({ onde: { produto_id: incidente.produto_id } }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  return { incidente, vinculadas: solicitacoes.filter((linha) => linha.incidente_id === id), disponiveis: solicitacoes.filter((linha) => !linha.incidente_id && linha.situacao !== 'cancelada'), produtos, pessoas };
}

export async function historicoDoIncidente(id: string) {
  const { historicoDosRegistros } = await import('./historico');
  const anexos = await repositorios.anexo_link.listar({ onde: { registro_id: id }, incluirArquivados: true });
  return historicoDosRegistros([id, ...anexos.map((anexo) => anexo.id)]);
}

/** Duração legível: "2 h 15 min", ou "em andamento". */
export function duracaoDoIncidente(incidente: Pick<IncidenteDisponibilidade, 'inicio' | 'fim'>, agora: string): string {
  const fim = incidente.fim ?? agora;
  const minutos = Math.max(0, Math.round((Date.parse(fim) - Date.parse(incidente.inicio)) / 60_000));
  const dias = Math.floor(minutos / MINUTOS_NO_DIA);
  const horas = Math.floor((minutos % MINUTOS_NO_DIA) / 60);
  const resto = minutos % 60;
  const texto = [dias ? `${dias} d` : '', horas ? `${horas} h` : '', resto || (!dias && !horas) ? `${resto} min` : ''].filter(Boolean).join(' ');
  return incidente.fim ? texto : `${texto}, em andamento`;
}
