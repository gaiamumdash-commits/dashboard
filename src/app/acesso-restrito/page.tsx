import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmailDaConta } from "@/components/layout/email-da-conta";
import { BotaoSair } from "@/components/layout/botao-sair";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarMembershipAtual } from "@/lib/ecc/membership";
import { emailAutorizadoNoBeta, modoCadastroFechado } from "@/lib/ecc/acesso-beta";

export const metadata: Metadata = {
  title: "Acesso restrito — Gaiamum",
};

export default async function PaginaAcessoRestrito() {
  // Achado real (2026-10-13): a esposa do Fabio foi autorizada e ganhou
  // workspace, mas continuava vendo "testes fechados" — esta página era
  // estática, então aba restaurada/favorito/app instalado abrindo direto
  // aqui nunca reavaliava o acesso. Agora quem já tem acesso sai daqui
  // sozinho; quem não tem continua vendo o aviso (sem loop: "/" só manda
  // de volta pra cá quem NÃO está autorizado).
  const user = await obterUsuarioAtual();
  if (!user) {
    redirect("/auth");
  }
  const temAcesso =
    Boolean(await buscarMembershipAtual()) ||
    !modoCadastroFechado() ||
    (user.email ? await emailAutorizadoNoBeta(user.email) : false);
  if (temAcesso) {
    redirect("/");
  }

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
