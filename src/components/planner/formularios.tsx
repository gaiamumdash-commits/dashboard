"use client";

import { useState } from "react";
import { criarCompromisso, criarHabito, editarHabito } from "@/lib/ecc/planner/actions";
import { NOME_DIA, ROTULO_AREA } from "@/lib/ecc/planner/regras";
import { AREAS_PLANNER, type AreaPlanner, type HabitoPlanner, type TipoCompromisso, type TipoHabito } from "@/lib/ecc/planner/tipos";
import { hojeISOBrasil } from "@/lib/ecc/kanban";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
      {texto}
      {children}
    </label>
  );
}

function SeletorArea({ area, fixa }: { area: AreaPlanner; fixa: boolean }) {
  if (fixa) return <input type="hidden" name="area" value={area} />;
  return (
    <Rotulo texto="Área">
      <select name="area" defaultValue={area} className={CLASSE_CAMPO}>
        {AREAS_PLANNER.map((a) => (
          <option key={a} value={a}>
            {ROTULO_AREA[a]}
          </option>
        ))}
      </select>
    </Rotulo>
  );
}

/** Erro de validação mostrado no próprio formulário (além do toast), ligado
 * ao form por `aria-describedby` pra leitor de tela. */
function ErroFormulario({ id, erro }: { id: string; erro: string | null }) {
  if (!erro) return null;
  return (
    <p id={id} role="alert" className="text-sm text-gaiamum-danger">
      {erro}
    </p>
  );
}

/** Criar ou editar hábito/rotina. Rotina pede horário (aparece no "Hoje"
 * na hora certa); hábito é acompanhamento de consistência. */
export function FormularioHabito({
  area,
  areaFixa = false,
  tipo,
  habito,
  aoSalvar,
}: {
  area: AreaPlanner;
  areaFixa?: boolean;
  tipo: TipoHabito;
  habito?: HabitoPlanner;
  aoSalvar?: () => void;
}) {
  const { pendente, executar } = useAcaoPlanner();
  const [erro, setErro] = useState<string | null>(null);
  const diasIniciais = habito?.dias_semana ?? [1, 2, 3, 4, 5, 6, 7];
  const idErro = `erro-habito-${habito?.id ?? "novo"}`;

  return (
    <form
      aria-describedby={erro ? idErro : undefined}
      className="flex flex-col gap-4"
      action={(formData) => {
        setErro(null);
        executar(
          async () => {
            const resultado = habito ? await editarHabito(habito.id, formData) : await criarHabito(formData);
            if (!resultado.ok) setErro(resultado.erro);
            return resultado;
          },
          { sucesso: habito ? "Salvo." : tipo === "rotina" ? "Rotina criada." : "Hábito criado.", aoConcluir: aoSalvar },
        );
      }}
    >
      <input type="hidden" name="tipo" value={tipo} />
      <Rotulo texto={tipo === "rotina" ? "Rotina" : "Hábito"}>
        <input
          name="nome"
          required
          maxLength={120}
          defaultValue={habito?.nome}
          autoFocus
          placeholder={tipo === "rotina" ? "Planejamento do dia, Organizar a cozinha..." : "Leitura, Beber água, Inglês..."}
          className={CLASSE_CAMPO}
        />
      </Rotulo>

      <SeletorArea area={habito?.area ?? area} fixa={areaFixa} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-gaiamum-text-muted">Dias da semana</legend>
        <div className="flex flex-wrap gap-1.5">
          {NOME_DIA.map((nome, indice) => (
            <label
              key={nome}
              className="cursor-pointer rounded-full border border-gaiamum-border px-3 py-1 text-xs text-gaiamum-text has-[:checked]:border-gaiamum-primary has-[:checked]:bg-gaiamum-primary/15 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gaiamum-primary/40"
            >
              <input
                type="checkbox"
                name="dias"
                value={indice + 1}
                defaultChecked={diasIniciais.includes(indice + 1)}
                className="sr-only"
              />
              {nome.slice(0, 3)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Rotulo texto={tipo === "rotina" ? "Horário" : "Horário (opcional)"}>
          <input type="time" name="horario" defaultValue={habito?.horario?.slice(0, 5) ?? ""} className={CLASSE_CAMPO} />
        </Rotulo>
        <Rotulo texto="Duração (min, opcional)">
          <input
            type="number"
            name="duracao"
            min={1}
            max={1440}
            inputMode="numeric"
            defaultValue={habito?.duracao_minutos ?? ""}
            className={CLASSE_CAMPO}
          />
        </Rotulo>
      </div>

      <ErroFormulario id={idErro} erro={erro} />
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : habito ? "Salvar" : tipo === "rotina" ? "Criar rotina" : "Criar hábito"}
      </button>
    </form>
  );
}

/** Compromisso do Planner (consulta, compromisso de pet, outro). Aparece na
 * Agenda e no card "Hoje" — privado, só pra própria pessoa. */
export function FormularioCompromisso({
  area,
  areaFixa = false,
  tipo = "outro",
  pets = [],
  aoSalvar,
}: {
  area: AreaPlanner;
  areaFixa?: boolean;
  tipo?: TipoCompromisso;
  pets?: { id: string; nome: string }[];
  aoSalvar?: () => void;
}) {
  const { pendente, executar } = useAcaoPlanner();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      aria-describedby={erro ? "erro-compromisso" : undefined}
      className="flex flex-col gap-4"
      action={(formData) => {
        setErro(null);
        executar(
          async () => {
            const resultado = await criarCompromisso(formData);
            if (!resultado.ok) setErro(resultado.erro);
            return resultado;
          },
          { sucesso: "Compromisso salvo. Ele também aparece na sua Agenda.", aoConcluir: aoSalvar },
        );
      }}
    >
      <input type="hidden" name="tipo" value={tipo} />
      <Rotulo texto={tipo === "consulta" ? "Consulta" : "Compromisso"}>
        <input
          name="titulo"
          required
          maxLength={200}
          autoFocus
          placeholder={tipo === "consulta" ? "Dentista, check-up..." : tipo === "pet" ? "Vacina, banho e tosa..." : "Comprar filtro de água..."}
          className={CLASSE_CAMPO}
        />
      </Rotulo>
      <SeletorArea area={area} fixa={areaFixa} />
      <div className="grid grid-cols-2 gap-3">
        <Rotulo texto="Data">
          <input type="date" name="data" required defaultValue={hojeISOBrasil()} className={CLASSE_CAMPO} />
        </Rotulo>
        <Rotulo texto="Horário">
          <input type="time" name="hora" required defaultValue="09:00" className={CLASSE_CAMPO} />
        </Rotulo>
      </div>
      <Rotulo texto="Local (opcional)">
        <input name="local" maxLength={200} className={CLASSE_CAMPO} />
      </Rotulo>
      {pets.length > 0 && (
        <Rotulo texto="Pet (opcional)">
          <select name="pet_id" defaultValue="" className={CLASSE_CAMPO}>
            <option value="">Nenhum</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Rotulo>
      )}
      <ErroFormulario id="erro-compromisso" erro={erro} />
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : "Salvar compromisso"}
      </button>
    </form>
  );
}
