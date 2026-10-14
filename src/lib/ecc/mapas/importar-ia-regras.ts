import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { MAX_NOS_POR_MAPA, MAX_TEXTO_NO } from "@/lib/ecc/mapas/tipos";
import type { RamoImportado } from "@/lib/ecc/mapas/importar";

// Resposta da IA ao ler foto/PDF de um mapa mental: schema pedido ao
// Gemini + validação no servidor. Regras puras, testadas em
// `__tests__/mapas-importar-ia.test.ts` — o modelo pode devolver JSON
// válido mas estruturalmente errado (dois centros, pai inexistente, ciclo).

/** Profundidade máxima aceita (ideia central = 0). Mapas reais ficam bem
 * abaixo; o limite só barra respostas degeneradas. */
export const PROFUNDIDADE_MAXIMA_IA = 30;

/** `responseSchema` no formato do SDK do Gemini — espelha `RespostaIASchema`. */
export const SCHEMA_MAPA_IA: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ["ok", "sem_mapa"] },
    nos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          pai: { type: Type.STRING, nullable: true },
          texto: { type: Type.STRING },
          incerto: { type: Type.BOOLEAN },
        },
        required: ["id", "pai", "texto"],
      },
    },
  },
  required: ["status", "nos"],
};

const RespostaIASchema = z.object({
  status: z.enum(["ok", "sem_mapa"]),
  nos: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        pai: z.string().trim().min(1).max(64).nullable(),
        texto: z.string(),
        incerto: z.boolean().optional(),
      }),
    )
    .max(MAX_NOS_POR_MAPA),
});

export type ResultadoValidacaoIA =
  | { ok: true; raiz: RamoImportado; incertos: number }
  | { ok: false; motivo: "sem_mapa" | "invalido"; erro: string };

const INVALIDO = "A IA não conseguiu montar um mapa confiável a partir desse arquivo. Tente uma foto mais nítida, de frente e bem iluminada.";

function invalido(): ResultadoValidacaoIA {
  return { ok: false, motivo: "invalido", erro: INVALIDO };
}

/** JSON bruto da IA → árvore pronta pra prévia. Exige: um único centro,
 * ids únicos, todo pai existente, nenhum ciclo, todos os nós ligados ao
 * centro, profundidade e quantidade dentro do limite, texto de 1 a 200
 * caracteres (quebras viram espaço; texto vazio invalida). */
export function validarMapaDaIA(jsonBruto: string): ResultadoValidacaoIA {
  let dados: unknown;
  try {
    dados = JSON.parse(jsonBruto);
  } catch {
    return invalido();
  }
  const lido = RespostaIASchema.safeParse(dados);
  if (!lido.success) return invalido();
  if (lido.data.status === "sem_mapa" || lido.data.nos.length === 0) {
    return { ok: false, motivo: "sem_mapa", erro: "Não encontrei um mapa mental nesse arquivo. Tente uma foto mais nítida e de frente." };
  }

  const nos = lido.data.nos.map((n) => ({ ...n, texto: n.texto.replace(/\s+/g, " ").trim() }));
  if (nos.some((n) => n.texto.length === 0 || n.texto.length > MAX_TEXTO_NO)) return invalido();

  const porId = new Map<string, (typeof nos)[number]>();
  for (const n of nos) {
    if (porId.has(n.id)) return invalido(); // id repetido
    porId.set(n.id, n);
  }
  const centros = nos.filter((n) => n.pai === null);
  if (centros.length !== 1) return invalido();
  if (nos.some((n) => n.pai !== null && (!porId.has(n.pai) || n.pai === n.id))) return invalido();

  // Sem ciclo e tudo ligado ao centro: subindo pelos pais, todo nó chega ao
  // centro em no máximo PROFUNDIDADE_MAXIMA_IA passos.
  for (const n of nos) {
    let atual = n;
    let passos = 0;
    while (atual.pai !== null) {
      atual = porId.get(atual.pai)!;
      passos += 1;
      if (passos > PROFUNDIDADE_MAXIMA_IA || atual === n) return invalido();
    }
  }

  const ramos = new Map(nos.map((n) => [n.id, { texto: n.texto, filhos: [] as RamoImportado[], ...(n.incerto ? { incerto: true } : {}) }]));
  for (const n of nos) {
    if (n.pai !== null) ramos.get(n.pai)!.filhos.push(ramos.get(n.id)!);
  }
  return { ok: true, raiz: ramos.get(centros[0].id)!, incertos: nos.filter((n) => n.incerto).length };
}

/** Assinatura (primeiros bytes) dos formatos aceitos pra leitura com IA —
 * o tipo declarado pelo navegador não basta. Devolve o MIME real ou null. */
export function mimePelaAssinatura(bytes: Uint8Array): string | null {
  const comeca = (assinatura: number[], deslocamento = 0) => assinatura.every((b, i) => bytes[deslocamento + i] === b);
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (comeca([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (comeca([0x66, 0x74, 0x79, 0x70], 4)) {
    const marca = String.fromCharCode(...bytes.subarray(8, 12));
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(marca)) return "image/heic";
  }
  return null;
}
