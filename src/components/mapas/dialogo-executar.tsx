"use client";

import { useState } from "react";
import { executarRamoComoCompromisso, executarRamoComoTarefa } from "@/lib/ecc/mapas/actions";
import { detectarData } from "@/lib/ecc/mapas/datas";
import { ROTULO_AREA } from "@/lib/ecc/planner/regras";
import { AREAS_PLANNER } from "@/lib/ecc/planner/tipos";
import type { NoMapa, OpcoesExecucao } from "@/lib/ecc/mapas/tipos";
import { Dialog } from "@/components/ui/dialog";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

const FOCOS = [
  [0, "Não agora"],
  [15, "15 min"],
  [25, "25 min"],
  [50, "50 min"],
  [90, "1h30"],
] as const;

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
      {rotulo}
      {children}
    </label>
  );
}

/**
 * "▶ Executar este ramo": vira TAREFA do Kanban (prazo, alarme e hiperfoco
 * de lá) ou COMPROMISSO do Planner (aparece na Agenda e no resumo das 7h).
 * A data citada no ramo já vem preenchida. Nada é criado sem confirmar.
 */
export function DialogoExecutar({
  no,
  hoje,
  opcoes,
  aoFechar,
}: {
  no: NoMapa;
  hoje: string;
  opcoes: OpcoesExecucao;
  aoFechar: () => void;
}) {
  const { pendente, executar } = useAcaoPlanner();
  const detectada = detectarData(no.texto, hoje);
  const [tipo, setTipo] = useState<"tarefa" | "compromisso">(opcoes.projetos.length > 0 ? "tarefa" : "compromisso");
  const [projetoId, setProjetoId] = useState(opcoes.projetos[0]?.id ?? "");
  const colunas = opcoes.projetos.find((p) => p.id === projetoId)?.colunas ?? [];

  const aba = (valor: "tarefa" | "compromisso", rotulo: string) => (
    <button
      type="button"
      onClick={() => setTipo(valor)}
      aria-pressed={tipo === valor}
      className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        tipo === valor ? "bg-gaiamum-primary text-white" : "text-gaiamum-text-muted hover:text-gaiamum-text"
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <Dialog titulo="▶ Executar este ramo" aoFechar={aoFechar} largura="md">
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex rounded-full border border-gaiamum-border p-1">
          {aba("tarefa", "📋 Tarefa no Kanban")}
          {aba("compromisso", "📅 Compromisso")}
        </div>

        {tipo === "tarefa" ? (
          opcoes.projetos.length === 0 ? (
            <p className="text-sm text-gaiamum-text-muted">Você ainda não tem projeto com quadro. Crie um em Projetos, ou use “Compromisso”.</p>
          ) : (
            <form
              className="flex flex-col gap-4"
              action={(fd) => {
                const foco = Number(fd.get("foco") ?? 0);
                executar(
                  () =>
                    executarRamoComoTarefa(no.id, {
                      projetoId: String(fd.get("projeto") ?? ""),
                      colunaId: String(fd.get("coluna") ?? ""),
                      titulo: String(fd.get("titulo") ?? ""),
                      data: String(fd.get("data") ?? "") || null,
                      hora: String(fd.get("hora") ?? "") || null,
                      focoMinutos: foco > 0 ? foco : null,
                    }),
                  { sucesso: foco > 0 ? "Tarefa criada e foco iniciado." : "Tarefa criada no Kanban.", aoConcluir: aoFechar },
                );
              }}
            >
              <Campo rotulo="Título">
                <input name="titulo" required maxLength={200} defaultValue={no.texto} className={CLASSE_CAMPO} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Projeto">
                  <select name="projeto" value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className={CLASSE_CAMPO}>
                    {opcoes.projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Coluna">
                  <select name="coluna" key={projetoId} defaultValue={colunas[0]?.id} className={CLASSE_CAMPO}>
                    {colunas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Prazo (opcional)">
                  <input type="date" name="data" defaultValue={detectada?.data ?? ""} className={CLASSE_CAMPO} />
                </Campo>
                <Campo rotulo="Hora do prazo">
                  <input type="time" name="hora" defaultValue={detectada?.hora ?? ""} placeholder="18:00" className={CLASSE_CAMPO} />
                </Campo>
              </div>
              <Campo rotulo="Iniciar foco agora? (cronômetro do Kanban)">
                <select name="foco" defaultValue="0" className={CLASSE_CAMPO}>
                  {FOCOS.map(([min, rotulo]) => (
                    <option key={min} value={min}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <p className="text-xs text-gaiamum-text-muted">
                O prazo, o alarme e a cor de urgência (amarelo/vermelho) são os do Kanban — o ramo mostra o mesmo estado.
              </p>
              <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
                {pendente ? "Criando..." : "Criar tarefa"}
              </button>
            </form>
          )
        ) : (
          <form
            className="flex flex-col gap-4"
            action={(fd) => executar(() => executarRamoComoCompromisso(no.id, fd), { sucesso: "Compromisso criado. Ele aparece na Agenda.", aoConcluir: aoFechar })}
          >
            <Campo rotulo="Título">
              <input name="titulo" required maxLength={200} defaultValue={no.texto} className={CLASSE_CAMPO} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Data">
                <input type="date" name="data" required defaultValue={detectada?.data ?? hoje} className={CLASSE_CAMPO} />
              </Campo>
              <Campo rotulo="Horário">
                <input type="time" name="hora" required defaultValue={detectada?.hora ?? "09:00"} className={CLASSE_CAMPO} />
              </Campo>
            </div>
            <Campo rotulo="Área do Planner">
              <select name="area" defaultValue="pessoal" className={CLASSE_CAMPO}>
                {AREAS_PLANNER.map((a) => (
                  <option key={a} value={a}>
                    {ROTULO_AREA[a]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Local (opcional)">
              <input name="local" maxLength={200} className={CLASSE_CAMPO} />
            </Campo>
            <p className="text-xs text-gaiamum-text-muted">Só você vê. Aparece na sua Agenda e no resumo do dia às 7h.</p>
            <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
              {pendente ? "Criando..." : "Criar compromisso"}
            </button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
