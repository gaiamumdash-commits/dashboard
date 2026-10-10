import type { Metadata } from "next";
import { contextoMapas, listarMapas } from "@/lib/ecc/mapas/dados";
import { EstruturaMapas } from "@/components/mapas/estrutura-mapas";
import { ListaMapas } from "@/components/mapas/lista-mapas";

export const metadata: Metadata = { title: "Mapas · Gaiamum" };

/** Lista de mapas mentais: os da pessoa e os que a equipe compartilhou. */
export default async function PaginaMapas() {
  const ctx = await contextoMapas();
  const { meus, compartilhados } = await listarMapas(ctx.tenantId, ctx.userId);
  return (
    <EstruturaMapas ctx={ctx}>
      <ListaMapas meus={meus} compartilhados={compartilhados} />
    </EstruturaMapas>
  );
}
