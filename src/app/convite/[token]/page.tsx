import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AceitarConviteBotao } from "@/components/equipe/aceitar-convite-botao";

export default async function PaginaConvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await obterUsuarioAtual();

  const service = createServiceClient();
  const { data: convite } = await service
    .from("convites")
    .select("*, tenants(nome)")
    .eq("token", token)
    .maybeSingle();

  const invalido = !convite || convite.status !== "pendente" || new Date(convite.expira_em) < new Date();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      {invalido ? (
        <>
          <h1 className="text-2xl font-semibold text-gaiamum-text">Convite inválido</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Este convite não existe mais, já foi usado, ou expirou. Peça pra quem te convidou gerar um novo
            link.
          </p>
        </>
      ) : !user ? (
        <>
          <h1 className="text-2xl font-semibold text-gaiamum-text">Você foi convidado</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Entre ou crie sua conta com o e-mail <strong className="text-gaiamum-text">{convite.email}</strong>{" "}
            pra aceitar o convite.
          </p>
          <a
            href={`/auth?redirect=/convite/${token}`}
            className="mt-6 rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark"
          >
            Entrar
          </a>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-gaiamum-text">Você foi convidado</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Aceite pra entrar no workspace com o e-mail{" "}
            <strong className="text-gaiamum-text">{convite.email}</strong>.
          </p>
          <AceitarConviteBotao token={token} emailBate={convite.email.toLowerCase() === (user.email ?? "").toLowerCase()} />
        </>
      )}
    </main>
  );
}
