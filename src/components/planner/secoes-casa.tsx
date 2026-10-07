"use client";

import { useRef, useState } from "react";
import {
  adicionarCompra,
  criarManutencao,
  criarPet,
  excluirCompra,
  excluirManutencao,
  excluirPet,
  limparComprados,
  marcarCompra,
  marcarManutencaoFeita,
  salvarRefeicao,
} from "@/lib/ecc/planner/actions";
import {
  formatarDataCurta,
  NOME_DIA,
  ROTULO_REFEICAO,
  ROTULO_STATUS_MANUTENCAO,
  SIGLA_DIA,
  statusManutencao,
  type StatusManutencao,
} from "@/lib/ecc/planner/regras";
import { REFEICOES, type CelulaCardapio, type ItemCompra, type ManutencaoPlanner, type PetPlanner, type Refeicao } from "@/lib/ecc/planner/tipos";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { CardSecao, EstadoVazio } from "@/components/planner/secoes-comuns";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_BOTAO_SECUNDARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

function dataLonga(chave: string): string {
  return `${formatarDataCurta(chave)}/${chave.slice(0, 4)}`;
}

// --------------------------------------------------------------------------
// Compras — lista simples por categoria
// --------------------------------------------------------------------------

function LinhaCompra({ item }: { item: ItemCompra }) {
  const { pendente, executar } = useAcaoPlanner();
  const [otimista, setOtimista] = useState(item.comprado);
  const [anterior, setAnterior] = useState(item.comprado);
  if (item.comprado !== anterior) {
    setAnterior(item.comprado);
    setOtimista(item.comprado);
  }
  return (
    <li className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        id={`compra-${item.id}`}
        checked={otimista}
        disabled={pendente}
        onChange={() => {
          const novo = !otimista;
          setOtimista(novo);
          executar(() => marcarCompra(item.id, novo), { desfazer: () => setOtimista(!novo) });
        }}
        className="h-4 w-4 accent-[var(--gaiamum-success)]"
      />
      <label htmlFor={`compra-${item.id}`} className={`min-w-0 flex-1 truncate text-sm ${otimista ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}>
        {item.nome}
        {item.quantidade && <span className="text-gaiamum-text-muted"> · {item.quantidade}</span>}
      </label>
      <button
        type="button"
        aria-label={`Remover ${item.nome}`}
        disabled={pendente}
        onClick={() => executar(() => excluirCompra(item.id))}
        className="text-gaiamum-text-muted hover:text-gaiamum-danger"
      >
        ✕
      </button>
    </li>
  );
}

export function SecaoCompras({ compras }: { compras: ItemCompra[] }) {
  const { pendente, executar } = useAcaoPlanner();
  const formRef = useRef<HTMLFormElement>(null);
  const categorias = [...new Set(compras.map((c) => c.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const comprados = compras.filter((c) => c.comprado).length;

  return (
    <CardSecao
      titulo="Lista de compras"
      descricao="Adicione, marque o que já comprou e limpe no fim."
      acao={
        comprados > 0 ? (
          <button
            type="button"
            disabled={pendente}
            onClick={() => executar(() => limparComprados(), { sucesso: "Comprados removidos da lista." })}
            className={CLASSE_BOTAO_SECUNDARIO}
          >
            Limpar comprados ({comprados})
          </button>
        ) : undefined
      }
    >
      <form
        ref={formRef}
        className="grid gap-2 sm:grid-cols-[1fr_10rem_7rem_auto]"
        action={(fd) => executar(() => adicionarCompra(fd), { aoConcluir: () => formRef.current?.reset() })}
      >
        <label className="sr-only" htmlFor="compra-nome">
          Item
        </label>
        <input id="compra-nome" name="nome" required maxLength={120} placeholder="Filtro de água, arroz..." className={CLASSE_CAMPO} />
        <label className="sr-only" htmlFor="compra-categoria">
          Categoria
        </label>
        <input id="compra-categoria" name="categoria" maxLength={60} placeholder="Categoria" list="categorias-compra" className={CLASSE_CAMPO} />
        <datalist id="categorias-compra">
          {["Mercado", "Hortifruti", "Limpeza", "Farmácia", "Casa", ...categorias].filter((v, i, a) => a.indexOf(v) === i).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label className="sr-only" htmlFor="compra-quantidade">
          Quantidade
        </label>
        <input id="compra-quantidade" name="quantidade" maxLength={40} placeholder="Qtd." className={CLASSE_CAMPO} />
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
          Adicionar
        </button>
      </form>

      {compras.length === 0 ? (
        <EstadoVazio titulo="Lista vazia." texto="O que faltar em casa vai aqui — dá pra agrupar por categoria." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categorias.map((categoria) => (
            <div key={categoria}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">{categoria}</h3>
              <ul className="mt-1 divide-y divide-gaiamum-border">
                {compras
                  .filter((c) => c.categoria === categoria)
                  .sort((a, b) => Number(a.comprado) - Number(b.comprado))
                  .map((c) => (
                    <LinhaCompra key={c.id} item={c} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </CardSecao>
  );
}

// --------------------------------------------------------------------------
// Cardápio semanal — célula editável, salva ao sair do campo
// --------------------------------------------------------------------------

function CelulaRefeicao({ semana, dia, refeicao, valor }: { semana: string; dia: number; refeicao: Refeicao; valor: string }) {
  const { pendente, executar } = useAcaoPlanner();
  const [texto, setTexto] = useState(valor);
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    setTexto(valor);
  }
  const id = `cardapio-${dia}-${refeicao}`;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {ROTULO_REFEICAO[refeicao]} de {NOME_DIA[dia - 1]}
      </label>
      <input
        id={id}
        value={texto}
        maxLength={200}
        disabled={pendente}
        placeholder="—"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          if (texto.trim() === valor.trim()) return;
          executar(() => salvarRefeicao(semana, dia, refeicao, texto), { desfazer: () => setTexto(valor) });
        }}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted hover:border-gaiamum-border focus:border-gaiamum-primary focus:bg-gaiamum-surface-raised"
      />
    </div>
  );
}

export function SecaoCardapio({ semana, cardapio, hoje }: { semana: string; cardapio: CelulaCardapio[]; hoje: string }) {
  const valor = (dia: number, refeicao: Refeicao) =>
    cardapio.find((c) => c.dia_semana === dia && c.refeicao === refeicao)?.descricao ?? "";

  return (
    <CardSecao
      titulo="Cardápio da semana"
      descricao={`Semana de ${formatarDataCurta(semana)}. Clique numa célula e escreva — salva ao sair do campo. Não é app de nutrição: só pra decidir o que comer e o que comprar.`}
    >
      {/* `relative`: os rótulos sr-only (position absolute) das células
          ficariam fora do recorte e esticariam a página no celular. */}
      <div className="relative -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Cardápio da semana por dia e refeição</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16">
                <span className="sr-only">Dia</span>
              </th>
              {REFEICOES.map((r) => (
                <th key={r} scope="col" className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                  {ROTULO_REFEICAO[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gaiamum-border">
            {[1, 2, 3, 4, 5, 6, 7].map((dia) => {
              const data = (() => {
                const [a, m, d] = semana.split("-").map(Number);
                return new Date(Date.UTC(a, m - 1, d + dia - 1)).toISOString().slice(0, 10);
              })();
              const ehHoje = data === hoje;
              return (
                <tr key={dia} className={ehHoje ? "bg-gaiamum-primary/5" : ""}>
                  <th scope="row" className={`px-2 py-1 text-left text-xs font-semibold ${ehHoje ? "text-gaiamum-primary" : "text-gaiamum-text-muted"}`}>
                    {SIGLA_DIA[dia - 1]}
                    <span className="block font-normal">{formatarDataCurta(data)}</span>
                  </th>
                  {REFEICOES.map((r) => (
                    <td key={r} className="px-1">
                      <CelulaRefeicao semana={semana} dia={dia} refeicao={r} valor={valor(dia, r)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardSecao>
  );
}

// --------------------------------------------------------------------------
// Pets — cadastro leve; compromissos do pet ficam em "Compromissos" (tipo pet)
// --------------------------------------------------------------------------

function FormularioPet({ aoSalvar }: { aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <form className="flex flex-col gap-4" action={(fd) => executar(() => criarPet(fd), { sucesso: "Pet adicionado.", aoConcluir: aoSalvar })}>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome
        <input name="nome" required maxLength={80} autoFocus className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Tipo (opcional)
        <input name="tipo" maxLength={60} placeholder="Cachorro, gato..." className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Notas (opcional)
        <textarea name="notas" maxLength={2000} rows={3} placeholder="Ração, veterinário, cuidados..." className={CLASSE_CAMPO} />
      </label>
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : "Adicionar pet"}
      </button>
    </form>
  );
}

export function SecaoPets({ pets }: { pets: PetPlanner[] }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <CardSecao
      titulo="Pets"
      descricao="Quem mora com você. Vacinas e consultas do pet entram em “Compromissos do pet”, logo abaixo — e aparecem na Agenda."
      acao={
        <BotaoDialogo titulo="Novo pet" className={CLASSE_BOTAO_PRIMARIO} rotulo="+ Novo pet">
          {(fechar) => <FormularioPet aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {pets.length === 0 ? (
        <EstadoVazio titulo="Nenhum pet cadastrado." texto="Cadastre pra ligar vacinas, banho e veterinário a ele." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pets.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 rounded-xl border border-gaiamum-border bg-gaiamum-surface-raised p-4">
              <p className="font-medium text-gaiamum-text">🐾 {p.nome}</p>
              {p.tipo && <p className="text-xs text-gaiamum-text-muted">{p.tipo}</p>}
              {p.notas && <p className="whitespace-pre-wrap text-sm text-gaiamum-text-muted">{p.notas}</p>}
              <button
                type="button"
                disabled={pendente}
                onClick={() => window.confirm(`Excluir ${p.nome}? Os compromissos dele continuam, sem o vínculo.`) && executar(() => excluirPet(p.id))}
                className="mt-2 self-end text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </CardSecao>
  );
}

// --------------------------------------------------------------------------
// Manutenções — última vez, próxima data, recorrência em meses
// --------------------------------------------------------------------------

const CLASSE_STATUS: Record<StatusManutencao, string> = {
  atrasada: "bg-gaiamum-danger/15 text-gaiamum-danger",
  em_breve: "bg-gaiamum-warning/15 text-gaiamum-warning",
  em_dia: "bg-gaiamum-success/15 text-gaiamum-success",
  sem_data: "bg-gaiamum-surface text-gaiamum-text-muted",
};

function FormularioManutencao({ aoSalvar }: { aoSalvar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <form className="flex flex-col gap-4" action={(fd) => executar(() => criarManutencao(fd), { sucesso: "Manutenção criada.", aoConcluir: aoSalvar })}>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Manutenção
        <input name="nome" required maxLength={120} autoFocus placeholder="Trocar filtro de água, limpar ar-condicionado..." className={CLASSE_CAMPO} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Última vez (opcional)
          <input type="date" name="ultima_realizacao" className={CLASSE_CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Próxima data
          <input type="date" name="proxima_data" className={CLASSE_CAMPO} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Repetir a cada (meses, opcional)
        <input type="number" name="recorrencia_meses" min={1} max={120} inputMode="numeric" placeholder="6" className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Observação (opcional)
        <textarea name="observacao" maxLength={1000} rows={2} className={CLASSE_CAMPO} />
      </label>
      <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
        {pendente ? "Salvando..." : "Criar manutenção"}
      </button>
    </form>
  );
}

function LinhaManutencao({ manutencao, hoje }: { manutencao: ManutencaoPlanner; hoje: string }) {
  const { pendente, executar } = useAcaoPlanner();
  const status = statusManutencao(manutencao, hoje);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gaiamum-text">{manutencao.nome}</p>
        <p className="text-xs text-gaiamum-text-muted">
          {manutencao.proxima_data ? `Próxima: ${dataLonga(manutencao.proxima_data)}` : "Sem próxima data"}
          {manutencao.ultima_realizacao && ` · última: ${dataLonga(manutencao.ultima_realizacao)}`}
          {manutencao.recorrencia_meses && ` · a cada ${manutencao.recorrencia_meses} ${manutencao.recorrencia_meses === 1 ? "mês" : "meses"}`}
        </p>
        {manutencao.observacao && <p className="mt-1 text-xs text-gaiamum-text-muted">{manutencao.observacao}</p>}
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CLASSE_STATUS[status]}`}>{ROTULO_STATUS_MANUTENCAO[status]}</span>
      <button
        type="button"
        disabled={pendente}
        onClick={() => executar(() => marcarManutencaoFeita(manutencao.id), { sucesso: "Registrado. Próxima data atualizada." })}
        className={`${CLASSE_BOTAO_SECUNDARIO} py-1 text-xs`}
      >
        ✓ Feita hoje
      </button>
      <button
        type="button"
        disabled={pendente}
        onClick={() => window.confirm(`Excluir "${manutencao.nome}"?`) && executar(() => excluirManutencao(manutencao.id))}
        className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
      >
        Excluir
      </button>
    </li>
  );
}

export function SecaoManutencoes({ manutencoes, hoje }: { manutencoes: ManutencaoPlanner[]; hoje: string }) {
  return (
    <CardSecao
      titulo="Manutenções"
      descricao="Filtro, ar-condicionado, seguro, revisões. A próxima data aparece na sua Agenda."
      acao={
        <BotaoDialogo titulo="Nova manutenção" className={CLASSE_BOTAO_PRIMARIO} rotulo="+ Nova manutenção">
          {(fechar) => <FormularioManutencao aoSalvar={fechar} />}
        </BotaoDialogo>
      }
    >
      {manutencoes.length === 0 ? (
        <EstadoVazio titulo="Nenhuma manutenção cadastrada." texto="Cadastre o que tem prazo de troca ou revisão e pare de lembrar só quando quebra." />
      ) : (
        <ul className="divide-y divide-gaiamum-border">
          {manutencoes.map((m) => (
            <LinhaManutencao key={m.id} manutencao={m} hoje={hoje} />
          ))}
        </ul>
      )}
    </CardSecao>
  );
}
