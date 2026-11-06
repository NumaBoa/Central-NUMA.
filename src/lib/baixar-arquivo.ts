/** Entrega um texto como arquivo para o navegador salvar. */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'application/json') {
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 1000);
}
