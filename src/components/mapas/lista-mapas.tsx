"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarMapa, excluirMapa } from "@/lib/ecc/mapas/actions";
import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import { MAX_TEXTO_NO, type Mapa } from "@/lib/ecc/mapas/tipos";
import { compartilhamentoDoMapa, seloCompartilhamento } from "@/lib/ecc/mapas/compartilhamento";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import {
  CLASSE_BOTAO_PRIMARIO,
  CLASSE_CAMPO,
} from "@/components/planner/estilos";

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: FUSO_BRASIL,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Ideia central + (opcional) lista colada que já vira os ramos. */
function FormularioNovoMapa({ aoSalvar }: { aoSalvar: () => void }) {
  const router = useRouter();
  const { pendente, executar } = useAcaoPlanner();
  return (
    <form
      className="flex flex-col gap-4"
      action={(fd) =>
        executar(
          async () => {
            const r = await criarMapa(fd);
            if (r.ok && r.id) router.push(`/mapas/${r.id}`);
            return r;
          },
          { sucesso: "Mapa criado.", aoConcluir: aoSalvar },
        )
      }
    >
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Ideia central
        <input
          name="titulo"
          required
          maxLength={MAX_TEXTO_NO}
          autoFocus
          placeholder="Lançamento de março, Viagem, TCC..."
          className={CLASSE_CAMPO}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Já tem uma lista? Cole aqui (opcional)
        <textarea
          name="lista"
          rows={6}
          maxLength={50000}
          placeholder={"Copy\n  Headline\n  Anúncios\nOrçamento\nEquipe"}
          className={`${CLASSE_CAMPO} font-mono text-xs`}
        />
        <span className="text-xs">
          Uma ideia por linha; o recuo vira sub-ramo.
        </span>
      </label>
      <button
        type="submit"
        disabled={pendente}
        className={CLASSE_BOTAO_PRIMARIO}
      >
        {pendente ? "Criando..." : "Criar mapa"}
      </button>
    </form>
  );
}

function CartaoMapa({ mapa, meu }: { mapa: Mapa; meu: boolean }) {
  const { pendente, executar } = useAcaoPlanner();
  const selo = seloCompartilhamento(compartilhamentoDoMapa(mapa), meu);
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4 transition hover:border-gaiamum-primary/60">
      <Link href={`/mapas/${mapa.id}`} className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gaiamum-primary/15 text-lg"
        >
          🧠
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 font-medium text-gaiamum-text">
            {mapa.titulo}
          </span>
          <span className="block text-xs text-gaiamum-text-muted">
            Atualizado em {quando(mapa.atualizado_em)}
            {selo && ` · ${selo}`}
          </span>
        </span>
      </Link>
      {meu && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              window.confirm(
                `Excluir o mapa "${mapa.titulo}" e todos os ramos dele?`,
              ) &&
              executar(() => excluirMapa(mapa.id), {
                sucesso: "Mapa excluído.",
              })
            }
            className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger disabled:opacity-60"
          >
            Excluir
          </button>
        </div>
      )}
    </li>
  );
}

export function ListaMapas({
  meus,
  compartilhados,
  indisponivel = false,
}: {
  meus: Mapa[];
  compartilhados: Mapa[];
  indisponivel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gaiamum-primary/15 text-3xl"
          >
            🧠
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-gaiamum-text">
              Mapa mental
            </h1>
            <p className="mt-1 text-gaiamum-text-muted">
              Organize ideias em ramos, foque no que importa e transforme em
              plano. Só você vê, a menos que compartilhe.
            </p>
          </div>
        </div>
        {!indisponivel && (
          <BotaoDialogo
            titulo="Novo mapa"
            className={CLASSE_BOTAO_PRIMARIO}
            rotulo="+ Novo mapa"
          >
            {(fechar) => <FormularioNovoMapa aoSalvar={fechar} />}
          </BotaoDialogo>
        )}
      </div>

      {indisponivel ? (
        <div className="rounded-2xl border border-dashed border-gaiamum-border px-4 py-12 text-center">
          <p className="font-medium text-gaiamum-text">
            O Mapa mental está sendo instalado.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gaiamum-text-muted">
            Em instantes você já vai poder criar seus mapas aqui. Se continuar
            assim, recarregue a página daqui a pouco.
          </p>
        </div>
      ) : meus.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gaiamum-border px-4 py-12 text-center">
          <p className="font-medium text-gaiamum-text">Nenhum mapa ainda.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gaiamum-text-muted">
            Comece com a ideia central — um projeto, uma viagem, um estudo. Se
            já tiver as ideias numa lista (WhatsApp, Notas), é só colar.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meus.map((m) => (
            <CartaoMapa key={m.id} mapa={m} meu />
          ))}
        </ul>
      )}

      {compartilhados.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-gaiamum-text">
            Compartilhados com você
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {compartilhados.map((m) => (
              <CartaoMapa key={m.id} mapa={m} meu={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
