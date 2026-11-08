/**
 * Ponto de conexão com o Google Drive. A integração não existe nesta etapa (D27 e `02 §0`), então a Central
 * não sabe o nome de um arquivo nem se ele é público. Por isso o título é digitado e a grade usa ícone por tipo.
 *
 * Para conectar, troque `driveAusente` por uma implementação real. Regras que ela precisa cumprir:
 * - `miniatura` só devolve imagem de arquivo que a conta já pode ler. Nunca muda a permissão de um arquivo
 *   para conseguir uma miniatura.
 * - A classe da Central (PUB, INT, FIN, DOC) não altera a permissão do Drive, e o Drive não altera a classe.
 * - Pastas sugeridas continuam sendo sugestões, a menos que a pessoa peça para criar.
 */
export interface ProvedorDoDrive {
  estado: 'ausente' | 'conectado';
  nomeDoArquivo(driveId: string): Promise<string | null>;
  miniatura(driveId: string): Promise<string | null>;
}

export const driveAusente: ProvedorDoDrive = {
  estado: 'ausente',
  nomeDoArquivo: async () => null,
  miniatura: async () => null,
};

export const provedorDoDrive = (): ProvedorDoDrive => driveAusente;
