import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AceitarConviteBotao } from "@/components/equipe/aceitar-convite-botao";
import { rotuloDoWorkspace } from "@/lib/ecc/workspaces";

type ConvitePendente = {
  token: string;
  expira_em: string;
  tenants: { nome: string } | { nome: string }[] | null;
  projetos: { nome: string } | { nome: string }[] | null;
};

const primeiro = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/**
 * Convites pendentes pro e-mail de quem está logado, dentro do app — achado
 * real (2026-10-05): a Angeline redefiniu a senha, entrou pelo login normal
 * (não pelo link do e-mail) e caiu no workspace antigo dela, vazio; o
 * convite ficou pendente porque o único jeito de aceitar era voltar ao
 * e-mail. Agora o convite aparece aqui com o botão de aceitar.
 *
 * Service client porque quem foi convidado ainda não é membro do workspace
 * (a RLS normal não alcança o convite) — filtrado SEMPRE pelo e-mail da
 * sessão, nunca por algo vindo do navegador. Aceitar continua passando por
 * `aceitarConvite`, que revalida token, validade e e-mail no servidor.
 */
export async function ConvitesPendentes() {
  const user = await obterUsuarioAtual();
  if (!user?.email) return null;

  const service = createServiceClient();
  const { data } = await service
    .from("convites")
    .select("token, expira_em, tenants(nome), projetos(nome)")
    .eq("email", user.email.toLowerCase())
    .eq("status", "pendente")
    .gte("expira_em", new Date().toISOString())
    .order("criado_em", { ascending: false });

  const convites = (data as ConvitePendente[] | null) ?? [];
  if (convites.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {convites.map((convite) => {
        const projeto = primeiro(convite.projetos)?.nome;
        const workspace = rotuloDoWorkspace(primeiro(convite.tenants)?.nome);
        return (
          <section key={convite.token} className="rounded-2xl border border-gaiamum-primary/50 bg-gaiamum-surface p-5">
            <p className="text-xs uppercase tracking-wide text-gaiamum-primary">Convite pendente</p>
            <h2 className="mt-1 text-base font-semibold text-gaiamum-text">
              {projeto ? `Você foi convidado(a) para o projeto “${projeto}”` : "Você foi convidado(a) para um workspace"}
            </h2>
            <p className="mt-1 text-sm text-gaiamum-text-muted">{workspace}</p>
            <AceitarConviteBotao token={convite.token} emailBate />
          </section>
        );
      })}
    </div>
  );
}
