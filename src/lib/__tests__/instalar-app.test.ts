import { describe, it, expect } from "vitest";
import { conviteDispensadoRecentemente, detectarFormaInstalacao, instrucoesInstalacao } from "@/lib/instalar-app";

const UA = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
};

const base = { maxTouchPoints: 0, emModoApp: false, temPromptNativo: false };

describe("detectarFormaInstalacao", () => {
  it("já rodando como app → instalado, em qualquer navegador", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.iphone, emModoApp: true })).toBe("instalado");
  });

  it("prompt nativo disponível → um clique", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.chromeWindows, temPromptNativo: true })).toBe("um-clique");
  });

  it("Chrome e Edge sem prompt → instalação pelo menu", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.chromeWindows })).toBe("chromium-manual");
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.edgeWindows })).toBe("chromium-manual");
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.chromeMac })).toBe("chromium-manual");
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.android })).toBe("chromium-manual");
  });

  it("iPhone → ios", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.iphone, maxTouchPoints: 5 })).toBe("ios");
  });

  it("iPad que se apresenta como Mac (tela de toque) → ios, não safari-mac", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.safariMac, maxTouchPoints: 5 })).toBe("ios");
  });

  it("Safari no Mac → safari-mac", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.safariMac })).toBe("safari-mac");
  });

  it("Firefox no PC → sem suporte", () => {
    expect(detectarFormaInstalacao({ ...base, userAgent: UA.firefoxWindows })).toBe("sem-suporte");
  });
});

describe("instrucoesInstalacao", () => {
  it("tem passo a passo pra toda forma que não é 1 clique nem instalado", () => {
    for (const forma of ["ios", "safari-mac", "chromium-manual", "sem-suporte"] as const) {
      expect(instrucoesInstalacao(forma).length).toBeGreaterThan(0);
    }
    expect(instrucoesInstalacao("um-clique")).toEqual([]);
    expect(instrucoesInstalacao("instalado")).toEqual([]);
  });
});

describe("conviteDispensadoRecentemente", () => {
  const agora = new Date("2026-10-10T12:00:00Z").getTime();

  it("nunca dispensado → mostra", () => {
    expect(conviteDispensadoRecentemente(null, agora)).toBe(false);
  });

  it("dispensado há 2 dias → continua escondido", () => {
    expect(conviteDispensadoRecentemente("2026-10-08T12:00:00Z", agora)).toBe(true);
  });

  it("dispensado há 8 dias → volta a aparecer", () => {
    expect(conviteDispensadoRecentemente("2026-10-02T12:00:00Z", agora)).toBe(false);
  });

  it("valor corrompido no navegador → mostra (nunca quebra)", () => {
    expect(conviteDispensadoRecentemente("lixo", agora)).toBe(false);
  });
});
