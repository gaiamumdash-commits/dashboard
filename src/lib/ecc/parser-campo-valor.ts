/** Parser determinístico (sem IA) de um bloco `CAMPO: valor` colado pelo
 * usuário — usado tanto pela extração final da entrevista quanto pela
 * copy da Mandala. Cada campo precisa estar numa linha só. */
export function parsearBlocoCampoValor(texto: string): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const linha of texto.split("\n")) {
    const match = linha.match(/^([A-Z_0-9]+):\s?(.*)$/);
    if (match && match[2].trim()) {
      campos[match[1]] = match[2].trim();
    }
  }
  return campos;
}
