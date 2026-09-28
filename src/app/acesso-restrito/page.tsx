import type { Metadata } from "next";
import { EmailDaConta } from "@/components/layout/email-da-conta";
import { BotaoSair } from "@/components/layout/botao-sair";

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
      {/* Quem cai aqui provavelmente entrou com a conta "errada" — mostrar
          qual e-mail está logado e oferecer o Sair resolve sem precisar
          limpar cookies. */}
      <div className="mt-6 flex flex-col items-center">
        <EmailDaConta />
        <BotaoSair />
      </div>
    </main>
  );
}
