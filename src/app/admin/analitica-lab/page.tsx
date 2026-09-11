import { redirect } from "next/navigation";
import { souDonoDoSaas } from "@/lib/ecc/dono-saas";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import {
  obterFunilLab,
  obterFunilOfertaLab,
  obterDistribuicaoPatentes,
  listarUsuariosEmRiscoDeEvasao,
  obterLogConsumoIA,
} from "@/lib/ecc/lab/analitica";
import { ROTULO_PATENTE } from "@/lib/ecc/lab/patentes";
import { MenuLateral } from "@/components/layout/menu-lateral";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function PaginaAnaliticaLab() {
  if (!(await souDonoDoSaas())) {
    redirect("/");
  }

  const tenantId = await garantirWorkspace();

  const [totalMetasSmart, papelAtual, funil, funilOferta, patentes, emRisco, logIA] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
    obterFunilLab(),
    obterFunilOfertaLab(),
    obterDistribuicaoPatentes(),
    listarUsuariosEmRiscoDeEvasao(),
    obterLogConsumoIA(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-gaiamum-text">📊 Analítica do Lab</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Visão cruzando todos os usuários do Gaiamum Lab — restrita a esta conta.
          </p>
        </div>

        {/* Funil */}
        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Funil de conclusão</h2>
          <p className="mt-1 text-sm text-gaiamum-text-muted">
            {funil.totalEntraram} pessoa(s) entraram no Lab · {funil.nuncaComecaram} nunca completaram nenhum passo.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {funil.porPasso.map((p) => {
              const pct = funil.totalEntraram > 0 ? Math.round((p.concluiram / funil.totalEntraram) * 100) : 0;
              return (
                <div key={p.passo} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gaiamum-text">{p.rotulo}</span>
                  <span className="text-gaiamum-text-muted">
                    {p.concluiram} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Oferta pré-onboarding do Lab */}
        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Oferta pré-onboarding do Lab</h2>
          <p className="mt-1 text-sm text-gaiamum-text-muted">
            {funilOferta.viram} viram a tela · {funilOferta.escolheramLab} escolheram o Lab ·{" "}
            {funilOferta.escolheramPular} foram direto pro app · {funilOferta.viramSemDecidir} viram e não
            decidiram ainda.
          </p>
        </section>

        {/* Patentes */}
        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Distribuição de patentes</h2>
          <div className="mt-3 flex gap-4 text-sm">
            {(Object.keys(patentes.porCodigo) as (keyof typeof patentes.porCodigo)[]).map((codigo) => (
              <span key={codigo} className="text-gaiamum-text-muted">
                {ROTULO_PATENTE[codigo]}: <strong className="text-gaiamum-text">{patentes.porCodigo[codigo]}</strong>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 overflow-x-auto">
            {patentes.usuarios.length === 0 ? (
              <p className="text-sm text-gaiamum-text-muted">Nenhuma patente conquistada ainda.</p>
            ) : (
              patentes.usuarios.map((p, i) => (
                <div key={`${p.userId}-${p.codigo}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gaiamum-text">{p.email ?? p.userId}</span>
                  <span className="text-gaiamum-text-muted">
                    {ROTULO_PATENTE[p.codigo]} · {formatarDataHora(p.conquistadaEm)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Em risco de evasão */}
        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Em risco de evasão (48h+ sem atividade)</h2>
          <div className="mt-3 flex flex-col gap-2 overflow-x-auto">
            {emRisco.length === 0 ? (
              <p className="text-sm text-gaiamum-text-muted">Ninguém parado há 48h ou mais agora.</p>
            ) : (
              emRisco.map((u) => (
                <div key={u.userId} className="flex flex-col gap-0.5 border-b border-gaiamum-border pb-2 text-sm last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gaiamum-text">{u.email ?? u.userId}</span>
                    <span
                      className={
                        u.reengajamentoJaEnviado
                          ? "rounded-full bg-gaiamum-success/15 px-2 py-0.5 text-xs font-semibold text-gaiamum-success"
                          : "rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted"
                      }
                    >
                      {u.reengajamentoJaEnviado ? "E-mail enviado" : "Ainda não enviado"}
                    </span>
                  </div>
                  <span className="text-xs text-gaiamum-text-muted">
                    Entrou em {formatarDataHora(u.entrouEm)} · última atividade {formatarDataHora(u.ultimaAtividade)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Consumo de IA */}
        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Consumo do Gemini</h2>
          <p className="mt-1 text-sm text-gaiamum-text-muted">
            {logIA.totais.chamadas} chamada(s) · {logIA.totais.sucesso} sucesso · {logIA.totais.falha} falha ·{" "}
            {logIA.totais.tokensTotais.toLocaleString("pt-BR")} tokens no total.
          </p>
          <div className="mt-4 flex flex-col gap-2 overflow-x-auto">
            {logIA.registros.length === 0 ? (
              <p className="text-sm text-gaiamum-text-muted">Nenhuma chamada registrada ainda.</p>
            ) : (
              logIA.registros.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className={r.sucesso ? "text-gaiamum-text" : "text-gaiamum-danger"}>
                    {formatarDataHora(r.criadoEm)} · {r.modelo}
                    {!r.sucesso && r.erro ? ` — ${r.erro}` : ""}
                  </span>
                  <span className="text-gaiamum-text-muted">{r.totalTokens ?? "—"} tokens</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
