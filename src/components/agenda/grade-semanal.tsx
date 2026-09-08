"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemAgenda } from "@/lib/ecc/tipos";
import { chaveSemanaAtual, diasDaSemana } from "@/lib/ecc/semana";
import { APENAS_DATA, COR_FONTE_AGENDA, formatarHora, mesmoDia } from "@/lib/ecc/agenda-apresentacao";
import { CLASSE_COR_ETIQUETA } from "@/lib/ecc/kanban";
import { DetalheItemAgenda } from "@/components/agenda/detalhe-item-agenda";

const ALTURA_HORA_PX = 48;
const HORAS = Array.from({ length: 24 }, (_, i) => i);

type ItemComHorario = { item: ItemAgenda; inicioMin: number; fimMin: number };
type ItemPosicionado = ItemComHorario & { coluna: number; totalColunas: number };

/** Aloca cada item na primeira coluna cujo último item já terminou antes do
 * início deste — estratégia clássica e simples de layout de agenda pra
 * eventos sobrepostos. Largura uniforme por dia (não por cluster local):
 * suficiente pra V1, sem sofisticar. */
function distribuirColunas(itens: ItemComHorario[]): ItemPosicionado[] {
  const ordenados = [...itens].sort((a, b) => a.inicioMin - b.inicioMin);
  const ultimoFimPorColuna: number[] = [];

  const comColuna = ordenados.map((it) => {
    let coluna = ultimoFimPorColuna.findIndex((fim) => fim <= it.inicioMin);
    if (coluna === -1) {
      coluna = ultimoFimPorColuna.length;
      ultimoFimPorColuna.push(it.fimMin);
    } else {
      ultimoFimPorColuna[coluna] = it.fimMin;
    }
    return { ...it, coluna };
  });

  const totalColunas = Math.max(ultimoFimPorColuna.length, 1);
  return comColuna.map((it) => ({ ...it, totalColunas }));
}

export function GradeSemanal({ itens, chaveSemana }: { itens: ItemAgenda[]; chaveSemana: string }) {
  const [itemSelecionado, setItemSelecionado] = useState<ItemAgenda | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const dias = diasDaSemana(chaveSemana);
  const ehSemanaAtual = chaveSemana === chaveSemanaAtual();

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll pro horário atual só na troca de semana (montagem inclusa),
  // nunca a cada minuto — senão o usuário não conseguiria rolar manualmente.
  useEffect(() => {
    if (!ehSemanaAtual || !containerRef.current) return;
    const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
    containerRef.current.scrollTop = Math.max((agoraMin / 60 - 2) * ALTURA_HORA_PX, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveSemana]);

  const itensDiaInteiroPorDia = dias.map((dia) =>
    itens.filter((item) => APENAS_DATA.test(item.quando) && mesmoDia(new Date(`${item.quando}T00:00:00`), dia)),
  );

  const itensPontuaisPorDia = dias.map((dia) => {
    const doDia: ItemComHorario[] = itens
      .filter((item) => !APENAS_DATA.test(item.quando))
      .filter((item) => mesmoDia(new Date(item.quando), dia))
      .map((item) => {
        const inicio = new Date(item.quando);
        const inicioMin = inicio.getHours() * 60 + inicio.getMinutes();
        const fim = item.fim ? new Date(item.fim) : null;
        const fimMinBruto = fim ? fim.getHours() * 60 + fim.getMinutes() : inicioMin + 30;
        return { item, inicioMin, fimMin: Math.max(fimMinBruto, inicioMin + 15) };
      });
    return distribuirColunas(doDia);
  });

  const temDiaInteiro = itensDiaInteiroPorDia.some((doDia) => doDia.length > 0);

  return (
    <div>
      {/* Cabeçalho fica DENTRO do container com scroll (sticky), não fora dele
       * — como irmão fora, ele usava largura cheia enquanto o grid de baixo
       * perdia ~16px pra barra de rolagem, desalinhando as colunas. */}
      <div ref={containerRef} className="mt-2 max-h-[70vh] overflow-y-auto">
        <div className="sticky top-0 z-20 bg-gaiamum-surface">
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gaiamum-border pb-2">
            <div />
            {dias.map((dia) => (
              <div
                key={dia.toISOString()}
                className={`text-center text-xs font-medium ${mesmoDia(dia, new Date()) ? "text-gaiamum-primary" : "text-gaiamum-text-muted"}`}
              >
                <div className="capitalize">{dia.toLocaleDateString("pt-BR", { weekday: "short" })}</div>
                <div className="text-sm text-gaiamum-text">{dia.getDate()}</div>
              </div>
            ))}
          </div>

          {temDiaInteiro && (
            <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-1 border-b border-gaiamum-border py-2">
              <div className="text-right text-[10px] text-gaiamum-text-muted">Dia</div>
              {itensDiaInteiroPorDia.map((doDia, i) => (
                <div key={dias[i].toISOString()} className="flex flex-col gap-1 px-1">
                  {doDia.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setItemSelecionado(item)}
                      className={`truncate rounded border px-1.5 py-0.5 text-left text-[11px] ${CLASSE_COR_ETIQUETA[COR_FONTE_AGENDA[item.fonte]]}`}
                    >
                      {item.titulo}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          <div>
            {HORAS.map((h) => (
              <div
                key={h}
                style={{ height: ALTURA_HORA_PX }}
                className="pr-2 text-right text-[11px] text-gaiamum-text-muted"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {dias.map((dia, i) => (
            <div key={dia.toISOString()} className="relative border-l border-gaiamum-border">
              {HORAS.map((h) => (
                <div key={h} style={{ height: ALTURA_HORA_PX }} className="border-t border-gaiamum-border" />
              ))}

              {itensPontuaisPorDia[i].map(({ item, inicioMin, fimMin, coluna, totalColunas }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setItemSelecionado(item)}
                  style={{
                    top: (inicioMin / 60) * ALTURA_HORA_PX,
                    height: Math.max(((fimMin - inicioMin) / 60) * ALTURA_HORA_PX, 20),
                    left: `${(coluna / totalColunas) * 100}%`,
                    width: `${100 / totalColunas}%`,
                  }}
                  className={`absolute overflow-hidden rounded border px-1 py-0.5 text-left text-[11px] leading-tight ${CLASSE_COR_ETIQUETA[COR_FONTE_AGENDA[item.fonte]]}`}
                >
                  <span className="block truncate font-medium">{item.titulo}</span>
                  <span className="block truncate opacity-80">{formatarHora(item.quando)}</span>
                </button>
              ))}

              {ehSemanaAtual && mesmoDia(dia, agora) && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-10 h-px bg-gaiamum-danger"
                  style={{ top: ((agora.getHours() * 60 + agora.getMinutes()) / 60) * ALTURA_HORA_PX }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {itemSelecionado && (
        <DetalheItemAgenda key={itemSelecionado.id} item={itemSelecionado} aoFechar={() => setItemSelecionado(null)} />
      )}
    </div>
  );
}
