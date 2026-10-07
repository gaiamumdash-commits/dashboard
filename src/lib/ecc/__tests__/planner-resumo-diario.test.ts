import { describe, it, expect } from "vitest";
import { assuntoDoResumo, montarResumoDiario, resumoTemConteudo, textoDoResumo } from "@/lib/ecc/planner/resumo-diario";

// Quarta, 2026-10-07; ontem = terça (ISO 2).
const HOJE = "2026-10-07";
const habitos = [
  { id: "r1", nome: "Planejamento do dia", tipo: "rotina" as const, dias_semana: [1, 2, 3, 4, 5], horario: "08:00:00", ativo: true },
  { id: "r2", nome: "Leitura", tipo: "rotina" as const, dias_semana: [3], horario: "20:00:00", ativo: true },
  { id: "h1", nome: "Beber água", tipo: "habito" as const, dias_semana: [1, 2, 3, 4, 5, 6, 7], horario: null, ativo: true },
  { id: "h2", nome: "Arquivado", tipo: "habito" as const, dias_semana: [3], horario: null, ativo: false },
];

describe("resumo diário do Planner", () => {
  const resumo = montarResumoDiario({
    hoje: HOJE,
    habitos,
    registrosDeOntem: [{ habito_id: "r1" }],
    compromissos: [
      { titulo: "Comprar filtro", inicio: "2026-10-07T19:00:00Z", local: null },
      { titulo: "Consulta dentista", inicio: "2026-10-07T17:00:00Z", local: "Clínica Saúde Oral" },
    ],
    manutencoes: [
      { nome: "Limpar ar-condicionado", proxima_data: "2026-09-30" },
      { nome: "Trocar filtro", proxima_data: "2026-10-07" },
      { nome: "Seguro", proxima_data: "2027-02-01" },
    ],
  });

  it("monta o dia em ordem, sem itens arquivados", () => {
    expect(resumo.compromissos).toEqual([
      { titulo: "Consulta dentista", horario: "14:00", local: "Clínica Saúde Oral" },
      { titulo: "Comprar filtro", horario: "16:00", local: null },
    ]);
    expect(resumo.rotinas).toEqual([
      { nome: "Planejamento do dia", horario: "08:00" },
      { nome: "Leitura", horario: "20:00" },
    ]);
    expect(resumo.habitos).toEqual(["Beber água"]);
    expect(resumo.manutencoes).toEqual([
      { nome: "Limpar ar-condicionado", atrasada: true },
      { nome: "Trocar filtro", atrasada: false },
    ]);
  });

  it("ontem: planejados de terça (Planejamento + Beber água), 1 feito", () => {
    expect(resumo.ontem).toEqual({ feitos: 1, planejados: 2 });
  });

  it("assunto e texto puro", () => {
    expect(assuntoDoResumo(resumo)).toBe("Seu dia no Planner: 2 compromissos, 3 hábitos e rotinas, 2 manutenções");
    const texto = textoDoResumo(resumo, "Fabio", "https://www.gaiamum.com.br/planner");
    expect(texto).toContain("- 14:00 Consulta dentista (Clínica Saúde Oral)");
    expect(texto).toContain("Limpar ar-condicionado (atrasada)");
    expect(texto).toContain("Ontem: 1 de 2");
    expect(texto).toContain("desligue");
  });

  it("dia sem nada não gera e-mail", () => {
    const vazio = montarResumoDiario({ hoje: HOJE, habitos: [], registrosDeOntem: [], compromissos: [], manutencoes: [] });
    expect(resumoTemConteudo(vazio)).toBe(false);
    expect(resumoTemConteudo(resumo)).toBe(true);
  });
});
