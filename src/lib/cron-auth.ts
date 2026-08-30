import { timingSafeEqual } from "node:crypto";

// Comparação em tempo constante contra CRON_SECRET — comparação de string
// comum (!==) retorna assim que encontra o primeiro byte diferente, o que em
// tese permite inferir o segredo por medição de tempo de resposta. Mesmo
// padrão do projeto irmão `platform` (src/lib/cron-auth.ts).
export function autorizacaoCronValida(header: string | null, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(header ?? "");
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(recebido, esperado);
}
