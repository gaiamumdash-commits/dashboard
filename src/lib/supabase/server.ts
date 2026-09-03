import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

const HEADER_USUARIO = 'x-supabase-user'

export type UsuarioAtual = { id: string; email?: string }

function usuarioValido(valor: unknown): valor is UsuarioAtual {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as { id?: unknown }).id === 'string' &&
    ((valor as { email?: unknown }).email === undefined ||
      typeof (valor as { email?: unknown }).email === 'string')
  )
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // set() chamado a partir de um Server Component — ignorado
            // porque o proxy.ts já cuida de renovar a sessão a cada request.
          }
        },
      },
    }
  )
}

// auth.getUser() sempre revalida o token com o servidor do Supabase (por
// segurança, ao contrário de getSession() que só lê o cookie) — cada
// chamada é uma volta de rede real. Várias funções independentes numa
// mesma página (garantirWorkspace, obterMembershipAtual, a própria page.tsx)
// chamavam isso separadamente, empilhando latência sequencial. cache() do
// React memoiza por request, então todas essas chamadas na mesma renderização
// viram uma volta de rede só.
//
// O proxy.ts (src/proxy.ts -> src/lib/supabase/middleware.ts) já validou a
// sessão com esse mesmo getUser() antes da página renderizar, e deixou o
// resultado no header x-supabase-user — ler esse header aqui evita pagar o
// MESMO round-trip de novo (middleware e render de página são execuções
// separadas no Next.js, o cache() acima nunca cobriu as duas juntas).
//
// Fallback pro getUser() real não é só defensivo: cobre header ausente,
// malformado, ou qualquer requisição que não passou pelo proxy (ex.: um
// matcher mais restrito no futuro, ou chamada fora do ciclo request/response
// do Next) — nunca confia cegamente na ausência do header.
export const obterUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const cabecalhos = await headers()
  const bruto = cabecalhos.get(HEADER_USUARIO)

  if (bruto) {
    try {
      const parseado = JSON.parse(bruto)
      if (usuarioValido(parseado)) {
        return { id: parseado.id, email: parseado.email }
      }
    } catch {
      // header malformado — não confia, cai pro fallback abaixo
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email }
})
