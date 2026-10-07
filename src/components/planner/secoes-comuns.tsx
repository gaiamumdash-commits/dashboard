"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  atualizarNota,
  atualizarStatusObjetivo,
  criarNota,
  criarObjetivo,
  excluirCompromisso,
  excluirNota,
  editarObjetivo,
  excluirObjetivo,
} from "@/lib/ecc/planner/actions";
import { formatarDataCurta, ROTULO_AREA } from "@/lib/ecc/planner/regras";
import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import type {
  AreaPlanner,
  CompromissoPlanner,
  HabitoPlanner,
  NotaPlanner,
  ObjetivoPlanner,
  RegistroHabito,
  StatusObjetivo,
  TipoCompromisso,
  TipoHabito,
} from "@/lib/ecc/planner/tipos";
import type { MetaSmart } from "@/lib/ecc/tipos";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { CaixaMarcar } from "@/components/planner/caixa-marcar";
import { FormularioCompromisso, FormularioHabito } from "@/components/planner/formularios";
import { GradeHabitos } from "@/components/planner/grade-habitos";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_BOTAO_SECUNDARIO, CLASSE_CAMPO, CLASSE_CARD, CLASSE_LINK_EDITAR } from "@/components/planner/estilos";

/** Card de seção das telas de área: título, descrição curta e ação. */
export function CardSecao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${CLASSE_CARD} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gaiamum-text">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-gaiamum-text-muted">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function EstadoVazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gaiamum-border px-4 py-8 text-center">
      <p className="font-medium text-gaiamum-text">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-gaiamum-text-muted">{texto}</p>
    </div>
  );
}

function BotaoExcluir({ rotulo, confirmar, acao }: { rotulo: string; confirmar: string; acao: () => ReturnType<typeof excluirNota> }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (window.confirm(confirmar)) executar(acao, { sucesso: "Excluído." });
      }}
      aria-label={rotulo}
      className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger disabled:opacity-60"
    >
      Excluir
    </button>
  );
}

// --------------------------------------------------------------------------
// Rotinas e hábitos
// --------------------------------------------------------------------------

export function SecaoRecorrentes({
  area,
  tipo,
  titulo,
  descricao,
  textoVazio,
  habitos,
  registros,
  segunda,
  hoje,
}: {
  area: AreaPlanner;
  tipo: TipoHabito;
  titulo: string;
  descricao: string;
  textoVazio: string;
  habitos: HabitoPlanner[];
  registros: RegistroHabito[];
  segunda: string;
  hoje: string;
}) {
  const [verArquivados, setVerArquivados] = useState(false);
  const doTipo = habitos.filter((h) => h.tipo === tipo);
  const ativos = doTipo.filter((h) => h.ativo);
  const arquivados = doTipo.filter((h) => !h.ativo);
  const novo = tipo === "rotina" ? "Nova rotina" : "Novo hábito";

  return (
    <CardSecao
      titulo={titulo}
      descricao={descricao}
      acao={
        <BotaoDialogo titulo={novo} className={CLASSE_BOTAO_PRIMARIO} rotulo={`+ ${novo}`}>
          {(fechar) => <FormularioHabito area={area} areaFixa tipo={tipo} aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {ativos.length === 0 ? (
        <EstadoVazio titulo={tipo === "rotina" ? "Nenhuma rotina ainda." : "Nenhum hábito ainda."} texto={textoVazio} />
      ) : (
        <GradeHabitos habitos={ativos} registros={registros} segunda={segunda} hoje={hoje} gerenciar />
      )}
      {arquivados.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerArquivados((v) => !v)}
            aria-expanded={verArquivados}
            className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text"
          >
            {verArquivados ? "Esconder" : "Ver"} arquivados ({arquivados.length})
          </button>
          {verArquivados && (
            <div className="mt-2">
              <GradeHabitos habitos={arquivados} registros={registros} segunda={segunda} hoje={hoje} gerenciar />
            </div>
          )}
        </div>
      )}
    </CardSecao>
  );
}

// --------------------------------------------------------------------------
// Objetivos (decisão do Fabio: tabela leve própria; Metas SMART do negócio
// aparecem só como referência, sem edição aqui)
// --------------------------------------------------------------------------

const ROTULO_STATUS_OBJETIVO: Record<StatusObjetivo, string> = {
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
};

function LinhaObjetivo({ objetivo, hoje }: { objetivo: ObjetivoPlanner; hoje: string }) {
  const { pendente, executar } = useAcaoPlanner();
  const atrasado = objetivo.status === "em_andamento" && objetivo.prazo !== null && objetivo.prazo < hoje;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${objetivo.status === "concluido" ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}>
          {objetivo.titulo}
        </p>
        {objetivo.prazo && (
          <p className={`text-xs ${atrasado ? "text-gaiamum-warning" : "text-gaiamum-text-muted"}`}>
            {atrasado ? "Prazo passou: " : "Até "}
            {formatarDataCurta(objetivo.prazo)}/{objetivo.prazo.slice(0, 4)}
          </p>
        )}
      </div>
      <label className="sr-only" htmlFor={`status-${objetivo.id}`}>
        Status de {objetivo.titulo}
      </label>
      <select
        id={`status-${objetivo.id}`}
        value={objetivo.status}
        disabled={pendente}
        onChange={(e) => executar(() => atualizarStatusObjetivo(objetivo.id, e.target.value))}
        className={`${CLASSE_CAMPO} py-1 text-xs`}
      >
        {Object.entries(ROTULO_STATUS_OBJETIVO).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
      <BotaoDialogo titulo="Editar objetivo" className={CLASSE_LINK_EDITAR} rotulo="Editar">
        {(fechar) => <FormularioObjetivo area={objetivo.area} objetivo={objetivo} aoSalvar={fechar} />}
      </BotaoDialogo>
      <BotaoExcluir
        rotulo={`Excluir ${objetivo.titulo}`}
        confirmar={`Excluir o objetivo "${objetivo.titulo}"?`}
        acao={() => excluirObjetivo(objetivo.id)}
      />
    </li>
  );
}

function FormularioObjetivo({ area, objetivo, aoSalvar }: { area: AreaPlanner; objetivo?: ObjetivoPlanner; aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) =>
        executar(() => (objetivo ? editarObjetivo(objetivo.id, formData) : criarObjetivo(formData)), {
          sucesso: objetivo ? "Objetivo salvo." : "Objetivo criado.",
          aoConcluir: aoSalvar,
        })
      }
    >
      <input type="hidden" name="area" value={area} />
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Objetivo
        <input
          name="titulo"
          required
          maxLength={200}
          autoFocus
          defaultValue={objetivo?.titulo}
          placeholder="Terminar 2 livros até dezembro..."
          className={CLASSE_CAMPO}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Prazo (opcional)
        <input type="date" name="prazo" defaultValue={objetivo?.prazo ?? ""} className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Notas (opcional)
        <textarea name="notas" maxLength={2000} rows={3} defaultValue={objetivo?.notas ?? ""} className={CLASSE_CAMPO} />
      </label>
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : objetivo ? "Salvar" : "Criar objetivo"}
      </button>
    </form>
  );
}

export function SecaoObjetivos({
  area,
  titulo = "Objetivos",
  objetivos,
  metasSmart,
  hoje,
}: {
  area: AreaPlanner;
  titulo?: string;
  objetivos: ObjetivoPlanner[];
  metasSmart: Pick<MetaSmart, "id" | "horizonte" | "specific" | "time_bound">[];
  hoje: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CardSecao
        titulo={titulo}
        descricao={
          area === "pessoal" ? "Seus objetivos pessoais — só você vê." : `Seus objetivos de ${ROTULO_AREA[area].toLowerCase()} — só você vê.`
        }
        acao={
          <BotaoDialogo titulo="Novo objetivo" className={CLASSE_BOTAO_PRIMARIO} rotulo="+ Novo objetivo">
            {(fechar) => <FormularioObjetivo area={area} aoSalvar={fechar} />}
          </BotaoDialogo>
        }
      >
        {objetivos.length === 0 ? (
          <EstadoVazio titulo="Nenhum objetivo ainda." texto="Um objetivo claro com prazo ajuda a escolher as rotinas certas da semana." />
        ) : (
          <ul className="divide-y divide-gaiamum-border">
            {objetivos.map((o) => (
              <LinhaObjetivo key={o.id} objetivo={o} hoje={hoje} />
            ))}
          </ul>
        )}
      </CardSecao>

      {metasSmart.length > 0 && (
        <CardSecao
          titulo="Metas SMART do seu negócio"
          descricao="Referência: são as metas do workspace (a equipe também vê). Elas são editadas em Metas SMART, não aqui."
          acao={
            <Link href="/onboarding" className={CLASSE_BOTAO_SECUNDARIO}>
              Abrir Metas SMART
            </Link>
          }
        >
          <ul className="flex flex-col gap-2">
            {metasSmart.map((m) => (
              <li key={m.id} className="rounded-xl bg-gaiamum-surface-raised px-4 py-3 text-sm">
                <span className="text-gaiamum-text">{m.specific}</span>
                <span className="mt-0.5 block text-xs text-gaiamum-text-muted">
                  {m.horizonte === "medio_prazo" ? "Médio prazo" : "Longo prazo"} · {m.time_bound}
                </span>
              </li>
            ))}
          </ul>
        </CardSecao>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Notas simples
// --------------------------------------------------------------------------

function CartaoNota({ nota }: { nota: NotaPlanner }) {
  const { pendente, executar } = useAcaoPlanner();
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <form
        className="flex flex-col gap-2 rounded-xl border border-gaiamum-primary/50 bg-gaiamum-surface-raised p-4"
        action={(formData) =>
          executar(() => atualizarNota(nota.id, String(formData.get("titulo") ?? ""), String(formData.get("conteudo") ?? "")), {
            sucesso: "Nota salva.",
            aoConcluir: () => setEditando(false),
          })
        }
      >
        <label className="sr-only" htmlFor={`titulo-${nota.id}`}>
          Título
        </label>
        <input id={`titulo-${nota.id}`} name="titulo" required maxLength={200} defaultValue={nota.titulo} className={CLASSE_CAMPO} />
        <label className="sr-only" htmlFor={`conteudo-${nota.id}`}>
          Nota
        </label>
        <textarea id={`conteudo-${nota.id}`} name="conteudo" maxLength={10000} rows={6} defaultValue={nota.conteudo} className={CLASSE_CAMPO} />
        <div className="flex gap-2">
          <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
            Salvar
          </button>
          <button type="button" onClick={() => setEditando(false)} className={CLASSE_BOTAO_SECUNDARIO}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-gaiamum-border bg-gaiamum-surface-raised p-4">
      <h3 className="font-medium text-gaiamum-text">{nota.titulo}</h3>
      {nota.conteudo && <p className="whitespace-pre-wrap text-sm text-gaiamum-text-muted">{nota.conteudo}</p>}
      <div className="mt-auto flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={() => setEditando(true)} className="text-xs text-gaiamum-primary hover:underline">
          Editar
        </button>
        <BotaoExcluir rotulo={`Excluir ${nota.titulo}`} confirmar={`Excluir a nota "${nota.titulo}"?`} acao={() => excluirNota(nota.id)} />
      </div>
    </article>
  );
}

function FormularioNota({ area, aoSalvar }: { area: AreaPlanner; aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <form className="flex flex-col gap-4" action={(formData) => executar(() => criarNota(formData), { sucesso: "Nota criada.", aoConcluir: aoSalvar })}>
      <input type="hidden" name="area" value={area} />
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Título
        <input name="titulo" required maxLength={200} autoFocus className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nota
        <textarea name="conteudo" maxLength={10000} rows={6} className={CLASSE_CAMPO} />
      </label>
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : "Criar nota"}
      </button>
    </form>
  );
}

export function SecaoNotas({ area, notas, titulo = "Notas" }: { area: AreaPlanner; notas: NotaPlanner[]; titulo?: string }) {
  return (
    <CardSecao
      titulo={titulo}
      descricao="Anotações simples. Pra material de projeto com a equipe, use as Páginas do projeto."
      acao={
        <BotaoDialogo titulo="Nova nota" className={CLASSE_BOTAO_PRIMARIO} rotulo="+ Nova nota">
          {(fechar) => <FormularioNota area={area} aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {notas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma nota ainda." texto="Ideias soltas, listas de referência, lembretes que não têm data." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notas.map((n) => (
            <CartaoNota key={n.id} nota={n} />
          ))}
        </div>
      )}
    </CardSecao>
  );
}

// --------------------------------------------------------------------------
// Compromissos (consultas, pets, outros) — também aparecem na Agenda
// --------------------------------------------------------------------------

function formatarInicio(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO_BRASIL,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LinhaCompromisso({
  compromisso,
  pets,
  hoje,
}: {
  compromisso: CompromissoPlanner;
  pets: { id: string; nome: string }[];
  hoje: string;
}) {
  const nomePet = compromisso.pet_id ? (pets.find((p) => p.id === compromisso.pet_id)?.nome ?? null) : null;
  return (
    <li className="flex items-center gap-3 py-3">
      <CaixaMarcar origem="compromisso" id={compromisso.id} data={hoje} feito={compromisso.concluido} rotulo={compromisso.titulo} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${compromisso.concluido ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}>
          {compromisso.titulo}
        </p>
        <p className="truncate text-xs capitalize text-gaiamum-text-muted">
          {formatarInicio(compromisso.inicio)}
          {compromisso.local && ` · ${compromisso.local}`}
          {nomePet && ` · 🐾 ${nomePet}`}
        </p>
      </div>
      <BotaoDialogo titulo={compromisso.tipo === "consulta" ? "Editar consulta" : "Editar compromisso"} className={CLASSE_LINK_EDITAR} rotulo="Editar">
        {(fechar) => <FormularioCompromisso area={compromisso.area} compromisso={compromisso} pets={pets} aoSalvar={fechar} />}
      </BotaoDialogo>
      <BotaoExcluir
        rotulo={`Excluir ${compromisso.titulo}`}
        confirmar={`Excluir "${compromisso.titulo}"? Ele também sai da sua Agenda.`}
        acao={() => excluirCompromisso(compromisso.id)}
      />
    </li>
  );
}

export function SecaoCompromissos({
  area,
  tipo,
  titulo,
  descricao,
  compromissos,
  pets = [],
  hoje,
  agora,
}: {
  area: AreaPlanner;
  tipo: TipoCompromisso;
  titulo: string;
  descricao: string;
  compromissos: CompromissoPlanner[];
  pets?: { id: string; nome: string }[];
  hoje: string;
  /** ISO do "agora" calculado no servidor (render puro, sem Date no cliente). */
  agora: string;
}) {
  const doTipo = compromissos.filter((c) => c.tipo === tipo);
  const proximos = doTipo.filter((c) => c.inicio >= agora || !c.concluido);
  const anteriores = doTipo.filter((c) => c.inicio < agora && c.concluido).reverse();

  return (
    <CardSecao
      titulo={titulo}
      descricao={descricao}
      acao={
        <BotaoDialogo titulo={tipo === "consulta" ? "Nova consulta" : "Novo compromisso"} className={CLASSE_BOTAO_PRIMARIO} rotulo="+ Adicionar">
          {(fechar) => <FormularioCompromisso area={area} areaFixa tipo={tipo} pets={pets} aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {proximos.length === 0 && anteriores.length === 0 ? (
        <EstadoVazio
          titulo={tipo === "consulta" ? "Nenhuma consulta marcada." : "Nenhum compromisso marcado."}
          texto="O que você marcar aqui aparece também na sua Agenda — só pra você."
        />
      ) : (
        <>
          {proximos.length > 0 && (
            <ul className="divide-y divide-gaiamum-border">
              {proximos.map((c) => (
                <LinhaCompromisso key={c.id} compromisso={c} pets={pets} hoje={hoje} />
              ))}
            </ul>
          )}
          {anteriores.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gaiamum-text-muted hover:text-gaiamum-text">Já feitos ({anteriores.length})</summary>
              <ul className="mt-2 divide-y divide-gaiamum-border">
                {anteriores.map((c) => (
                  <LinhaCompromisso key={c.id} compromisso={c} pets={pets} hoje={hoje} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </CardSecao>
  );
}
