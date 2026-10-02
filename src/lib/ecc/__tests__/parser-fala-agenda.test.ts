import { describe, it, expect } from "vitest";
import { interpretarFalaAgenda } from "@/lib/ecc/parser-fala-agenda";

const AGORA = new Date(2026, 8, 30, 10, 0); // quarta-feira, 30/09/2026, 10h (hora local do teste)

describe("interpretarFalaAgenda — parser determinístico (sem IA) de voz para compromisso", () => {
  it("reconhece 'amanhã às 15h' e extrai título limpo", () => {
    const r = interpretarFalaAgenda("reunião com o cliente amanhã às 15h", AGORA);
    expect(r.titulo).toBe("reunião com o cliente");
    expect(r.inicioLocal).toBe("2026-10-01T15:00");
    expect(r.fimLocal).toBeNull();
  });

  it("reconhece intervalo 'das 9h às 11h' e preenche início e fim", () => {
    const r = interpretarFalaAgenda("workshop hoje das 9h às 11h", AGORA);
    expect(r.inicioLocal).toBe("2026-09-30T09:00");
    expect(r.fimLocal).toBe("2026-09-30T11:00");
  });

  it("descarta o fim quando ele viria antes do início (intervalo inválido)", () => {
    const r = interpretarFalaAgenda("evento hoje das 18h às 10h", AGORA);
    expect(r.fimLocal).toBeNull();
  });

  it("reconhece dia da semana futuro (sexta-feira)", () => {
    const r = interpretarFalaAgenda("dentista sexta-feira às 8h", AGORA);
    // 30/09/2026 é quarta; a próxima sexta é 02/10/2026.
    expect(r.inicioLocal).toBe("2026-10-02T08:00");
  });

  it("reconhece data explícita dd/mm", () => {
    const r = interpretarFalaAgenda("aniversário dia 25/12", AGORA);
    expect(r.inicioLocal.slice(0, 10)).toBe("2026-12-25");
  });

  it("reconhece antecedência de alarme em minutos/horas", () => {
    const r = interpretarFalaAgenda("consulta amanhã às 14h me avise 30 minutos antes", AGORA);
    expect(r.antecedenciaMin).toBe(30);
  });

  it("sem antecedência mencionada, o alarme fica em 0 (sem alarme)", () => {
    const r = interpretarFalaAgenda("almoço hoje ao meio-dia", AGORA);
    expect(r.antecedenciaMin).toBe(0);
    expect(r.inicioLocal).toBe("2026-09-30T12:00");
  });

  it("reconhece meia-noite", () => {
    const r = interpretarFalaAgenda("virada do ano meia-noite", AGORA);
    expect(r.inicioLocal.endsWith("T00:00")).toBe(true);
  });

  it("continua funcionando com texto acentuado real (achado real documentado no código-fonte)", () => {
    const r = interpretarFalaAgenda("reunião de alinhamento às 16h", AGORA);
    expect(r.titulo).toBe("reunião de alinhamento");
    expect(r.inicioLocal).toBe("2026-09-30T16:00");
  });

  it("nunca devolve título vazio — cai no fallback 'Compromisso'", () => {
    const r = interpretarFalaAgenda("às 10h", AGORA);
    expect(r.titulo.length).toBeGreaterThan(0);
  });
});
