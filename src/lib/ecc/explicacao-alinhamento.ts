"use server";

import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { listarIndicadoresDoProjeto } from "@/lib/ecc/indicadores";
import { alinhamentoTemDadosReais, calcularAlinhamentoGaiamum } from "@/lib/ecc/visao-360";
import { gerarTextoComGemini, mensagemDeErroGemini } from "@/lib/ecc/gemini";
import { concederPatente } from "@/lib/ecc/lab/patentes";
import type { ColunaKanban, Projeto, Tarefa } from "@/lib/ecc/tipos";

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace gera explicação de IA.");
  }
}

function montarPrompt(projeto: Projeto, alinhamento: ReturnType<typeof calcularAlinhamentoGaiamum>): string {
  const linhasFatores = alinhamento.fatores
    .map((f) =>
      f.valor === null
        ? `- ${f.rotulo}: sem dado, não considerado (${f.descricao})`
        : `- ${f.rotulo}: ${f.valor}% (peso ${f.pesoEfetivo}% no score, ${f.descricao})`,
    )
    .join("\n");

  return `Você é um consultor que ajuda a interpretar o desempenho de um projeto dentro do produto Gaiamum.

Projeto: ${projeto.nome}
Resultado esperado: ${projeto.resultado_esperado ?? "não definido"}

Score de Alinhamento Gaiamum (0-100, calculado por fórmula determinística, não por você): ${alinhamento.score}%

Fatores que compõem o score:
${linhasFatores}

Escreva uma explicação curta (3 a 5 frases, em português) interpretando o que esses números dizem sobre o alinhamento do projeto com o resultado esperado — destaque o que está puxando o score pra cima ou pra baixo, e dê uma sugestão prática de próximo passo.

Regras inegociáveis: use só as informações acima, nunca invente dado que não foi dado; nunca prometa um resultado que os números não sustentam (ex.: "vai bater a meta"); tom direto, sem enrolação, sem markdown.`;
}

export type ResultadoExplicacaoAlinhamento = { texto: string; erro: null } | { texto: null; erro: string };

/** Devolve `{erro}` em vez de lançar exceção — Next.js redige a mensagem de
 * erros lançados em Server Actions nos builds de produção (achado real,
 * confirmado em teste manual: um `throw` aqui virava "An error occurred in
 * the Server Components render" genérico pro usuário). Erro esperado (owner,
 * projeto sem dados) também segue o mesmo formato, por simplicidade — o
 * client trata os dois casos do mesmo jeito. */
export async function gerarExplicacaoAlinhamento(projetoId: string): Promise<ResultadoExplicacaoAlinhamento> {
  try {
    const tenantId = await garantirWorkspace();
    await exigirOwner(tenantId);
    const supabase = await createClient();

    const { data: projeto } = await supabase
      .from("projetos")
      .select("*")
      .eq("id", projetoId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!projeto) {
      return { texto: null, erro: "Projeto não encontrado." };
    }

    const projetoTipado = projeto as Projeto;

    const [{ data: colunas }, { data: tarefas }, indicadores] = await Promise.all([
      supabase.from("colunas_kanban").select("*").eq("projeto_id", projetoId),
      supabase.from("tarefas").select("*").eq("projeto_id", projetoId),
      listarIndicadoresDoProjeto(projetoId),
    ]);

    const listaColunas = (colunas as ColunaKanban[]) ?? [];
    const listaTarefas = (tarefas as Tarefa[]) ?? [];
    const colunasConcluidoIds = new Set(listaColunas.filter((c) => c.concluido).map((c) => c.id));

    const alinhamento = calcularAlinhamentoGaiamum({
      metaSmartId: projetoTipado.meta_smart_id,
      tarefas: listaTarefas,
      colunasConcluidoIds,
      indicadores,
    });

    if (!alinhamentoTemDadosReais(alinhamento)) {
      return { texto: null, erro: "Ainda não há dados suficientes no projeto para gerar uma explicação." };
    }

    const prompt = montarPrompt(projetoTipado, alinhamento);
    const texto = await gerarTextoComGemini(prompt);

    // Patente Master: primeira análise de IA real gerada com sucesso. Sem
    // checagem extra "isso não é o projeto do Café Mangue": `tenantId` acima
    // vem de garantirWorkspace() (sempre a membership mais antiga do
    // usuário) — o tenant do Lab é garantidamente mais novo, então o
    // `.eq("tenant_id", tenantId)` na busca do projeto acima nunca encontra
    // o Café Mangue por essa function (ver mesmo raciocínio em
    // projetos/[id]/visao-360/page.tsx).
    const user = await obterUsuarioAtual();
    if (user) {
      try {
        await concederPatente(user.id, "master", { projetoId });
      } catch {
        // nunca quebra a explicação em si por causa disso
      }
    }

    return { texto, erro: null };
  } catch (erro) {
    return { texto: null, erro: mensagemDeErroGemini(erro) };
  }
}
