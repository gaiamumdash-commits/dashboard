import { describe, it, expect } from "vitest";
import { focoDoDia, habitosSemHorarioPendentes, itensDoDia, semanaDoPlanner } from "@/lib/ecc/planner/painel";

// Quarta, 2026-10-07. 13:00Z = 10:00 em Brasília.
const HOJE = "2026-10-07";

const habitos = [
  { id: "r1", nome: "Planejamento do dia", tipo: "rotina" as const, dias_semana: [1, 2, 3, 4, 5], horario: "08:00:00", duracao_minutos: null, area: "pessoal" as const },
  { id: "r2", nome: "Leitura", tipo: "rotina" as const, dias_semana: [3], horario: "20:00:00", duracao_minutos: 20, area: "estudos" as const },
  { id: "h1", nome: "Beber água", tipo: "habito" as const, dias_semana: [1, 2, 3, 4, 5, 6, 7], horario: null, duracao_minutos: null, area: "saude" as const },
  { id: "h2", nome: "Inglês", tipo: "habito" as const, dias_semana: [3], horario: "09:00:00", duracao_minutos: 30, area: "estudos" as const },
];

const compromissos = [
  { id: "c1", titulo: "Consulta dentista", inicio: "2026-10-07T17:00:00Z", local: "Clínica Saúde Oral", concluido: false, area: "saude" as const },
  { id: "c2", titulo: "Vacina", inicio: "2026-10-09T13:00:00Z", local: null, concluido: true, area: "casa" as const },
];

const agenda = [
  { id: "g1", fonte: "google" as const, titulo: "Reunião projeto", quando: "2026-10-07T14:00:00Z", link: "https://calendar" },
  { id: "k1", fonte: "conta_a_pagar" as const, titulo: "Internet", quando: "2026-10-07", link: "/financeiro" },
  { id: "g2", fonte: "google" as const, titulo: "Amanhã", quando: "2026-10-08T14:00:00Z", link: null },
  // 02:00Z do dia 8 ainda é dia 7 no Brasil (23:00).
  { id: "g3", fonte: "google" as const, titulo: "Tarde da noite", quando: "2026-10-08T02:00:00Z", link: null },
];

describe("card Hoje", () => {
  it("junta rotinas, hábitos com horário, compromissos e Agenda, em ordem de horário", () => {
    const itens = itensDoDia({ data: HOJE, habitos, registros: [{ habito_id: "r1", data: HOJE }], compromissos, agenda });
    expect(itens.map((i) => [i.horario, i.titulo])).toEqual([
      ["08:00", "Planejamento do dia"],
      ["09:00", "Inglês"],
      ["11:00", "Reunião projeto"],
      ["14:00", "Consulta dentista"],
      ["20:00", "Leitura"],
      ["23:00", "Tarde da noite"],
      [null, "Internet"],
    ]);
    expect(itens.find((i) => i.id === "r1")!.feito).toBe(true);
    expect(itens.find((i) => i.id === "c1")).toMatchObject({ feito: false, detalhe: "Clínica Saúde Oral", href: "/planner/saude" });
    // Item de outro módulo: sem checkbox, só link.
    expect(itens.find((i) => i.id === "g1")).toMatchObject({ feito: null, detalhe: "Google Agenda" });
    // Hábito sem horário não polui o card cronológico.
    expect(itens.some((i) => i.id === "h1")).toBe(false);
  });

  it("dia sem nada devolve lista vazia", () => {
    expect(itensDoDia({ data: "2026-10-11", habitos: [], registros: [], compromissos: [], agenda: [] })).toEqual([]);
  });
});

describe("Foco de hoje", () => {
  it("só pendentes, compromisso primeiro, depois rotinas/hábitos, até 3", () => {
    const itens = itensDoDia({ data: HOJE, habitos, registros: [{ habito_id: "r1", data: HOJE }], compromissos, agenda });
    const extras = habitosSemHorarioPendentes(habitos, [], HOJE);
    expect(extras.map((e) => e.titulo)).toEqual(["Beber água"]);
    expect(focoDoDia(itens, extras).map((i) => i.titulo)).toEqual(["Consulta dentista", "Leitura", "Inglês"]);
  });

  it("hábito sem horário já feito não entra no foco", () => {
    expect(habitosSemHorarioPendentes(habitos, [{ habito_id: "h1", data: HOJE }], HOJE)).toEqual([]);
  });

  it("sem nada do Planner, mostra itens dos outros módulos", () => {
    const itens = itensDoDia({ data: HOJE, habitos: [], registros: [], compromissos: [], agenda });
    expect(focoDoDia(itens, []).map((i) => i.titulo)).toEqual(["Reunião projeto", "Tarde da noite", "Internet"]);
  });
});

describe("Esta semana", () => {
  it("7 dias e placar só com itens marcáveis do Planner", () => {
    const { dias, concluidos, total } = semanaDoPlanner({
      segunda: "2026-10-05",
      habitos,
      registros: [
        { habito_id: "r1", data: "2026-10-05" },
        { habito_id: "r1", data: "2026-10-06" },
      ],
      compromissos,
      agenda,
    });
    expect(dias).toHaveLength(7);
    expect(dias[0].data).toBe("2026-10-05");
    // r1: 5 dias úteis; r2: qua; h2 (hábito com horário): qua; c1, c2 → 9 marcáveis.
    expect(total).toBe(9);
    // r1 seg+ter, c2 concluído.
    expect(concluidos).toBe(3);
    expect(dias[3].itens.map((i) => i.titulo)).toContain("Amanhã");
  });
});
