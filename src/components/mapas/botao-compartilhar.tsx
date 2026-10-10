"use client";

import { definirCompartilhamento } from "@/lib/ecc/mapas/actions";
import { COMPARTILHAMENTOS, ROTULO_COMPARTILHAMENTO, type Compartilhamento } from "@/lib/ecc/mapas/compartilhamento";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_SECUNDARIO } from "@/components/planner/estilos";

const MENSAGEM_SUCESSO: Record<Compartilhamento, string> = {
  privado: "Agora só você vê este mapa.",
  equipe: "Mapa compartilhado com a equipe (só leitura).",
  todos: "Mapa compartilhado com a equipe e os convidados (só leitura).",
};

/** Escolhas do dono: cada opção salva na hora e fecha. */
function OpcoesCompartilhamento({ mapaId, atual, aoSalvar }: { mapaId: string; atual: Compartilhamento; aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <div role="radiogroup" aria-label="Com quem compartilhar" className="flex flex-col gap-2">
      {COMPARTILHAMENTOS.map((opcao) => {
        const r = ROTULO_COMPARTILHAMENTO[opcao];
        const marcada = opcao === atual;
        return (
          <button
            key={opcao}
            type="button"
            role="radio"
            aria-checked={marcada}
            disabled={pendente}
            onClick={() =>
              marcada
                ? aoSalvar()
                : executar(() => definirCompartilhamento(mapaId, opcao), { sucesso: MENSAGEM_SUCESSO[opcao], aoConcluir: aoSalvar })
            }
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary ${
              marcada ? "border-gaiamum-primary bg-gaiamum-primary/10" : "border-gaiamum-border hover:bg-gaiamum-surface-raised"
            }`}
          >
            <span aria-hidden className="text-lg leading-6">
              {r.icone}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-gaiamum-text">
                {r.titulo}
                {marcada && <span className="ml-2 text-xs font-normal text-gaiamum-primary">atual</span>}
              </span>
              <span className="block text-sm text-gaiamum-text-muted">{r.descricao}</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-gaiamum-text-muted">Quem recebe só lê: não edita, não move e não executa ramos.</p>
    </div>
  );
}

/** Botão do cabeçalho do mapa (só para o dono). Sem a migration 0063, fica
 * desligado com o motivo — nunca compartilha pela regra antiga. */
export function BotaoCompartilhar({ mapaId, atual, disponivel }: { mapaId: string; atual: Compartilhamento; disponivel: boolean }) {
  const r = ROTULO_COMPARTILHAMENTO[atual];
  const rotulo = (
    <>
      <span aria-hidden>{r.icone}</span> {r.titulo}
    </>
  );
  if (!disponivel) {
    return (
      <button
        type="button"
        disabled
        title="Compartilhar está sendo instalado (falta uma atualização do banco)."
        className={`${CLASSE_BOTAO_SECUNDARIO} cursor-not-allowed`}
      >
        {rotulo}
      </button>
    );
  }
  return (
    <BotaoDialogo titulo="Compartilhar mapa" className={CLASSE_BOTAO_SECUNDARIO} rotulo={rotulo}>
      {(fechar) => <OpcoesCompartilhamento mapaId={mapaId} atual={atual} aoSalvar={fechar} />}
    </BotaoDialogo>
  );
}
