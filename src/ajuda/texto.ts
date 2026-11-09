import type { Artigo, Bloco, Disponibilidade, Manual } from './tipos';

/** O texto sem as marcas `**`: para a busca e para a assinatura do conteúdo. */
export const semMarcas = (texto: string) => texto.replaceAll('**', '');

/** Divide um texto em trechos normais e em destaque (`**assim**`), para quem desenha a tela e o PDF. */
export function trechos(texto: string): { texto: string; destaque: boolean }[] {
  return texto.split('**').flatMap((parte, indice) => (parte ? [{ texto: parte, destaque: indice % 2 === 1 }] : []));
}

function textoDoBloco(bloco: Bloco): string[] {
  switch (bloco.tipo) {
    case 'paragrafo':
    case 'subtitulo':
    case 'exemplo':
    case 'atencao':
      return [bloco.texto];
    case 'lista':
      return [...bloco.itens];
    case 'termos':
      return [bloco.titulo ?? '', ...bloco.itens.flatMap((item) => [item.termo, item.significado])];
    case 'procedimento':
      return [bloco.titulo ?? '', bloco.objetivo, ...bloco.antes, bloco.caminho, ...bloco.passos, bloco.resultado, ...(bloco.cuidados ?? [])];
    case 'perguntas':
      return bloco.itens.flatMap((item) => [item.pergunta, item.resposta]);
  }
}

/** Todo o texto do corpo do artigo, sem marcas. */
export function textoDoArtigo(artigo: Pick<Artigo, 'blocos'>): string {
  return semMarcas(artigo.blocos.flatMap(textoDoBloco).join(' '));
}

export const ROTULOS_DISPONIBILIDADE: Readonly<Record<Disponibilidade['tipo'], string>> = {
  disponivel: 'Disponível para usar',
  condicao: 'Disponível mediante condição',
  futuro: 'Ainda não implementado',
};

/** A frase completa da disponibilidade, como aparece na tela, na busca e no PDF. */
export function textoDaDisponibilidade(disponibilidade: Disponibilidade): string {
  if (disponibilidade.tipo === 'condicao') return `${ROTULOS_DISPONIBILIDADE.condicao}: ${disponibilidade.condicao}`;
  if (disponibilidade.tipo === 'futuro') return `${ROTULOS_DISPONIBILIDADE.futuro}. Previsto para: ${disponibilidade.quando}.`;
  return ROTULOS_DISPONIBILIDADE.disponivel;
}

/** "8 de novembro de 2026". */
export function dataPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

/**
 * Assinatura do conteúdo do manual: muda sempre que um texto muda. O PDF guarda a assinatura de quando foi
 * gerado, e um teste acusa quando o arquivo ficou para trás (é preciso gerar de novo). Entram também os rótulos
 * de disponibilidade, que o PDF imprime. Mudança só de aparência (o estilo da impressão) pede gerar de novo à mão.
 */
export function assinaturaDoManual(manual: Manual): string {
  const texto = JSON.stringify([manual, ROTULOS_DISPONIBILIDADE]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const caminhoDoArtigo = (manual: Pick<Manual, 'slug'>, artigo: Pick<Artigo, 'id'>) => `/ajuda/${manual.slug}/${artigo.id}`;
export const caminhoDoPdf = (manual: Pick<Manual, 'arquivo'>) => `/manuais/${manual.arquivo}.pdf`;
export const nomeDoPdf = (manual: Pick<Manual, 'arquivo'>) => `${manual.arquivo}.pdf`;
