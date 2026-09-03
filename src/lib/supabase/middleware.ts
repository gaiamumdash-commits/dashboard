import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const HEADER_USUARIO = 'x-supabase-user'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Nunca confia num x-supabase-user vindo do cliente: getUser() já revalidou
  // o token com o servidor do Supabase, então este é o único lugar autorizado
  // a escrever esse header. Sem usuário válido, apaga explicitamente — do
  // contrário um cliente malicioso poderia mandar o próprio x-supabase-user
  // tentando se passar por alguém logado (mesmo cuidado já documentado pro
  // x-request-id em src/proxy.ts).
  try {
    if (user) {
      request.headers.set(HEADER_USUARIO, JSON.stringify({ id: user.id, email: user.email }))
    } else {
      request.headers.delete(HEADER_USUARIO)
    }
  } catch {
    request.headers.delete(HEADER_USUARIO)
  }

  // Reconstrução final OBRIGATÓRIA depois do set/delete acima:
  // NextResponse.next({request}) tira um snapshot síncrono de
  // request.headers no momento da chamada — mutar depois não propaga
  // sozinho. headers: supabaseResponse.headers preserva o(s) Set-Cookie de
  // renovação de sessão que setAll() já tenha aplicado acima.
  return NextResponse.next({
    request,
    headers: supabaseResponse.headers,
  })
}
