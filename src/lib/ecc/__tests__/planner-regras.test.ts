import { describe, it, expect } from "vitest";
import {
  chavesDaSemana,
  concluirManutencao,
  consistenciaDaSemana,
  dataOpcional,
  descreverDias,
  diaIsoDe,
  diasComCardapio,
  ehChaveData,
  formatarMinutos,
  minutosFeitosNaSemana,
  planejadosNoDia,
  segundaDaChave,
  semanaDoHabito,
  somarMesesChave,
  statusManutencao,
  sugestaoDaSemana,
  validarHabito,
} from "@/lib/ecc/planner/regras";

// 2026-10-05 é uma segunda-feira; "hoje" nos testes é quarta, 2026-10-07.
const SEGUNDA = "2026-10-05";
const HOJE = "2026-10-07";

describe("datas do Planner", () => {
  it("dia ISO: segunda = 1, domingo = 7", () => {
    expect(diaIsoDe("2026-10-05")).toBe(1);
    expect(diaIsoDe("2026-10-07")).toBe(3);
    expect(diaIsoDe("2026-10-11")).toBe(7);
  });

  it("segunda da semana de qualquer dia, inclusive domingo", () => {
    expect(segundaDaChave("2026-10-07")).toBe(SEGUNDA);
    expect(segundaDaChave("2026-10-11")).toBe(SEGUNDA);
    expect(segundaDaChave("2026-10-05")).toBe(SEGUNDA);
  });

  it("7 chaves de segunda a domingo, atravessando o mês", () => {
    expect(chavesDaSemana("2026-09-28")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("somar meses não pula mês curto", () => {
    expect(somarMesesChave("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMesesChave("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMesesChave("2026-10-07", 6)).toBe("2027-04-07");
    expect(somarMesesChave("2026-11-15", 12)).toBe("2027-11-15");
  });

  it("valida chave de data de verdade (rejeita 31/02)", () => {
    expect(ehChaveData("2026-02-28")).toBe(true);
    expect(ehChaveData("2026-02-31")).toBe(false);
    expect(ehChaveData("07/10/2026")).toBe(false);
    expect(dataOpcional("", "Data")).toEqual({ ok: true, valor: null });
    expect(dataOpcional("2026-13-01", "Data").ok).toBe(false);
  });
});

describe("semana e consistência de hábitos", () => {
  const leitura = { id: "h1", dias_semana: [1, 3, 5], duracao_minutos: 30 };
  const agua = { id: "h2", dias_semana: [1, 2, 3, 4, 5, 6, 7], duracao_minutos: null };

  it("grade de 7 dias marca planejado, feito e futuro", () => {
    const grade = semanaDoHabito(leitura, [{ habito_id: "h1", data: "2026-10-05" }], SEGUNDA, HOJE);
    expect(grade).toHaveLength(7);
    expect(grade[0]).toMatchObject({ data: "2026-10-05", planejado: true, feito: true, futuro: false });
    expect(grade[1]).toMatchObject({ planejado: false, feito: false, futuro: false });
    expect(grade[2]).toMatchObject({ planejado: true, feito: false, futuro: false });
    expect(grade[4]).toMatchObject({ planejado: true, futuro: true });
  });

  it("consistência conta só dias planejados até hoje (inclusive)", () => {
    // Leitura: seg e qua planejados até hoje (2), feito seg → 1.
    // Água: seg, ter, qua (3), feitos seg e ter → 2.
    const registros = [
      { habito_id: "h1", data: "2026-10-05" },
      { habito_id: "h2", data: "2026-10-05" },
      { habito_id: "h2", data: "2026-10-06" },
    ];
    expect(consistenciaDaSemana([leitura, agua], registros, SEGUNDA, HOJE)).toEqual({
      planejados: 5,
      feitos: 3,
      percentual: 60,
    });
  });

  it("feito em dia não planejado não infla a consistência", () => {
    const registros = [{ habito_id: "h1", data: "2026-10-06" }];
    expect(consistenciaDaSemana([leitura], registros, SEGUNDA, HOJE)).toEqual({ planejados: 2, feitos: 0, percentual: 0 });
  });

  it("sem nada planejado até hoje é 'sem dado' (null), não 0%", () => {
    const soSexta = { id: "h3", dias_semana: [5] };
    expect(consistenciaDaSemana([soSexta], [], SEGUNDA, HOJE).percentual).toBeNull();
    expect(consistenciaDaSemana([], [], SEGUNDA, HOJE).percentual).toBeNull();
  });

  it("registro de outra semana não conta", () => {
    expect(consistenciaDaSemana([leitura], [{ habito_id: "h1", data: "2026-09-28" }], SEGUNDA, HOJE).feitos).toBe(0);
  });

  it("minutos feitos somam a duração só dentro da semana", () => {
    const registros = [
      { habito_id: "h1", data: "2026-10-05" },
      { habito_id: "h1", data: "2026-10-07" },
      { habito_id: "h1", data: "2026-10-12" },
      { habito_id: "h2", data: "2026-10-05" },
    ];
    expect(minutosFeitosNaSemana([leitura, agua], registros, SEGUNDA)).toBe(60);
    expect(formatarMinutos(45)).toBe("45min");
    expect(formatarMinutos(60)).toBe("1h");
    expect(formatarMinutos(260)).toBe("4h 20min");
  });

  it("planejados do dia vêm por horário, sem horário por último", () => {
    const itens = [
      { nome: "Leitura", dias_semana: [3], horario: "20:00:00" },
      { nome: "Água", dias_semana: [3], horario: null },
      { nome: "Planejamento", dias_semana: [3], horario: "08:00:00" },
      { nome: "Academia", dias_semana: [2], horario: "07:00:00" },
    ];
    expect(planejadosNoDia(itens, HOJE).map((i) => i.nome)).toEqual(["Planejamento", "Leitura", "Água"]);
  });

  it("descreve os dias em português", () => {
    expect(descreverDias([1, 2, 3, 4, 5, 6, 7])).toBe("Todos os dias");
    expect(descreverDias([5, 4, 3, 2, 1])).toBe("Dias úteis");
    expect(descreverDias([1, 3, 5])).toBe("Seg, Qua, Sex");
  });
});

describe("sugestão da semana (determinística)", () => {
  it("sem dado nenhum, não sugere nada", () => {
    expect(sugestaoDaSemana({}, { planejados: 0, feitos: 0, percentual: null })).toBeNull();
  });

  it("aponta a área abaixo da média", () => {
    const texto = sugestaoDaSemana(
      {
        pessoal: { planejados: 10, feitos: 9, percentual: 90 },
        estudos: { planejados: 10, feitos: 4, percentual: 40 },
      },
      { planejados: 20, feitos: 13, percentual: 65 },
    );
    expect(texto).toContain("65%");
    expect(texto).toContain("Estudos está abaixo da média (40%)");
  });

  it("com só uma área, não compara", () => {
    const texto = sugestaoDaSemana({ casa: { planejados: 4, feitos: 2, percentual: 50 } }, { planejados: 4, feitos: 2, percentual: 50 });
    expect(texto).not.toContain("abaixo");
  });
});

describe("manutenções", () => {
  it("status por próxima data", () => {
    expect(statusManutencao({ proxima_data: null }, HOJE)).toBe("sem_data");
    expect(statusManutencao({ proxima_data: "2026-10-06" }, HOJE)).toBe("atrasada");
    expect(statusManutencao({ proxima_data: "2026-10-07" }, HOJE)).toBe("em_breve");
    expect(statusManutencao({ proxima_data: "2026-10-14" }, HOJE)).toBe("em_breve");
    expect(statusManutencao({ proxima_data: "2026-10-15" }, HOJE)).toBe("em_dia");
  });

  it("concluir recalcula a próxima a partir de hoje", () => {
    expect(concluirManutencao({ recorrencia_meses: 6 }, HOJE)).toEqual({
      ultima_realizacao: HOJE,
      proxima_data: "2027-04-07",
    });
    expect(concluirManutencao({ recorrencia_meses: null }, HOJE)).toEqual({ ultima_realizacao: HOJE, proxima_data: null });
  });
});

describe("cardápio", () => {
  it("conta dias com pelo menos uma refeição", () => {
    expect(diasComCardapio([{ dia_semana: 1 }, { dia_semana: 1 }, { dia_semana: 3 }])).toBe(2);
    expect(diasComCardapio([])).toBe(0);
  });
});

describe("validação de hábito", () => {
  const base = { nome: "  Leitura ", area: "estudos", tipo: "habito", dias: ["1", "3", "3", "5"], horario: "", duracao: "30" };

  it("normaliza e aceita entrada válida", () => {
    expect(validarHabito(base)).toEqual({
      ok: true,
      valor: { nome: "Leitura", area: "estudos", tipo: "habito", dias_semana: [1, 3, 5], horario: null, duracao_minutos: 30 },
    });
  });

  it("rotina com horário", () => {
    const r = validarHabito({ ...base, tipo: "rotina", horario: "08:00" });
    expect(r.ok && r.valor.horario).toBe("08:00");
    expect(r.ok && r.valor.tipo).toBe("rotina");
  });

  it("recusa sem nome, sem dias, área inválida, horário e duração inválidos", () => {
    expect(validarHabito({ ...base, nome: "  " }).ok).toBe(false);
    expect(validarHabito({ ...base, dias: [] }).ok).toBe(false);
    expect(validarHabito({ ...base, dias: ["0", "8"] }).ok).toBe(false);
    expect(validarHabito({ ...base, area: "financeiro" }).ok).toBe(false);
    expect(validarHabito({ ...base, horario: "25:00" }).ok).toBe(false);
    expect(validarHabito({ ...base, duracao: "0" }).ok).toBe(false);
    expect(validarHabito({ ...base, duracao: "abc" }).ok).toBe(false);
  });
});
