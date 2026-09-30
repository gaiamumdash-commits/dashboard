import { describe, it, expect } from "vitest";
import { extrairIdsMencionados, calcularBuscaMencao, aplicarMencao } from "@/lib/ecc/mencoes";
import type { MembroTenant } from "@/lib/ecc/tipos";

const MEMBROS: MembroTenant[] = [
  { user_id: "u1", email: "fabio@gaiamum.com.br", papel: "owner" },
  { user_id: "u2", email: "ana@gaiamum.com.br", papel: "member" },
];

describe("extrairIdsMencionados — só reconhece @email de gente que é membro real", () => {
  it("reconhece uma menção válida no meio do texto", () => {
    const ids = extrairIdsMencionados("oi @fabio@gaiamum.com.br, pode revisar isso?", MEMBROS);
    expect(ids).toEqual(["u1"]);
  });

  it("ignora um @algo que não é e-mail de membro (evita falso positivo)", () => {
    const ids = extrairIdsMencionados("isso é tipo @importante mesmo", MEMBROS);
    expect(ids).toEqual([]);
  });

  it("reconhece múltiplas menções distintas sem duplicar", () => {
    const ids = extrairIdsMencionados("@fabio@gaiamum.com.br e @ana@gaiamum.com.br, vejam isso", MEMBROS);
    expect(ids.sort()).toEqual(["u1", "u2"]);
  });

  it("sem nenhum membro no workspace, nunca reconhece nada", () => {
    expect(extrairIdsMencionados("@fabio@gaiamum.com.br", [])).toEqual([]);
  });
});

describe("calcularBuscaMencao — detecta @token em digitação até a posição do cursor", () => {
  it("reconhece um @ em digitação no início do texto", () => {
    expect(calcularBuscaMencao("@fab", 4)).toBe("fab");
  });

  it("devolve null quando não há @ sendo digitado", () => {
    expect(calcularBuscaMencao("texto qualquer sem arroba", 10)).toBeNull();
  });

  it("ignora um @ já finalizado (com espaço depois)", () => {
    expect(calcularBuscaMencao("@fabio@gaiamum.com.br mais texto", 30)).toBeNull();
  });
});

describe("aplicarMencao — substitui o token parcial por @email completo", () => {
  it("substitui '@fab' por '@fabio@gaiamum.com.br ' e posiciona o cursor depois do espaço", () => {
    const { novoTexto, novoCursor } = aplicarMencao("oi @fab", 7, "fabio@gaiamum.com.br");
    expect(novoTexto).toBe("oi @fabio@gaiamum.com.br ");
    expect(novoCursor).toBe(novoTexto.length);
  });
});
