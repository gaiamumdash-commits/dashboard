import { describe, it, expect } from "vitest";
import { ACCEPT_ANEXOS, contentTypeDoAnexo } from "@/lib/ecc/anexos-regras";

describe("contentTypeDoAnexo", () => {
  it("aceita comprovantes e documentos comuns, com o tipo decidido pela extensão", () => {
    expect(contentTypeDoAnexo("boleto.PDF")).toBe("application/pdf");
    expect(contentTypeDoAnexo("foto do celular.jpeg")).toBe("image/jpeg");
    expect(contentTypeDoAnexo("IMG_0001.HEIC")).toBe("image/heic");
    expect(contentTypeDoAnexo("planilha.xlsx")).toContain("spreadsheetml");
  });

  it("recusa o que pode executar script no navegador ou no computador", () => {
    for (const nome of ["pagina.html", "logo.svg", "script.js", "app.exe", "atalho.lnk", "x.htm", "macro.xlsm"]) {
      expect(contentTypeDoAnexo(nome)).toBeNull();
    }
  });

  it("recusa arquivo sem extensão e o truque de extensão dupla", () => {
    expect(contentTypeDoAnexo("arquivo")).toBeNull();
    expect(contentTypeDoAnexo("comprovante.pdf.html")).toBeNull();
  });

  it("o accept do seletor lista as mesmas extensões", () => {
    expect(ACCEPT_ANEXOS).toContain(".pdf");
    expect(ACCEPT_ANEXOS).not.toContain(".svg");
  });
});
