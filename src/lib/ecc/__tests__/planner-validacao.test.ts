import { describe, it, expect } from "vitest";
import {
  dataEHoraParaFormulario,
  lerCompromisso,
  lerCurso,
  lerLeitura,
  lerManutencao,
  lerObjetivo,
  lerPet,
} from "@/lib/ecc/planner/validacao";

function form(campos: Record<string, string>) {
  return { get: (nome: string) => (nome in campos ? campos[nome] : null) };
}

describe("validação compartilhada criar/editar do Planner", () => {
  it("compromisso: data e hora do Brasil viram instante UTC, e voltam iguais pro formulário", () => {
    const r = lerCompromisso(form({ titulo: " Dentista ", data: "2026-10-07", hora: "14:00", local: "", notas: "" }));
    expect(r).toEqual({
      ok: true,
      valor: { titulo: "Dentista", inicio: "2026-10-07T17:00:00.000Z", local: null, notas: null, pet_id: null },
    });
    expect(dataEHoraParaFormulario("2026-10-07T17:00:00.000Z")).toEqual({ data: "2026-10-07", hora: "14:00" });
    // 23:30 de Brasília já é o dia seguinte em UTC — a ida e volta não perde o dia.
    const tarde = lerCompromisso(form({ titulo: "x", data: "2026-10-07", hora: "23:30" }));
    expect(tarde.ok && dataEHoraParaFormulario(tarde.valor.inicio)).toEqual({ data: "2026-10-07", hora: "23:30" });
  });

  it("compromisso: recusa sem data, hora inválida e pet que não é UUID", () => {
    expect(lerCompromisso(form({ titulo: "x", hora: "10:00" })).ok).toBe(false);
    expect(lerCompromisso(form({ titulo: "x", data: "2026-10-07", hora: "24:00" })).ok).toBe(false);
    expect(lerCompromisso(form({ titulo: "x", data: "2026-10-07", hora: "10:00", pet_id: "1 or 1=1" })).ok).toBe(false);
    expect(lerCompromisso(form({ titulo: "", data: "2026-10-07" })).ok).toBe(false);
  });

  it("curso: link só http(s); campos vazios viram null", () => {
    expect(lerCurso(form({ nome: "Gestão", link: "javascript:alert(1)" }), "curso").ok).toBe(false);
    const r = lerCurso(form({ nome: "Gestão", link: "https://fgv.br", instituicao: "", notas: "boa" }), "curso");
    expect(r.ok && r.valor).toMatchObject({ nome: "Gestão", link: "https://fgv.br", instituicao: null, notas: "boa" });
    expect(lerCurso(form({ nome: "" }), "idioma")).toEqual({ ok: false, erro: "Idioma é obrigatório." });
  });

  it("manutenção: recorrência opcional entre 1 e 120 meses; datas válidas", () => {
    expect(lerManutencao(form({ nome: "Filtro", recorrencia_meses: "" })).ok).toBe(true);
    expect(lerManutencao(form({ nome: "Filtro", recorrencia_meses: "0" })).ok).toBe(false);
    expect(lerManutencao(form({ nome: "Filtro", proxima_data: "2026-02-31" })).ok).toBe(false);
    const r = lerManutencao(form({ nome: "Filtro", proxima_data: "2027-04-07", recorrencia_meses: "6" }));
    expect(r.ok && r.valor).toMatchObject({ proxima_data: "2027-04-07", recorrencia_meses: 6, ultima_realizacao: null });
  });

  it("leitura, objetivo e pet: título obrigatório e limites de tamanho", () => {
    expect(lerLeitura(form({ titulo: "  " })).ok).toBe(false);
    expect(lerLeitura(form({ titulo: "Livro", autor: "a".repeat(121) })).ok).toBe(false);
    expect(lerObjetivo(form({ titulo: "Correr 5 km", prazo: "2026-12-01" }))).toEqual({
      ok: true,
      valor: { titulo: "Correr 5 km", prazo: "2026-12-01", notas: null },
    });
    expect(lerPet(form({ nome: "Thor", tipo: "Cachorro" }))).toEqual({ ok: true, valor: { nome: "Thor", tipo: "Cachorro", notas: null } });
    expect(lerPet(form({ nome: "" })).ok).toBe(false);
  });
});
