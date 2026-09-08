/** Fallback genérico pra `loading.tsx` de cada rota — mantém a mesma forma
 * do layout real (sidebar w-60 no desktop, cabeçalho h-14 no mobile) pra não
 * pular o conteúdo quando os dados chegam. Não busca dado nenhum: só existe
 * pra dar feedback instantâneo no clique, já que nenhuma rota tinha
 * `loading.tsx` antes (ver handoff, sessão #14) — sem isso o React espera a
 * página inteira responder antes de trocar qualquer pixel, parecendo
 * travado por 2-3s mesmo quando o servidor está respondendo normalmente. */
export function EsqueletoPagina() {
  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row" aria-busy="true" aria-live="polite">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gaiamum-border bg-gaiamum-surface px-4 py-6 sm:flex">
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-gaiamum-border" />
          <div className="h-5 w-20 animate-pulse rounded bg-gaiamum-border" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-gaiamum-border" />
          ))}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gaiamum-border bg-gaiamum-surface px-4 sm:hidden">
        <div className="h-7 w-7 animate-pulse rounded-full bg-gaiamum-border" />
        <div className="h-5 w-24 animate-pulse rounded bg-gaiamum-border" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-gaiamum-border" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gaiamum-border" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-gaiamum-border bg-gaiamum-surface" />
          ))}
        </div>
      </main>
    </div>
  );
}
