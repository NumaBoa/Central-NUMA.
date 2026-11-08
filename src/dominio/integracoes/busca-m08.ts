/**
 * O que o M08 acrescenta à busca global (T13.03). Itens restritos passam por `podeVerClasse` (CA-08.01):
 * hoje libera tudo (D27), e a etapa com servidor só precisa mudar lá. Inscritos ficam de fora: são dados pessoais.
 */
import { repositorios } from '@/dados/repositorios';
import { formatarDiaISO } from '@/lib/formatacao';
import { ROTULOS_TIPO_ARQUIVO } from '../biblioteca';
import { ROTULOS_SITUACAO_CAMPANHA } from '../campanhas';
import { podeVerClasse, ROTULOS_CLASSE } from '../classes';
import { ROTULOS_CANAL, ROTULOS_SITUACAO_PECA } from '../conteudo';

type Candidato = { id: string; codigo: string | null; titulo: string; detalhe: string; href: string; texto: string; peso: number };

export async function candidatosDoM08(): Promise<{ tipo: string; rotulo: string; candidatos: Candidato[] }[]> {
  const [arquivos, campanhas, pecas, listas] = await Promise.all([repositorios.arquivo.listar(), repositorios.campanha.listar(), repositorios.peca_conteudo.listar(), repositorios.lista_espera.listar()]);
  return [
    {
      tipo: 'arquivos',
      rotulo: 'Biblioteca',
      candidatos: arquivos
        .filter((arquivo) => podeVerClasse(arquivo.classe))
        .map((arquivo) => ({ id: arquivo.id, codigo: arquivo.codigo, titulo: arquivo.titulo, detalhe: `${ROTULOS_TIPO_ARQUIVO[arquivo.tipo]} · ${ROTULOS_CLASSE[arquivo.classe]}`, href: `/marketing/arquivos/${arquivo.id}`, texto: `${arquivo.codigo} ${arquivo.titulo} ${arquivo.descricao ?? ''}`, peso: 0 })),
    },
    {
      tipo: 'campanhas',
      rotulo: 'Campanhas',
      candidatos: campanhas.map((campanha) => ({ id: campanha.id, codigo: campanha.codigo, titulo: campanha.nome, detalhe: ROTULOS_SITUACAO_CAMPANHA[campanha.situacao], href: `/marketing/campanhas/${campanha.id}`, texto: `${campanha.codigo} ${campanha.nome}`, peso: campanha.situacao === 'encerrada' || campanha.situacao === 'cancelada' ? 1 : 0 })),
    },
    {
      tipo: 'pecas',
      rotulo: 'Conteúdo',
      candidatos: pecas.map((peca) => ({ id: peca.id, codigo: peca.codigo, titulo: peca.titulo, detalhe: `${ROTULOS_CANAL[peca.canal]} · ${ROTULOS_SITUACAO_PECA[peca.situacao]} · ${formatarDiaISO(peca.publicado_em ?? peca.data_prevista)}`, href: `/marketing/conteudo?peca=${peca.id}`, texto: `${peca.codigo} ${peca.titulo}`, peso: peca.situacao === 'publicado' || peca.situacao === 'cancelado' ? 1 : 0 })),
    },
    {
      tipo: 'listas',
      rotulo: 'Listas de espera',
      candidatos: listas.map((lista) => ({ id: lista.id, codigo: null, titulo: lista.nome, detalhe: lista.situacao === 'ativa' ? 'Ativa' : 'Encerrada', href: `/marketing/listas/${lista.id}`, texto: lista.nome, peso: lista.situacao === 'ativa' ? 0 : 1 })),
    },
  ];
}
