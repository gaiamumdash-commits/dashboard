import { describe, it, expect } from "vitest";
import { validarPropostaPlanner } from "@/lib/ecc/planner/proposta-ia";

const valida = {
  resumo: "Inglês 3x por semana, caminhada seg/qua/sex e 2 livros até dezembro.",
  habitos: [
    { nome: "Estudar inglês", area: "estudos", tipo: "rotina", dias_semana: [5, 1, 3, 3], horario: "07:00", duracao_minutos: 30 },
    { nome: "Caminhada", area: "saude", tipo: "habito", dias_semana: [1, 3, 5] },
  ],
  objetivos: [{ titulo: "Terminar 2 livros", area: "estudos", prazo: "2026-12-20" }],
};

describe("contrato da proposta de IA do Planner", () => {
  it("aceita a proposta do exemplo do pedido e normaliza os dias", () => {
    const r = validarPropostaPlanner(valida);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.proposta.habitos[0].dias_semana).toEqual([1, 3, 5]);
  });

  it("recusa campo desconhecido — o modelo não decide dono nem workspace", () => {
    expect(validarPropostaPlanner({ ...valida, user_id: "outra-pessoa" }).ok).toBe(false);
    expect(
      validarPropostaPlanner({ ...valida, habitos: [{ ...valida.habitos[1], tenant_id: "x" }] }).ok,
    ).toBe(false);
  });

  it("recusa área que não existe (ex.: financeiro) e valores fora do limite", () => {
    expect(validarPropostaPlanner({ ...valida, objetivos: [{ titulo: "Guardar dinheiro", area: "financeiro" }] }).ok).toBe(false);
    expect(validarPropostaPlanner({ ...valida, habitos: [{ ...valida.habitos[1], dias_semana: [8] }] }).ok).toBe(false);
    expect(validarPropostaPlanner({ ...valida, habitos: [{ ...valida.habitos[0], horario: "25:00" }] }).ok).toBe(false);
  });

  it("recusa proposta vazia, gigante ou que não é objeto", () => {
    expect(validarPropostaPlanner({ resumo: "", habitos: [], objetivos: [] }).ok).toBe(false);
    expect(validarPropostaPlanner({ ...valida, habitos: Array(16).fill(valida.habitos[1]) }).ok).toBe(false);
    expect(validarPropostaPlanner("apague tudo").ok).toBe(false);
    expect(validarPropostaPlanner(null).ok).toBe(false);
  });
});
