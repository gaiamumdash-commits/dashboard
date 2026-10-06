import { describe, it, expect } from "vitest";
import { autorizacaoCronValida } from "@/lib/cron-auth";

describe("autorizacaoCronValida", () => {
  it("aceita o header com o segredo certo", () => {
    expect(autorizacaoCronValida("Bearer segredo-de-teste", "segredo-de-teste")).toBe(true);
  });

  it("recusa segredo errado ou header ausente", () => {
    expect(autorizacaoCronValida("Bearer outro", "segredo-de-teste")).toBe(false);
    expect(autorizacaoCronValida(null, "segredo-de-teste")).toBe(false);
  });

  it("segredo vazio NUNCA autoriza, nem com o header 'Bearer ' (achado da auditoria)", () => {
    expect(autorizacaoCronValida("Bearer ", "")).toBe(false);
    expect(autorizacaoCronValida("Bearer    ", "   ")).toBe(false);
  });
});
