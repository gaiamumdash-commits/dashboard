"use client";

import { useFormStatus } from "react-dom";

export function BotaoSalvar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-black transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Salvar metas e continuar"}
    </button>
  );
}
