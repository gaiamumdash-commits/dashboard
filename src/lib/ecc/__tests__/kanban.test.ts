import { describe, it, expect, vi, afterEach } from "vitest";
import {
  urgenciaDoPrazo,
  calcularNovaOrdem,
  corAvatarPorEmail,
  hojeISOBrasil,
  paraUtcDoFuso,
} from "@/lib/ecc/kanban";

describe("urgenciaDoPrazo", () => {
  afterEach(() => vi.useRealTimers());

  it("marca sem_prazo quando não há data_limite", () => {
    expect(urgenciaDoPrazo({ data_limite: null }, false)).toBe("sem_prazo");
  });

  it("marca ok quando a coluna já está concluída, mesmo com prazo vencido", () => {
    expect(urgenciaDoPrazo({ data_limite: "2020-01-01T00:00:00.000Z" }, true)).toBe("ok");
  });

  it("marca atrasado quando o prazo já passou e a coluna não é a concluída", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    expect(urgenciaDoPrazo({ data_limite: "2026-09-29T12:00:00.000Z" }, false)).toBe("atrasado");
  });

  it("marca proximo quando faltam até 48h — regressão real: era 'dias de calendário', hoje é hora exata (migration 0013)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    // Falta exatamente 47h — dentro da janela de alerta.
    expect(urgenciaDoPrazo({ data_limite: "2026-10-02T11:00:00.000Z" }, false)).toBe("proximo");
  });

  it("marca ok quando falta mais de 48h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    expect(urgenciaDoPrazo({ data_limite: "2026-10-05T12:00:00.000Z" }, false)).toBe("ok");
  });
});

describe("calcularNovaOrdem — posição fracionária do cartão (técnica Trello/Notion)", () => {
  it("usa 1000 quando a coluna está vazia (sem vizinho nenhum)", () => {
    expect(calcularNovaOrdem(null, null)).toBe(1000);
  });

  it("soma 1000 ao vizinho de cima quando solto no fim da coluna", () => {
    expect(calcularNovaOrdem(2000, null)).toBe(3000);
  });

  it("subtrai 1000 do vizinho de baixo quando solto no topo da coluna", () => {
    expect(calcularNovaOrdem(null, 2000)).toBe(1000);
  });

  it("usa a média exata entre os dois vizinhos quando solto no meio", () => {
    expect(calcularNovaOrdem(1000, 2000)).toBe(1500);
  });
});

describe("corAvatarPorEmail — determinística por e-mail", () => {
  it("sempre devolve a mesma cor para o mesmo e-mail", () => {
    const a = corAvatarPorEmail("fabio@gaiamum.com.br");
    const b = corAvatarPorEmail("fabio@gaiamum.com.br");
    expect(a).toBe(b);
  });

  it("é uma das 6 cores fixas do sistema", () => {
    const cor = corAvatarPorEmail("qualquer@exemplo.com");
    expect(["purple", "teal", "yellow", "blue", "coral", "lime"]).toContain(cor);
  });
});

describe("hojeISOBrasil — achado real de bug corrigido em 2026-09-29 (UTC vs. fuso de Brasília)", () => {
  afterEach(() => vi.useRealTimers());

  it("às 22h de Brasília (01h UTC do dia seguinte) ainda devolve a data de hoje, não a de amanhã", () => {
    // 2026-09-29 22:00 em Brasília (UTC-3) = 2026-09-30 01:00 em UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T01:00:00.000Z"));
    expect(hojeISOBrasil()).toBe("2026-09-29");
  });

  it("ao meio-dia de Brasília, data em UTC e em Brasília coincidem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T15:00:00.000Z")); // 12h em Brasília
    expect(hojeISOBrasil()).toBe("2026-09-30");
  });
});

describe("paraUtcDoFuso", () => {
  it("converte 14:00 de Brasília (UTC-3) para 17:00 UTC", () => {
    const utc = paraUtcDoFuso("2026-09-30T14:00", "America/Sao_Paulo");
    expect(utc.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });
});
