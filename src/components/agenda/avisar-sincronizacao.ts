import { toast } from "sonner";
import type { ResultadoSincronizacao } from "@/lib/ecc/google-calendar-interno";

/** Traduz o resultado de uma Server Action da Agenda num aviso na tela.
 * `mensagemOk` é o texto base ("Compromisso atualizado"); quando o Google
 * está conectado e a cópia foi atualizada junto, o aviso diz isso — pra
 * pessoa saber se a mudança também chegou no celular. */
export function avisarResultadoAgenda(
  resultado: ResultadoSincronizacao | { status: "invalido"; aviso: string },
  mensagemOk: string,
): boolean {
  switch (resultado.status) {
    case "sincronizado":
      toast.success(`${mensagemOk} no Gaiamum e no Google Calendar.`);
      return true;
    case "nao_conectado":
      toast.success(`${mensagemOk}.`);
      return true;
    case "falhou":
      toast.warning(resultado.aviso);
      return true;
    case "invalido":
      toast.error(resultado.aviso);
      return false;
  }
}
