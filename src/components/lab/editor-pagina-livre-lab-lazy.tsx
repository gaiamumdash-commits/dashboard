"use client";

// BlockNote é client-only (usa `document`/ProseMirror) — o Next.js só
// permite `dynamic(..., { ssr: false })` dentro de um arquivo que já é
// "use client", por isso esse wrapper existe separado do componente pesado.
import dynamic from "next/dynamic";

const EditorPaginaLivreLab = dynamic(
  () => import("./editor-pagina-livre-lab").then((m) => m.EditorPaginaLivreLab),
  {
    ssr: false,
    loading: () => <p className="text-sm text-gaiamum-text-muted">Carregando editor…</p>,
  },
);

export { EditorPaginaLivreLab as EditorPaginaLivreLabLazy };
