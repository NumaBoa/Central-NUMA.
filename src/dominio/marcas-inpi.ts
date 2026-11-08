/**
 * Regras de T06.05 (08-M06): pesquisas de anterioridade e processos por classe, tudo registrado à mão. O sistema não
 * consulta o INPI até a F3 (RN-06.09), e pesquisa registrada não é garantia de registro.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { parDoVinculo, type Vinculo } from '@/dados/tipos/apoio';
import type { Contraparte, Entidade } from '@/dados/tipos/contraparte';
import type { Marca } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { MarcaPesquisa, MarcaPrazo, MarcaProcesso } from '@/dados/tipos/sociedade';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { sincronizarAlertasDasMarcas } from './alertas-m06';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';

export const ROTULOS_RESULTADO_PESQUISA: Readonly<Record<MarcaPesquisa['resultado'], string>> = { disponivel: 'Disponível', conflito_possivel: 'Conflito possível', indisponivel: 'Indisponível' };
export const ROTULOS_APRESENTACAO: Readonly<Record<MarcaProcesso['apresentacao'], string>> = { nominativa: 'Nominativa', mista: 'Mista', figurativa: 'Figurativa' };
export const ROTULOS_SITUACAO_PROCESSO: Readonly<Record<MarcaProcesso['situacao'], string>> = { planejado: 'Planejado', protocolado: 'Protocolado', em_exame: 'Em exame', publicado: 'Publicado', oposicao: 'Oposição', exigencia: 'Exigência', deferido: 'Deferido', registrado: 'Registrado', indeferido: 'Indeferido', arquivado: 'Arquivado' };

/** RN-06.08 e CA-06.04, com as palavras da especificação. */
export const AVISO_NOME_PROVISORIO = 'Verificar disponibilidade antes de investir em identidade';
export const NOTA_PESQUISA_MANUAL = 'Registro manual. A Central não consulta o INPI nesta fase. O resultado é o da pesquisa informada e não garante o registro.';

export function marcaPrecisaDeAviso(marca: Pick<Marca, 'id' | 'provisorio' | 'arquivado_em'>, pesquisas: readonly Pick<MarcaPesquisa, 'marca_id' | 'arquivado_em'>[]): boolean {
  return marca.provisorio && !marca.arquivado_em && !pesquisas.some((pesquisa) => pesquisa.marca_id === marca.id && !pesquisa.arquivado_em);
}

/** A situação mostrada na ficha do produto (CA-06.04). */
export async function avisoDaMarcaDoProduto(marcaId: string | null | undefined): Promise<string | null> {
  if (!marcaId) return null;
  const [marca, pesquisas] = await Promise.all([repositorios.marca.obter(marcaId), repositorios.marca_pesquisa.listar({ onde: { marca_id: marcaId } })]);
  return marca && marcaPrecisaDeAviso(marca, pesquisas) ? AVISO_NOME_PROVISORIO : null;
}

export type DadosDasMarcas = {
  marcas: Marca[];
  pesquisas: MarcaPesquisa[];
  processos: MarcaProcesso[];
  prazos: MarcaPrazo[];
  pessoas: Pessoa[];
  entidades: Entidade[];
  contrapartes: Contraparte[];
  titulos: Titulo[];
  vinculos: Vinculo[];
};

export async function carregarMarcas(): Promise<DadosDasMarcas> {
  const [marcas, pesquisas, processos, prazos, pessoas, entidades, contrapartes, titulos, vinculos] = await Promise.all([repositorios.marca.listar(), repositorios.marca_pesquisa.listar(), repositorios.marca_processo.listar(), repositorios.marca_prazo.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.entidade.listar(), repositorios.contraparte.listar(), repositorios.titulo.listar(), repositorios.vinculo.listar()]);
  return { marcas, pesquisas, processos, prazos, pessoas, entidades, contrapartes, titulos, vinculos };
}

export const pesquisasDaMarca = <T extends Pick<MarcaPesquisa, 'marca_id' | 'data'>>(marcaId: string, pesquisas: readonly T[]): T[] => pesquisas.filter((pesquisa) => pesquisa.marca_id === marcaId).sort((a, b) => b.data.localeCompare(a.data));
export const processosDaMarca = <T extends Pick<MarcaProcesso, 'marca_id'>>(marcaId: string, processos: readonly T[]): T[] => processos.filter((processo) => processo.marca_id === marcaId);

/** O prazo aberto mais próximo de uma marca. */
export function proximoPrazoDaMarca(marcaId: string, { processos, prazos }: Pick<DadosDasMarcas, 'processos' | 'prazos'>): MarcaPrazo | null {
  const dela = new Set(processosDaMarca(marcaId, processos).map((processo) => processo.id));
  return prazos.filter((prazo) => dela.has(prazo.processo_id) && !prazo.cumprido_em).sort((a, b) => a.data_limite.localeCompare(b.data_limite))[0] ?? null;
}

export type LinhaDaMarca = { marca: Marca; pesquisa: MarcaPesquisa | null; processos: MarcaProcesso[]; proximoPrazo: MarcaPrazo | null; aviso: boolean };

export function linhasDasMarcas(dados: Pick<DadosDasMarcas, 'marcas' | 'pesquisas' | 'processos' | 'prazos'>): LinhaDaMarca[] {
  return dados.marcas.map((marca) => ({ marca, pesquisa: pesquisasDaMarca(marca.id, dados.pesquisas)[0] ?? null, processos: processosDaMarca(marca.id, dados.processos), proximoPrazo: proximoPrazoDaMarca(marca.id, dados), aviso: marcaPrecisaDeAviso(marca, dados.pesquisas) }));
}

export type FiltrosMarcas = { busca: string; provisorio: string; situacao: string };
export const FILTROS_MARCAS_INICIAIS: FiltrosMarcas = { busca: '', provisorio: '', situacao: '' };

export function filtrarMarcas(linhas: readonly LinhaDaMarca[], { busca, provisorio, situacao }: FiltrosMarcas): LinhaDaMarca[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return linhas.filter(({ marca, pesquisa, processos }) => {
    if (termo && !marca.nome.toLocaleLowerCase('pt-BR').includes(termo)) return false;
    if (provisorio && (provisorio === 'sim') !== marca.provisorio) return false;
    if (situacao === 'sem_pesquisa') return !pesquisa;
    if (situacao === 'sem_processo') return !processos.length;
    if (situacao) return processos.some((processo) => processo.situacao === situacao);
    return true;
  });
}

// ---------- Pesquisa ----------

export type FormularioPesquisa = { marca_id: string; data: string; feita_por: string; bases: string; resultado: string; observacoes: string; evidencia_url: string };

export const formularioPesquisaVazio = (marcaId: string, pessoaId: string, hoje: string = hojeISO()): FormularioPesquisa => ({ marca_id: marcaId, data: hoje, feita_por: pessoaId, bases: '', resultado: '', observacoes: '', evidencia_url: '' });

export function errosDaPesquisa(formulario: FormularioPesquisa, hoje: string = hojeISO()): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.marca_id) erros.marca_id = 'Escolha a marca.';
  if (!formulario.data) erros.data = 'Informe a data da pesquisa.';
  else if (formulario.data > hoje) erros.data = 'Use hoje ou uma data passada.';
  if (!formulario.feita_por) erros.feita_por = 'Diga quem fez a pesquisa.';
  if (!formulario.resultado) erros.resultado = 'Escolha o resultado.';
  if (formulario.evidencia_url.trim() && !linkDoDriveValido(formulario.evidencia_url)) erros.evidencia_url = MENSAGEM_LINK_DRIVE;
  return erros;
}

export async function registrarPesquisa(formulario: FormularioPesquisa, hoje: string = hojeISO()): Promise<MarcaPesquisa> {
  const erro = Object.values(errosDaPesquisa(formulario, hoje))[0];
  if (erro) throw new ErroDeRegra(erro);
  return repositorios.marca_pesquisa.criar({ marca_id: formulario.marca_id, data: formulario.data, feita_por: formulario.feita_por, bases: formulario.bases.trim() || null, resultado: formulario.resultado as MarcaPesquisa['resultado'], observacoes: formulario.observacoes.trim() || null, evidencia_url: formulario.evidencia_url.trim() || null });
}

/** Pesquisa errada sai com motivo, e o histórico guarda. Se era a única de uma marca provisória, o aviso volta. */
export async function removerPesquisa(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo.');
  await repositorios.marca_pesquisa.arquivar(id, motivo.trim());
}

// ---------- Processo ----------

export type FormularioProcesso = { marca_id: string; classes: string; apresentacao: string; titular_entidade_id: string; numero_processo: string; data_deposito: string; situacao: MarcaProcesso['situacao']; procurador_id: string; observacoes: string };

export const formularioProcessoVazio = (marcaId: string): FormularioProcesso => ({ marca_id: marcaId, classes: '', apresentacao: '', titular_entidade_id: '', numero_processo: '', data_deposito: '', situacao: 'planejado', procurador_id: '', observacoes: '' });

export const formularioDoProcesso = (processo: MarcaProcesso): FormularioProcesso => ({ marca_id: processo.marca_id, classes: processo.classes, apresentacao: processo.apresentacao, titular_entidade_id: processo.titular_entidade_id ?? '', numero_processo: processo.numero_processo ?? '', data_deposito: processo.data_deposito ?? '', situacao: processo.situacao, procurador_id: processo.procurador_id ?? '', observacoes: processo.observacoes ?? '' });

/** T06.05: Planejada vale como intenção; protocolo exige titular real, número e data do depósito. */
export function errosDoProcesso(formulario: FormularioProcesso, entidades: readonly Pick<Entidade, 'id' | 'situacao'>[], hoje: string = hojeISO()): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.marca_id) erros.marca_id = 'Escolha a marca.';
  if (!formulario.classes.trim()) erros.classes = 'Informe a classe ou as classes (Nice).';
  if (!formulario.apresentacao) erros.apresentacao = 'Escolha a apresentação.';
  if (!formulario.titular_entidade_id) erros.titular_entidade_id = 'Escolha a entidade titular.';
  if (formulario.situacao !== 'planejado') {
    if (!formulario.numero_processo.trim()) erros.numero_processo = 'A partir de Protocolado, informe o número do processo.';
    if (!formulario.data_deposito) erros.data_deposito = 'A partir de Protocolado, informe a data do depósito.';
    const titular = entidades.find((entidade) => entidade.id === formulario.titular_entidade_id);
    if (titular && titular.situacao !== 'ativa') erros.titular_entidade_id = 'O protocolo exige um titular real: a entidade precisa estar Ativa.';
  }
  if (formulario.data_deposito && formulario.data_deposito > hoje) erros.data_deposito = 'Use hoje ou uma data passada.';
  return erros;
}

export async function salvarProcesso(formulario: FormularioProcesso, id?: string, hoje: string = hojeISO()): Promise<MarcaProcesso> {
  const entidades = await repositorios.entidade.listar();
  const erro = Object.values(errosDoProcesso(formulario, entidades, hoje))[0];
  if (erro) throw new ErroDeRegra(erro);
  const dados = { marca_id: formulario.marca_id, classes: formulario.classes.trim(), apresentacao: formulario.apresentacao as MarcaProcesso['apresentacao'], titular_entidade_id: formulario.titular_entidade_id, numero_processo: formulario.numero_processo.trim() || null, data_deposito: formulario.data_deposito || null, situacao: formulario.situacao, procurador_id: formulario.procurador_id || null, observacoes: formulario.observacoes.trim() || null };
  return id ? repositorios.marca_processo.atualizar(id, dados) : repositorios.marca_processo.criar(dados);
}

/** Tira o processo de vista com os prazos dele: o alerta aberto se resolve. O histórico guarda. */
export async function removerProcesso(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo.');
  const prazos = await repositorios.marca_prazo.listar({ onde: { processo_id: id } });
  await emTransacao(async () => {
    for (const prazo of prazos) await repositorios.marca_prazo.arquivar(prazo.id, motivo.trim());
    await repositorios.marca_processo.arquivar(id, motivo.trim());
  });
  await sincronizarAlertasDasMarcas();
}

// ---------- Prazos ----------

export type FormularioPrazo = { descricao: string; data_limite: string; responsavel_id: string };

export function errosDoPrazo(formulario: FormularioPrazo): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!formulario.descricao.trim()) erros.descricao = 'Descreva o prazo.';
  if (!formulario.data_limite) erros.data_limite = 'Informe a data-limite.';
  if (!formulario.responsavel_id) erros.responsavel_id = 'Escolha a responsável.';
  return erros;
}

/** RN-06.09: cadastrado à mão, e o alerta nasce aqui mesmo se já estiver na janela. */
export async function adicionarPrazo(processoId: string, formulario: FormularioPrazo): Promise<MarcaPrazo> {
  const erro = Object.values(errosDoPrazo(formulario))[0];
  if (erro) throw new ErroDeRegra(erro);
  const prazo = await repositorios.marca_prazo.criar({ processo_id: processoId, descricao: formulario.descricao.trim(), data_limite: formulario.data_limite, responsavel_id: formulario.responsavel_id, cumprido_em: null });
  await sincronizarAlertasDasMarcas();
  return prazo;
}

export async function cumprirPrazo(id: string, data: string, hoje: string = hojeISO()): Promise<void> {
  if (!data) throw new ErroDeRegra('Informe a data.');
  if (data > hoje) throw new ErroDeRegra('Use hoje ou uma data passada.');
  await repositorios.marca_prazo.atualizar(id, { cumprido_em: data });
  await sincronizarAlertasDasMarcas();
}

export async function reabrirPrazo(id: string): Promise<void> {
  await repositorios.marca_prazo.atualizar(id, { cumprido_em: null });
  await sincronizarAlertasDasMarcas();
}

export async function removerPrazo(id: string): Promise<void> {
  await repositorios.marca_prazo.arquivar(id);
  await sincronizarAlertasDasMarcas();
}

// ---------- Custos: títulos do M05 ----------

export function titulosDoProcesso(processoId: string, { vinculos, titulos }: Pick<DadosDasMarcas, 'vinculos' | 'titulos'>): Titulo[] {
  const ids = vinculos.flatMap((vinculo) => {
    if (vinculo.origem_tipo === 'marca_processo' && vinculo.origem_id === processoId && vinculo.destino_tipo === 'titulo') return [vinculo.destino_id];
    if (vinculo.destino_tipo === 'marca_processo' && vinculo.destino_id === processoId && vinculo.origem_tipo === 'titulo') return [vinculo.origem_id];
    return [];
  });
  return titulos.filter((titulo) => ids.includes(titulo.id));
}

/** Repetir não duplica o vínculo. */
export async function vincularTituloAoProcesso(processoId: string, tituloId: string): Promise<void> {
  const par = parDoVinculo({ tipo: 'marca_processo', id: processoId }, { tipo: 'titulo', id: tituloId });
  const existentes = await repositorios.vinculo.listar({ onde: par });
  if (!existentes.length) await repositorios.vinculo.criar(par);
}

export async function desvincularTituloDoProcesso(processoId: string, tituloId: string): Promise<void> {
  const par = parDoVinculo({ tipo: 'marca_processo', id: processoId }, { tipo: 'titulo', id: tituloId });
  for (const vinculo of await repositorios.vinculo.listar({ onde: par })) await repositorios.vinculo.arquivar(vinculo.id);
}
