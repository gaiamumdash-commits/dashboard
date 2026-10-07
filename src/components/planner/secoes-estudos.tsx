"use client";

import { useState } from "react";
import { atualizarCurso, atualizarLeitura, criarCurso, criarLeitura, excluirCurso, excluirLeitura } from "@/lib/ecc/planner/actions";
import { formatarDataCurta } from "@/lib/ecc/planner/regras";
import type { CursoPlanner, LeituraPlanner, ResultadoAcao, StatusCurso, StatusLeitura, TipoCurso } from "@/lib/ecc/planner/tipos";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { CardSecao, EstadoVazio } from "@/components/planner/secoes-comuns";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

const ROTULO_STATUS_LEITURA: Record<StatusLeitura, string> = { quero_ler: "Quero ler", lendo: "Lendo", concluido: "Concluído" };
const ROTULO_STATUS_CURSO: Record<StatusCurso, string> = { planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído" };

/** Barra de progresso editável (0–100, passo de 5). Salva ao soltar, não a
 * cada movimento — evita uma Server Action por pixel arrastado. */
function ProgressoEditavel({ valor, rotulo, aoSalvar, desabilitado }: { valor: number; rotulo: string; aoSalvar: (v: number) => void; desabilitado: boolean }) {
  const [local, setLocal] = useState(valor);
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    setLocal(valor);
  }
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={local}
        disabled={desabilitado}
        aria-label={`Progresso de ${rotulo}`}
        aria-valuetext={`${local}%`}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => local !== valor && aoSalvar(local)}
        onKeyUp={() => local !== valor && aoSalvar(local)}
        className="h-2 flex-1 cursor-pointer accent-[var(--gaiamum-primary)]"
      />
      <span className="w-10 text-right text-xs tabular-nums text-gaiamum-text-muted">{local}%</span>
    </div>
  );
}

function ExcluirLink({ confirmar, acao }: { confirmar: string; acao: () => Promise<ResultadoAcao> }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => window.confirm(confirmar) && executar(acao, { sucesso: "Excluído." })}
      className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger disabled:opacity-60"
    >
      Excluir
    </button>
  );
}

// --------------------------------------------------------------------------
// Leituras
// --------------------------------------------------------------------------

function CartaoLeitura({ leitura }: { leitura: LeituraPlanner }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-gaiamum-border bg-gaiamum-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gaiamum-text">{leitura.titulo}</p>
          <p className="text-xs text-gaiamum-text-muted">
            {leitura.autor ?? "Autor não informado"}
            {leitura.data_alvo && ` · meta: ${formatarDataCurta(leitura.data_alvo)}/${leitura.data_alvo.slice(0, 4)}`}
          </p>
        </div>
        <label className="sr-only" htmlFor={`status-leitura-${leitura.id}`}>
          Status de {leitura.titulo}
        </label>
        <select
          id={`status-leitura-${leitura.id}`}
          value={leitura.status}
          disabled={pendente}
          onChange={(e) => executar(() => atualizarLeitura(leitura.id, { status: e.target.value }))}
          className={`${CLASSE_CAMPO} py-1 text-xs`}
        >
          {Object.entries(ROTULO_STATUS_LEITURA).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {leitura.status !== "quero_ler" && (
        <ProgressoEditavel
          valor={leitura.progresso}
          rotulo={leitura.titulo}
          desabilitado={pendente}
          aoSalvar={(v) => executar(() => atualizarLeitura(leitura.id, { progresso: v }))}
        />
      )}
      <div className="flex justify-end">
        <ExcluirLink confirmar={`Excluir "${leitura.titulo}"?`} acao={() => excluirLeitura(leitura.id)} />
      </div>
    </li>
  );
}

function FormularioLeitura({ aoSalvar }: { aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <form className="flex flex-col gap-4" action={(fd) => executar(() => criarLeitura(fd), { sucesso: "Leitura adicionada.", aoConcluir: aoSalvar })}>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Título
        <input name="titulo" required maxLength={200} autoFocus className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Autor (opcional)
        <input name="autor" maxLength={120} className={CLASSE_CAMPO} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Status
          <select name="status" defaultValue="lendo" className={CLASSE_CAMPO}>
            {Object.entries(ROTULO_STATUS_LEITURA).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Terminar até (opcional)
          <input type="date" name="data_alvo" className={CLASSE_CAMPO} />
        </label>
      </div>
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : "Adicionar leitura"}
      </button>
    </form>
  );
}

export function SecaoLeituras({ leituras }: { leituras: LeituraPlanner[] }) {
  const grupos: StatusLeitura[] = ["lendo", "quero_ler", "concluido"];
  return (
    <CardSecao
      titulo="Leituras"
      descricao="O que você está lendo, o que quer ler e o que já terminou."
      acao={
        <BotaoDialogo titulo="Nova leitura" className={CLASSE_BOTAO_PRIMARIO} rotulo="+ Nova leitura">
          {(fechar) => <FormularioLeitura aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {leituras.length === 0 ? (
        <EstadoVazio titulo="Nenhuma leitura ainda." texto="Adicione o livro que está na mesa de cabeceira — o progresso aparece no card de Estudos." />
      ) : (
        grupos.map((status) => {
          const doGrupo = leituras.filter((l) => l.status === status);
          if (doGrupo.length === 0) return null;
          return (
            <div key={status}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                {ROTULO_STATUS_LEITURA[status]} ({doGrupo.length})
              </h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {doGrupo.map((l) => (
                  <CartaoLeitura key={l.id} leitura={l} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </CardSecao>
  );
}

// --------------------------------------------------------------------------
// Cursos e idiomas (idioma = organizar objetivo/frequência/progresso, não
// é app de ensino)
// --------------------------------------------------------------------------

function CartaoCurso({ curso }: { curso: CursoPlanner }) {
  const { pendente, executar } = useAcaoPlanner();
  const detalhes = [curso.instituicao, curso.frequencia, curso.data_alvo && `até ${formatarDataCurta(curso.data_alvo)}/${curso.data_alvo.slice(0, 4)}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-gaiamum-border bg-gaiamum-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gaiamum-text">{curso.nome}</p>
          {detalhes && <p className="text-xs text-gaiamum-text-muted">{detalhes}</p>}
          {curso.objetivo && <p className="mt-1 text-sm text-gaiamum-text-muted">🎯 {curso.objetivo}</p>}
        </div>
        <label className="sr-only" htmlFor={`status-curso-${curso.id}`}>
          Status de {curso.nome}
        </label>
        <select
          id={`status-curso-${curso.id}`}
          value={curso.status}
          disabled={pendente}
          onChange={(e) => executar(() => atualizarCurso(curso.id, { status: e.target.value }))}
          className={`${CLASSE_CAMPO} py-1 text-xs`}
        >
          {Object.entries(ROTULO_STATUS_CURSO).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <ProgressoEditavel
        valor={curso.progresso}
        rotulo={curso.nome}
        desabilitado={pendente}
        aoSalvar={(v) => executar(() => atualizarCurso(curso.id, { progresso: v }))}
      />
      <div className="flex items-center justify-between">
        {curso.link ? (
          <a href={curso.link} target="_blank" rel="noreferrer noopener" className="text-xs text-gaiamum-primary hover:underline">
            Abrir link ↗
          </a>
        ) : (
          <span />
        )}
        <ExcluirLink confirmar={`Excluir "${curso.nome}"?`} acao={() => excluirCurso(curso.id)} />
      </div>
    </li>
  );
}

function FormularioCurso({ tipo, aoSalvar }: { tipo: TipoCurso; aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  const idioma = tipo === "idioma";
  return (
    <form className="flex flex-col gap-4" action={(fd) => executar(() => criarCurso(fd), { sucesso: "Adicionado.", aoConcluir: aoSalvar })}>
      <input type="hidden" name="tipo" value={tipo} />
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        {idioma ? "Idioma" : "Curso"}
        <input name="nome" required maxLength={200} autoFocus placeholder={idioma ? "Inglês, Espanhol..." : "Gestão de projetos..."} className={CLASSE_CAMPO} />
      </label>
      {idioma ? (
        <>
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Objetivo (opcional)
            <input name="objetivo" maxLength={300} placeholder="Conversar em reuniões até junho..." className={CLASSE_CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Frequência (opcional)
            <input name="frequencia" maxLength={120} placeholder="3x por semana, 30 min" className={CLASSE_CAMPO} />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Instituição (opcional)
            <input name="instituicao" maxLength={120} className={CLASSE_CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Link (opcional)
            <input type="url" name="link" maxLength={500} placeholder="https://" className={CLASSE_CAMPO} />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Concluir até (opcional)
        <input type="date" name="data_alvo" className={CLASSE_CAMPO} />
      </label>
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : idioma ? "Adicionar idioma" : "Adicionar curso"}
      </button>
    </form>
  );
}

export function SecaoCursos({ tipo, cursos }: { tipo: TipoCurso; cursos: CursoPlanner[] }) {
  const idioma = tipo === "idioma";
  const doTipo = cursos.filter((c) => c.tipo === tipo);
  return (
    <CardSecao
      titulo={idioma ? "Idiomas" : "Cursos"}
      descricao={
        idioma
          ? "Organize objetivo, frequência e progresso. As sessões de estudo entram como rotina em “Rotina de estudos”."
          : "Cursos que você está fazendo ou quer fazer."
      }
      acao={
        <BotaoDialogo titulo={idioma ? "Novo idioma" : "Novo curso"} className={CLASSE_BOTAO_PRIMARIO} rotulo={idioma ? "+ Novo idioma" : "+ Novo curso"}>
          {(fechar) => <FormularioCurso tipo={tipo} aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {doTipo.length === 0 ? (
        <EstadoVazio
          titulo={idioma ? "Nenhum idioma ainda." : "Nenhum curso ainda."}
          texto={idioma ? "Defina o idioma e o objetivo — depois crie a rotina de estudo dele." : "Acompanhe o progresso e o prazo de cada curso."}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {doTipo.map((c) => (
            <CartaoCurso key={c.id} curso={c} />
          ))}
        </ul>
      )}
    </CardSecao>
  );
}
