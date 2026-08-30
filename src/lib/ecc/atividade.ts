import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listarMembros } from "@/lib/ecc/equipe";
import { enviarEmailAtividade } from "@/lib/ecc/notificacoes";
import type { TipoAtividade } from "@/lib/ecc/tipos";

const MENSAGEM_POR_TIPO: Record<TipoAtividade, (detalhe: Record<string, string>) => string> = {
  criada: () => "criou este cartão",
  movida: (d) => `moveu este cartão de "${d.de}" para "${d.para}"`,
  descricao_editada: () => "editou a descrição deste cartão",
  checklist_item_adicionado: (d) => `adicionou "${d.texto}" ao checklist`,
  checklist_item_concluido: (d) => `marcou "${d.texto}" como concluído no checklist`,
  checklist_item_reaberto: (d) => `reabriu "${d.texto}" no checklist`,
  checklist_item_removido: (d) => `removeu "${d.texto}" do checklist`,
  membro_adicionado: () => "te adicionou como responsável por este cartão",
  membro_removido: () => "te removeu como responsável deste cartão",
};

/**
 * Grava no histórico da tarefa e avisa por e-mail quem está marcado como
 * responsável (menos quem fez a própria mudança). Pedido do Fabio
 * comparando com o Trello: precisa ficar claro quem mexeu em quê, pra
 * ninguém sobrescrever o trabalho do outro sem saber.
 */
export async function registrarAtividade({
  tenantId,
  projetoId,
  tarefaId,
  tipo,
  detalhe = {},
  notificarTambem = [],
}: {
  tenantId: string;
  projetoId: string;
  tarefaId: string;
  tipo: TipoAtividade;
  detalhe?: Record<string, string>;
  /** IDs extras a notificar além dos responsáveis atuais — necessário pra
   * "membro_removido", já que a pessoa removida não está mais em
   * tarefa_membros no momento em que essa função roda. */
  notificarTambem?: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[registrarAtividade] sem usuário autenticado, abortando");
    return;
  }

  const { error: erroInsert } = await supabase.from("tarefa_atividades").insert({
    tenant_id: tenantId,
    projeto_id: projetoId,
    tarefa_id: tarefaId,
    user_id: user.id,
    tipo,
    detalhe,
  });

  if (erroInsert) {
    console.error("[registrarAtividade] falha ao gravar atividade:", erroInsert);
  }

  const [{ data: tarefa, error: erroTarefa }, { data: projeto, error: erroProjeto }, { data: responsaveis, error: erroResponsaveis }] =
    await Promise.all([
      supabase.from("tarefas").select("titulo").eq("id", tarefaId).maybeSingle(),
      supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle(),
      supabase.from("tarefa_membros").select("user_id").eq("tarefa_id", tarefaId),
    ]);

  if (erroTarefa || erroProjeto || erroResponsaveis) {
    console.error("[registrarAtividade] falha ao buscar dados pra notificação:", {
      erroTarefa,
      erroProjeto,
      erroResponsaveis,
    });
  }

  const idsResponsaveis = Array.from(
    new Set([...(responsaveis ?? []).map((r) => r.user_id as string), ...notificarTambem]),
  ).filter((id) => id !== user.id);

  if (idsResponsaveis.length === 0) return;

  const membros = await listarMembros(tenantId);
  const emails = membros
    .filter((m) => idsResponsaveis.includes(m.user_id))
    .map((m) => m.email);

  if (emails.length === 0) return;

  await enviarEmailAtividade({
    destinatarios: emails,
    atorEmail: user.email ?? "alguém",
    acao: MENSAGEM_POR_TIPO[tipo](detalhe),
    tituloTarefa: (tarefa?.titulo as string | undefined) ?? "uma tarefa",
    nomeProjeto: (projeto?.nome as string | undefined) ?? "Gaiamum",
    projetoId,
  });
}
