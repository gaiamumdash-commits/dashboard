"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { atualizarConteudoPaginaLivre, excluirPaginaLivre, renomearPaginaLivre } from "@/lib/ecc/paginas-livres";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { useTemaAtual } from "@/components/theme-toggle";

const ATRASO_AUTOSAVE_MS = 1000;

type StatusSalvamento = "ocioso" | "salvando" | "salvo";

export function EditorPaginaLivre({
  paginaId,
  projetoId,
  tituloInicial,
  conteudoInicial,
  atualizadoEmInicial,
  podeExcluir,
}: {
  paginaId: string;
  projetoId: string;
  tituloInicial: string;
  conteudoInicial: PartialBlock[];
  atualizadoEmInicial: string;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const tema = useTemaAtual();
  const editor = useCreateBlockNote({ initialContent: conteudoInicial });

  const [titulo, setTitulo] = useState(tituloInicial);
  const [status, setStatus] = useState<StatusSalvamento>("ocioso");
  const atualizadoEmRef = useRef(atualizadoEmInicial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function salvarAgora() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus("salvando");
    atualizarConteudoPaginaLivre(paginaId, projetoId, editor.document, atualizadoEmRef.current)
      .then((resultado) => {
        if ("conflito" in resultado) {
          toast.error("Essa página foi editada em outro lugar nesse meio-tempo. Recarregue antes de continuar editando.");
          setStatus("ocioso");
          return;
        }
        atualizadoEmRef.current = resultado.atualizado_em;
        setStatus("salvo");
      })
      .catch((err) => {
        toast.error(mensagemDeErro(err, "Falha ao salvar conteúdo."));
        setStatus("ocioso");
      });
  }

  function agendarAutosave() {
    setStatus("ocioso");
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(salvarAgora, ATRASO_AUTOSAVE_MS);
  }

  // Flush ao sair da página/trocar de aba — não perder a última rajada de
  // digitação presa no debounce.
  useEffect(() => {
    function aoSair() {
      if (timerRef.current) {
        salvarAgora();
      }
    }
    document.addEventListener("visibilitychange", aoSair);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", aoSair);
      window.removeEventListener("beforeunload", aoSair);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoSairDoTitulo() {
    const tituloLimpo = titulo.trim() || "Sem título";
    if (tituloLimpo === tituloInicial) {
      return;
    }
    renomearPaginaLivre(paginaId, projetoId, tituloLimpo).catch((err) => {
      toast.error(mensagemDeErro(err, "Falha ao renomear página."));
    });
  }

  function excluir() {
    if (!confirm(`Excluir a página "${titulo}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    excluirPaginaLivre(paginaId, projetoId)
      .then(() => router.push(`/projetos/${projetoId}/paginas`))
      .catch((err) => toast.error(mensagemDeErro(err, "Falha ao excluir página.")));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={aoSairDoTitulo}
          className="w-full flex-1 bg-transparent text-2xl font-semibold text-gaiamum-text outline-none"
        />
        <div className="flex shrink-0 items-center gap-3 pt-2">
          <span className="text-xs text-gaiamum-text-muted">
            {status === "salvando" ? "Salvando…" : status === "salvo" ? "Salvo" : ""}
          </span>
          {podeExcluir && (
            <button type="button" onClick={excluir} className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger">
              Excluir
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-2">
        <BlockNoteView editor={editor} theme={tema === "light" ? "light" : "dark"} onChange={agendarAutosave} />
      </div>
    </div>
  );
}
