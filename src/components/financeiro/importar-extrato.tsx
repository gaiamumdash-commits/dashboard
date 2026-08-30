"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import type { CategoriaFinanceira, RegraCategoria } from "@/lib/ecc/tipos";
import { sugerirCategoria } from "@/lib/ecc/categorizacao";
import { confirmarImportacaoExtrato, type LinhaExtratoConfirmada } from "@/lib/ecc/importacao-extrato";

const CATEGORIAS: { valor: CategoriaFinanceira; rotulo: string }[] = [
  { valor: "consumo", rotulo: "Consumo" },
  { valor: "investimento", rotulo: "Investimento" },
  { valor: "despesa", rotulo: "Despesa" },
];

type LinhaRevisao = LinhaExtratoConfirmada & { incluir: boolean };

const ALIASES_DESCRICAO = ["descricao", "descrição", "historico", "histórico", "lancamento", "lançamento", "memo"];
const ALIASES_VALOR = ["valor", "value", "amount", "montante"];
const ALIASES_DATA = ["data", "date", "datalancamento", "datamovimento"];

function normalizarCabecalho(cabecalho: string): string {
  return cabecalho
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function encontrarColuna(cabecalhos: string[], aliases: string[]): string | null {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizarCabecalho(c) }));
  for (const alias of aliases) {
    const achado = normalizados.find((c) => c.norm === alias || c.norm.includes(alias));
    if (achado) return achado.original;
  }
  return null;
}

function parseValorBR(bruto: string): number {
  const limpo = bruto.replace(/R\$\s?/gi, "").trim();
  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");
  let normalizado = limpo;
  if (temVirgula && temPonto) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  }
  return Number(normalizado);
}

function parseDataParaISO(bruto: string): string | null {
  const s = bruto.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const brasileira = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (brasileira) {
    const [, dia, mes, ano] = brasileira;
    const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
    return `${anoCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  return null;
}

export function ImportarExtrato({ regras }: { regras: RegraCategoria[] }) {
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  function processarArquivo(arquivo: File) {
    setErro(null);
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        const cabecalhos = resultado.meta.fields ?? [];
        const colDescricao = encontrarColuna(cabecalhos, ALIASES_DESCRICAO);
        const colValor = encontrarColuna(cabecalhos, ALIASES_VALOR);
        const colData = encontrarColuna(cabecalhos, ALIASES_DATA);

        if (!colDescricao || !colValor || !colData) {
          setErro(
            `Não consegui identificar as colunas de descrição/valor/data no CSV (cabeçalhos encontrados: ${cabecalhos.join(", ") || "nenhum"}). Confirma se o arquivo tem cabeçalho na primeira linha.`,
          );
          setLinhas([]);
          return;
        }

        const novasLinhas: LinhaRevisao[] = [];
        for (const linha of resultado.data) {
          const descricao = (linha[colDescricao] ?? "").trim();
          const valorBruto = (linha[colValor] ?? "").trim();
          const dataBruta = (linha[colData] ?? "").trim();
          if (!descricao || !valorBruto || !dataBruta) continue;

          const valor = Math.abs(parseValorBR(valorBruto));
          const data = parseDataParaISO(dataBruta);
          if (!Number.isFinite(valor) || valor === 0 || !data) continue;

          novasLinhas.push({
            nome: descricao,
            valor,
            data,
            categoria: sugerirCategoria(descricao, regras) ?? "despesa",
            incluir: true,
          });
        }

        if (novasLinhas.length === 0) {
          setErro("O CSV foi lido, mas nenhuma linha válida foi encontrada (confira valor e data de cada linha).");
        }
        setLinhas(novasLinhas);
      },
      error: (err) => setErro(`Falha ao ler o CSV: ${err.message}`),
    });
  }

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      const incluidas: LinhaExtratoConfirmada[] = linhas
        .filter((l) => l.incluir)
        .map((l) => ({ nome: l.nome, valor: l.valor, categoria: l.categoria, data: l.data }));
      await confirmarImportacaoExtrato(incluidas);
      setLinhas([]);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao confirmar importação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div>
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Extrato em CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) processarArquivo(arquivo);
            }}
            className="text-sm text-gaiamum-text-muted file:mr-3 file:rounded-lg file:border file:border-gaiamum-border file:bg-gaiamum-surface-raised file:px-3 file:py-2 file:text-sm file:text-gaiamum-text"
          />
        </label>
        <p className="mt-1 text-xs text-gaiamum-text-muted">
          Baixe o extrato do banco em CSV e suba aqui. Precisa ter colunas de descrição, valor e data — se o
          seu banco usar nomes diferentes desses, me avisa que eu ajusto.
        </p>
      </div>

      {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}

      {linhas.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gaiamum-text-muted">
                  <th className="w-8 pb-2"></th>
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, indice) => (
                  <tr key={indice} className="border-t border-gaiamum-border">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={linha.incluir}
                        onChange={(e) =>
                          setLinhas((atual) =>
                            atual.map((l, i) => (i === indice ? { ...l, incluir: e.target.checked } : l)),
                          )
                        }
                        className="h-4 w-4 accent-gaiamum-primary"
                      />
                    </td>
                    <td className="py-2 text-gaiamum-text">{linha.nome}</td>
                    <td className="py-2 text-gaiamum-text-muted">
                      {linha.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="py-2 text-gaiamum-text-muted">
                      {new Date(`${linha.data}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2">
                      <select
                        value={linha.categoria}
                        onChange={(e) =>
                          setLinhas((atual) =>
                            atual.map((l, i) =>
                              i === indice ? { ...l, categoria: e.target.value as CategoriaFinanceira } : l,
                            ),
                          )
                        }
                        className="rounded border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1 text-xs text-gaiamum-text outline-none"
                      >
                        {CATEGORIAS.map((c) => (
                          <option key={c.valor} value={c.valor}>
                            {c.rotulo}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || linhas.every((l) => !l.incluir)}
            className="self-start rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-50"
          >
            {enviando ? "Confirmando..." : `Confirmar importação (${linhas.filter((l) => l.incluir).length})`}
          </button>
        </>
      )}
    </div>
  );
}
