import { CLASSE_FUNDO_QUADRO, TEXTO_SOBRE_FUNDO_QUADRO, corAvatarPorEmail } from "@/lib/ecc/kanban";

const CLASSE_TAMANHO: Record<"sm" | "md", string> = {
  sm: "h-5 w-5 text-[9px]",
  md: "h-6 w-6 text-[10px]",
};

/** `email` pode ser `null` (revisão de privacidade, 2026-10-01 — convidado
 * de projeto vendo o owner sem compartilhar projeto, migration 0049);
 * `nomeExibicao` é o fallback nesse caso. Passar pelo menos um dos dois. */
export function AvatarIniciais({
  email,
  nomeExibicao,
  tamanho = "md",
}: {
  email: string | null;
  nomeExibicao?: string;
  tamanho?: "sm" | "md";
}) {
  const identificador = email ?? nomeExibicao ?? "?";
  const cor = corAvatarPorEmail(identificador);
  return (
    <span
      title={email ?? nomeExibicao}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${CLASSE_TAMANHO[tamanho]} ${CLASSE_FUNDO_QUADRO[cor]} ${TEXTO_SOBRE_FUNDO_QUADRO[cor]}`}
    >
      {identificador.slice(0, 2).toUpperCase()}
    </span>
  );
}
