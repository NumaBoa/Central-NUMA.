import { hojeISO } from '@/lib/datas';
import { montarCodigo } from '@/lib/ids';
import type { Arquivo, ArquivoContexto, ArquivoVersao, ArquivoVinculo, Campanha, ConsentimentoTexto, Inscrito, ListaEspera, PecaConteudo } from '../tipos/marketing';
import { ID_BRUNA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_MIMO, ID_PRODUTO_ZUPI } from './base';
import { controle } from './controle';

/*
 * Exemplos do M08 (17 §6): todos com `exemplo: true` e "(exemplo)" no título. Os links são de um Drive
 * fictício e não abrem nenhum arquivo. As datas são relativas ao dia da carga: nada publicado no futuro.
 */

const id = (grupo: string, numero: number) => `9a8b7c6d-${grupo}-4e5f-8a9b-0c1d2e3f${String(numero).padStart(4, '0')}`;
const idArquivo = (numero: number) => id('a001', numero);
const idCampanha = (numero: number) => id('ca01', numero);
const idLista = (numero: number) => id('b001', numero);
const idTexto = (numero: number) => id('c001', numero);

/** Um ID com cara de ID do Drive, mas que diz que é de exemplo. */
const idDoDrive = (numero: number) => `1ExemploCentralNuma${String(numero).padStart(4, '0')}xxxxxxxxxx`;
const linkDoDrive = (numero: number) => `https://drive.google.com/file/d/${idDoDrive(numero)}/view`;

function diasDepois(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

type Base = Pick<Arquivo, 'titulo' | 'tipo' | 'classe'> & Partial<Arquivo> & { produtos: (string | null)[]; versoes?: number };

export function marketingDeExemplo(agora: string) {
  const hoje = hojeISO(new Date(agora));
  const ano = hoje.slice(0, 4);
  const bases: Base[] = [
    { titulo: 'Logo Kipi horizontal (exemplo)', tipo: 'logo', classe: 'pub', produtos: [ID_PRODUTO_KIPI], versoes: 2, origem_autor: 'Bruna Alves (freelancer)', direitos_uso: 'Próprios' },
    { titulo: 'Manual de marca Kipi (exemplo)', tipo: 'identidade', classe: 'int', produtos: [ID_PRODUTO_KIPI], descricao: 'Cores, tipografia e aplicações do Kipi.', direitos_uso: 'Próprios' },
    { titulo: 'Apresentação institucional Numa (exemplo)', tipo: 'apresentacao', classe: 'int', produtos: [null], versoes: 3, finalidade: 'institucional', publico: 'Parceiros', contem_precos: false, descricao: 'Visão geral da Numa, portfólio e contato.' },
    { titulo: 'Kipi: visão do produto (exemplo)', tipo: 'apresentacao', classe: 'pub', produtos: [ID_PRODUTO_KIPI], finalidade: 'produto', publico: 'Clientes', contem_precos: true, precos_data: diasDepois(hoje, -10), data_uso: diasDepois(hoje, -6) },
    { titulo: 'Planejamento interno Numa (exemplo)', tipo: 'apresentacao', classe: 'fin', pasta_restrita_confirmada: true, contem_fin: true, produtos: [null], finalidade: 'institucional', publico: 'Sócias', contem_precos: false },
    { titulo: 'Imagem da campanha de lançamento Kipi (exemplo)', tipo: 'imagem', classe: 'pub', produtos: [ID_PRODUTO_KIPI], origem_autor: 'Banco de imagens (fictício)', direitos_uso: 'Licença de uso em redes sociais', direitos_validade: diasDepois(hoje, 20) },
    { titulo: 'Foto do evento Zupi (exemplo)', tipo: 'imagem', classe: 'pub', produtos: [ID_PRODUTO_ZUPI], origem_autor: 'Fotógrafo contratado (fictício)', direitos_uso: 'Uso por 1 ano', direitos_validade: diasDepois(hoje, -5) },
    { titulo: 'Licença de imagem: banco fictício (exemplo)', tipo: 'contrato', classe: 'doc', pasta_restrita_confirmada: true, produtos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI], descricao: 'Comprovante da licença das imagens de campanha.' },
  ];

  const arquivo: Arquivo[] = [];
  const arquivo_contexto: ArquivoContexto[] = [];
  const arquivo_versao: ArquivoVersao[] = [];
  let numeroDoLink = 0;
  bases.forEach(({ produtos, versoes = 1, ...base }, indice) => {
    const arquivoId = idArquivo(indice + 1);
    const links = Array.from({ length: versoes }, () => (numeroDoLink += 1));
    const atual = links.at(-1) as number;
    arquivo.push({
      ...controle(arquivoId, true, agora),
      codigo: montarCodigo('ARQ', ano, indice + 1),
      descricao: null,
      pasta_restrita_confirmada: false,
      versao_atual: versoes,
      url_atual: linkDoDrive(atual),
      drive_file_id: idDoDrive(atual),
      origem_autor: null,
      direitos_uso: null,
      direitos_validade: null,
      responsavel_id: ID_KIMBERLY,
      finalidade: null,
      publico: null,
      data_uso: null,
      contem_precos: null,
      precos_data: null,
      contem_fin: false,
      ...base,
    });
    produtos.forEach((produto, ordem) => arquivo_contexto.push({ ...controle(id('a002', indice * 10 + ordem + 1), true, agora), arquivo_id: arquivoId, produto_id: produto }));
    links.forEach((link, posicao) =>
      arquivo_versao.push({ ...controle(id('a003', link), true, agora), arquivo_id: arquivoId, versao: posicao + 1, url: linkDoDrive(link), drive_file_id: idDoDrive(link), nota: posicao === 0 ? null : 'Ajustes de cor e margem (exemplo).' }),
    );
  });

  const resultadosVazios = { inscritos: null, contatos: null, oportunidades: null, vendas: null, medido_em: null, observacao: null };
  const campanha: Campanha[] = [
    { ...controle(idCampanha(1), true, agora), codigo: montarCodigo('CAM', ano, 1), nome: 'Lançamento Kipi (exemplo)', produto_id: ID_PRODUTO_KIPI, objetivo: 'Apresentar o produto e captar interessados.', publico: 'Produtores artesanais.', canais: ['instagram', 'email'], inicio: diasDepois(hoje, -5), fim: diasDepois(hoje, 20), orcamento: null, responsavel_id: ID_KIMBERLY, situacao: 'em_andamento', resultados: resultadosVazios, cancelada_motivo: null },
    { ...controle(idCampanha(2), true, agora), codigo: montarCodigo('CAM', ano, 2), nome: 'Comunidade Zupi (exemplo)', produto_id: ID_PRODUTO_ZUPI, objetivo: 'Formar a primeira lista de interessados.', publico: null, canais: ['tiktok'], inicio: diasDepois(hoje, 15), fim: null, orcamento: null, responsavel_id: ID_KIMBERLY, situacao: 'planejada', resultados: resultadosVazios, cancelada_motivo: null },
  ];

  const resultadosDaPeca = { alcance: null, interacoes: null, cliques: null, inscritos: null };
  const peca = (numero: number, dados: Pick<PecaConteudo, 'titulo' | 'produto_id' | 'canal' | 'formato' | 'data_prevista' | 'situacao'> & Partial<PecaConteudo>): PecaConteudo => ({
    ...controle(id('d001', numero), true, agora),
    codigo: montarCodigo('PEC', ano, numero),
    responsavel_id: ID_KIMBERLY,
    campanha_id: null,
    texto: null,
    link_publicacao: null,
    publicado_em: null,
    resultados: resultadosDaPeca,
    medido_em: null,
    cancelado_motivo: null,
    ...dados,
  });
  const peca_conteudo: PecaConteudo[] = [
    peca(1, { titulo: 'Carrossel de lançamento (exemplo)', produto_id: ID_PRODUTO_KIPI, canal: 'instagram', formato: 'carrossel', data_prevista: diasDepois(hoje, 2), situacao: 'producao', campanha_id: idCampanha(1), texto: 'Organize pedidos e receitas com mais clareza.' }),
    peca(2, { titulo: 'Bastidores do Kipi (exemplo)', produto_id: ID_PRODUTO_KIPI, canal: 'instagram', formato: 'story', data_prevista: diasDepois(hoje, 4), situacao: 'revisao', campanha_id: idCampanha(1) }),
    peca(3, { titulo: 'Dica de uso (exemplo)', produto_id: ID_PRODUTO_ZUPI, canal: 'tiktok', formato: 'video_curto', data_prevista: diasDepois(hoje, 6), situacao: 'aprovado', responsavel_id: ID_BRUNA }),
    peca(4, { titulo: 'Depoimento de cliente (exemplo)', produto_id: ID_PRODUTO_KIPI, canal: 'instagram', formato: 'post', data_prevista: diasDepois(hoje, 10), situacao: 'ideia' }),
    peca(5, { titulo: 'Quem é a Numa (exemplo)', produto_id: null, canal: 'linkedin', formato: 'artigo', data_prevista: diasDepois(hoje, -4), situacao: 'publicado', publicado_em: diasDepois(hoje, -3), link_publicacao: 'https://www.linkedin.com/exemplo-numa' }),
    peca(6, { titulo: 'Teaser do Mimo (exemplo)', produto_id: ID_PRODUTO_MIMO, canal: 'instagram', formato: 'video_curto', data_prevista: diasDepois(hoje, -8), situacao: 'cancelado', cancelado_motivo: 'O lançamento foi adiado (exemplo).' }),
  ];

  const lista_espera: ListaEspera[] = [
    { ...controle(idLista(1), true, agora), produto_id: ID_PRODUTO_KIPI, nome: 'Kipi: lançamento (exemplo)', situacao: 'ativa' },
    { ...controle(idLista(2), true, agora), produto_id: ID_PRODUTO_ZUPI, nome: 'Zupi: novidades (exemplo)', situacao: 'ativa' },
  ];
  const textoKipi = (versao: number) => `Quero receber novidades do Kipi por e-mail. Posso cancelar quando quiser (texto de exemplo, versão ${versao}).`;
  const consentimento_texto: ConsentimentoTexto[] = [
    { ...controle(idTexto(1), true, agora), lista_id: idLista(1), versao: 1, texto: textoKipi(1), vigente_desde: diasDepois(hoje, -60) },
    { ...controle(idTexto(2), true, agora), lista_id: idLista(1), versao: 2, texto: textoKipi(2), vigente_desde: diasDepois(hoje, -20) },
    { ...controle(idTexto(3), true, agora), lista_id: idLista(2), versao: 1, texto: 'Quero receber novidades do Zupi por e-mail. Posso cancelar quando quiser (texto de exemplo).', vigente_desde: diasDepois(hoje, -30) },
  ];
  const inscrito = (numero: number, dados: Pick<Inscrito, 'lista_id' | 'nome' | 'email' | 'situacao'> & Partial<Inscrito>): Inscrito => ({
    ...controle(id('e001', numero), true, agora),
    email_normalizado: dados.email.trim().toLowerCase(),
    origem: 'site',
    campanha_id: null,
    consentimento_versao_id: null,
    consentido_em: null,
    descadastrado_em: null,
    convidado_em: null,
    convertido_em: null,
    ...dados,
  });
  const inscritos: Inscrito[] = [
    inscrito(1, { lista_id: idLista(1), nome: 'Marina (exemplo)', email: 'marina@exemplo.com.br', situacao: 'ativo', consentimento_versao_id: idTexto(2), consentido_em: diasDepois(hoje, -2), campanha_id: idCampanha(1) }),
    inscrito(2, { lista_id: idLista(1), nome: 'Rafael (exemplo)', email: 'rafael@exemplo.com.br', situacao: 'convidado', origem: 'evento', consentimento_versao_id: idTexto(2), consentido_em: diasDepois(hoje, -3), convidado_em: diasDepois(hoje, -1) }),
    inscrito(3, { lista_id: idLista(1), nome: 'Ana (exemplo)', email: 'ana@exemplo.com.br', situacao: 'descadastrado', consentimento_versao_id: idTexto(1), consentido_em: diasDepois(hoje, -40), descadastrado_em: diasDepois(hoje, -9) }),
    inscrito(4, { lista_id: idLista(1), nome: 'Júlia (exemplo)', email: 'julia@exemplo.com.br', situacao: 'ativo', origem: 'indicacao' }),
    inscrito(5, { lista_id: idLista(1), nome: 'Pedro (exemplo)', email: 'pedro@exemplo.com.br', situacao: 'convertido', origem: 'rede_social', consentimento_versao_id: idTexto(2), consentido_em: diasDepois(hoje, -12), convidado_em: diasDepois(hoje, -8), convertido_em: diasDepois(hoje, -4), campanha_id: idCampanha(1) }),
    inscrito(6, { lista_id: idLista(1), nome: 'Carla (exemplo)', email: 'carla@exemplo.com.br', situacao: 'ativo', consentimento_versao_id: idTexto(1), consentido_em: diasDepois(hoje, -35) }),
    inscrito(7, { lista_id: idLista(2), nome: 'Bruno (exemplo)', email: 'bruno@exemplo.com.br', situacao: 'ativo', origem: 'rede_social', consentimento_versao_id: idTexto(3), consentido_em: diasDepois(hoje, -7) }),
    inscrito(8, { lista_id: idLista(2), nome: null, email: 'contato.zupi@exemplo.com.br', situacao: 'ativo', consentimento_versao_id: idTexto(3), consentido_em: diasDepois(hoje, -1) }),
  ];

  /** O logo do Kipi aparece na ficha do produto e na campanha: um arquivo, dois vínculos (RN-08.05). */
  const arquivo_vinculo: ArquivoVinculo[] = [
    { ...controle(id('a004', 1), true, agora), arquivo_id: idArquivo(1), registro_tipo: 'produto', registro_id: ID_PRODUTO_KIPI },
    { ...controle(id('a004', 2), true, agora), arquivo_id: idArquivo(1), registro_tipo: 'campanha', registro_id: idCampanha(1) },
    { ...controle(id('a004', 3), true, agora), arquivo_id: idArquivo(6), registro_tipo: 'peca_conteudo', registro_id: id('d001', 1) },
    { ...controle(id('a004', 4), true, agora), arquivo_id: idArquivo(6), registro_tipo: 'campanha', registro_id: idCampanha(1) },
  ];

  return { arquivo, arquivo_contexto, arquivo_versao, arquivo_vinculo, campanha, peca_conteudo, lista_espera, consentimento_texto, inscrito: inscritos };
}

export const ARQUIVOS_DE_EXEMPLO = 8;
export const CAMPANHAS_DE_EXEMPLO = 2;
export const PECAS_DE_EXEMPLO = 6;
export const LISTAS_DE_EXEMPLO = 2;
export const INSCRITOS_DE_EXEMPLO = 8;
