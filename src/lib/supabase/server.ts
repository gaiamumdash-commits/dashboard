import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

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
export const obterUsuarioAtual = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
