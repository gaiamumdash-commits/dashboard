import type { Metadata } from "next";
import { contextoMapas, listarMapas } from "@/lib/ecc/mapas/dados";
import { EstruturaMapas } from "@/components/mapas/estrutura-mapas";
import { ListaMapas } from "@/components/mapas/lista-mapas";

export const metadata: Metadata = { title: "Mapa mental · Gaiamum" };

/** A Server Action "Importar mapa" roda nesta rota: ler foto/PDF com IA
 * leva até ~110 s (`TEMPO_MAXIMO_LEITURA_MS` em gemini.ts). */
export const maxDuration = 120;

/** Lista de mapas mentais: os da pessoa e os que a equipe compartilhou. */
export default async function PaginaMapas() {
  const ctx = await contextoMapas();
  const { meus, compartilhados, indisponivel } = await listarMapas(ctx.tenantId, ctx.userId);
  return (
    <EstruturaMapas ctx={ctx}>
      <ListaMapas meus={meus} compartilhados={compartilhados} indisponivel={indisponivel} />
    </EstruturaMapas>
  );
}
