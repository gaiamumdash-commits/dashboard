import Link from "next/link";
import { AnelProgresso } from "@/components/planner/anel-progresso";
import { COR_AREA } from "@/components/planner/cores-area";
import { GradeHabitos } from "@/components/planner/grade-habitos";
import { CLASSE_CARD } from "@/components/planner/estilos";
import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import type { ResumoArea } from "@/lib/ecc/planner/painel";
import { diaIsoDe, formatarDataCurta, ROTULO_STATUS_MANUTENCAO, statusManutencao } from "@/lib/ecc/planner/regras";
import type { DadosArea } from "@/lib/ecc/planner/dados";
import type { AreaPlanner } from "@/lib/ecc/planner/tipos";

function Bloco({ titulo, link, children }: { titulo: string; link?: { href: string; rotulo: string }; children: React.ReactNode }) {
  return (
    <section className={`${CLASSE_CARD} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gaiamum-text">{titulo}</h2>
        {link && (
          <Link href={link.href} className="text-sm text-gaiamum-primary hover:underline">
            {link.rotulo} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-gaiamum-text-muted">{texto}</p>;
}

/** Visão geral de uma área: consistência + indicadores (mesmos do card da
 * visão geral do Planner), a semana dos hábitos/rotinas da área, próximos
 * compromissos e um bloco específico por área. Só leitura e atalhos — a
 * edição fica nas abas. */
export function VisaoGeralArea({
  area,
  resumo,
  dados,
  agora,
}: {
  area: AreaPlanner;
  resumo: ResumoArea;
  dados: DadosArea;
  agora: string;
}) {
  const { hoje, segunda } = dados.semana;
  const ativos = dados.habitos.filter((h) => h.ativo);
  const proximos = dados.compromissos.filter((c) => !c.concluido && c.inicio >= agora).slice(0, 5);
  const abaRecorrentes = area === "casa" ? "rotinas" : "rotina";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className={`${CLASSE_CARD} flex items-center gap-5 lg:col-span-3`}>
        <AnelProgresso percentual={resumo.consistencia.percentual} classeCor={COR_AREA[area].texto} tamanho={88} rotulo="Consistência da semana" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gaiamum-text-muted">
            {resumo.consistencia.percentual === null
              ? "Ainda não há hábitos ou rotinas planejados até hoje nesta semana."
              : `${resumo.consistencia.feitos} de ${resumo.consistencia.planejados} hábitos e rotinas planejados até hoje foram feitos.`}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {resumo.metricas.map((m) => (
              <li key={m.rotulo} className="text-gaiamum-text-muted">
                <span className="mr-1 font-semibold text-gaiamum-text">{m.valor}</span>
                {m.rotulo}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="lg:col-span-2">
        <Bloco titulo="Esta semana" link={{ href: `/planner/${area}?aba=${abaRecorrentes}`, rotulo: "Gerenciar" }}>
          {ativos.length === 0 ? (
            <Vazio texto="Nenhum hábito ou rotina nesta área ainda." />
          ) : (
            <GradeHabitos habitos={ativos} registros={dados.registros} segunda={segunda} hoje={hoje} />
          )}
        </Bloco>
      </div>

      <Bloco titulo="Próximos compromissos">
        {proximos.length === 0 ? (
          <Vazio texto="Nada marcado." />
        ) : (
          <ul className="flex flex-col gap-2">
            {proximos.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="text-gaiamum-text">{c.titulo}</span>
                <span className="block text-xs capitalize text-gaiamum-text-muted">
                  {new Date(c.inicio).toLocaleString("pt-BR", {
                    timeZone: FUSO_BRASIL,
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      {area === "estudos" && (
        <>
          <Bloco titulo="Foco atual" link={{ href: "/planner/estudos?aba=leituras", rotulo: "Leituras" }}>
            {dados.leituras.filter((l) => l.status === "lendo").length === 0 ? (
              <Vazio texto="Nenhuma leitura em andamento." />
            ) : (
              <ul className="flex flex-col gap-3">
                {dados.leituras
                  .filter((l) => l.status === "lendo")
                  .map((l) => (
                    <li key={l.id}>
                      <div className="flex justify-between text-sm">
                        <span className="truncate text-gaiamum-text">📖 {l.titulo}</span>
                        <span className="text-gaiamum-text-muted">{l.progresso}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gaiamum-surface-raised">
                        <div className="h-full rounded-full bg-gaiamum-tag-blue" style={{ width: `${l.progresso}%` }} />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Bloco>
          <div className="lg:col-span-2">
            <Bloco titulo="Cursos e idiomas" link={{ href: "/planner/estudos?aba=cursos", rotulo: "Cursos" }}>
              {dados.cursos.filter((c) => c.status !== "concluido").length === 0 ? (
                <Vazio texto="Nenhum curso ou idioma em andamento." />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {dados.cursos
                    .filter((c) => c.status !== "concluido")
                    .map((c) => (
                      <li key={c.id} className="rounded-xl bg-gaiamum-surface-raised p-3 text-sm">
                        <span className="text-gaiamum-text">
                          {c.tipo === "idioma" ? "🗣️" : "🎓"} {c.nome}
                        </span>
                        <span className="block text-xs text-gaiamum-text-muted">{c.progresso}% concluído</span>
                      </li>
                    ))}
                </ul>
              )}
            </Bloco>
          </div>
        </>
      )}

      {area === "casa" && (
        <>
          <Bloco titulo="Manutenções próximas" link={{ href: "/planner/casa?aba=manutencoes", rotulo: "Todas" }}>
            {(() => {
              const proximas = dados.manutencoes.filter((m) => ["atrasada", "em_breve"].includes(statusManutencao(m, hoje)));
              if (proximas.length === 0) return <Vazio texto="Nada vencendo nos próximos 7 dias." />;
              return (
                <ul className="flex flex-col gap-2 text-sm">
                  {proximas.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span className="truncate text-gaiamum-text">🔧 {m.nome}</span>
                      <span className="shrink-0 text-xs text-gaiamum-text-muted">
                        {ROTULO_STATUS_MANUTENCAO[statusManutencao(m, hoje)]}
                        {m.proxima_data && ` · ${formatarDataCurta(m.proxima_data)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Bloco>
          <Bloco titulo="Cardápio de hoje" link={{ href: "/planner/casa?aba=cardapio", rotulo: "Semana" }}>
            {(() => {
              const doDia = dados.cardapio.filter((c) => c.dia_semana === diaIsoDe(hoje));
              if (doDia.length === 0) return <Vazio texto="Nada planejado pra hoje." />;
              return (
                <ul className="flex flex-col gap-1 text-sm">
                  {doDia.map((c) => (
                    <li key={c.id} className="text-gaiamum-text">
                      {c.descricao}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Bloco>
          <Bloco titulo="Lista de compras" link={{ href: "/planner/casa?aba=compras", rotulo: "Abrir" }}>
            {dados.compras.filter((c) => !c.comprado).length === 0 ? (
              <Vazio texto="Nada pendente." />
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {dados.compras
                  .filter((c) => !c.comprado)
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.id} className="truncate text-gaiamum-text">
                      • {c.nome}
                    </li>
                  ))}
              </ul>
            )}
          </Bloco>
        </>
      )}

      {(area === "pessoal" || area === "saude") && (
        <div className="lg:col-span-3">
          <Bloco
            titulo={area === "saude" ? "Objetivos de bem-estar" : "Objetivos"}
            link={{ href: `/planner/${area}?aba=${area === "saude" ? "bem-estar" : "objetivos"}`, rotulo: "Abrir" }}
          >
            {dados.objetivos.filter((o) => o.status === "em_andamento").length === 0 ? (
              <Vazio texto="Nenhum objetivo em andamento." />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {dados.objetivos
                  .filter((o) => o.status === "em_andamento")
                  .map((o) => (
                    <li key={o.id} className="rounded-xl bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text">
                      🎯 {o.titulo}
                      {o.prazo && <span className="block text-xs text-gaiamum-text-muted">até {formatarDataCurta(o.prazo)}</span>}
                    </li>
                  ))}
              </ul>
            )}
          </Bloco>
        </div>
      )}
    </div>
  );
}
