import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  COLUNAS_CAFE_MANGUE,
  DECISOES_CAFE_MANGUE,
  INDICADORES_CAFE_MANGUE,
  META_SMART_CAFE_MANGUE,
  NOME_PROJETO_CAFE_MANGUE,
  PROJETO_CAFE_MANGUE,
  TAREFAS_CAFE_MANGUE,
} from "@/lib/ecc/lab/conteudo-cafe-mangue";

function dataLimiteDoOffset(offsetDias: number | null): string | null {
  if (offsetDias === null) return null;
  const data = new Date();
  data.setDate(data.getDate() + offsetDias);
  return data.toISOString();
}

/** Recalcula data_limite das tarefas a partir dos offsets relativos a
 * "agora" — sem isso, um seed feito uma vez com datas fixas ficaria
 * didaticamente "errado" com o tempo (a tarefa "futura" vira atrasada
 * sozinha, o cenário perde o sentido). */
async function normalizarDatasDasTarefas(projetoId: string): Promise<void> {
  const service = createServiceClient();
  const { data: tarefas } = await service.from("tarefas").select("id, titulo").eq("projeto_id", projetoId);
  if (!tarefas) return;

  const offsetPorTitulo = new Map(TAREFAS_CAFE_MANGUE.map((t) => [t.titulo, t.offsetDias]));

  await Promise.all(
    (tarefas as { id: string; titulo: string }[]).map((t) => {
      const offset = offsetPorTitulo.get(t.titulo);
      if (offset === undefined) return Promise.resolve();
      return service.from("tarefas").update({ data_limite: dataLimiteDoOffset(offset) }).eq("id", t.id);
    }),
  );
}

/** Cria (ou reaproveita, renormalizando as datas) o projeto fictício "Café
 * Mangue" no tenant do Lab do usuário — idempotente por nome do projeto
 * dentro do tenant, mesmo padrão de obterOuCriarQuadroDeProducao()
 * (producao-conteudo.ts): via service client direto, sem passar pelo
 * formulário/Server Actions normais de criarProjeto/criarTarefa. */
export async function semearCafeMangue(tenantIdLab: string, userId: string): Promise<string> {
  const service = createServiceClient();

  const { data: existente } = await service
    .from("projetos")
    .select("id")
    .eq("tenant_id", tenantIdLab)
    .eq("nome", NOME_PROJETO_CAFE_MANGUE)
    .maybeSingle();

  if (existente) {
    const projetoId = (existente as { id: string }).id;
    await normalizarDatasDasTarefas(projetoId);
    return projetoId;
  }

  const { data: metaSmart, error: erroMeta } = await service
    .from("metas_smart")
    .insert({ tenant_id: tenantIdLab, ...META_SMART_CAFE_MANGUE })
    .select("id")
    .single();

  if (erroMeta || !metaSmart) {
    throw new Error(`Falha ao semear meta SMART do Lab: ${erroMeta?.message}`);
  }

  const { data: projeto, error: erroProjeto } = await service
    .from("projetos")
    .insert({
      tenant_id: tenantIdLab,
      nome: NOME_PROJETO_CAFE_MANGUE,
      resultado_esperado: PROJETO_CAFE_MANGUE.resultadoEsperado,
      meta_smart_id: (metaSmart as { id: string }).id,
    })
    .select("id")
    .single();

  if (erroProjeto || !projeto) {
    throw new Error(`Falha ao semear projeto do Lab: ${erroProjeto?.message}`);
  }

  const projetoId = (projeto as { id: string }).id;

  const { data: colunas, error: erroColunas } = await service
    .from("colunas_kanban")
    .insert(COLUNAS_CAFE_MANGUE.map((c) => ({ tenant_id: tenantIdLab, projeto_id: projetoId, ...c })))
    .select("id, nome");

  if (erroColunas || !colunas) {
    throw new Error(`Falha ao semear colunas do Lab: ${erroColunas?.message}`);
  }

  const colunaIdPorNome = new Map((colunas as { id: string; nome: string }[]).map((c) => [c.nome, c.id]));

  const { error: erroTarefas } = await service.from("tarefas").insert(
    TAREFAS_CAFE_MANGUE.map((t) => ({
      tenant_id: tenantIdLab,
      projeto_id: projetoId,
      titulo: t.titulo,
      coluna_id: colunaIdPorNome.get(t.coluna),
      prioridade: t.prioridade,
      is_marco: t.isMarco,
      data_limite: dataLimiteDoOffset(t.offsetDias),
    })),
  );

  if (erroTarefas) {
    throw new Error(`Falha ao semear tarefas do Lab: ${erroTarefas.message}`);
  }

  const { error: erroIndicadores } = await service
    .from("indicadores")
    .insert(INDICADORES_CAFE_MANGUE.map((i) => ({ tenant_id: tenantIdLab, projeto_id: projetoId, ...i })));

  if (erroIndicadores) {
    throw new Error(`Falha ao semear indicadores do Lab: ${erroIndicadores.message}`);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { error: erroDecisoes } = await service.from("decisoes").insert(
    DECISOES_CAFE_MANGUE.map((d) => ({
      tenant_id: tenantIdLab,
      projeto_id: projetoId,
      // Vincula à meta SMART do case desde o seed — antes ficava null mesmo
      // a meta existindo; a Fase A2 deixou esse vínculo visível no formulário
      // de decisão, então a decisão pré-semeada já deve aparecer conectada.
      meta_smart_id: (metaSmart as { id: string }).id,
      autor: userId,
      data: hoje,
      ...d,
    })),
  );

  if (erroDecisoes) {
    throw new Error(`Falha ao semear decisões do Lab: ${erroDecisoes.message}`);
  }

  return projetoId;
}

/** "Refazer o case": apaga o projeto Café Mangue + a meta SMART vinculada
 * (cascade cuida de colunas/tarefas/indicadores/decisões) e re-semeia do
 * zero. Nunca toca em patentes_usuario nem em lab_passos de outro módulo —
 * isso é responsabilidade de quem chama (ver refazerModuloLab em actions.ts). */
export async function refazerCafeMangue(tenantIdLab: string, userId: string): Promise<void> {
  const service = createServiceClient();

  const { data: projeto } = await service
    .from("projetos")
    .select("id, meta_smart_id")
    .eq("tenant_id", tenantIdLab)
    .eq("nome", NOME_PROJETO_CAFE_MANGUE)
    .maybeSingle();

  if (projeto) {
    const { id: projetoId, meta_smart_id: metaSmartId } = projeto as {
      id: string;
      meta_smart_id: string | null;
    };
    await service.from("projetos").delete().eq("id", projetoId);
    if (metaSmartId) {
      await service.from("metas_smart").delete().eq("id", metaSmartId);
    }
  }

  await semearCafeMangue(tenantIdLab, userId);
}
