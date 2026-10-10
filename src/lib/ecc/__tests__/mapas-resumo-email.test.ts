import { describe, it, expect } from "vitest";
import { montarResumoMapa } from "@/lib/ecc/mapas/resumo-email";

const no = (id: string, pai: string | null, ordem: number, texto: string, nota: string | null = null) => ({ id, pai_id: pai, ordem, texto, nota });

describe("resumo do mapa por e-mail (conteúdo)", () => {
  const nos = [
    no("r", null, 0, "Lançamento"),
    no("b", "r", 2, "Anúncios #urgente"),
    no("a", "r", 1, "Página de vendas"),
    no("a1", "a", 1, "Revisar copy sexta 14h", "ver com a Ana"),
    no("b1", "b", 1, "Vendas no Meta 15/11"),
    no("x", "a", 2, "Vendas <script>alert(1)</script>"),
  ];
  const r = montarResumoMapa({ titulo: "Lançamento <B>", nos, hoje: "2026-10-10", link: "https://www.gaiamum.com.br/mapas/m" });

  it("texto em tópicos, na ordem do mapa, com recuo e nota", () => {
    expect(r.texto.split("\n").slice(2, 7)).toEqual([
      "- Página de vendas",
      "  - Revisar copy sexta 14h",
      "    (ver com a Ana)",
      "  - Vendas <script>alert(1)</script>",
      "- Anúncios #urgente",
    ]);
  });

  it("datas em ordem cronológica e palavras-chave", () => {
    expect(r.texto).toContain("Datas do mapa:\n- 16/10 14:00: Revisar copy sexta 14h\n- 15/11: Vendas no Meta 15/11");
    expect(r.texto).toMatch(/Palavras-chave: #urgente \(1\), vendas \(3\)|Palavras-chave: #urgente \(1\), Vendas \(3\)/);
  });

  it("HTML escapa todo texto da pessoa (título, ramo, nota)", () => {
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("Vendas &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(r.html).toContain("Lançamento &lt;B&gt;");
    expect(r.assunto).toBe("🧠 Resumo do mapa: Lançamento <B>");
  });

  it("mapa só com a ideia central não quebra", () => {
    const vazio = montarResumoMapa({ titulo: "Só ideia", nos: [no("r", null, 0, "Só ideia")], hoje: "2026-10-10", link: "x" });
    expect(vazio.html).toContain("ainda não tem ramos");
  });
});
