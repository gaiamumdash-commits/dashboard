"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { iniciarLoginGoogle } from "@/lib/ecc/auth-google";

export default function PaginaAuth() {
  return (
    <Suspense>
      <FormularioAuth />
    </Suspense>
  );
}

function FormularioAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const supabase = createClient();

  const [modo, setModo] = useState<"login" | "cadastro" | "recuperacao">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setAviso(null);

    if (modo === "recuperacao") {
      setCarregando(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/redefinir-senha`,
      });
      setCarregando(false);

      if (error) {
        setErro(error.message);
        return;
      }

      setAviso("Enviamos um link de recuperação pro seu e-mail. Confira a caixa de entrada.");
      return;
    }

    setCarregando(true);

    const { error } =
      modo === "login"
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({ email, password: senha });

    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  async function handleGoogle() {
    setErro(null);
    setCarregando(true);
    // iniciarLoginGoogle() sempre redireciona (sucesso ou erro tratado lá
    // dentro) — não há um caminho de retorno normal aqui.
    await iniciarLoginGoogle();
  }

  return (
    <main className="relative min-h-screen bg-gaiamum-bg lg:flex">
      {/* Arte mobile: fundo cheio, versão vertical sem os mockups (densos
          demais numa tela estreita), com espaço vazio na parte de baixo pro
          cartão flutuar sem brigar com o texto. object-cover cabe bem em
          proporções de celular (mais estreitas que a arte); em tablet
          retrato (mais "quadrado") ele esticava demais e cortava o texto
          do meio, então a partir de md usamos contain. */}
      <div className="absolute inset-0 bg-gaiamum-bg lg:hidden">
        <Image
          src="/brand/login-hero-mobile.png"
          alt="Gaiamum Dashboard: organize, decida, cresça"
          fill
          sizes="100vw"
          className="object-cover object-top md:object-contain md:object-center"
          priority
        />
      </div>

      {/* Arte desktop: metade esquerda da tela, só em telas largas (lg+).
          lg:h-screen explícito porque <Image fill> precisa de um ancestral
          com altura definida — não depender só do stretch do flex. */}
      <div className="relative hidden bg-gaiamum-bg lg:block lg:h-screen lg:w-1/2">
        <Image
          src="/brand/login-hero.png"
          alt="Gaiamum Dashboard: organize, decida, cresça"
          fill
          sizes="50vw"
          className="object-contain object-left"
          priority
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-4 pb-10 pt-4 lg:h-screen lg:w-1/2 lg:flex-row lg:items-center lg:justify-center lg:py-12">
        {/* Empurra o cartão pra baixo do texto da arte (que termina em ~46%
            da altura da imagem) antes de deixá-lo flutuar na reserva vazia
            do fundo. Sem isso, em celulares mais baixos o cartão cobria
            "Cresça." — min-height garante a folga mínima, flex-1 deixa ele
            crescer e empurrar o cartão pro fim quando sobra espaço. */}
        <div className="min-h-[48vh] flex-1 lg:hidden" aria-hidden />
        <div className="w-full max-w-sm rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-8">
        <Image src="/brand/crab-mark.png" alt="" width={56} height={56} className="mb-3" priority />
        <h1 className="mb-1 text-2xl font-semibold text-gaiamum-text">Gaiamum</h1>
        <p className="mb-6 text-sm text-gaiamum-text-muted">
          {modo === "login" && "Entre no seu Command Center."}
          {modo === "cadastro" && "Crie seu workspace."}
          {modo === "recuperacao" && "Informa seu e-mail que mandamos um link pra redefinir a senha."}
        </p>

        {modo !== "recuperacao" && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={carregando}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-4 py-2 font-medium text-gaiamum-text transition hover:border-gaiamum-primary disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Entrar com Google
            </button>

            <div className="mb-4 flex items-center gap-3 text-xs text-gaiamum-text-muted">
              <span className="h-px flex-1 bg-gaiamum-border" />
              ou
              <span className="h-px flex-1 bg-gaiamum-border" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
          </label>

          {modo !== "recuperacao" && (
            <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
              Senha
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>
          )}

          {modo === "login" && (
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setAviso(null);
                setModo("recuperacao");
              }}
              className="-mt-2 self-end text-xs text-gaiamum-text-muted underline underline-offset-2 hover:text-gaiamum-text"
            >
              Esqueci minha senha
            </button>
          )}

          {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
          {aviso && <p className="text-sm text-gaiamum-success">{aviso}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 rounded-lg bg-gaiamum-primary px-4 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
          >
            {carregando
              ? "Aguarde..."
              : modo === "login"
                ? "Entrar"
                : modo === "cadastro"
                  ? "Criar conta"
                  : "Enviar link de recuperação"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setErro(null);
            setAviso(null);
            setModo(modo === "login" ? "cadastro" : "login");
          }}
          className="mt-4 text-sm text-gaiamum-text-muted underline underline-offset-2 hover:text-gaiamum-text"
        >
          {modo === "cadastro" ? "Já tem conta? Entre" : "Ainda não tem conta? Cadastre-se"}
        </button>
        </div>
      </div>
    </main>
  );
}
