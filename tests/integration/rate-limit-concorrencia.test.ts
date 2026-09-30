import { describe, it, expect, beforeAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Rate limit atômico sob concorrência e entre instâncias" — critério de
 * aceite do P0 (5.3/5). Chama `ia_registrar_tentativa` (migration 0046)
 * de verdade, via service role (único chamador legítimo — o EXECUTE é
 * revogado de anon/authenticated na própria migration), simulando
 * concorrência real com `Promise.all` — é exatamente o cenário que um
 * contador em memória erraria (2 processos/instâncias lendo "3 restantes"
 * ao mesmo tempo e os dois permitindo), e que só o lock de linha do
 * UPSERT no Postgres resolve corretamente.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("ia_registrar_tentativa — contagem atômica sob concorrência real", () => {
  let service: SupabaseClient;

  beforeAll(() => {
    service = clienteServico();
  });

  async function tentar(escopo: string, chave: string, janela: string, limite: number) {
    const { data, error } = await service.rpc("ia_registrar_tentativa", {
      p_escopo: escopo,
      p_chave: chave,
      p_janela: janela,
      p_limite: limite,
    });
    if (error) throw error;
    return data as boolean;
  }

  it("permite exatamente N tentativas e bloqueia a partir da N+1, mesmo todas em paralelo (sem contagem perdida nem dupla)", async () => {
    const chave = `usuario-concorrencia-${crypto.randomUUID()}`;
    const janela = new Date().toISOString();
    const limite = 5;

    // 10 tentativas disparadas ao mesmo tempo, limite 5 — o Postgres
    // serializa as escritas na mesma linha (lock), então o resultado tem
    // que ser EXATAMENTE 5 true e 5 false, nunca mais nem menos.
    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => tentar("usuario", chave, janela, limite)),
    );

    const permitidas = resultados.filter(Boolean).length;
    const bloqueadas = resultados.filter((r) => !r).length;

    expect(permitidas).toBe(5);
    expect(bloqueadas).toBe(5);

    // Confirma que a contagem real na tabela bate com o total de
    // tentativas (10) — prova que não houve "lost update" (duas
    // tentativas lendo o mesmo valor e uma sobrescrevendo o incremento da
    // outra, o que daria um número menor que 10).
    const { data: linha } = await service
      .from("ia_rate_limit")
      .select("contagem")
      .eq("escopo", "usuario")
      .eq("chave", chave)
      .eq("janela", janela)
      .single();
    expect(linha!.contagem).toBe(10);
  });

  it("janelas diferentes (chaves diferentes) não interferem uma na outra", async () => {
    const janela1 = new Date(Date.now()).toISOString();
    const janela2 = new Date(Date.now() + 60_000).toISOString();
    const chave = `usuario-janelas-${crypto.randomUUID()}`;

    const r1 = await tentar("usuario", chave, janela1, 1);
    const r2 = await tentar("usuario", chave, janela2, 1); // outra janela, mesmo limite — não deveria herdar o consumo da janela 1.

    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });

  it("escopos diferentes (usuario/workspace/global) são contados separadamente, mesmo com a mesma chave", async () => {
    const chaveComum = `chave-compartilhada-${crypto.randomUUID()}`;
    const janela = new Date().toISOString();

    const rUsuario = await tentar("usuario", chaveComum, janela, 1);
    const rWorkspace = await tentar("workspace", chaveComum, janela, 1);

    expect(rUsuario).toBe(true);
    expect(rWorkspace).toBe(true); // não é bloqueado pelo consumo do escopo 'usuario'.
  });

  it("EXECUTE da função é revogado de anon/authenticated (migration 0029-style revoke) — usuário comum não pode chamar direto", async () => {
    // Login como um usuário comum (não service role) e tenta chamar a RPC
    // direto — deve falhar por falta de permissão, não por erro de lógica.
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY ?? "");

    const email = `rate-limit-usuario-comum-${crypto.randomUUID()}@teste.gaiamum.invalid`;
    const senha = crypto.randomUUID();
    const { data: criado } = await service.auth.admin.createUser({ email, password: senha, email_confirm: true });
    await anon.auth.signInWithPassword({ email, password: senha });

    const { error } = await anon.rpc("ia_registrar_tentativa", {
      p_escopo: "global",
      p_chave: "tentativa-maliciosa",
      p_janela: new Date().toISOString(),
      p_limite: 999999,
    });

    expect(error).not.toBeNull(); // permission denied — RLS/GRANT bloqueia, não é "sempre permite".

    await service.auth.admin.deleteUser(criado!.user!.id);
  });
});
