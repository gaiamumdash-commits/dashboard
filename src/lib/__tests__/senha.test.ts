import { describe, it, expect } from "vitest";
import { ehErroDeSenhaCurta, MENSAGEM_SENHA_CURTA, TAMANHO_MINIMO_SENHA_LOGIN, TAMANHO_MINIMO_SENHA_NOVA } from "@/lib/senha";

describe("regra de senha", () => {
  it("senha nova exige 8; login continua aceitando a partir de 6 (quem já tinha senha curta não fica trancado)", () => {
    expect(TAMANHO_MINIMO_SENHA_NOVA).toBe(8);
    expect(TAMANHO_MINIMO_SENHA_LOGIN).toBe(6);
    expect(MENSAGEM_SENHA_CURTA).toContain("8 caracteres");
  });

  it("reconhece o erro em inglês do Supabase pra traduzir", () => {
    expect(ehErroDeSenhaCurta("Password should be at least 8 characters.")).toBe(true);
    expect(ehErroDeSenhaCurta("Invalid login credentials")).toBe(false);
  });
});
