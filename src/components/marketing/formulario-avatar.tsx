"use client";

import { useFormStatus } from "react-dom";
import type { AvatarCliente, AvatarItem } from "@/lib/ecc/tipos";
import { salvarAvatarCliente } from "@/lib/ecc/marketing";

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Salvar avatar"}
    </button>
  );
}

export function FormularioAvatar({
  produtoId,
  avatar,
  itens,
}: {
  produtoId: string;
  avatar: AvatarCliente | null;
  itens: AvatarItem[];
}) {
  const acao = salvarAvatarCliente.bind(null, produtoId);
  const dores = itens.filter((i) => i.tipo === "dor").sort((a, b) => a.ordem - b.ordem);
  const desejos = itens.filter((i) => i.tipo === "desejo").sort((a, b) => a.ordem - b.ordem);

  function textoDoItem(lista: AvatarItem[], ordem: number): string {
    return lista.find((i) => i.ordem === ordem)?.texto ?? "";
  }

  return (
    <form action={acao} className="flex flex-col gap-6 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">5 dores</h2>
        <div className="mt-3 flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <input
              key={`dor_${n}`}
              name={`dor_${n}`}
              placeholder={`Dor ${n}`}
              defaultValue={textoDoItem(dores, n)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">5 desejos</h2>
        <div className="mt-3 flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <input
              key={`desejo_${n}`}
              name={`desejo_${n}`}
              placeholder={`Desejo ${n}`}
              defaultValue={textoDoItem(desejos, n)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Dor unificada
        <textarea
          name="dor_unificada"
          rows={2}
          placeholder="A dor real por trás de todas as outras"
          defaultValue={avatar?.dor_unificada ?? ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Gatilho de compra
        <textarea
          name="gatilho_compra"
          rows={2}
          placeholder="O que faz essa pessoa decidir comprar"
          defaultValue={avatar?.gatilho_compra ?? ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <BotaoSalvar />
    </form>
  );
}
