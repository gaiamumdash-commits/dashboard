import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { CodigoPatente } from "@/lib/ecc/lab/patentes";
import { ORDEM_PATENTES } from "@/lib/ecc/lab/patentes";
import type { PassoLab } from "@/lib/ecc/lab/progresso";

/** Consultas cross-tenant pro painel de analítica restrito ao dono do SaaS
 * (`souDonoDoSaas()`) — sempre via `createServiceClient()`, nunca RLS, já
 * que aqui a leitura é sobre todos os usuários, não "o próprio". Volume
 * esperado baixo nesta fase de validação: agregação feita em memória, sem
 * RPC/view SQL nova — mesmo estilo já usado em `calcularAlinhamentoGaiamum`. */

// Este painel cobre só o módulo núcleo (`modulo: "nucleo"`, filtrado nas
// queries abaixo) — a Fase A2 ampliou PassoLab com passos de outro módulo
// ("criar_decisao"/"atualizar_indicador"), então o tipo aqui é estreitado de
// propósito: misturar funis de módulos diferentes no mesmo painel confundiria
// mais do que ajudaria.
type PassoNucleo = Extract<PassoLab, "explorar_quadro" | "concluir">;

const ROTULO_PASSO: Record<PassoNucleo, string> = {
  explorar_quadro: "Explorou o quadro",
  concluir: "Concluiu o Lab (virou Explorador)",
};

const ORDEM_PASSOS: PassoNucleo[] = ["explorar_quadro", "concluir"];

const LIMITE_INATIVIDADE_MS = 48 * 60 * 60 * 1000;

export type FunilLab = {
  totalEntraram: number;
  nuncaComecaram: number;
  porPasso: { passo: PassoNucleo; rotulo: string; concluiram: number }[];
};

export async function obterFunilLab(): Promise<FunilLab> {
  const service = createServiceClient();

  const [{ data: tenants }, { data: passos }] = await Promise.all([
    service.from("lab_tenants").select("user_id"),
    service.from("lab_passos").select("user_id, passo").eq("modulo", "nucleo"),
  ]);

  const totalEntraram = (tenants ?? []).length;
  const linhasPassos = (passos as { user_id: string; passo: PassoNucleo }[] | null) ?? [];

  const usuariosComAlgumPasso = new Set(linhasPassos.map((p) => p.user_id));

  const porPasso = ORDEM_PASSOS.map((passo) => ({
    passo,
    rotulo: ROTULO_PASSO[passo],
    concluiram: new Set(linhasPassos.filter((p) => p.passo === passo).map((p) => p.user_id)).size,
  }));

  return {
    totalEntraram,
    nuncaComecaram: totalEntraram - usuariosComAlgumPasso.size,
    porPasso,
  };
}

export type PatenteComUsuario = {
  userId: string;
  email: string | null;
  codigo: CodigoPatente;
  conquistadaEm: string;
};

export type DistribuicaoPatentes = {
  porCodigo: Record<CodigoPatente, number>;
  usuarios: PatenteComUsuario[];
};

export async function obterDistribuicaoPatentes(): Promise<DistribuicaoPatentes> {
  const service = createServiceClient();

  const { data: patentes } = await service
    .from("patentes_usuario")
    .select("user_id, codigo, conquistada_em")
    .order("conquistada_em", { ascending: false });

  const linhas = (patentes as { user_id: string; codigo: CodigoPatente; conquistada_em: string }[] | null) ?? [];

  const idsUnicos = [...new Set(linhas.map((p) => p.user_id))];
  const emails = await Promise.all(
    idsUnicos.map(async (userId) => {
      const { data } = await service.auth.admin.getUserById(userId);
      return [userId, data?.user?.email ?? null] as const;
    }),
  );
  const mapaEmail = new Map(emails);

  const porCodigo = Object.fromEntries(ORDEM_PATENTES.map((c) => [c, 0])) as Record<CodigoPatente, number>;
  for (const linha of linhas) {
    porCodigo[linha.codigo]++;
  }

  return {
    porCodigo,
    usuarios: linhas.map((p) => ({
      userId: p.user_id,
      email: mapaEmail.get(p.user_id) ?? null,
      codigo: p.codigo,
      conquistadaEm: p.conquistada_em,
    })),
  };
}

export type UsuarioEmRisco = {
  userId: string;
  tenantId: string;
  email: string | null;
  entrouEm: string;
  ultimaAtividade: string;
  reengajamentoJaEnviado: boolean;
};

/** Usada tanto pelo painel quanto pelo cron de reengajamento. Cobre os 2
 * casos de "48h sem atividade": nunca completou nenhum passo (usa
 * `lab_tenants.criado_em` como referência) e completou algum passo mas
 * parou (usa o `concluido_em` mais recente). */
export async function listarUsuariosEmRiscoDeEvasao(): Promise<UsuarioEmRisco[]> {
  const service = createServiceClient();
  const agora = Date.now();

  const [{ data: exploradores }, { data: tenants }, { data: passos }] = await Promise.all([
    service.from("patentes_usuario").select("user_id").eq("codigo", "explorador"),
    service.from("lab_tenants").select("user_id, tenant_id, criado_em, reengajamento_enviado_em"),
    service.from("lab_passos").select("user_id, concluido_em").eq("modulo", "nucleo"),
  ]);

  const idsExploradores = new Set((exploradores ?? []).map((p) => p.user_id as string));

  const ultimaAtividadePorUsuario = new Map<string, string>();
  for (const p of (passos as { user_id: string; concluido_em: string }[] | null) ?? []) {
    const atual = ultimaAtividadePorUsuario.get(p.user_id);
    if (!atual || new Date(p.concluido_em) > new Date(atual)) {
      ultimaAtividadePorUsuario.set(p.user_id, p.concluido_em);
    }
  }

  const linhasTenants =
    (tenants as
      | { user_id: string; tenant_id: string; criado_em: string; reengajamento_enviado_em: string | null }[]
      | null) ?? [];

  const candidatos = linhasTenants.filter((t) => !idsExploradores.has(t.user_id));

  const emails = await Promise.all(
    candidatos.map(async (t) => {
      const { data } = await service.auth.admin.getUserById(t.user_id);
      return data?.user?.email ?? null;
    }),
  );

  return candidatos
    .map((t, i) => {
      const ultimaAtividade = ultimaAtividadePorUsuario.get(t.user_id) ?? t.criado_em;
      return {
        userId: t.user_id,
        tenantId: t.tenant_id,
        email: emails[i],
        entrouEm: t.criado_em,
        ultimaAtividade,
        reengajamentoJaEnviado: Boolean(t.reengajamento_enviado_em),
      };
    })
    .filter((u) => agora - new Date(u.ultimaAtividade).getTime() >= LIMITE_INATIVIDADE_MS);
}

export type LinhaLogConsumoIA = {
  id: string;
  criadoEm: string;
  provedor: string;
  modelo: string;
  sucesso: boolean;
  erro: string | null;
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
};

export type LogConsumoIA = {
  registros: LinhaLogConsumoIA[];
  totais: { chamadas: number; sucesso: number; falha: number; tokensTotais: number };
};

export async function obterLogConsumoIA(limite = 50): Promise<LogConsumoIA> {
  const service = createServiceClient();

  const [{ data: recentes }, { data: todos }] = await Promise.all([
    service
      .from("ia_consumo_log")
      .select("id, criado_em, provedor, modelo, sucesso, erro, prompt_tokens, candidates_tokens, total_tokens")
      .order("criado_em", { ascending: false })
      .limit(limite),
    service.from("ia_consumo_log").select("sucesso, total_tokens"),
  ]);

  type LinhaBruta = {
    id: string;
    criado_em: string;
    provedor: string;
    modelo: string;
    sucesso: boolean;
    erro: string | null;
    prompt_tokens: number | null;
    candidates_tokens: number | null;
    total_tokens: number | null;
  };

  const registros = ((recentes as LinhaBruta[] | null) ?? []).map((r) => ({
    id: r.id,
    criadoEm: r.criado_em,
    provedor: r.provedor,
    modelo: r.modelo,
    sucesso: r.sucesso,
    erro: r.erro,
    promptTokens: r.prompt_tokens,
    candidatesTokens: r.candidates_tokens,
    totalTokens: r.total_tokens,
  }));

  const linhasTotais = (todos as { sucesso: boolean; total_tokens: number | null }[] | null) ?? [];

  return {
    registros,
    totais: {
      chamadas: linhasTotais.length,
      sucesso: linhasTotais.filter((l) => l.sucesso).length,
      falha: linhasTotais.filter((l) => !l.sucesso).length,
      tokensTotais: linhasTotais.reduce((soma, l) => soma + (l.total_tokens ?? 0), 0),
    },
  };
}
