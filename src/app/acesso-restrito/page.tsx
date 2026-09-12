import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso restrito — Gaiamum",
};

export default function PaginaAcessoRestrito() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-gaiamum-text">Gaiamum está em fase de testes fechados</h1>
      <p className="mt-2 text-gaiamum-text-muted">
        Por enquanto o acesso é só por convite ou autorização direta. Você será avisado quando o
        Gaiamum abrir para todo mundo.
      </p>
    </main>
  );
}
