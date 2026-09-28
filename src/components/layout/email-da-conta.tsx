import { obterUsuarioAtual } from "@/lib/supabase/server";

/** Mostra com qual conta a pessoa está logada — fica logo acima do "Sair" no
 * menu (desktop e mobile), pra ela nunca ter dúvida de qual e-mail está
 * usando (importante quando se alterna entre uma conta pessoal e outra de
 * trabalho). Busca própria, dentro de `<Suspense>` no chamador: o resto do
 * menu não espera por ela. */
export async function EmailDaConta({ className = "" }: { className?: string }) {
  const user = await obterUsuarioAtual();
  if (!user?.email) return null;

  return (
    <div className={`px-3 pb-1 ${className}`}>
      <p className="text-[11px] uppercase tracking-wide text-gaiamum-text-muted">Conectado como</p>
      <p title={user.email} className="truncate text-sm font-medium text-gaiamum-text">
        {user.email}
      </p>
    </div>
  );
}
