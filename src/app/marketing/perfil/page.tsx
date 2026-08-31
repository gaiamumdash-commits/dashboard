import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterPerfilNegocio } from "@/lib/ecc/marketing";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { FormularioPerfil } from "@/components/marketing/formulario-perfil";

export default async function PaginaPerfilNegocio() {
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const perfil = await obterPerfilNegocio(tenantId);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href="/marketing" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Marketing
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Perfil do negócio</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Base reaproveitada em tudo que o módulo de Marketing gerar depois.
        </p>

        <div className="mt-8">
          <FormularioPerfil perfil={perfil} />
        </div>
      </main>
    </div>
  );
}
