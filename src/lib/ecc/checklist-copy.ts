/** Validação determinística (sem IA, sem rede) dos vícios de copy que dá
 * pra checar por regex — o resto do checklist (prova concreta, ensinar em
 * vez de vender, dor real etc.) é qualitativo demais pra código e vira
 * autoverificação embutida no próprio prompt que o Claude recebe. */

const REGEX_EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

export function validarViciosDeterministico(entrada: {
  gancho: string;
  paragrafo1?: string;
  nomeProduto?: string;
}): string[] {
  const { gancho, paragrafo1, nomeProduto } = entrada;
  const textoCompleto = [gancho, paragrafo1].filter(Boolean).join("\n");
  const avisos: string[] = [];

  if (/[—–]/.test(textoCompleto)) {
    avisos.push("Tem travessão (—) — troque por vírgula, ponto ou reformule a frase.");
  }
  if (textoCompleto.includes("!")) {
    avisos.push("Tem ponto de exclamação — troque por ponto final.");
  }
  if (/não é [^.?!]+,?\s*\.?\s*é [^.?!]+/i.test(textoCompleto)) {
    avisos.push('Tem o padrão "Não é X. É Y." — afirme diretamente o que é, sem a comparação.');
  }
  if (gancho.trim().endsWith("?") || gancho.includes("?")) {
    avisos.push("O gancho tem pergunta — troque por uma afirmação que avisa ou ensina algo.");
  }
  if (REGEX_EMOJI.test(textoCompleto)) {
    avisos.push("Tem emoji no texto — remova.");
  }
  if (/\bmesmo que\b|\bsem precisar\b/i.test(textoCompleto)) {
    avisos.push('Tem a muleta "mesmo que" ou "sem precisar" — troque por um argumento real.');
  }
  if (nomeProduto && nomeProduto.trim()) {
    const inicio = textoCompleto.slice(0, 200).toLowerCase();
    if (inicio.includes(nomeProduto.trim().toLowerCase())) {
      avisos.push(`O nome do produto ("${nomeProduto}") aparece logo no início — deixe pra depois da argumentação.`);
    }
  }

  return avisos;
}
