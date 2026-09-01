"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificacaoApp } from "@/lib/ecc/tipos";
import { contarNaoLidas, listarNotificacoesRecentes, marcarComoLida, marcarTodasComoLidas } from "@/lib/ecc/notificacoes-app";

const INTERVALO_POLLING_MS = 60_000;

function formatarQuando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Sino no topo do menu lateral — contador de não lidas com polling simples
 * (sem Supabase Realtime, que não é usado em nenhum outro lugar do
 * projeto ainda). Busca a lista completa só quando o popover abre. */
export function SinoNotificacoes({ naoLidasIniciais }: { naoLidasIniciais: number }) {
  const [naoLidas, setNaoLidas] = useState(naoLidasIniciais);
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoApp[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      contarNaoLidas().then(setNaoLidas);
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(id);
  }, []);

  function alternarAberto() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir) {
      listarNotificacoesRecentes().then(setNotificacoes);
    }
  }

  async function abrirNotificacao(notificacao: NotificacaoApp) {
    if (!notificacao.lida) {
      await marcarComoLida(notificacao.id);
      setNaoLidas((n) => Math.max(0, n - 1));
      setNotificacoes((atual) => atual?.map((n) => (n.id === notificacao.id ? { ...n, lida: true } : n)) ?? null);
    }
    setAberto(false);
    router.refresh();
  }

  async function marcarTudo() {
    await marcarTodasComoLidas();
    setNaoLidas(0);
    setNotificacoes((atual) => atual?.map((n) => ({ ...n, lida: true })) ?? null);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alternarAberto}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gaiamum-text-muted transition hover:bg-gaiamum-surface-raised hover:text-gaiamum-text"
      >
        🔔
        {naoLidas > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gaiamum-primary px-1 text-[10px] font-semibold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gaiamum-text-muted">Notificações</span>
            {naoLidas > 0 && (
              <button type="button" onClick={marcarTudo} className="text-xs text-gaiamum-primary hover:underline">
                Marcar tudo como lida
              </button>
            )}
          </div>

          <div className="mt-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {notificacoes === null && <p className="px-2 py-2 text-xs text-gaiamum-text-muted">Carregando...</p>}
            {notificacoes !== null && notificacoes.length === 0 && (
              <p className="px-2 py-2 text-xs text-gaiamum-text-muted">Nenhuma notificação ainda.</p>
            )}
            {notificacoes?.map((notificacao) => {
              const conteudo = (
                <>
                  <span className={`text-sm ${notificacao.lida ? "text-gaiamum-text-muted" : "font-medium text-gaiamum-text"}`}>
                    {notificacao.titulo}
                  </span>
                  {notificacao.corpo && <span className="text-xs text-gaiamum-text-muted">{notificacao.corpo}</span>}
                  <span className="text-[11px] text-gaiamum-text-muted">{formatarQuando(notificacao.criado_em)}</span>
                </>
              );

              return notificacao.link ? (
                <Link
                  key={notificacao.id}
                  href={notificacao.link}
                  onClick={() => abrirNotificacao(notificacao)}
                  className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-gaiamum-surface-raised"
                >
                  {conteudo}
                </Link>
              ) : (
                <button
                  key={notificacao.id}
                  type="button"
                  onClick={() => abrirNotificacao(notificacao)}
                  className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-gaiamum-surface-raised"
                >
                  {conteudo}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
