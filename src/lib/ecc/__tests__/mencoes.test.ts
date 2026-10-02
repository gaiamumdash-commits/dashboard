import { describe, it, expect } from "vitest";
import { extrairIdsMencionados, calcularBuscaMencao, aplicarMencao } from "@/lib/ecc/mencoes";
import type { MembroTenant } from "@/lib/ecc/tipos";

const MEMBROS: MembroTenant[] = [
  { user_id: "u1", email: "fabio@gaiamum.com.br", papel: "owner", nome_exibicao: "fabio" },
  { user_id: "u2", email: "ana@gaiamum.com.br", papel: "member", nome_exibicao: "ana" },
];

// Revisão de privacidade (2026-10-01): `email` pode ser `null` quando quem
// está vendo não tem direito a ele (migration 0049) — a @menção precisa
// continuar funcionando usando `nome_exibicao` nesse caso.
const MEMBROS_COM_UM_SEM_EMAIL: MembroTenant[] = [
  { user_id: "u1", email: null, papel: "owner", nome_exibicao: "fabio" },
  { user_id: "u2", email: "ana@gaiamum.com.br", papel: "member", nome_exibicao: "ana" },
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

describe("extrairIdsMencionados — revisão de privacidade (2026-10-01): membro sem e-mail visível", () => {
  it("reconhece a menção pelo nome_exibicao quando email é null", () => {
    const ids = extrairIdsMencionados("oi @fabio, pode revisar isso?", MEMBROS_COM_UM_SEM_EMAIL);
    expect(ids).toEqual(["u1"]);
  });

  it("o membro com e-mail visível continua reconhecido pelo e-mail completo, sem mudança", () => {
    const ids = extrairIdsMencionados("oi @ana@gaiamum.com.br", MEMBROS_COM_UM_SEM_EMAIL);
    expect(ids).toEqual(["u2"]);
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
