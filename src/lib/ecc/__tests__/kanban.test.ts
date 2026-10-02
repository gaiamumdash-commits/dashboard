import { describe, it, expect, vi, afterEach } from "vitest";
import {
  urgenciaDoPrazo,
  calcularNovaOrdem,
  corAvatarPorEmail,
  hojeISOBrasil,
  paraUtcDoFuso,
  encontrarColunaEmFoco,
  calcularVelocidadeAutoScroll,
  gerarIdCliente,
  estadoHiperfoco,
  minutosRestantesHiperfoco,
} from "@/lib/ecc/kanban";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("gerarIdCliente — achado real, 2026-10-01: fallback precisa ser um UUID válido de verdade", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usa crypto.randomUUID quando disponível (contexto seguro: HTTPS ou localhost)", () => {
    const id = gerarIdCliente();
    expect(id).toMatch(REGEX_UUID);
  });

  it("[REGRESSÃO] em contexto NÃO seguro (crypto.randomUUID ausente, como HTTP puro num IP de rede), ainda devolve um UUID válido — não um 'temp-xxx' qualquer que o banco rejeitaria com 'invalid input syntax for type uuid'", () => {
    vi.stubGlobal("crypto", {});
    const id = gerarIdCliente();
    expect(id).toMatch(REGEX_UUID);
  });

  it("gera ids diferentes em chamadas sucessivas, mesmo no fallback", () => {
    vi.stubGlobal("crypto", {});
    const a = gerarIdCliente();
    const b = gerarIdCliente();
    expect(a).not.toBe(b);
  });
});

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

describe("estadoHiperfoco — temporizador de hiperfoco (migration 0052)", () => {
  afterEach(() => vi.useRealTimers());

  it("inativo quando não há timer (sem início ou sem duração)", () => {
    expect(estadoHiperfoco(null, 30)).toBe("inativo");
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", null)).toBe("inativo");
  });

  it("ativo logo no início do timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T10:01:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe("ativo");
  });

  it("metade exatamente na metade do tempo — pedido do Fabio: proporcional à duração, não um limiar fixo", () => {
    vi.useFakeTimers();
    // Timer de 30min iniciado às 10:00 — metade é às 10:15.
    vi.setSystemTime(new Date("2026-10-02T10:15:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe("metade");
  });

  it("ainda ativo 1min antes da metade", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T10:14:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe("ativo");
  });

  it("esgotado exatamente no horário em que vence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T10:30:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe("esgotado");
  });

  it("continua esgotado bem depois de vencer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe("esgotado");
  });

  it("timers de durações diferentes acendem o amarelo em momentos proporcionalmente diferentes", () => {
    vi.useFakeTimers();
    // 15min de duração, metade é aos 7min30s — 7min ainda deve ser "ativo".
    vi.setSystemTime(new Date("2026-10-02T10:07:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 15)).toBe("ativo");
    vi.setSystemTime(new Date("2026-10-02T10:08:00.000Z"));
    expect(estadoHiperfoco("2026-10-02T10:00:00.000Z", 15)).toBe("metade");
  });
});

describe("minutosRestantesHiperfoco", () => {
  afterEach(() => vi.useRealTimers());

  it("conta os minutos restantes, arredondando pra cima", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T10:20:30.000Z"));
    // 30min a partir de 10:00 vence às 10:30 — faltam 9min30s, arredonda pra 10.
    expect(minutosRestantesHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe(10);
  });

  it("nunca fica negativo depois de esgotar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T11:00:00.000Z"));
    expect(minutosRestantesHiperfoco("2026-10-02T10:00:00.000Z", 30)).toBe(0);
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

// Kanban mobile (2026-09-30): coluna em foco durante o swipe horizontal e
// velocidade do auto-scroll durante um arrasto de cartão por toque.
describe("encontrarColunaEmFoco", () => {
  const colunas = [
    { id: "a", offsetLeft: 0, largura: 300 },
    { id: "b", offsetLeft: 300, largura: 300 },
    { id: "c", offsetLeft: 600, largura: 300 },
  ];

  it("escolhe a 1ª coluna quando o centro visível está sobre ela", () => {
    expect(encontrarColunaEmFoco(colunas, 150)).toBe("a");
  });

  it("escolhe a coluna do meio quando o centro visível está sobre ela", () => {
    expect(encontrarColunaEmFoco(colunas, 450)).toBe("b");
  });

  it("escolhe a última coluna quando o centro visível está além dela (fim do scroll)", () => {
    expect(encontrarColunaEmFoco(colunas, 950)).toBe("c");
  });

  it("no ponto exato de fronteira entre duas colunas, escolhe uma das duas de forma determinística (a 1ª encontrada)", () => {
    // Fronteira exata entre "a" (centro 150) e "b" (centro 450) é 300 —
    // distância igual (150) pras duas; o "menor que" no laço mantém a 1ª.
    expect(encontrarColunaEmFoco(colunas, 300)).toBe("a");
  });

  it("devolve null pra lista vazia (quadro sem colunas)", () => {
    expect(encontrarColunaEmFoco([], 100)).toBeNull();
  });
});

describe("calcularVelocidadeAutoScroll", () => {
  it("não rola quando a distância da borda é maior que a zona de ativação", () => {
    expect(calcularVelocidadeAutoScroll(200, 90, 18)).toBe(0);
  });

  it("não rola quando já passou da borda (distância negativa)", () => {
    expect(calcularVelocidadeAutoScroll(-5, 90, 18)).toBe(0);
  });

  it("rola na velocidade máxima quando colado na borda (distância 0)", () => {
    expect(calcularVelocidadeAutoScroll(0, 90, 18)).toBe(18);
  });

  it("rola mais devagar quanto mais longe da borda, dentro da zona", () => {
    const pertoDaBorda = calcularVelocidadeAutoScroll(10, 90, 18);
    const longeDaBorda = calcularVelocidadeAutoScroll(80, 90, 18);
    expect(pertoDaBorda).toBeGreaterThan(longeDaBorda);
    expect(longeDaBorda).toBeGreaterThan(0);
  });

  it("zona de ativação zero ou negativa nunca rola (evita divisão por zero)", () => {
    expect(calcularVelocidadeAutoScroll(0, 0, 18)).toBe(0);
  });
});
