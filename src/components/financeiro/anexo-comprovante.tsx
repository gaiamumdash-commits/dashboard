"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Anexo } from "@/lib/ecc/tipos";
import { enviarAnexoContaAPagar, removerAnexo, urlAssinadaDoAnexo } from "@/lib/ecc/anexos";

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnexoComprovante({ contaId, anexos }: { contaId: string; anexos: Anexo[] }) {
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
    <div className="flex w-full flex-wrap items-center gap-2 pl-7">
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
                await removerAnexo(anexo.id);
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
            await enviarAnexoContaAPagar(contaId, formData);
            router.refresh();
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Falha ao enviar comprovante.");
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
          Anexar comprovante
        </button>
      </form>
      {erro && <span className="text-xs text-gaiamum-danger">{erro}</span>}
    </div>
  );
}
