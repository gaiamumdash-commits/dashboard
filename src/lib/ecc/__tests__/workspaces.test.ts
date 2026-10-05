import { describe, it, expect } from "vitest";
import { escolherMembership, rotuloDoWorkspace, workspacesDoSeletor } from "@/lib/ecc/workspaces";

const m = (tenant_id: string, criado_em: string) => ({ tenant_id, papel: "member", escopo: "completo", criado_em });

const antigo = m("antigo", "2026-09-03T00:00:00Z");
const lab = m("lab", "2026-09-04T00:00:00Z");
const novo = m("novo", "2026-10-05T00:00:00Z");
const semLab = new Set<string>();
const comLab = new Set(["lab"]);

describe("escolherMembership", () => {
  it("sem preferência → a mais antiga (comportamento de sempre)", () => {
    expect(escolherMembership([novo, antigo], null, semLab)?.tenant_id).toBe("antigo");
  });

  it("com preferência válida → a preferida (caso da Angeline depois de aceitar o convite)", () => {
    expect(escolherMembership([antigo, novo], "novo", semLab)?.tenant_id).toBe("novo");
  });

  it("preferência de um workspace do qual a pessoa saiu/foi removida → volta pra mais antiga", () => {
    expect(escolherMembership([antigo, novo], "removido", semLab)?.tenant_id).toBe("antigo");
  });

  it("nunca escolhe o sandbox do Lab, nem se for o mais antigo nem se vier na preferência", () => {
    const labAntigo = m("lab", "2026-01-01T00:00:00Z");
    expect(escolherMembership([labAntigo, novo], null, comLab)?.tenant_id).toBe("novo");
    expect(escolherMembership([labAntigo, novo], "lab", comLab)?.tenant_id).toBe("novo");
  });

  it("só o Lab → devolve ele (nunca deixa a pessoa sem workspace nenhum)", () => {
    expect(escolherMembership([lab], null, comLab)?.tenant_id).toBe("lab");
  });

  it("sem memberships → null", () => {
    expect(escolherMembership([], "x", semLab)).toBeNull();
  });
});

describe("workspacesDoSeletor", () => {
  it("lista sem o Lab, na ordem de entrada", () => {
    expect(workspacesDoSeletor([novo, lab, antigo], comLab).map((w) => w.tenant_id)).toEqual(["antigo", "novo"]);
  });
});

describe("rotuloDoWorkspace", () => {
  it("encurta o nome automático tirando o domínio do e-mail", () => {
    expect(rotuloDoWorkspace("Workspace de ceo.ifaz@gmail.com")).toBe("Workspace de ceo.ifaz");
  });

  it("mantém nome personalizado e trata vazio", () => {
    expect(rotuloDoWorkspace("Agência Mangue")).toBe("Agência Mangue");
    expect(rotuloDoWorkspace("  ")).toBe("Workspace sem nome");
  });
});
