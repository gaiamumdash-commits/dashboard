import "server-only";
import { after } from "next/server";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { listarMembros } from "@/lib/ecc/equipe";
import { enviarEmailAtividade } from "@/lib/ecc/notificacoes";
import { MENSAGEM_POR_TIPO } from "@/lib/ecc/mensagens-atividade";
import type { TipoAtividade } from "@/lib/ecc/tipos";

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
  const user = await obterUsuarioAtual();

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

  // O envio de e-mail roda depois que a resposta já foi enviada ao cliente
  // (after(), Next.js) — sem isso, mover/editar/comentar num cartão ficava
  // esperando a API do Resend responder antes de voltar pra tela, e isso
  // acontece em praticamente toda mutação de tarefa (é aqui que quase todas
  // chamam registrarAtividade).
  after(async () => {
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
  });
}
