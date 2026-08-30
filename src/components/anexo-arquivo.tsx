"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Anexo } from "@/lib/ecc/tipos";
import { removerAnexo, urlAssinadaDoAnexo } from "@/lib/ecc/anexos";

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Peça genérica de anexo — mesmo bucket privado do Supabase Storage,
 * reaproveitada tanto pra comprovante de conta a pagar quanto pra arquivo
 * no cartão de tarefa. `enviar` já vem com a entidade fixada pelo chamador. */
export function AnexoArquivo({
  anexos,
  enviar,
  caminhoRevalidar,
  rotuloAnexar = "Anexar arquivo",
}: {
  anexos: Anexo[];
  enviar: (formData: FormData) => Promise<void>;
  caminhoRevalidar: string;
  rotuloAnexar?: string;
}) {
  const [, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function abrirAnexo(storagePath: string) {
    try {
      const url = await urlAssinadaDoAnexo(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao abrir anexo.");
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {anexos.map((anexo) => (
        <span
          key={anexo.id}
          className="flex items-center gap-1 rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted"
        >
          <button
            type="button"
            onClick={() => abrirAnexo(anexo.storage_path)}
            className="hover:text-gaiamum-primary hover:underline"
          >
            📎 {anexo.nome_arquivo} ({formatarTamanho(anexo.tamanho_bytes)})
          </button>
          <button
            type="button"
            onClick={() =>
              iniciarTransicao(async () => {
                await removerAnexo(anexo.id, caminhoRevalidar);
                router.refresh();
              })
            }
            className="hover:text-gaiamum-danger"
          >
            ✕
          </button>
        </span>
      ))}

      <form
        action={async (formData) => {
          setErro(null);
          try {
            await enviar(formData);
            router.refresh();
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
          }
        }}
        className="flex items-center gap-1"
      >
        <input
          type="file"
          name="arquivo"
          required
          className="text-xs text-gaiamum-text-muted file:mr-2 file:rounded file:border-0 file:bg-gaiamum-surface-raised file:px-2 file:py-1 file:text-xs file:text-gaiamum-text"
        />
        <button type="submit" className="text-xs text-gaiamum-primary hover:underline">
          {rotuloAnexar}
        </button>
      </form>
      {erro && <span className="text-xs text-gaiamum-danger">{erro}</span>}
    </div>
  );
}
