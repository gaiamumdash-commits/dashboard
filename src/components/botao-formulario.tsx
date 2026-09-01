"use client";

import { useFormStatus } from "react-dom";

/** Botão de submit genérico que se desabilita e troca o texto enquanto a
 * Server Action do form pai está pendente — precisa ser filho direto (ou
 * descendente) de um <form>, `useFormStatus` só enxerga o form ancestral.
 * Mesmo padrão já usado em src/components/onboarding/botao-salvar.tsx,
 * generalizado pra reaproveitar em qualquer formulário. */
export function BotaoFormulario({
  label,
  labelPendente = "Enviando...",
  className = "rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60",
}: {
  label: string;
  labelPendente?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? labelPendente : label}
    </button>
  );
}
