"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CampoSenha } from "@/components/campo-senha";
import { ehErroDeSenhaCurta, MENSAGEM_SENHA_CURTA, TAMANHO_MINIMO_SENHA_NOVA } from "@/lib/senha";

/** Sem sessão aqui = o link do e-mail não foi validado (expirou, já foi
 * usado, ou é um link antigo aberto noutro navegador — ver
 * `src/app/auth/confirmar/route.ts`). Antes aparecia "Auth session missing!". */
const MENSAGEM_SEM_SESSAO =
  "Não conseguimos validar o link do e-mail (ele expira e só pode ser usado uma vez). Volte pra tela de entrada, clique em “Esqueci minha senha” e use o link do e-mail novo.";

export default function PaginaRedefinirSenha() {
  const router = useRouter();
  const supabase = createClient();

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (senha.length < TAMANHO_MINIMO_SENHA_NOVA) {
      setErro(MENSAGEM_SENHA_CURTA);
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    if (error) {
      setErro(
        ehErroDeSenhaCurta(error.message)
          ? MENSAGEM_SENHA_CURTA
          : /session missing/i.test(error.message)
            ? MENSAGEM_SEM_SESSAO
            : error.message,
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gaiamum-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-8">
        <h1 className="mb-1 text-2xl font-semibold text-gaiamum-text">Nova senha</h1>
        <p className="mb-6 text-sm text-gaiamum-text-muted">Escolha uma nova senha pro seu workspace.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Nova senha
            <CampoSenha value={senha} onChange={setSenha} autoComplete="new-password" minLength={TAMANHO_MINIMO_SENHA_NOVA} />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Confirmar senha
            <CampoSenha value={confirmacao} onChange={setConfirmacao} autoComplete="new-password" minLength={TAMANHO_MINIMO_SENHA_NOVA} />
          </label>

          {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
          {erro === MENSAGEM_SEM_SESSAO && (
            <Link href="/auth" className="text-sm text-gaiamum-primary underline">
              Voltar pra tela de entrada
            </Link>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 rounded-lg bg-gaiamum-primary px-4 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
          >
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
