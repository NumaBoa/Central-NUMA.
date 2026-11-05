import { formatInTimeZone } from 'date-fns-tz';
import { configuracoesSchema, cambioSchema, backupSchema, type Backup, type Configuracoes, type Cambio, type Estado } from '@/dados/tipos';
import { criarEstadoInicial } from '@/dados/exemplos';
import { BancoLocal } from '@/dados/repositorio-local';

export function lerConfiguracoes(estado: Estado): Configuracoes { return configuracoesSchema.parse(Object.fromEntries(estado.dados.configuracao.map((r) => [r.chave, r.valor]))); }
export function hojeNoFuso(fuso: string, agora = new Date()) { return formatInTimeZone(agora, fuso, 'yyyy-MM-dd'); }
export function pessoasInternas(estado: Estado) { return estado.dados.pessoa.filter((p) => p.tipo === 'interna' && p.situacao === 'ativa' && !p.arquivado_em); }
export function salvarConfiguracoes(banco: BancoLocal, entrada: unknown, cambios: unknown[]) {
  const config = configuracoesSchema.parse(entrada);
  if (config.fase_ativa !== 'f0a') throw new Error('As próximas fases serão liberadas quando suas telas estiverem construídas e validadas.');
  const validos = cambios.map((c) => cambioSchema.parse(c));
  const unicos = validos.map((c) => `${c.moeda}:${c.data_referencia}`); if (new Set(unicos).size !== unicos.length) throw new Error('Já existe um câmbio para essa moeda e data.');
  banco.transacao((estado) => {
    if (!pessoasInternas(estado).some((p) => p.id === config.responsavel_backup_id)) throw new Error('Escolha uma pessoa interna ativa para o backup.');
    const anterior = lerConfiguracoes(estado); const cambioAnterior = structuredClone(estado.dados.cambio_referencia);
    const alterados = Object.keys(config).filter((chave) => anterior[chave as keyof Configuracoes] !== config[chave as keyof Configuracoes]);
    const agora = new Date().toISOString();
    for (const chave of alterados) { const registro = estado.dados.configuracao.find((r) => r.chave === chave)!; registro.valor = config[chave as keyof Configuracoes]; registro.atualizado_em = agora; registro.atualizado_por = estado.meta.pessoa_atual; registro.versao_registro++; }
    estado.dados.cambio_referencia = validos.map((c) => { const antigo = cambioAnterior.find((r) => r.id === c.id); if (antigo && JSON.stringify(antigo) === JSON.stringify(c)) return antigo; return { ...c, criado_por: antigo?.criado_por ?? estado.meta.pessoa_atual, atualizado_em: agora, atualizado_por: estado.meta.pessoa_atual, versao_registro: antigo ? antigo.versao_registro + 1 : 1, exemplo: false }; });
    if (alterados.length || JSON.stringify(cambioAnterior) !== JSON.stringify(estado.dados.cambio_referencia)) banco.registrar(estado, { acao: 'alterou', tabela: 'configuracao', registro_id: 'gerais', resumo: `Configurações atualizadas${alterados.length ? `: ${alterados.length} campo(s)` : ': câmbio de referência'}.`, antes: { configuracoes: anterior, cambios: cambioAnterior }, depois: { configuracoes: config, cambios: estado.dados.cambio_referencia }, motivo: null });
  });
}
export function novoCambio(): Cambio { const agora = new Date().toISOString(); return { id: crypto.randomUUID(), criado_em: agora, criado_por: null, atualizado_em: agora, atualizado_por: null, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo: false, moeda: 'USD', valor_brl: NaN, data_referencia: hojeNoFuso('America/Sao_Paulo'), fonte: '' }; }
export function validarBackup(texto: string): Backup {
  if (new Blob([texto]).size > 4 * 1024 * 1024) throw new Error('O arquivo excede o limite de 4 MB do protótipo.');
  let json: unknown; try { json = JSON.parse(texto); } catch { throw new Error('O arquivo não é um JSON válido. Escolha uma exportação da Central Numa.'); }
  const resultado = backupSchema.safeParse(json); if (!resultado.success) throw new Error('O arquivo não tem o formato da Central Numa ou contém registros inválidos. Nenhum dado foi alterado.');
  const backup = resultado.data; const estado: Estado = { dados: backup.dados, meta: backup.meta };
  const config = lerConfiguracoes(estado); const pessoas = pessoasInternas(estado);
  if (!pessoas.length || !pessoas.some((p) => p.id === config.responsavel_backup_id) || !pessoas.some((p) => p.id === estado.meta.pessoa_atual)) throw new Error('O backup precisa ter a pessoa atual e a responsável pelo backup ativas.');
  if (config.fase_ativa !== 'f0a') throw new Error('Este protótipo aceita apenas backups da fase F0a.');
  for (const registros of Object.values(backup.dados)) if (new Set(registros.map((r) => r.id)).size !== registros.length) throw new Error('O arquivo contém identificadores duplicados.');
  if (new Set(backup.dados.configuracao.map((c) => c.chave)).size !== backup.dados.configuracao.length) throw new Error('O arquivo contém configurações duplicadas.');
  const taxas = backup.dados.cambio_referencia.map((c) => `${c.moeda}:${c.data_referencia}`); if (new Set(taxas).size !== taxas.length) throw new Error('O arquivo contém câmbios duplicados.');
  const contextos = ['consolidada', 'institucional', ...backup.dados.produto.filter((p) => p.situacao === 'ativo' && !p.arquivado_em).map((p) => p.id)];
  if (!contextos.includes(estado.meta.contexto)) throw new Error('O contexto selecionado não existe no backup.');
  return backup;
}
export function exportarBackup(banco: BancoLocal): string {
  banco.transacao((estado) => { const pessoa = estado.dados.pessoa.find((p) => p.id === estado.meta.pessoa_atual); estado.meta.ultimo_backup = new Date().toISOString(); estado.meta.ultimo_backup_por = pessoa?.nome_completo ?? 'Sistema'; banco.registrar(estado, { acao: 'exportou', tabela: 'dados', registro_id: 'central', resumo: 'Backup completo exportado em JSON.', antes: null, depois: null, motivo: null }); });
  const estado = banco.ler(); return JSON.stringify({ sistema: 'central-numa', versao: 1, exportado_em: estado.meta.ultimo_backup, ...estado }, null, 2);
}
export function importarBackup(banco: BancoLocal, backup: Backup) { const validado = validarBackup(JSON.stringify(backup)); banco.transacao((estado) => { const pessoa = estado.meta.pessoa_atual; const nome = estado.dados.pessoa.find((p) => p.id === pessoa)?.nome_completo ?? 'Sistema'; const historico = estado.dados.auditoria; estado.dados = structuredClone(validado.dados); estado.meta = structuredClone(validado.meta); const ids = new Set(estado.dados.auditoria.map((a) => a.id)); estado.dados.auditoria.push(...historico.filter((a) => !ids.has(a.id))); banco.registrar(estado, { acao: 'executou_acao', tabela: 'dados', registro_id: 'central', resumo: `Backup importado por ${nome}.`, antes: null, depois: { exportado_em: validado.exportado_em }, motivo: 'Importação confirmada após prévia.' }); }); }
export function restaurarExemplos(banco: BancoLocal) { banco.transacao((estado) => { const historico = estado.dados.auditoria; const pessoa = estado.meta.pessoa_atual; const inicial = criarEstadoInicial(); estado.dados = inicial.dados; estado.meta = { ...inicial.meta, pessoa_atual: pessoasInternas(inicial).some((p) => p.id === pessoa) ? pessoa : inicial.meta.pessoa_atual }; estado.dados.auditoria = historico; banco.registrar(estado, { acao: 'restaurou', tabela: 'dados', registro_id: 'central', resumo: 'Dados de exemplo restaurados.', antes: null, depois: null, motivo: 'Restauração confirmada pela usuária.' }); }); }
export function limparExemplos(banco: BancoLocal) { banco.transacao((estado) => { const anteriores = estado.dados.pessoa.filter((p) => p.exemplo).length; const removidos = new Set(estado.dados.pessoa.filter((p) => p.exemplo).map((p) => p.id)); const config = lerConfiguracoes(estado); if (removidos.has(config.responsavel_backup_id)) throw new Error('Escolha uma responsável real para o backup antes de limpar os exemplos.'); const dados = estado.dados; dados.pessoa = dados.pessoa.filter((r) => !r.exemplo); dados.produto = dados.produto.filter((r) => !r.exemplo); dados.cambio_referencia = dados.cambio_referencia.filter((r) => !r.exemplo); if (removidos.has(estado.meta.pessoa_atual ?? '')) estado.meta.pessoa_atual = pessoasInternas(estado)[0]?.id ?? null; const contextos = ['consolidada', 'institucional', ...dados.produto.map((p) => p.id)]; if (!contextos.includes(estado.meta.contexto)) estado.meta.contexto = 'consolidada'; banco.registrar(estado, { acao: 'executou_acao', tabela: 'dados', registro_id: 'central', resumo: `${anteriores} pessoa(s) de exemplo removida(s). Cadastros reais preservados.`, antes: null, depois: null, motivo: 'Limpeza de exemplos confirmada.' }); }); }
export function rodarRotinas(banco: BancoLocal, forcar = false): boolean { return banco.transacao((estado) => { const hoje = hojeNoFuso(lerConfiguracoes(estado).fuso); if (!forcar && estado.meta.ultima_rotina === hoje) return false; estado.meta.ultima_rotina = hoje; banco.registrar(estado, { acao: 'executou_acao', tabela: 'rotina', registro_id: hoje, resumo: 'Rotinas verificadas. Nenhuma fonte de alerta construída nesta entrega.', antes: null, depois: { alertas_novos: 0 }, motivo: null }); return true; }); }
export function proximoCodigo(banco: BancoLocal, prefixo: string, ano = new Date().getFullYear()): string { return banco.transacao((estado) => { const chave = `${prefixo}:${ano}`; const numero = (estado.meta.contadores[chave] ?? 0) + 1; estado.meta.contadores[chave] = numero; return `${prefixo}-${ano}-${String(numero).padStart(4, '0')}`; }); }
