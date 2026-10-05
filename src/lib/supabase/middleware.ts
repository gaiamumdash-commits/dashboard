import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_WORKSPACE_PREFERIDO, escolherMembership, type MembershipCandidata } from '@/lib/ecc/workspaces'

const HEADER_USUARIO = 'x-supabase-user'
const HEADER_MEMBERSHIP = 'x-gaiamum-membership'
const COOKIE_MEMBERSHIP = 'gaiamum-membership'
// 5min: janela de cache do workspace principal (tenantId/papel/escopo) —
// ver comentário mais abaixo pra raciocínio completo.
const MEMBERSHIP_MAX_AGE_S = 300

type MembershipCache = { tenantId: string; papel: string; escopo: string }

function membershipValida(valor: unknown): valor is MembershipCache {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as MembershipCache).tenantId === 'string' &&
    typeof (valor as MembershipCache).papel === 'string' &&
    typeof (valor as MembershipCache).escopo === 'string'
  )
}

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

  // Cache de 5min do workspace principal (tenantId/papel/escopo) num cookie
  // — medido (handoff, sessão #14) que cada consulta ao Supabase custa
  // ~300-500ms mesmo "quente", e toda página faz 1 dessas só pra achar o
  // tenant do usuário antes de buscar dado de verdade. Guardando aqui, a
  // navegação seguinte (dentro da janela de 5min) pula essa consulta
  // inteira — só reconsulta quando o cookie está ausente, expirado, ou é de
  // outro usuário (troca de conta no mesmo navegador, checado via user.id
  // dentro do valor cacheado).
  //
  // Segurança: isso é só uma dica pra decisão de UI/redirect no Next (ex.:
  // `/financeiro` só-owner) — nunca é a autorização de verdade. Toda
  // leitura/escrita real de dado passa por RLS no Postgres
  // (current_papel()/current_tenant_ids(), ver supabase/migrations), que lê
  // a membership real da tabela via auth.uid() do JWT já revalidado por
  // getUser() acima — nunca confia neste cookie. Pior caso de um valor
  // desatualizado (ou adulterado via devtools) aqui: a página mostra o
  // redirect/UI errado por até 5min; a query real ao banco continua
  // negando/retornando vazio pra quem não tem o papel de verdade.
  try {
    if (user) {
      const bruto = request.cookies.get(COOKIE_MEMBERSHIP)?.value
      // Workspace escolhido no seletor do menu (lib/ecc/workspaces.ts) —
      // se o cache de 5min aponta pra OUTRO workspace, ele é descartado na
      // hora (senão a troca demoraria até 5min pra valer).
      const tenantPreferido = request.cookies.get(COOKIE_WORKSPACE_PREFERIDO)?.value ?? null
      let membership: MembershipCache | null = null

      if (bruto) {
        try {
          const parseado = JSON.parse(bruto)
          if (
            parseado?.userId === user.id &&
            membershipValida(parseado) &&
            (!tenantPreferido || parseado.tenantId === tenantPreferido)
          ) {
            membership = { tenantId: parseado.tenantId, papel: parseado.papel, escopo: parseado.escopo }
          }
        } catch {
          membership = null
        }
      }

      if (!membership) {
        const [{ data: todas }, { data: lab }] = await Promise.all([
          supabase.from('memberships').select('tenant_id, papel, escopo, criado_em').eq('user_id', user.id),
          supabase.from('lab_tenants').select('tenant_id').eq('user_id', user.id),
        ])
        const data = escolherMembership(
          (todas as MembershipCandidata[] | null) ?? [],
          tenantPreferido,
          new Set(((lab as { tenant_id: string }[] | null) ?? []).map((l) => l.tenant_id)),
        )

        if (data) {
          membership = { tenantId: data.tenant_id as string, papel: data.papel as string, escopo: data.escopo as string }
          supabaseResponse.cookies.set(
            COOKIE_MEMBERSHIP,
            JSON.stringify({ userId: user.id, ...membership }),
            { maxAge: MEMBERSHIP_MAX_AGE_S, httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
          )
          // Preferência de um workspace do qual a pessoa saiu (ou foi
          // removida): apaga, senão o cache acima nunca bateria e esta
          // consulta rodaria em toda página.
          if (tenantPreferido && data.tenant_id !== tenantPreferido) {
            supabaseResponse.cookies.delete(COOKIE_WORKSPACE_PREFERIDO)
          }
        } else {
          supabaseResponse.cookies.delete(COOKIE_MEMBERSHIP)
        }
      }

      if (membership) {
        request.headers.set(HEADER_MEMBERSHIP, JSON.stringify(membership))
      } else {
        request.headers.delete(HEADER_MEMBERSHIP)
      }
    } else {
      request.headers.delete(HEADER_MEMBERSHIP)
      supabaseResponse.cookies.delete(COOKIE_MEMBERSHIP)
    }
  } catch {
    request.headers.delete(HEADER_MEMBERSHIP)
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
