import { describe, it, expect } from "vitest";
import { inicioDoMinuto, inicioDaHora } from "@/lib/ecc/ia-rate-limit";

describe("inicioDoMinuto — janela usada no limite por usuário (rajada curta)", () => {
  it("zera segundos e milissegundos, preserva o minuto", () => {
    const data = new Date("2026-09-30T14:23:47.512Z");
    expect(inicioDoMinuto(data)).toBe("2026-09-30T14:23:00.000Z");
  });

  it("duas chamadas no mesmo minuto caem na mesma janela (mesma chave de contagem)", () => {
    const a = new Date("2026-09-30T14:23:01.000Z");
    const b = new Date("2026-09-30T14:23:58.000Z");
    expect(inicioDoMinuto(a)).toBe(inicioDoMinuto(b));
  });

  it("um minuto de diferença cai em janelas diferentes", () => {
    const a = new Date("2026-09-30T14:23:59.000Z");
    const b = new Date("2026-09-30T14:24:00.000Z");
    expect(inicioDoMinuto(a)).not.toBe(inicioDoMinuto(b));
  });
});

describe("inicioDaHora — janela usada nos limites de workspace/global (volume sustentado)", () => {
  it("zera minutos, segundos e milissegundos, preserva a hora", () => {
    const data = new Date("2026-09-30T14:23:47.512Z");
    expect(inicioDaHora(data)).toBe("2026-09-30T14:00:00.000Z");
  });

  it("duas chamadas na mesma hora caem na mesma janela", () => {
    const a = new Date("2026-09-30T14:01:00.000Z");
    const b = new Date("2026-09-30T14:59:59.000Z");
    expect(inicioDaHora(a)).toBe(inicioDaHora(b));
  });

  it("uma hora de diferença cai em janelas diferentes", () => {
    const a = new Date("2026-09-30T14:59:59.000Z");
    const b = new Date("2026-09-30T15:00:00.000Z");
    expect(inicioDaHora(a)).not.toBe(inicioDaHora(b));
  });
});
