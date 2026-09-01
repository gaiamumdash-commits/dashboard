import { CLASSE_FUNDO_QUADRO, TEXTO_SOBRE_FUNDO_QUADRO, corAvatarPorEmail } from "@/lib/ecc/kanban";

const CLASSE_TAMANHO: Record<"sm" | "md", string> = {
  sm: "h-5 w-5 text-[9px]",
  md: "h-6 w-6 text-[10px]",
};

export function AvatarIniciais({ email, tamanho = "md" }: { email: string; tamanho?: "sm" | "md" }) {
  const cor = corAvatarPorEmail(email);
  return (
    <span
      title={email}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${CLASSE_TAMANHO[tamanho]} ${CLASSE_FUNDO_QUADRO[cor]} ${TEXTO_SOBRE_FUNDO_QUADRO[cor]}`}
    >
      {email.slice(0, 2).toUpperCase()}
    </span>
  );
}
