import { describe, it, expect } from "vitest";
import { detectarData, rotuloData } from "@/lib/ecc/mapas/datas";
import { citaPalavra, palavrasChave, tagsDoMapa } from "@/lib/ecc/mapas/palavras";

// 2026-10-10 é sábado.
const HOJE = "2026-10-10";

describe("datas citadas nos ramos (regra, sem IA)", () => {
  it.each([
    ["Reunião sexta 14h", { data: "2026-10-16", hora: "14:00" }],
    ["entrega 15/11", { data: "2026-11-15", hora: null }],
    ["entrega 15/11/27", { data: "2027-11-15", hora: null }],
    ["pagar dia 5", { data: "2026-11-05", hora: null }],
    ["pagar dia 25", { data: "2026-10-25", hora: null }],
    ["evento 20 de dezembro às 9", { data: "2026-12-20", hora: "09:00" }],
    ["amanhã 8:30", { data: "2026-10-11", hora: "08:30" }],
    ["depois de amanhã", { data: "2026-10-12", hora: null }],
    ["revisão 05/03", { data: "2027-03-05", hora: null }],
    ["Ideias de sábado", { data: "2026-10-17", hora: null }],
    ["HOJE ao meio-dia", { data: "2026-10-10", hora: "12:00" }],
  ])("%s", (texto, esperado) => {
    expect(detectarData(texto, HOJE)).toEqual(esperado);
  });

  it("sem data (ou data impossível) devolve null", () => {
    expect(detectarData("Copy da página", HOJE)).toBeNull();
    expect(detectarData("31/02", HOJE)).toBeNull();
    expect(detectarData("chamar a 3 pessoas", HOJE)).toBeNull();
  });

  it("rótulo curto: Hoje, Amanhã, dd/mm e ano só se não for o atual", () => {
    expect(rotuloData({ data: "2026-10-10", hora: "14:00" }, HOJE)).toBe("Hoje 14:00");
    expect(rotuloData({ data: "2026-10-11", hora: null }, HOJE)).toBe("Amanhã");
    expect(rotuloData({ data: "2026-11-15", hora: null }, HOJE)).toBe("15/11");
    expect(rotuloData({ data: "2027-03-05", hora: null }, HOJE)).toBe("05/03/2027");
  });
});

describe("palavras-chave e #tags (contagem, sem IA)", () => {
  const textos = ["Lançamento do produto", "Produto: página de vendas", "Vídeo de vendas #urgente", "Anúncios #Urgente", "produto novo"];

  it("conta sem acento/maiúscula, ignora palavras comuns, mostra a grafia mais usada", () => {
    const r = palavrasChave(textos);
    expect(r.map((p) => [p.palavra, p.total])).toEqual([
      ["produto", 3],
      ["vendas", 2],
    ]);
    // "de", "do" e palavras citadas uma vez ficam de fora.
    expect(r.some((p) => p.chave === "de" || p.chave === "lancamento")).toBe(false);
  });

  it("#tags contam juntas (sem acento/maiúscula) e aparecem mesmo citadas uma vez", () => {
    const tags = tagsDoMapa(textos);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ chave: "#urgente", total: 2 });
    expect(palavrasChave(textos).some((p) => p.chave.includes("urgente"))).toBe(false);
  });

  it("filtro: o ramo cita a palavra inteira ou a #tag", () => {
    expect(citaPalavra("Página de VENDAS", "vendas")).toBe(true);
    expect(citaPalavra("vendaval", "vendas")).toBe(false);
    expect(citaPalavra("Anúncios #Urgente", "#urgente")).toBe(true);
    expect(citaPalavra("urgente sem tag", "#urgente")).toBe(false);
  });
});
